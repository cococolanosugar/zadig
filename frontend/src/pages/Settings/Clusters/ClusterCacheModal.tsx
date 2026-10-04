import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Radio,
  Select,
  Input,
  InputNumber,
  Space,
  Typography,
  Alert,
  Spin,
} from 'antd';
import { DatabaseOutlined, CloudServerOutlined } from '@ant-design/icons';
import {
  settingsApi,
  type ClusterItem,
  type ClusterCacheConfig,
  type StorageItem,
} from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

interface ClusterCacheModalProps {
  open: boolean;
  onClose: () => void;
  cluster: ClusterItem | null;
  onSuccess?: () => void;
}

export const ClusterCacheModal: React.FC<ClusterCacheModalProps> = ({
  open,
  onClose,
  cluster,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingStorages, setLoadingStorages] = useState<boolean>(false);
  const [storageList, setStorageList] = useState<StorageItem[]>([]);

  const mediumType = Form.useWatch('medium_type', form);
  const provisionType = Form.useWatch('provision_type', form);

  useEffect(() => {
    if (open && cluster) {
      // Load Object Storage list
      setLoadingStorages(true);
      settingsApi
        .getStorages()
        .then((list: StorageItem[]) => setStorageList(list))
        .catch(() => setStorageList([]))
        .finally(() => setLoadingStorages(false));

      // Populate form
      const cache = cluster.cache;
      const mType = cache?.medium_type || 'object';
      const nfs = cache?.nfs_properties;
      form.setFieldsValue({
        medium_type: mType,
        object_id: cache?.object_properties?.id || undefined,
        provision_type: nfs?.provision_type || 'dynamic',
        storage_class: nfs?.storage_class || '',
        storage_size_in_gib: nfs?.storage_size_in_gib || 10,
        pvc: nfs?.pvc || '',
      });
    }
  }, [open, cluster, form]);

  const handleSave = async () => {
    if (!cluster) return;
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload: ClusterCacheConfig = {
        medium_type: values.medium_type,
        object_properties: {
          id: values.medium_type === 'object' ? values.object_id || '' : '',
        },
        nfs_properties: {
          provision_type: values.medium_type === 'nfs' ? values.provision_type : '',
          storage_class:
            values.medium_type === 'nfs' && values.provision_type === 'dynamic'
              ? values.storage_class || ''
              : '',
          storage_size_in_gib:
            values.medium_type === 'nfs' && values.provision_type === 'dynamic'
              ? Number(values.storage_size_in_gib) || 0
              : 0,
          pvc:
            values.medium_type === 'nfs' && values.provision_type === 'static'
              ? values.pvc || ''
              : '',
        },
      };

      await settingsApi.updateClusterCache(cluster.id, payload);
      feedback.message.success('缓存资源配置更新成功');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      if (err?.errorFields) return;
      feedback.message.error(err?.response?.data?.message || err?.message || '更新缓存配置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <span>缓存资源配置</span>
          {cluster && <Text type="secondary">({cluster.name})</Text>}
        </Space>
      }
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={saving}
      okText="保存配置"
      cancelText="取消"
      width={560}
      destroyOnHidden
    >
      <Alert
        title="调度到当前集群的工作流任务将会使用指定存储介质进行缓存加速。"
        type="info"
        showIcon
        style={{ marginTop: 12, marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          medium_type: 'object',
          provision_type: 'dynamic',
          storage_size_in_gib: 10,
        }}
      >
        <Form.Item
          name="medium_type"
          label="存储介质"
          rules={[{ required: true, message: '请选择存储介质' }]}
        >
          <Radio.Group>
            <Radio value="object">
              <Space>
                <CloudServerOutlined />
                <span>对象存储 (Object Storage)</span>
              </Space>
            </Radio>
            <Radio value="nfs">
              <Space>
                <DatabaseOutlined />
                <span>集群存储 (Cluster Storage / NFS)</span>
              </Space>
            </Radio>
          </Radio.Group>
        </Form.Item>

        {mediumType === 'object' && (
          <Spin spinning={loadingStorages}>
            <Form.Item
              name="object_id"
              label="指定对象存储"
              rules={[{ required: true, message: '请选择对象存储' }]}
              extra="请选择已在系统设置中集成的 S3 / OSS / COS 等对象存储实例。"
            >
              <Select
                placeholder="请选择对象存储"
                options={storageList.map((s) => ({
                  label: `${s.name || s.bucket || s.endpoint} (${s.bucket || s.endpoint})`,
                  value: s.id,
                }))}
              />
            </Form.Item>
          </Spin>
        )}

        {mediumType === 'nfs' && (
          <>
            <Form.Item
              name="provision_type"
              label="存储资源分配方式"
              rules={[{ required: true, message: '请选择资源分配方式' }]}
            >
              <Radio.Group>
                <Radio value="dynamic">动态生成资源 (Dynamic Provisioning)</Radio>
                <Radio value="static">已有存储资源 (Static PVC)</Radio>
              </Radio.Group>
            </Form.Item>

            {provisionType === 'dynamic' ? (
              <>
                <Form.Item
                  name="storage_class"
                  label="存储类 (StorageClass)"
                  rules={[{ required: true, message: '请输入 StorageClass 名称' }]}
                  extra="集群中需预先部署具备动态卷创建能力的 CSI 插件，并支持 ReadWriteMany (RWX)。"
                >
                  <Input placeholder="例如: nfs-client 或 alicloud-nas" />
                </Form.Item>

                <Form.Item
                  name="storage_size_in_gib"
                  label="存储容量配额"
                  rules={[{ required: true, message: '请输入存储容量' }]}
                >
                  <InputNumber min={1} max={10240} suffix="GiB" style={{ width: 160 }} />
                </Form.Item>
              </>
            ) : (
              <Form.Item
                name="pvc"
                label="已有持久化存储卷 (PVC)"
                rules={[{ required: true, message: '请输入 PVC 名称' }]}
                extra="必须是集群中处于 Bound 状态且访问模式为 ReadWriteMany (RWX) 的持久卷声明。"
              >
                <Input placeholder="输入集群内已有 PVC 名称" />
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default ClusterCacheModal;
