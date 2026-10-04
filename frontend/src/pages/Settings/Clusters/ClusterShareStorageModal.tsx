import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Switch,
  Radio,
  Input,
  InputNumber,
  Space,
  Typography,
  Alert,
  Tag,
  Spin,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  type ClusterItem,
  type ClusterShareStorageConfig,
} from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

interface ClusterShareStorageModalProps {
  open: boolean;
  onClose: () => void;
  cluster: ClusterItem | null;
  onSuccess?: () => void;
}

export const ClusterShareStorageModal: React.FC<ClusterShareStorageModalProps> = ({
  open,
  onClose,
  cluster,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [isEnabledInWorkflow, setIsEnabledInWorkflow] = useState<boolean | null>(null);

  const enabled = Form.useWatch('enabled', form);
  const provisionType = Form.useWatch('provision_type', form);

  useEffect(() => {
    if (open && cluster) {
      setChecking(true);
      settingsApi
        .checkClusterShareStorageEnabled(cluster.id)
        .then((res) => setIsEnabledInWorkflow(res))
        .catch(() => setIsEnabledInWorkflow(false))
        .finally(() => setChecking(false));

      const storage = cluster.share_storage;
      const hasStorage = Boolean(storage?.medium_type && storage.medium_type !== '');
      const nfs = storage?.nfs_properties;

      form.setFieldsValue({
        enabled: hasStorage,
        provision_type: nfs?.provision_type || 'dynamic',
        storage_class: nfs?.storage_class || '',
        storage_size_in_gib: nfs?.storage_size_in_gib || 20,
        pvc: nfs?.pvc || '',
      });
    } else {
      setIsEnabledInWorkflow(null);
    }
  }, [open, cluster, form]);

  const handleSave = async () => {
    if (!cluster) return;
    try {
      const values = await form.validateFields();
      setSaving(true);

      const isEnabled = Boolean(values.enabled);
      const payload: ClusterShareStorageConfig = {
        medium_type: isEnabled ? 'nfs' : '',
        nfs_properties: {
          provision_type: isEnabled ? values.provision_type : '',
          storage_class:
            isEnabled && values.provision_type === 'dynamic' ? values.storage_class || '' : '',
          storage_size_in_gib:
            isEnabled && values.provision_type === 'dynamic'
              ? Number(values.storage_size_in_gib) || 0
              : 0,
          pvc: isEnabled && values.provision_type === 'static' ? values.pvc || '' : '',
        },
      };

      await settingsApi.updateClusterShareStorage(cluster.id, payload);
      feedback.message.success('共享存储配置更新成功');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      if (err?.errorFields) return;
      feedback.message.error(err?.response?.data?.message || err?.message || '更新共享存储配置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <span>共享存储资源配置</span>
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
        title="调度到当前集群的工作流任务将会使用指定存储资源进行跨步骤/跨任务共享存储。"
        type="info"
        showIcon
        style={{ marginTop: 12, marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <Text strong>工作流引擎共享存储可用性：</Text>
          <Spin spinning={checking} size="small">
            {isEnabledInWorkflow ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                已生效就绪 (Ready)
              </Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">
                未启用或未绑定
              </Tag>
            )}
          </Spin>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: false,
          provision_type: 'dynamic',
          storage_size_in_gib: 20,
        }}
      >
        <Form.Item
          name="enabled"
          label="开启共享存储"
          valuePropName="checked"
          extra="开启后，多步骤工作流可跨任务共享产物目录、源码工作区与中间文件。"
        >
          <Switch />
        </Form.Item>

        {enabled && (
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
                  extra="集群中需支持动态卷创建，并且底层存储需支持多节点同时读写 ReadWriteMany (RWX)。"
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
                extra="需填入当前集群中访问模式为 ReadWriteMany (RWX) 的持久卷声明名称。"
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

export default ClusterShareStorageModal;
