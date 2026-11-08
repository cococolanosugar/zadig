import React, { useRef, useState } from 'react';
import {
  ProTable,
  ModalForm,
  ProFormText,
  ProFormTextArea,
  ProFormRadio,
  ProFormSwitch,
  ProFormDependency,
} from '@ant-design/pro-components';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography, Modal, Alert, Input, Spin } from 'antd';
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
  CodeOutlined,
  CopyOutlined,
  LinkOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { settingsApi, type ClusterItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';
import { ClusterStrategyDrawer } from './ClusterStrategyDrawer';
import { ClusterCacheModal } from './ClusterCacheModal';
import { ClusterShareStorageModal } from './ClusterShareStorageModal';
import { ClusterCleanCacheModal } from './ClusterCleanCacheModal';

const { Text, Paragraph } = Typography;

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

  // LOOP2-B2: Agent 一键部署脚本弹窗
  const [agentScriptOpen, setAgentScriptOpen] = useState(false);
  const [agentScriptLoading, setAgentScriptLoading] = useState(false);
  const [agentScriptClusterName, setAgentScriptClusterName] = useState('');
  const [agentCommand, setAgentCommand] = useState('');
  const [agentExpiresAt, setAgentExpiresAt] = useState<number | undefined>();

  const showAgentScriptModal = async (clusterId: string, clusterName?: string) => {
    if (!clusterId) {
      feedback.message.warning('集群 ID 缺失，无法生成接入脚本');
      return;
    }
    setAgentScriptLoading(true);
    setAgentScriptClusterName(clusterName || clusterId);
    setAgentCommand('');
    setAgentExpiresAt(undefined);
    setAgentScriptOpen(true);
    try {
      const res = await settingsApi.getClusterAgentCommand(clusterId);
      setAgentCommand(res?.command || '');
      setAgentExpiresAt(res?.expires_at);
      if (!res?.command) {
        feedback.message.warning('未获取到有效的 kubectl apply 命令');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
          ?.description ||
        (err as Error)?.message ||
        '获取 Agent 接入脚本失败';
      feedback.message.error(msg);
      setAgentScriptOpen(false);
    } finally {
      setAgentScriptLoading(false);
    }
  };

  const handleCopyAgentCommand = async () => {
    if (!agentCommand) return;
    try {
      await navigator.clipboard.writeText(agentCommand);
      feedback.message.success('命令已复制到剪贴板');
    } catch {
      feedback.message.error('复制失败，请手动选中命令文本');
    }
  };

  const handleTestConnection = async () => {
    const values = formRef.current?.getFieldsValue();
    const accessType = values?.access_type || 'kubeconfig';
    if (accessType === 'agent') {
      feedback.message.info('Agent 模式无需 KubeConfig 连通性测试，创建后请使用「接入脚本」在目标集群部署 Agent');
      return;
    }
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
        type: accessType,
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

  // LOOP8-A1: 断开 / 重连 / 安全删除
  const handleDisconnect = async (clusterId: string) => {
    try {
      await settingsApi.disconnectCluster(clusterId);
      feedback.message.success('集群已断开连接');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '断开集群连接失败';
      feedback.message.error(msg);
    }
  };

  const handleReconnect = async (clusterId: string) => {
    try {
      await settingsApi.reconnectCluster(clusterId);
      feedback.message.success('集群已重新连接');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '重新连接集群失败';
      feedback.message.error(msg);
    }
  };

  const handleSafeDelete = async (record: ClusterItem) => {
    try {
      const info = await settingsApi.getClusterDeletionInfo(record.id);
      if (!info.deletable && info.env_in_use && info.env_in_use.length > 0) {
        feedback.modal?.warning({
          title: '无法删除该集群',
          content: (
            <div>
              <p>以下环境仍在引用该集群，请先清理后再删除：</p>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {info.env_in_use.map((e) => (
                  <li key={`${e.project_name}-${e.name}`}>
                    项目: {e.project_name}, 环境: {e.display_name || e.name}
                  </li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }
      feedback.modal?.confirm({
        title: `确定删除集群 [${record.name}]？`,
        content: '删除后将无法向该集群调度工作流或部署环境。',
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          await settingsApi.deleteCluster(record.id);
          feedback.message.success('集群已成功删除');
          actionRef.current?.reload();
        },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '删除集群失败（本地集群或仍被环境引用时不可删除）';
      feedback.message.error(msg);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    const accessType = (values.access_type as string) || 'kubeconfig';
    try {
      const created = (await settingsApi.createCluster({
        name: values.name as string,
        description: values.description as string,
        // LOOP2-B2: Agent 模式无需 kube_config
        kube_config: accessType === 'agent' ? '' : (values.kube_config as string),
        production: values.production as boolean,
        type: accessType,
      })) as ClusterItem | undefined;
      feedback.message.success(
        accessType === 'agent' ? '集群记录创建成功！请按下方脚本在目标集群部署 Agent' : '集群接入成功！'
      );
      actionRef.current?.reload();
      if (accessType === 'agent' && created?.id) {
        await showAgentScriptModal(created.id, created.name || (values.name as string));
      }
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
      width: 420,
      render: (_, record) => {
        const isDisconnected = record.status === 'disconnected' || !!record.disconnected;
        return [
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
          // LOOP2-B2: 外置集群均可生成 Agent 接入脚本
          !record.local ? (
            <Button
              key="agent-script"
              type="link"
              size="small"
              icon={<CodeOutlined />}
              onClick={() => showAgentScriptModal(record.id, record.name)}
            >
              接入脚本
            </Button>
          ) : null,
          // LOOP8-A1: 非本地集群 — 断开/重连 + 安全删除
          !record.local ? (
            isDisconnected ? (
              <Button
                key="reconnect"
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => handleReconnect(record.id)}
              >
                重新连接
              </Button>
            ) : (
              <Popconfirm
                key="disconnect"
                title="确定断开此集群连接？"
                description="断开后将无法向该集群调度工作流或部署环境，可稍后重新连接。"
                onConfirm={() => handleDisconnect(record.id)}
                okText="断开"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<DisconnectOutlined />}>
                  断开连接
                </Button>
              </Popconfirm>
            )
          ) : null,
          !record.local ? (
            <Button
              key="delete"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleSafeDelete(record)}
            >
              删除
            </Button>
          ) : (
            <Text key="builtin" type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
              内置保护
            </Text>
          ),
        ];
      },
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

            {/* LOOP2-B2: Agent 模式隐藏/免填 KubeConfig */}
            <ProFormDependency name={['access_type']}>
              {({ access_type }) =>
                access_type === 'agent' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title="Agent 模式无需配置 KubeConfig，创建后将生成一键部署脚本"
                    description="请在目标 Kubernetes 集群执行生成的 kubectl apply 命令完成 Agent 接入。"
                  />
                ) : (
                  <ProFormTextArea
                    name="kube_config"
                    label="KubeConfig 内容 (YAML)"
                    placeholder="粘贴包含 clusters, users, contexts 的 kubeconfig 配置文本..."
                    rules={[{ required: true, message: '请输入有效 kubeconfig 配置' }]}
                    fieldProps={{ rows: 6 }}
                  />
                )
              }
            </ProFormDependency>

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

      <Modal
        title={`Agent 接入脚本${agentScriptClusterName ? ` · ${agentScriptClusterName}` : ''}`}
        open={agentScriptOpen}
        onCancel={() => setAgentScriptOpen(false)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopyAgentCommand} disabled={!agentCommand}>
            复制命令
          </Button>,
          <Button key="close" onClick={() => setAgentScriptOpen(false)}>
            关闭
          </Button>,
        ]}
        width={720}
        destroyOnHidden
      >
        <Spin spinning={agentScriptLoading}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={
              agentExpiresAt
                ? `命令含短期 Token，请在过期前使用（expires_at: ${new Date(agentExpiresAt * 1000).toLocaleString()}）`
                : '命令含短期 Token，请尽快在目标集群执行'
            }
          />
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            在目标集群控制节点执行以下命令完成 Agent 部署：
          </Paragraph>
          <Input.TextArea
            value={agentCommand}
            readOnly
            autoSize={{ minRows: 3, maxRows: 8 }}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
        </Spin>
      </Modal>

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
