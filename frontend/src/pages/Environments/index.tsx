import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  Space,
  Select,
  Typography,
  Modal,
  Drawer,
  Badge,
  InputNumber,
  Table,
  Dropdown,
  Input,
  Spin,
  Empty,
} from 'antd';
import {
  ClusterOutlined,
  CodeOutlined,
  FileTextOutlined,
  SyncOutlined,
  ControlOutlined,
  PlusOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useProjectStore } from '../../stores/project';
import PodTerminal from '../../components/Terminal/PodTerminal';
import EnvConfigDrawer from './EnvConfigDrawer';
import EnvWorkloadsDrawer from './EnvWorkloadsDrawer';
import LogViewer from '../../components/Terminal/LogViewer';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

interface EnvironmentItem {
  name: string;
  alias?: string;
  cluster_id?: string;
  cluster_name?: string;
  namespace?: string;
  status?: string;
  production?: boolean;
  update_time?: number;
}

interface PodItem {
  name: string;
  container_name: string;
  status: string;
  ready: string;
  restarts: number;
  node_name?: string;
  ip?: string;
  age?: string;
}

interface EnvOperationLogItem {
  id?: string;
  username?: string;
  function?: string;
  method?: string;
  status?: number;
  created_at?: number;
  detail?: string;
  request_body?: string;
}

export const EnvironmentsPage: React.FC = () => {
  const { projectName, envName: routeEnvName } = useParams<{ projectName?: string; envName?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject;
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [currentEnv, setCurrentEnv] = useState<string>(routeEnvName || '');
  const [pods, setPods] = useState<PodItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Terminal Modal state
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [activePod, setActivePod] = useState<{ podName: string; containerName: string } | null>(null);

  // Log Drawer state
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [activeLogPod, setActiveLogPod] = useState<string | null>(null);
  const [streamingLogUrl, setStreamingLogUrl] = useState<string | undefined>(undefined);

  // Scale modal state
  const [scaleModalVisible, setScaleModalVisible] = useState(false);
  const [replicas, setReplicas] = useState<number>(1);
  const [scaling, setScaling] = useState(false);

  // Env config management drawer (configmaps/secrets/ingresses/pvcs)
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  // Resource view drawer (workloads by type)
  const [workloadsDrawerOpen, setWorkloadsDrawerOpen] = useState(false);
  // Alias edit modal
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [aliasValue, setAliasValue] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  // 全局变量编辑（对齐旧版「更新全局变量」）
  const [gvModalOpen, setGvModalOpen] = useState(false);
  const [gvLoading, setGvLoading] = useState(false);
  const [gvSaving, setGvSaving] = useState(false);
  const [gvRows, setGvRows] = useState<Array<{ key: string; value: string; type?: string; desc?: string }>>([]);
  const [envRevision, setEnvRevision] = useState<number>(0);
  // 当前环境是否处于睡眠状态（后端 ProductStatusSleeping = "Sleeping"）
  const currentEnvObj = environments.find((e) => e.name === currentEnv);
  const currentEnvIsSleeping = currentEnvObj?.status === 'Sleeping';

  // Environment Change Log Drawer state
  const [changeLogOpen, setChangeLogOpen] = useState<boolean>(false);
  const [changeLogs, setChangeLogs] = useState<EnvOperationLogItem[]>([]);
  const [changeLogsLoading, setChangeLogsLoading] = useState<boolean>(false);
  const [changeLogsTotal, setChangeLogsTotal] = useState<number>(0);
  const [changeLogsPage, setChangeLogsPage] = useState<number>(1);

  const fetchChangeLogs = useCallback(
    async (page = 1) => {
      if (!activeProject || !currentEnv) return;
      setChangeLogsLoading(true);
      try {
        const res = await http.get<{ operation_logs?: EnvOperationLogItem[]; total?: number; count?: number } | EnvOperationLogItem[]>(
          `/api/aslan/environment/operations?projectName=${activeProject}&envName=${currentEnv}&page=${page}&pageSize=15`,
          { skipErrorHandler: true }
        );
        if (Array.isArray(res)) {
          setChangeLogs(res);
          setChangeLogsTotal(res.length);
        } else if (res && typeof res === 'object') {
          setChangeLogs(res.operation_logs || []);
          setChangeLogsTotal(res.total || res.count || 0);
        }
        setChangeLogsPage(page);
      } catch {
        setChangeLogs([]);
        setChangeLogsTotal(0);
      } finally {
        setChangeLogsLoading(false);
      }
    },
    [activeProject, currentEnv]
  );

  // Check if current route is /log
  useEffect(() => {
    if (location.pathname.endsWith('/log')) {
      setChangeLogOpen(true);
      fetchChangeLogs();
    }
  }, [location.pathname, fetchChangeLogs]);

  const loadEnvironments = useCallback(async () => {
    if (!activeProject) {
      setEnvironments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await http.get<EnvironmentItem[] | { data: EnvironmentItem[] }>(
        `/api/aslan/environment/environments?projectName=${activeProject}`
      );
      const list = Array.isArray(res) ? res : ('data' in res && Array.isArray(res.data) ? res.data : []);
      setEnvironments(list);
      if (routeEnvName) {
        setCurrentEnv(routeEnvName);
      } else if (list.length > 0 && !currentEnv) {
        setCurrentEnv(list[0].name);
      }
    } catch {
      setEnvironments([]);
      setCurrentEnv('');
      feedback.message.error('获取环境列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeProject, routeEnvName, currentEnv]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const loadWorkloadPods = useCallback(async () => {
    if (!activeProject || !currentEnv) return;
    try {
      const res = await http.get<PodItem[]>(
        `/api/aslan/environment/environments/${currentEnv}/workloads/pods?projectName=${activeProject}`
      );
      setPods(Array.isArray(res) ? res : []);
    } catch {
      setPods([]);
      feedback.message.error('获取 Pod 列表失败，请稍后重试');
    }
  }, [activeProject, currentEnv]);

  // 全局变量加载（candidates + 环境当前 revision）
  const loadGlobalVariables = useCallback(async () => {
    if (!activeProject || !currentEnv) return;
    setGvLoading(true);
    try {
      const detail = await http.get<{ revision?: number }>(
        `/api/aslan/environment/environments/${currentEnv}?projectName=${activeProject}`,
        { skipErrorHandler: true }
      );
      setEnvRevision(Number(detail?.revision) || 0);
      const res = await http.get<Array<{ key: string; value: unknown; type?: string; desc?: string }>>(
        `/api/aslan/environment/environments/${currentEnv}/globalVariableCandidates?projectName=${activeProject}`,
        { skipErrorHandler: true }
      );
      setGvRows(
        (Array.isArray(res) ? res : []).map((r) => ({
          key: r.key,
          value: r.value === null || r.value === undefined ? '' : String(r.value),
          type: r.type,
          desc: r.desc,
        }))
      );
    } catch {
      setGvRows([]);
    } finally {
      setGvLoading(false);
    }
  }, [activeProject, currentEnv]);

  const handleSaveGlobalVariables = async () => {
    if (!activeProject || !currentEnv) return;
    setGvSaving(true);
    try {
      await http.put(
        `/api/aslan/environment/environments/${currentEnv}/k8s/globalVariables?projectName=${activeProject}&production=${currentEnvIsSleeping ? 'false' : 'false'}`,
        {
          current_revision: envRevision,
          global_variables: gvRows.map((r) => ({
            key: r.key,
            value: r.value,
            type: r.type,
            desc: r.desc,
          })),
        }
      );
      feedback.message.success('全局变量已更新');
      setGvModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '全局变量更新失败';
      feedback.message.error(msg);
    } finally {
      setGvSaving(false);
    }
  };

  useEffect(() => {
    loadWorkloadPods();
  }, [loadWorkloadPods]);

  const openTerminal = (pod: PodItem) => {
    setActivePod({ podName: pod.name, containerName: pod.container_name });
    setTerminalVisible(true);
  };

  const openLogs = (pod: PodItem) => {
    setActiveLogPod(pod.name);
    setStreamingLogUrl(
      `/api/aslan/environment/environments/${currentEnv}/workloads/pods/${pod.name}/logs?container=${pod.container_name}&projectName=${activeProject}&follow=true`
    );
    setLogDrawerVisible(true);
  };

  const handleScaleReplicas = async () => {
    if (!activeProject || !currentEnv) return;
    setScaling(true);
    try {
      const targetService = pods[0]?.container_name || pods[0]?.name || activeProject;
      await http.post(
        `/api/aslan/environment/environments/${currentEnv}/services/${targetService}/scaleNew?projectName=${activeProject}&type=Deployment&name=${targetService}&number=${replicas}`
      );
      feedback.message.success(`工作负载 [${targetService}] 副本数已调整为 ${replicas}`);
      setScaleModalVisible(false);
      loadWorkloadPods();
    } catch (err: any) {
      feedback.message.error(err?.message || '调整工作负载副本数失败，请检查集群连接与权限');
    } finally {
      setScaling(false);
    }
  };

  const podColumns: ProColumns<PodItem>[] = [
    {
      title: 'Pod 实例名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <ClusterOutlined style={{ color: '#0066ff' }} />
          <Text strong copyable>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => {
        const isRunning = record.status === 'Running';
        return (
          <Badge
            status={isRunning ? 'success' : 'error'}
            text={
              <Text style={{ color: isRunning ? '#52c41a' : '#ff4d4f' }}>
                {record.status} ({record.ready})
              </Text>
            }
          />
        );
      },
    },
    {
      title: '重启次数',
      dataIndex: 'restarts',
      key: 'restarts',
      render: (restarts) => {
        const count = Number(restarts || 0);
        return count > 0 ? (
          <Tag color="volcano">{count} 次</Tag>
        ) : (
          <Text type="secondary">0 次</Text>
        );
      },
    },
    {
      title: '所在主机节点',
      dataIndex: 'node_name',
      key: 'node_name',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: 'Pod IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '存活运行时长',
      dataIndex: 'age',
      key: 'age',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '容器操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          icon={<FileSearchOutlined />}
          onClick={() =>
            navigate(
              `/v1/projects/detail/${activeProject}/envs/${currentEnv}/k8s/${record.container_name || record.name}?service=${record.name}`
            )
          }
        >
          服务详情
        </Button>,
        <Button
          key="terminal"
          type="link"
          icon={<CodeOutlined />}
          onClick={() => openTerminal(record)}
        >
          实时终端
        </Button>,
        <Button
          key="logs"
          type="link"
          icon={<FileTextOutlined />}
          onClick={() => openLogs(record)}
        >
          查看日志
        </Button>,
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Environment Top Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <ClusterOutlined style={{ fontSize: 20, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  环境与容器集群管理
                </Title>
                <Space orientation="horizontal" style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    所属项目: <Tag color="blue">{activeProject || '全局工作区'}</Tag>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    当前环境:
                  </Text>
                  <Select
                    value={currentEnv}
                    onChange={setCurrentEnv}
                    style={{ width: 140 }}
                    size="small"
                    options={environments.map((e) => ({
                      label: e.alias ? `${e.alias} (${e.name})` : `${e.name} (${e.status || 'Running'})`,
                      value: e.name,
                    }))}
                  />
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate(`/v1/projects/detail/${activeProject}/envs/create`)}
              >
                新建环境
              </Button>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => {
                  setChangeLogOpen(true);
                  fetchChangeLogs();
                }}
              >
                变更记录
              </Button>
              <Button
                icon={<ControlOutlined />}
                onClick={() => setScaleModalVisible(true)}
                disabled={!currentEnv}
              >
                副本伸缩
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setGvRows([]);
                  setGvModalOpen(true);
                  loadGlobalVariables();
                }}
                disabled={!currentEnv}
              >
                全局变量
              </Button>
              <Button
                icon={<AppstoreOutlined />}
                onClick={() => setConfigDrawerOpen(true)}
                disabled={!currentEnv}
              >
                配置管理
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setWorkloadsDrawerOpen(true)}
                disabled={!currentEnv}
              >
                资源视图
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'alias',
                      icon: <EditOutlined />,
                      label: '设置别名',
                      onClick: () => {
                        const env = environments.find((e) => e.name === currentEnv);
                        setAliasValue(env?.alias || '');
                        setAliasModalOpen(true);
                      },
                      disabled: !currentEnv,
                    },
                    {
                      key: 'sleep',
                      icon: <EyeOutlined />,
                      label: currentEnvIsSleeping ? '唤醒环境' : '睡眠环境',
                      disabled: !currentEnv,
                      onClick: async () => {
                        if (!currentEnv || !activeProject) return;
                        const action = currentEnvIsSleeping ? 'disable' : 'enable';
                        const prodParam = currentEnvObj?.production ? '&production=true' : '';
                        try {
                          await http.post(
                            `/api/aslan/environment/environments/${currentEnv}/sleep?projectName=${activeProject}&action=${action}${prodParam}`
                          );
                          feedback.message.success(
                            action === 'enable' ? `环境 [${currentEnv}] 已进入睡眠状态` : `环境 [${currentEnv}] 已唤醒`
                          );
                          await loadEnvironments();
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message || '操作失败';
                          feedback.message.error(msg);
                        }
                      },
                    },
                    { type: 'divider' as const },
                    {
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      label: '删除环境',
                      danger: true,
                      disabled: !currentEnv,
                      onClick: () => {
                        if (!currentEnv || !activeProject) return;
                        const currentEnvObj = environments.find((e) => e.name === currentEnv);
                        const isProd = currentEnvObj?.production ?? false;
                        const prodParam = isProd ? '&production=true' : '';
                        feedback.modal?.confirm({
                          title: `确认删除环境 [${currentEnv}]？`,
                          content: '环境下的服务实例与配置将被移除，该操作不可恢复。',
                          okText: '删除',
                          okButtonProps: { danger: true },
                          cancelText: '取消',
                          onOk: async () => {
                            try {
                              await http.delete(
                                `/api/aslan/environment/environments/${currentEnv}?projectName=${activeProject}&is_delete=true${prodParam}`
                              );
                              feedback.message.success(`环境 [${currentEnv}] 已删除`);
                              setCurrentEnv('');
                              await loadEnvironments();
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
                                ?.message || '删除环境失败';
                              feedback.message.error(msg);
                            }
                          },
                        });
                      },
                    },
                  ],
                }}
              >
                <Button icon={<MoreOutlined />} disabled={!currentEnv}>
                  环境操作
                </Button>
              </Dropdown>
              <Button
                icon={<SyncOutlined />}
                onClick={loadWorkloadPods}
              >
                刷新状态
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Pod Workloads Table */}
      <ProTable<PodItem>
        headerTitle={`Workload Pod 容器实例 (${currentEnv})`}
        rowKey="name"
        search={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        loading={loading}
        dataSource={pods}
        columns={podColumns}
        cardBordered={false}
        pagination={{ pageSize: 10 }}
      />

      {/* Interactive Pod Web Terminal Modal */}
      <Modal
        title={
          <Space orientation="horizontal">
            <CodeOutlined style={{ color: '#0066ff' }} />
            <span>Pod 交互式终端: {activePod?.podName}</span>
          </Space>
        }
        open={terminalVisible}
        onCancel={() => setTerminalVisible(false)}
        footer={null}
        width={960}
        styles={{ body: { padding: 0 } }}
      >
        {activePod && terminalVisible && activeProject && (
          <PodTerminal
            podName={activePod.podName}
            containerName={activePod.containerName}
            projectName={activeProject}
            envName={currentEnv}
            height={540}
          />
        )}
      </Modal>

      {/* Live Container Log Streaming Drawer */}
      <Drawer
        title={
          <Space orientation="horizontal">
            <FileTextOutlined style={{ color: '#0066ff' }} />
            <span>实时容器日志: {activeLogPod}</span>
          </Space>
        }
        placement="right"
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
        size="large"
        styles={{ body: { padding: 0 } }}
      >
        <LogViewer
          streamUrl={streamingLogUrl}
          height="100%"
        />
      </Drawer>

      {/* Environment Change Log Drawer */}
      <Drawer
        title={
          <Space orientation="horizontal">
            <HistoryOutlined style={{ color: '#0066ff' }} />
            <span>环境变更记录: {activeProject} / {currentEnv}</span>
          </Space>
        }
        placement="right"
        open={changeLogOpen}
        onClose={() => {
          setChangeLogOpen(false);
          if (location.pathname.endsWith('/log')) {
            navigate(`/v1/projects/detail/${activeProject}/envs/${currentEnv}`);
          }
        }}
        size="large"
      >
        <Table<EnvOperationLogItem>
          rowKey={(r, idx) => r.id || `${r.created_at}_${idx}`}
          loading={changeLogsLoading}
          dataSource={changeLogs}
          pagination={{
            current: changeLogsPage,
            pageSize: 15,
            total: changeLogsTotal,
            onChange: (p) => fetchChangeLogs(p),
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          columns={[
            {
              title: '操作时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 170,
              render: (t) => (t ? dayjs(t * 1000).format('YYYY-MM-DD HH:mm:ss') : '-'),
            },
            {
              title: '操作人',
              dataIndex: 'username',
              key: 'username',
              width: 120,
              render: (u) => <Text strong>{String(u || '-')}</Text>,
            },
            {
              title: '操作方法',
              dataIndex: 'method',
              key: 'method',
              width: 90,
              render: (m) => (
                <Tag color={m === 'POST' ? 'green' : m === 'DELETE' ? 'red' : 'blue'}>
                  {String(m || 'GET')}
                </Tag>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 80,
              render: (s) => (
                <Tag color={Number(s) >= 200 && Number(s) < 300 ? 'success' : 'error'}>
                  {String(s || 200)}
                </Tag>
              ),
            },
            {
              title: '功能/变更详情',
              dataIndex: 'function',
              key: 'function',
              render: (f, record) => (
                <div>
                  <Text code>{String(f || '-')}</Text>
                  {record.detail && (
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                      {record.detail}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      {/* Scale Replicas Modal */}
      <Modal
        title="调整服务工作负载副本数 (Replica Scale)"
        open={scaleModalVisible}
        onOk={handleScaleReplicas}
        onCancel={() => setScaleModalVisible(false)}
        confirmLoading={scaling}
        okText="确认扩缩容"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <Text style={{ display: 'block', marginBottom: 12 }}>期望 Pod 实例数量:</Text>
          <InputNumber
            min={0}
            max={32}
            value={replicas}
            onChange={(val) => setReplicas(val || 1)}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
      {/* Env Config Management Drawer (ConfigMap/Secret/Ingress/PVC) */}
      <EnvConfigDrawer
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        envName={currentEnv || ''}
        projectName={activeProject || ''}
        production={environments.find((e) => e.name === currentEnv)?.production ?? false}
      />

      {/* Resource View Drawer (workloads by type, aligned with old portal) */}
      <EnvWorkloadsDrawer
        open={workloadsDrawerOpen}
        onClose={() => setWorkloadsDrawerOpen(false)}
        envName={currentEnv || ''}
        projectName={activeProject || ''}
        production={environments.find((e) => e.name === currentEnv)?.production ?? false}
      />

      {/* Global Variables Edit Modal (对齐旧版「更新全局变量」) */}
      <Modal
        title={`更新全局变量: ${currentEnv}`}
        open={gvModalOpen}
        onCancel={() => setGvModalOpen(false)}
        onOk={handleSaveGlobalVariables}
        confirmLoading={gvSaving}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        {gvLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : gvRows.length > 0 ? (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {gvRows.map((row, idx) => (
              <div key={row.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 180 }}>
                  <Text strong style={{ fontSize: 13 }}>{row.key}</Text>
                  {row.desc && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{row.desc}</Text>
                    </div>
                  )}
                </div>
                <Input
                  style={{ flex: 1 }}
                  value={row.value}
                  onChange={(e) => {
                    const next = [...gvRows];
                    next[idx] = { ...row, value: e.target.value };
                    setGvRows(next);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该环境暂无可编辑的全局变量" />
        )}
      </Modal>

      {/* Alias Edit Modal */}
      <Modal
        title={`设置环境别名: ${currentEnv}`}
        open={aliasModalOpen}
        onCancel={() => setAliasModalOpen(false)}
        confirmLoading={aliasSaving}
        okText="保存"
        cancelText="取消"
        onOk={async () => {
          if (!currentEnv || !activeProject) return;
          setAliasSaving(true);
          const isProd = environments.find((e) => e.name === currentEnv)?.production ?? false;
          const prodParam = isProd ? '&production=true' : '';
          try {
            await http.put(
              `/api/aslan/environment/environments/${currentEnv}/alias?projectName=${activeProject}${prodParam}`,
              { alias: aliasValue }
            );
            feedback.message.success('环境别名已更新');
            setAliasModalOpen(false);
            loadEnvironments();
          } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '别名保存失败';
            feedback.message.error(msg);
          } finally {
            setAliasSaving(false);
          }
        }}
      >
        <Input
          placeholder="环境别名（展示用，可留空清除）"
          value={aliasValue}
          onChange={(e) => setAliasValue(e.target.value)}
          maxLength={32}
        />
      </Modal>
    </div>
  );
};

export default EnvironmentsPage;
