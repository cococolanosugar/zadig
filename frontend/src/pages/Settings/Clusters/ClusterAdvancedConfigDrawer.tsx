import React, { useEffect, useState } from 'react';
import {
  App,
  Drawer,
  Collapse,
  Form,
  InputNumber,
  Select,
  Radio,
  Button,
  Space,
  Typography,
  Divider,
} from 'antd';
import {
  ScheduleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  type ClusterItem,
  type DindCfg,
} from '../../../api/settings';
import { ClusterStrategyDrawer } from './ClusterStrategyDrawer';
import { ClusterCacheModal } from './ClusterCacheModal';
import { ClusterShareStorageModal } from './ClusterShareStorageModal';

const { Text } = Typography;

export interface ClusterAdvancedConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  cluster: ClusterItem | null;
  onSuccess?: () => void;
}

/**
 * 四大高级配置整合抽屉：调度策略 / 缓存资源 / 共享存储 / DinD
 */
export const ClusterAdvancedConfigDrawer: React.FC<ClusterAdvancedConfigDrawerProps> = ({
  open,
  onClose,
  cluster,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [dindForm] = Form.useForm();
  const [savingDind, setSavingDind] = useState(false);
  const [storageClasses, setStorageClasses] = useState<string[]>([]);
  const [loadingSc, setLoadingSc] = useState(false);

  const [strategyOpen, setStrategyOpen] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const storageType = Form.useWatch('storage_type', dindForm);

  useEffect(() => {
    if (!open || !cluster) return;
    const cfg = cluster.dind_cfg;
    dindForm.setFieldsValue({
      replicas: cfg?.replicas ?? 1,
      cpu: cfg?.resources?.limits?.cpu ?? 1000,
      memory: cfg?.resources?.limits?.memory ?? 2048,
      storage_type: cfg?.storage?.type || 'rootfs',
      storage_class: cfg?.storage?.storage_class || undefined,
      storage_size_in_gib: cfg?.storage?.storage_size_in_gib || 20,
      storage_driver: cfg?.storage_driver || 'overlay2',
    });
  }, [open, cluster, dindForm]);

  useEffect(() => {
    if (!open || !cluster || storageType !== 'dynamic') return;
    setLoadingSc(true);
    settingsApi
      .getClusterStorageClasses(cluster.id)
      .then((list) => setStorageClasses(list))
      .catch(() => setStorageClasses([]))
      .finally(() => setLoadingSc(false));
  }, [open, cluster, storageType]);

  const handleSaveDind = async () => {
    if (!cluster) return;
    try {
      const values = await dindForm.validateFields();
      setSavingDind(true);
      const payload: DindCfg = {
        replicas: Number(values.replicas) || 0,
        resources: {
          limits: {
            cpu: Number(values.cpu) || 0,
            memory: Number(values.memory) || 0,
          },
        },
        storage: {
          type: values.storage_type,
          storage_class:
            values.storage_type === 'dynamic' ? values.storage_class || '' : undefined,
          storage_size_in_gib:
            values.storage_type === 'dynamic'
              ? Number(values.storage_size_in_gib) || 0
              : undefined,
        },
        storage_driver: values.storage_driver || 'overlay2',
      };
      await settingsApi.updateClusterDind(cluster.id, payload);
      message.success('DinD 资源配置已保存');
      onSuccess?.();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '保存 DinD 配置失败';
      message.error(msg);
    } finally {
      setSavingDind(false);
    }
  };

  return (
    <>
      <Drawer
        title={`高级配置 — ${cluster?.name || ''}`}
        open={open}
        onClose={onClose}
        size="large"
        destroyOnHidden
      >
        <Collapse
          defaultActiveKey={['strategy', 'cache', 'share', 'dind']}
          items={[
            {
              key: 'strategy',
              label: (
                <Space>
                  <ScheduleOutlined />
                  调度策略
                </Space>
              ),
              children: (
                <div>
                  <Text type="secondary">
                    管理节点调度策略（随机 / 强制 / 优先），节点标签使用 key:value 格式。
                  </Text>
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" onClick={() => setStrategyOpen(true)}>
                      打开调度策略管理
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              key: 'cache',
              label: (
                <Space>
                  <DatabaseOutlined />
                  缓存资源配置
                </Space>
              ),
              children: (
                <div>
                  <Text type="secondary">配置构建缓存介质（对象存储 / NFS）。</Text>
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" onClick={() => setCacheOpen(true)}>
                      配置缓存资源
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              key: 'share',
              label: (
                <Space>
                  <CloudServerOutlined />
                  共享存储配置
                </Space>
              ),
              children: (
                <div>
                  <Text type="secondary">为工作流任务配置跨 Job 共享存储（NFS）。</Text>
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" onClick={() => setShareOpen(true)}>
                      配置共享存储
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              key: 'dind',
              label: (
                <Space>
                  <BuildOutlined />
                  DinD 资源配置
                </Space>
              ),
              children: (
                <Form form={dindForm} layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item
                    name="replicas"
                    label="副本数"
                    rules={[{ required: true, message: '请选择副本数' }]}
                    extra="0 表示不部署 DinD；1 表示启用单副本"
                  >
                    <Radio.Group
                      options={[
                        { label: '0（关闭）', value: 0 },
                        { label: '1（启用）', value: 1 },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="cpu" label="CPU 限制 (m)" rules={[{ required: true }]}>
                    <InputNumber min={100} step={100} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="memory" label="内存限制 (Mi)" rules={[{ required: true }]}>
                    <InputNumber min={256} step={256} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name="storage_type"
                    label="存储介质"
                    rules={[{ required: true, message: '请选择存储介质' }]}
                  >
                    <Radio.Group
                      options={[
                        { label: 'rootfs（临时存储）', value: 'rootfs' },
                        { label: 'dynamic（集群动态存储）', value: 'dynamic' },
                      ]}
                    />
                  </Form.Item>
                  {storageType === 'dynamic' && (
                    <>
                      <Form.Item
                        name="storage_class"
                        label="StorageClass"
                        rules={[{ required: true, message: '请选择 StorageClass' }]}
                      >
                        <Select
                          loading={loadingSc}
                          placeholder="选择 StorageClass"
                          options={storageClasses.map((sc) => ({ label: sc, value: sc }))}
                          showSearch={{ optionFilterProp: 'label' }}
                        />
                      </Form.Item>
                      <Form.Item
                        name="storage_size_in_gib"
                        label="存储大小 (GiB)"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </>
                  )}
                  <Form.Item
                    name="storage_driver"
                    label="存储驱动"
                    rules={[{ required: true, message: '请选择存储驱动' }]}
                  >
                    <Select
                      options={[
                        { label: 'overlay2', value: 'overlay2' },
                        { label: 'aufs', value: 'aufs' },
                        { label: 'vfs', value: 'vfs' },
                        { label: 'btrfs', value: 'btrfs' },
                        { label: 'zfs', value: 'zfs' },
                      ]}
                    />
                  </Form.Item>
                  <Divider />
                  <Button type="primary" loading={savingDind} onClick={handleSaveDind}>
                    保存 DinD 配置
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Drawer>

      <ClusterStrategyDrawer
        open={strategyOpen}
        onClose={() => setStrategyOpen(false)}
        cluster={cluster}
        onSuccess={onSuccess}
      />
      <ClusterCacheModal
        open={cacheOpen}
        onClose={() => setCacheOpen(false)}
        cluster={cluster}
        onSuccess={onSuccess}
      />
      <ClusterShareStorageModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        cluster={cluster}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default ClusterAdvancedConfigDrawer;
