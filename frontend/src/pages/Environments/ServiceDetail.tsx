import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Typography, Button, Space, Tag, Table, Empty, Spin, Drawer, Descriptions, Alert, Popconfirm, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClusterOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CodeOutlined,
  ArrowLeftOutlined,
  FileSearchOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import http from '../../api/client';
import LogViewer from '../../components/Terminal/LogViewer';
import PodTerminal from '../../components/Terminal/PodTerminal';
import YamlEditor from '../../components/Editor/YamlEditor';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

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

interface PodDetailInfo {
  name?: string;
  status?: string;
  ip?: string;
  node_name?: string;
  ready?: string;
  restarts?: number;
  created_at?: string;
  age?: string;
  containers?: Array<{ name?: string; image?: string; status?: string; restarts?: number }>;
}

/**
 * 环境服务详情页 (对应旧版 envs/detail/:service_name)
 * 数据源:
 *  - 工作负载 YAML: GET /api/aslan/environment/kube/yaml?type=&name=&envName=&projectName=
 *  - Pod 列表: GET /api/aslan/environment/environments/:env/workloads/pods?projectName= (按服务过滤)
 *  - Pod 详情: GET /api/aslan/environment/kube/pods/:podName?projectName=&envName=
 *  - Pod 事件: GET /api/aslan/environment/kube/pods/:podName/events?projectName=&envName=
 *  - 实时日志: SSE /api/aslan/logs/sse/pods/:podName/containers/:containerName?envName=&projectName=
 */
export const ServiceDetailPage: React.FC = () => {
  const { envName: paramEnvName, serviceType: paramServiceType, serviceName: paramServiceName } = useParams<{
    envName?: string;
    serviceType?: string;
    serviceName?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  // projectName 是上级路由参数（/v1/projects/detail/:projectName/envs/...），
  // 顶层独立路由（/v1/envs/:envName/...）时从 query 兜底
  const routeProjectName = location.pathname.match(/^\/v1\/projects\/detail\/([^/]+)/)?.[1] || '';
  const projectName = routeProjectName || searchParams.get('projectName') || '';
  const envName = paramEnvName || searchParams.get('envName') || '';
  const serviceName = paramServiceName || searchParams.get('serviceName') || searchParams.get('service') || '';
  const serviceType =
    paramServiceType ||
    (location.pathname.includes('/helm/')
      ? 'helm'
      : location.pathname.includes('/pm/')
      ? 'pm'
      : 'k8s');

  const [loading, setLoading] = useState(false);
  const [pods, setPods] = useState<PodItem[]>([]);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [yamlLoading, setYamlLoading] = useState(false);
  // 环境服务 YAML 编辑保存（对齐旧版；PUT /environments/:envName/services/:serviceName）
  const [svcCurrentRevision, setSvcCurrentRevision] = useState<number>(0);
  const [savingYaml, setSavingYaml] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Log drawer
  const [logPod, setLogPod] = useState<{ pod: string; container: string } | null>(null);
  const [logStreamUrl, setLogStreamUrl] = useState<string | undefined>(undefined);

  // Terminal modal
  const [terminalPod, setTerminalPod] = useState<{ pod: string; container: string } | null>(null);
  const [terminalVisible, setTerminalVisible] = useState(false);

  // Pod detail drawer
  const [podDetail, setPodDetail] = useState<PodDetailInfo | null>(null);
  const [podDetailOpen, setPodDetailOpen] = useState(false);
  const [podDetailLoading, setPodDetailLoading] = useState(false);
  const [podEvents, setPodEvents] = useState<Array<{ type?: string; reason?: string; message?: string; last_timestamp?: string }>>([]);

  const fetchPods = useCallback(async () => {
    if (!envName || !projectName) return;
    setLoading(true);
    try {
      // 后端实际端点为 kube/pods（environments/:env/workloads/pods 不存在）
      const res = await http.get<PodItem[]>(
        `/api/aslan/environment/kube/pods?projectName=${projectName}&envName=${envName}&production=false`,
        { skipErrorHandler: true }
      );
      const all = Array.isArray(res) ? res : [];
      // 按服务过滤：pod 名前缀匹配
      const filtered = all.filter((p) => p.name.startsWith(`${serviceName}-`));
      setPods(filtered);
    } catch {
      setPods([]);
    } finally {
      setLoading(false);
    }
  }, [envName, projectName, serviceName]);

  const fetchYaml = useCallback(async () => {
    if (!envName || !projectName || !serviceName) return;
    // k8s 服务的工作负载类型为 Deployment；helm 同理
    const resourceType = serviceType === 'pm' ? '' : 'deployment';
    if (!resourceType) {
      setYamlContent('// 主机 (PM) 服务没有 K8s 工作负载 YAML');
      return;
    }
    setYamlLoading(true);
    try {
      // 可编辑的是环境内服务的模板 YAML（variable_yaml）；同时取 current_revision 供保存
      const detail = await http.get<{
        services?: Array<Array<{ service_name?: string; revision?: number; variable_yaml?: string }>>;
      }>(
        `/api/aslan/environment/environments/${envName}?projectName=${projectName}`,
        { skipErrorHandler: true }
      );
      const svcEntry = (detail?.services || [])
        .flatMap((g) => g || [])
        .find((s) => s.service_name === serviceName);
      setSvcCurrentRevision(Number(svcEntry?.revision) || 0);
      setYamlContent(svcEntry?.variable_yaml || '');
    } catch {
      setSvcCurrentRevision(0);
      setYamlContent('');
    } finally {
      setYamlLoading(false);
    }
  }, [envName, projectName, serviceName, serviceType]);

  const handleSaveSvcYaml = async () => {
    if (!envName || !projectName || !serviceName) return;
    setSavingYaml(true);
    try {
      await http.put(
        `/api/aslan/environment/environments/${envName}/services/${encodeURIComponent(serviceName)}?projectName=${projectName}&production=false`,
        {
          service_name: serviceName,
          type: 'k8s',
          current_revision: svcCurrentRevision,
          variable_yaml: yamlContent,
        }
      );
      feedback.message.success('服务 YAML 已更新，可「重启」使变更生效');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '服务 YAML 保存失败';
      feedback.message.error(msg);
    } finally {
      setSavingYaml(false);
    }
  };

  const handleRestartSvc = async () => {
    if (!envName || !projectName || !serviceName) return;
    setRestarting(true);
    try {
      await http.post(
        `/api/aslan/environment/environments/${envName}/services/${encodeURIComponent(serviceName)}/restart?projectName=${projectName}`
      );
      feedback.message.success(`服务 [${serviceName}] 已重启，资源将按最新配置同步`);
      fetchPods();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '重启失败';
      feedback.message.error(msg);
    } finally {
      setRestarting(false);
    }
  };

  useEffect(() => {
    fetchPods();
    fetchYaml();
  }, [fetchPods, fetchYaml]);

  const openLogs = async (pod: PodItem) => {
    // kube/pods 不返回容器名，先取 Pod 详情中的容器列表
    let containerName = '';
    try {
      const detail = await http.get<PodDetailInfo>(
        `/api/aslan/environment/kube/pods/${pod.name}?projectName=${projectName}&envName=${envName}`,
        { skipErrorHandler: true }
      );
      containerName = (detail?.containers || []).map((c) => c.name || '').find(Boolean) || pod.name;
    } catch {
      containerName = pod.name;
    }
    setLogPod({ pod: pod.name, container: containerName });
    setLogStreamUrl(
      `/api/logs/sse/pods/${pod.name}/containers/${containerName}?envName=${envName}&projectName=${projectName}&tails=100`
    );
  };

  const openPodDetail = async (pod: PodItem) => {
    setPodDetailOpen(true);
    setPodDetailLoading(true);
    setPodEvents([]);
    try {
      const res = await http.get<PodDetailInfo>(
        `/api/aslan/environment/kube/pods/${pod.name}?projectName=${projectName}&envName=${envName}`,
        { skipErrorHandler: true }
      );
      setPodDetail(res || null);
    } catch {
      setPodDetail(null);
    }
    try {
      const evRes = await http.get<Array<{ type?: string; reason?: string; message?: string; last_timestamp?: string }>>(
        `/api/aslan/environment/kube/pods/${pod.name}/events?projectName=${projectName}&envName=${envName}`,
        { skipErrorHandler: true }
      );
      setPodEvents(Array.isArray(evRes) ? evRes : []);
    } catch {
      setPodEvents([]);
    } finally {
      setPodDetailLoading(false);
    }
  };

  const handleDeletePod = async (pod: PodItem) => {
    try {
      await http.delete(`/api/aslan/environment/kube/${envName}/pods/${pod.name}?projectName=${projectName}`);
      feedback.message.success(`Pod [${pod.name}] 已重建，等待新实例拉起`);
      fetchPods();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || 'Pod 重建失败');
    }
  };

  const podColumns: ColumnsType<PodItem> = [
    {
      title: 'Pod 名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong copyable>{name}</Text>,
    },
    {
      title: '容器',
      dataIndex: 'container_name',
      key: 'container_name',
      render: (c) => <Text code>{String(c || '-')}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const running = status === 'Running';
        return <Tag color={running ? 'success' : 'error'}>{`${status} (${record.ready || '-'})`}</Tag>;
      },
    },
    { title: '重启', dataIndex: 'restarts', key: 'restarts', render: (r) => String(r ?? 0) },
    { title: 'IP', dataIndex: 'ip', key: 'ip', render: (ip) => <Text type="secondary">{String(ip || '-')}</Text> },
    { title: '节点', dataIndex: 'node_name', key: 'node_name', render: (n) => <Text type="secondary">{String(n || '-')}</Text> },
    { title: '存活', dataIndex: 'age', key: 'age', render: (a) => <Text type="secondary">{String(a || '-')}</Text> },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space orientation="horizontal" size={0}>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openLogs(record)}>
            日志
          </Button>
          <Button type="link" size="small" icon={<CodeOutlined />} onClick={() => {
            setTerminalPod({ pod: record.name, container: record.container_name });
            setTerminalVisible(true);
          }}>
            终端
          </Button>
          <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => openPodDetail(record)}>
            详情
          </Button>
          <Popconfirm
            title={`确定重建 Pod [${record.name}]？`}
            description="删除后由工作负载控制器自动拉起新实例。"
            onConfirm={() => handleDeletePod(record)}
            okText="重建"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              重建
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Space orientation="horizontal" size="middle">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/v1/projects/detail/${projectName}/envs`)}>
            返回环境
          </Button>
          <ClusterOutlined style={{ fontSize: 20, color: '#0066ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              服务详情: {serviceName}
            </Title>
            <Space orientation="horizontal" style={{ marginTop: 4 }}>
              <Tag color="blue">{projectName || '-'}</Tag>
              <Tag color="geekblue">环境: {envName}</Tag>
              <Tag color="cyan">{serviceType === 'pm' ? '主机服务' : 'K8s 服务'}</Tag>
            </Space>
          </div>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={() => { fetchPods(); fetchYaml(); }}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* Tabs: 实例 / 工作负载 YAML */}
      <Card variant="borderless" style={{ borderRadius: 8 }} styles={{ body: { padding: '8px 24px 16px' } }}>
        <Tabs
          defaultActiveKey="instances"
          items={[
            {
              key: 'instances',
              label: `Pod 实例 (${pods.length})`,
              children: (
                <Table
                  dataSource={pods}
                  columns={podColumns}
                  rowKey="name"
                  loading={loading}
                  pagination={false}
                  size="middle"
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={`环境 [${envName}] 中未找到服务 [${serviceName}] 的 Pod 实例`}
                      />
                    ),
                  }}
                />
              ),
            },
            {
              key: 'yaml',
              label: '服务 YAML（可编辑）',
              children: yamlLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <Spin />
                </div>
              ) : yamlContent ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                    <Button size="small" icon={<ReloadOutlined />} onClick={fetchYaml}>
                      重置
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<ExclamationCircleOutlined />}
                      loading={restarting}
                      onClick={handleRestartSvc}
                      disabled={serviceType === 'pm'}
                    >
                      重启生效
                    </Button>
                    <Button type="primary" size="small" icon={<SaveOutlined />} loading={savingYaml} onClick={handleSaveSvcYaml}>
                      保存 YAML
                    </Button>
                  </div>
                  <YamlEditor value={yamlContent} onChange={setYamlContent} theme="light" height={460} />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到服务 YAML（可能为只读托管资源）" />
              ),
            },
          ]}
        />
      </Card>

      {/* Pod Log Drawer */}
      <Drawer
        title={`实时日志: ${logPod?.pod}`}
        placement="right"
        open={!!logPod}
        onClose={() => {
          setLogPod(null);
          setLogStreamUrl(undefined);
        }}
        size="large"
        styles={{ body: { padding: 0 } }}
      >
        <LogViewer streamUrl={logStreamUrl} height="100%" />
      </Drawer>

      {/* Pod Terminal Modal */}
      <Modal
        title={`Pod 终端: ${terminalPod?.pod}`}
        open={terminalVisible}
        onCancel={() => setTerminalVisible(false)}
        footer={null}
        width={960}
        styles={{ body: { padding: 0 } }}
      >
        {terminalPod && projectName && (
          <PodTerminal
            podName={terminalPod.pod}
            containerName={terminalPod.container}
            projectName={projectName}
            envName={envName || ''}
            height={540}
          />
        )}
      </Modal>

      {/* Pod Detail Drawer */}
      <Drawer
        title={`Pod 详情: ${podDetail?.name || ''}`}
        placement="right"
        open={podDetailOpen}
        onClose={() => setPodDetailOpen(false)}
        size="large"
      >
        {podDetailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin />
          </div>
        ) : podDetail ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="状态">
                <Tag color={podDetail.status === 'Running' ? 'success' : 'error'}>{podDetail.status || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="IP">{podDetail.ip || '-'}</Descriptions.Item>
              <Descriptions.Item label="节点">{podDetail.node_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{podDetail.created_at || podDetail.age || '-'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ margin: '20px 0 8px' }}>容器</Title>
            <Table
              dataSource={podDetail.containers || []}
              rowKey={(r) => r.name || String(Math.random())}
              pagination={false}
              size="small"
              columns={[
                { title: '容器名', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{String(n || '-')}</Text> },
                { title: '镜像', dataIndex: 'image', key: 'image', render: (img) => <Text code style={{ fontSize: 12 }}>{String(img || '-')}</Text> },
                { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={String(s || '').includes('Running') ? 'success' : 'default'}>{String(s || '-')}</Tag> },
              ]}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无容器信息" /> }}
            />

            <Title level={5} style={{ margin: '20px 0 8px' }}>最近事件</Title>
            {podEvents.length > 0 ? (
              <div>
                {podEvents.map((ev, idx) => (
                  <Alert
                    key={idx}
                    title={`${ev.type || 'Normal'} / ${ev.reason || '-'}`}
                    description={`${ev.message || ''}${ev.last_timestamp ? ` (${ev.last_timestamp})` : ''}`}
                    type={ev.type === 'Warning' ? 'warning' : 'info'}
                    showIcon={ev.type === 'Warning'}
                    icon={ev.type === 'Warning' ? <ExclamationCircleOutlined /> : undefined}
                    style={{ marginBottom: 8, borderRadius: 6 }}
                  />
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />
            )}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到 Pod 详情" />
        )}
      </Drawer>
    </div>
  );
};

export default ServiceDetailPage;
