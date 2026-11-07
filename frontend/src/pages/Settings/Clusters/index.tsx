import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormTextArea, ProFormRadio, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  HddOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ScheduleOutlined,
  CloudServerOutlined,
  FolderOpenOutlined,
  ClearOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { settingsApi, type ClusterItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';
import { ClusterStrategyDrawer } from './ClusterStrategyDrawer';
import { ClusterCacheModal } from './ClusterCacheModal';
import { ClusterShareStorageModal } from './ClusterShareStorageModal';
import { ClusterCleanCacheModal } from './ClusterCleanCacheModal';

const { Text } = Typography;

export const ClustersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  // Modals / Drawers state
  const [activeCluster, setActiveCluster] = useState<ClusterItem | null>(null);
  const [strategyDrawerVisible, setStrategyDrawerVisible] = useState<boolean>(false);
  const [cacheModalVisible, setCacheModalVisible] = useState<boolean>(false);
  const [shareStorageModalVisible, setShareStorageModalVisible] = useState<boolean>(false);
  const [cleanCacheModalVisible, setCleanCacheModalVisible] = useState<boolean>(false);
  const formRef = useRef<ProFormInstance>();
  const [validating, setValidating] = useState<boolean>(false);

  const handleTestConnection = async () => {
    const values = formRef.current?.getFieldsValue();
    const kubeConfig = values?.kube_config?.trim();
    if (!kubeConfig) {
      feedback.message.warning('请先输入 KubeConfig 配置文本再进行连接测试');
      return;
    }
    setValidating(true);
    try {
      await settingsApi.validateCluster({
        name: values.name || 'test-probe',
        kube_config: kubeConfig,
        type: values.access_type || 'kubeconfig',
      });
      feedback.message.success('集群通信连通性测试通过！Kubernetes API 响应正常');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description ||
        (err as Error)?.message ||
        '集群连接测试失败，请检查 KubeConfig 有效性与网络可达性';
      feedback.message.error(`连接测试失败: ${msg}`);
    } finally {
      setValidating(false);
    }
  };

  const openStrategyDrawer = (cluster: ClusterItem) => {
    setActiveCluster(cluster);
    setStrategyDrawerVisible(true);
  };

  const openCacheModal = (cluster: ClusterItem) => {
    setActiveCluster(cluster);
    setCacheModalVisible(true);
  };

  const openShareStorageModal = (cluster: ClusterItem) => {
    setActiveCluster(cluster);
    setShareStorageModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteCluster(id);
      feedback.message.success('集群已成功删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除集群失败（本地集群或仍被环境引用时不可删除）';
      feedback.message.error(msg);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createCluster({
        name: values.name as string,
        description: values.description as string,
        kube_config: values.kube_config as string,
        production: values.production as boolean,
        type: values.access_type as string || 'kubeconfig',
      });
      feedback.message.success('集群接入成功！');
      actionRef.current?.reload();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '集群接入失败，请检查 KubeConfig 与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  const columns: ProColumns<ClusterItem>[] = [
    {
      title: '集群名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <HddOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
          {record.local && <Tag color="cyan">当前管理集群</Tag>}
          {record.production && <Tag color="orange">生产集群</Tag>}
        </Space>
      ),
    },
    {
      title: '集群状态',
      dataIndex: 'status',
      key: 'status',
      search: false,
      render: (_, record) => {
        const isHealthy = record.status === 'normal' || record.local || !record.status;
        return isHealthy ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            正常通信
          </Tag>
        ) : (
          <Tag icon={<SyncOutlined spin />} color="warning">
            {record.status}
          </Tag>
        );
      },
    },
    {
      title: '接入类型',
      dataIndex: 'type',
      key: 'type',
      search: false,
      render: (_, record) => (
        <Text type="secondary">{record.local ? '内嵌控制面' : record.type || 'KubeConfig'}</Text>
      ),
    },
    {
      title: '描述说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 280,
      render: (_, record) => [
        <Button
          key="strategy"
          type="link"
          size="small"
          icon={<ScheduleOutlined />}
          onClick={() => openStrategyDrawer(record)}
        >
          策略配置
        </Button>,
        <Button
          key="cache"
          type="link"
          size="small"
          icon={<CloudServerOutlined />}
          onClick={() => openCacheModal(record)}
        >
          缓存配置
        </Button>,
        <Button
          key="share-storage"
          type="link"
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={() => openShareStorageModal(record)}
        >
          共享存储
        </Button>,
        !record.local ? (
          <Popconfirm
            key="delete"
            title="确定断开此集群连接？"
            description="删除后将无法向该集群调度工作流或部署环境。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              断开连接
            </Button>
          </Popconfirm>
        ) : (
          <Text key="builtin" type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
            内置保护
          </Text>
        ),
      ],
    },
  ];

  return (
    <div>
      <ProTable<ClusterItem>
        headerTitle="Kubernetes 集群接入管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getClusters();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button
            key="clean-cache"
            icon={<ClearOutlined />}
            onClick={() => setCleanCacheModalVisible(true)}
          >
            一键清理构建缓存
          </Button>,
          <ModalForm
            key="add-cluster"
            title="接入 Kubernetes 集群"
            formRef={formRef}
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加集群
              </Button>
            }
            width={600}
            submitter={{
              render: (_props, defaultDoms) => [
                <Button
                  key="test-connection"
                  icon={<ApiOutlined />}
                  loading={validating}
                  onClick={handleTestConnection}
                >
                  测试连接
                </Button>,
                ...defaultDoms,
              ],
            }}
            onFinish={handleCreate}
          >
            <ProFormText
              name="name"
              label="集群标识名称"
              placeholder="例如: k8s-staging-cluster"
              rules={[{ required: true, message: '请输入集群标识名称' }]}
            />

            <ProFormRadio.Group
              name="access_type"
              label="接入方式"
              initialValue="kubeconfig"
              options={[
                { label: 'KubeConfig 凭据文件', value: 'kubeconfig' },
                { label: 'Zadig Cluster Agent 代理', value: 'agent' },
              ]}
            />

            <ProFormTextArea
              name="kube_config"
              label="KubeConfig 内容 (YAML)"
              placeholder="粘贴包含 clusters, users, contexts 的 kubeconfig 配置文本..."
              rules={[{ required: true, message: '请输入有效 kubeconfig 配置' }]}
              fieldProps={{ rows: 6 }}
            />

            <ProFormSwitch
              name="production"
              label="生产环境集群保护"
              tooltip="开启后，发布至此集群将触发更严格的审批策略与权限阻断。"
            />

            <ProFormTextArea
              name="description"
              label="备注描述"
              placeholder="集群硬件配置、网络拓扑或所属业务线说明"
            />
          </ModalForm>,
        ]}
      />

      <ClusterStrategyDrawer
        open={strategyDrawerVisible}
        onClose={() => setStrategyDrawerVisible(false)}
        cluster={activeCluster}
        onSuccess={() => actionRef.current?.reload()}
      />

      <ClusterCacheModal
        open={cacheModalVisible}
        onClose={() => setCacheModalVisible(false)}
        cluster={activeCluster}
        onSuccess={() => actionRef.current?.reload()}
      />

      <ClusterShareStorageModal
        open={shareStorageModalVisible}
        onClose={() => setShareStorageModalVisible(false)}
        cluster={activeCluster}
        onSuccess={() => actionRef.current?.reload()}
      />

      <ClusterCleanCacheModal
        open={cleanCacheModalVisible}
        onClose={() => setCleanCacheModalVisible(false)}
      />
    </div>
  );
};

export default ClustersPage;
