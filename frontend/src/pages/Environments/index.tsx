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
} from 'antd';
import {
  ClusterOutlined,
  CodeOutlined,
  FileTextOutlined,
  SyncOutlined,
  ControlOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import PodTerminal from '../../components/Terminal/PodTerminal';
import LogViewer from '../../components/Terminal/LogViewer';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

interface EnvironmentItem {
  name: string;
  cluster_id?: string;
  cluster_name?: string;
  namespace?: string;
  status?: string;
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

export const EnvironmentsPage: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject;
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [currentEnv, setCurrentEnv] = useState<string>('');
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
      setCurrentEnv(list.length > 0 ? list[0].name : '');
    } catch {
      setEnvironments([]);
      setCurrentEnv('');
      feedback.message.error('获取环境列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

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
      render: (text) => <Text code>{String(text || 'k8s-worker')}</Text>,
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
      render: (text) => <Text type="secondary">{String(text || '1d')}</Text>,
    },
    {
      title: '容器操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
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
                      label: `${e.name} (${e.status || 'Running'})`,
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
                icon={<ControlOutlined />}
                onClick={() => setScaleModalVisible(true)}
              >
                副本伸缩
              </Button>
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
    </div>
  );
};

export default EnvironmentsPage;
