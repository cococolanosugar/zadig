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
  RocketOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  DiffOutlined,
  GlobalOutlined,
  FieldTimeOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { useProjectStore } from '../../stores/project';
import PodTerminal from '../../components/Terminal/PodTerminal';
import EnvConfigDrawer from './EnvConfigDrawer';
import EnvWorkloadsDrawer from './EnvWorkloadsDrawer';
import HelmReleasesDrawer from './HelmReleasesDrawer';
import HelmRendersetDrawer from './HelmRendersetDrawer';
import EnvNodesDrawer from './EnvNodesDrawer';
import EnvEventsDrawer from './EnvEventsDrawer';
import EnvServiceHistoryDrawer from './EnvServiceHistoryDrawer';
import ServiceDiffModal from './ServiceDiffModal';
import ShareEnvModal from './ShareEnvModal';
import PortalServiceModal from './PortalServiceModal';
import IstioGrayscaleDrawer from './IstioGrayscaleDrawer';
import SleepCronModal from './SleepCronModal';
import EnvRevisionDrawer from './EnvRevisionDrawer';
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
  source?: string;
  // ShareEnv (自测模式 / 基准环境)
  share_env_enable?: boolean;
  share_env_is_base?: boolean;
  share_env_base_env?: string;
  // IstioGrayscale (灰度发布)
  istio_grayscale_enable?: boolean;
  istio_grayscale_is_base?: boolean;
  istio_grayscale_base_env?: string;
}

// GET /api/aslan/environment/kube/pods — kube.ListPodsInfoRespone
interface PodItem {
  name: string;
  ready: string;
  status: string;
  images?: string[];
  create_time?: number;
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
  const { currentProject, projects } = useProjectStore();
  const activeProject = projectName || currentProject;
  const searchParams = new URLSearchParams(location.search);

  // 深链承接（旧版路由 envs/{podDetail,resourceDetail,externalConfig} 被当作环境名导致假死）：
  //  podDetail      → 环境页 Pod 区并按 ?podName= 打开该 Pod 实时日志（无参时提示选择 Pod）
  //  resourceDetail → 自动打开「资源视图」抽屉（EnvWorkloadsDrawer）
  //  externalConfig → 自动打开「配置管理」抽屉（EnvConfigDrawer）
  // 真实环境名经 ?envName= 传入；无参数时落在安全列表态并明确提示
  const DEEP_LINK_MODES = ['podDetail', 'resourceDetail', 'externalConfig'];
  const deepLinkMode = DEEP_LINK_MODES.includes(routeEnvName || '')
    ? (routeEnvName as string)
    : searchParams.get('open') === 'config'
    ? 'externalConfig'
    : searchParams.get('open') === 'resources'
    ? 'resourceDetail'
    : searchParams.get('open') === 'podDetail'
    ? 'podDetail'
    : '';
  const deepLinkEnv = searchParams.get('envName') || '';
  const deepLinkPod = searchParams.get('podName') || '';

  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [currentEnv, setCurrentEnv] = useState<string>(deepLinkMode ? '' : routeEnvName || '');
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
  const [helmReleasesOpen, setHelmReleasesOpen] = useState(false);
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
  const currentProjectObj = projects.find((p) => (p.name || p.product_name) === activeProject);
  const currentEnvObj = environments.find((e) => e.name === currentEnv);
  const currentEnvIsSleeping = currentEnvObj?.status === 'Sleeping';
  // 门控 Helm 特性：项目为 Helm 架构或环境 source === 'helm'，避免非 Helm 环境调用 /helm/releases 触发后端查表 panic
  const isHelmEnv = Boolean(
    currentProjectObj?.deployType === 'helm' ||
    (currentProjectObj as { deploy_type?: string })?.deploy_type === 'helm' ||
    (currentProjectObj as { product_feature?: { deploy_type?: string } })?.product_feature?.deploy_type === 'helm' ||
    currentEnvObj?.source === 'helm'
  );

  // 管理服务（对齐旧版添加/删除服务；后端 PUT /environments/:name 全量替换服务组）
  const [svcModalOpen, setSvcModalOpen] = useState(false);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcSaving, setSvcSaving] = useState(false);
  const [availableSvcs, setAvailableSvcs] = useState<Array<{ service_name: string; type: string; selected: boolean; group: Array<{ service_name: string; type: string }> }>>([]);

  // Environment Change Log Drawer state
  const [changeLogOpen, setChangeLogOpen] = useState<boolean>(false);
  const [changeLogs, setChangeLogs] = useState<EnvOperationLogItem[]>([]);
  const [changeLogsLoading, setChangeLogsLoading] = useState<boolean>(false);
  const [changeLogsTotal, setChangeLogsTotal] = useState<number>(0);
  const [changeLogsPage, setChangeLogsPage] = useState<number>(1);

  // 节点列表与环境级事件抽屉状态
  const [nodesDrawerOpen, setNodesDrawerOpen] = useState(false);
  const [eventsDrawerOpen, setEventsDrawerOpen] = useState(false);

  // 服务版本历史抽屉状态
  const [historyServiceName, setHistoryServiceName] = useState<string>('');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Helm 渲染配置抽屉状态
  const [helmRendersetOpen, setHelmRendersetOpen] = useState(false);

  // 服务模板差异对比弹窗状态
  const [diffTargetService, setDiffTargetService] = useState<string>('');
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  // 自测模式 (ShareEnv) 弹窗状态
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalMode, setShareModalMode] = useState<'enable' | 'disable'>('enable');

  // 入口服务网关配置弹窗 (PortalService)
  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [portalTargetService, setPortalTargetService] = useState('');
  const [portalIsGrayscale, setPortalIsGrayscale] = useState(false);

  // Istio 灰度发布管理抽屉状态
  const [grayscaleDrawerOpen, setGrayscaleDrawerOpen] = useState(false);

  // 定时睡眠与唤醒弹窗 (F8)
  const [sleepCronModalOpen, setSleepCronModalOpen] = useState(false);

  // 环境版本与快照记录抽屉状态 (F10)
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);

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
      if (deepLinkMode) {
        // 深链模式：环境名来自 ?envName=，不在路径段上；缺失时落到默认环境或安全列表态
        const target = deepLinkEnv ? list.find((e) => e.name === deepLinkEnv) : undefined;
        if (target) setCurrentEnv(target.name);
        else if (list.length > 0 && !currentEnv) setCurrentEnv(list[0].name);
      } else if (routeEnvName) {
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
  }, [activeProject, routeEnvName, currentEnv, deepLinkMode, deepLinkEnv]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const loadWorkloadPods = useCallback(async () => {
    if (!activeProject || !currentEnv) return;
    try {
      // 后端实际端点为 kube/pods（environments/:name/workloads/pods 不存在）
      const res = await http.get<PodItem[]>(
        `/api/aslan/environment/kube/pods?projectName=${activeProject}&envName=${currentEnv}&production=${currentEnvObj?.production ?? false}`
      );
      setPods(Array.isArray(res) ? res : []);
    } catch {
      setPods([]);
      feedback.message.error('获取 Pod 列表失败，请稍后重试');
    }
  }, [activeProject, currentEnv, currentEnvObj?.production]);

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
        `/api/aslan/environment/environments/${currentEnv}/k8s/globalVariables?projectName=${activeProject}&production=${currentEnvObj?.production ?? false}`,
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

  // 管理服务：加载 init_info（项目全部服务）+ 环境详情（当前服务/revision），标记勾选态
  const loadServiceManagement = useCallback(async () => {
    if (!activeProject || !currentEnv) return;
    setSvcLoading(true);
    try {
      const [initRes, detailRes] = await Promise.all([
        http.get<{ services?: Array<Array<{ service_name: string; type: string }>> }>(
          `/api/aslan/environment/init_info/${activeProject}?envType=general&isBaseEnv=true&baseEnv=&projectName=${activeProject}`,
          { skipErrorHandler: true }
        ),
        http.get<Record<string, unknown>>(
          `/api/aslan/environment/environments/${currentEnv}?projectName=${activeProject}`,
          { skipErrorHandler: true }
        ),
      ]);
      const current = new Set<string>();
      ((detailRes as { services?: Array<Array<{ service_name?: string }>> })?.services || []).forEach((group) =>
        (group || []).forEach((s) => {
          if (s.service_name) current.add(s.service_name);
        })
      );
      const flat: Array<{ service_name: string; type: string; selected: boolean; group: Array<{ service_name: string; type: string }> }> = [];
      ((initRes as { services?: Array<Array<{ service_name?: string; type?: string }>> })?.services || []).forEach((group) => {
        const normalized = (group || []).map((s) => ({ service_name: s.service_name || '', type: s.type || 'k8s' }));
        normalized.forEach((s) => {
          flat.push({
            service_name: s.service_name,
            type: s.type,
            selected: current.has(s.service_name),
            group: normalized,
          });
        });
      });
      setAvailableSvcs(flat);
    } catch {
      setAvailableSvcs([]);
    } finally {
      setSvcLoading(false);
    }
  }, [activeProject, currentEnv]);

  const handleSaveServices = async () => {
    if (!activeProject || !currentEnv) return;
    setSvcSaving(true);
    try {
      // 环境详情作为 PUT body（后端全量替换服务组），勾选的服务聚为一组
      const detail = await http.get<Record<string, unknown>>(
        `/api/aslan/environment/environments/${currentEnv}?projectName=${activeProject}`,
        { skipErrorHandler: true }
      );
      const selectedGroup: Array<{ service_name: string; type: string }> = [];
      const seen = new Set<string>();
      availableSvcs.forEach((s) => {
        if (s.selected && !seen.has(s.service_name)) {
          seen.add(s.service_name);
          selectedGroup.push({ service_name: s.service_name, type: s.type });
        }
      });
      const body = { ...(detail as Record<string, unknown>), services: [selectedGroup] };
      delete (body as { created_at?: unknown }).created_at;
      delete (body as { updated_at?: unknown }).updated_at;
      const r = await http.put(
        `/api/aslan/environment/environments/${currentEnv}?projectName=${activeProject}&type=k8s`,
        body
      );
      feedback.message.success(
        `环境服务已更新（当前 ${selectedGroup.length} 个服务），正在后台同步资源`
      );
      setSvcModalOpen(false);
      return r;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '环境服务更新失败';
      feedback.message.error(msg);
      return undefined;
    } finally {
      setSvcSaving(false);
    }
  };

  useEffect(() => {
    loadWorkloadPods();
  }, [loadWorkloadPods]);

  // kube/pods 不返回容器名，日志/终端需先取 Pod 详情中的容器列表
  const openPodDetailForContainers = async (pod: PodItem) => {
    try {
      const res = await http.get<{
        containers?: Array<{ name?: string; image?: string }>;
      }>(
        `/api/aslan/environment/kube/pods/${pod.name}?projectName=${activeProject}&envName=${currentEnv}`,
        { skipErrorHandler: true }
      );
      const containers = (res?.containers || []).map((c) => c.name || '').filter(Boolean);
      return containers;
    } catch {
      return [];
    }
  };

  const openTerminal = async (pod: PodItem) => {
    const containers = await openPodDetailForContainers(pod);
    const containerName = containers[0] || pod.name;
    setActivePod({ podName: pod.name, containerName });
    setTerminalVisible(true);
  };

  const openLogs = (pod: PodItem) => {
    // 容器名需实时获取；若无容器信息则退化为 pod 名（K8s 单容器场景常一致）
    openPodDetailForContainers(pod).then((containers) => {
      const containerName = containers[0] || pod.name;
      setActiveLogPod(pod.name);
      setStreamingLogUrl(
        `/api/logs/sse/pods/${pod.name}/containers/${containerName}?envName=${currentEnv}&projectName=${activeProject}&tails=100`
      );
      setLogDrawerVisible(true);
    });
  };

  // 深链承接 effect：环境与 Pod 列表就绪后，按 deepLinkMode 打开对应视图
  useEffect(() => {
    if (!deepLinkMode) return;
    if (!currentEnv) {
      // 未指定环境且列表为空 → 安全提示，不渲染假死态
      feedback.message.warning('该链接未指定环境，请从环境列表选择环境后再查看');
      return;
    }
    if (deepLinkMode === 'resourceDetail') {
      setWorkloadsDrawerOpen(true);
    } else if (deepLinkMode === 'externalConfig') {
      setConfigDrawerOpen(true);
    } else if (deepLinkMode === 'podDetail') {
      const pod = deepLinkPod ? pods.find((p) => p.name === deepLinkPod || p.name.startsWith(`${deepLinkPod}-`)) : undefined;
      if (pod) {
        openLogs(pod);
      } else {
        feedback.message.info(deepLinkPod ? `未在环境 [${currentEnv}] 中找到 Pod ${deepLinkPod}，请在 Pod 实例列表中选择` : '请在「Pod 实例」列表中选择要查看的 Pod');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkMode, currentEnv, pods]);

  const handleScaleReplicas = async () => {
    if (!activeProject || !currentEnv) return;
    setScaling(true);
    try {
      const targetService = (pods[0]?.name || '').replace(/-[a-z0-9]+(-[a-z0-9]+)?$/, '') || pods[0]?.name || '';
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
      title: '镜像',
      key: 'images',
      ellipsis: true,
      render: (_, record) => (
        <Text code style={{ fontSize: 12 }}>{(record.images || [])[0] || '-'}</Text>
      ),
    },
    {
      title: '存活运行时长',
      key: 'age',
      render: (_, record) => (
        <Text type="secondary">{record.create_time ? Math.max(1, Math.floor((Date.now() / 1000 - record.create_time) / 86400)) + 'd' : '-'}</Text>
      ),
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
              `/v1/projects/detail/${activeProject}/envs/${currentEnv}/k8s/${record.name}?service=${record.name}`
            )
          }
        >
          服务详情
        </Button>,
        <Button
          key="history"
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => {
            setHistoryServiceName(record.name);
            setHistoryDrawerOpen(true);
          }}
        >
          版本历史
        </Button>,
        <Button
          key="diff"
          type="link"
          icon={<DiffOutlined />}
          onClick={() => {
            setDiffTargetService(record.name);
            setDiffModalOpen(true);
          }}
        >
          服务差异
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
        ...(currentEnvObj?.share_env_is_base || currentEnvObj?.istio_grayscale_is_base
          ? [
              <Button
                key="portal"
                type="link"
                icon={<GlobalOutlined />}
                onClick={() => {
                  setPortalTargetService(record.name);
                  setPortalIsGrayscale(Boolean(currentEnvObj?.istio_grayscale_is_base));
                  setPortalModalOpen(true);
                }}
              >
                网关配置
              </Button>,
            ]
          : []),
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
                    style={{ minWidth: 160 }}
                    size="small"
                    options={environments.map((e) => {
                      let extraTag = '';
                      if (e.share_env_is_base) extraTag = ' [自测基准]';
                      else if (e.share_env_base_env) extraTag = ` [自测: ${e.share_env_base_env}]`;
                      else if (e.istio_grayscale_is_base) extraTag = ' [灰度基准]';
                      else if (e.istio_grayscale_base_env) extraTag = ` [灰度: ${e.istio_grayscale_base_env}]`;

                      return {
                        label: (e.alias ? `${e.alias} (${e.name})` : `${e.name} (${e.status || 'Running'})`) + extraTag,
                        value: e.name,
                      };
                    })}
                  />
                  {currentEnvObj?.production ? (
                    <Tag color="gold">生产</Tag>
                  ) : (
                    <Tag color="green">测试</Tag>
                  )}
                  {currentEnvObj?.share_env_is_base && (
                    <Tag color="purple">自测·基准环境</Tag>
                  )}
                  {currentEnvObj?.share_env_base_env && (
                    <Tag color="blue">自测·子环境 (基准: {currentEnvObj.share_env_base_env})</Tag>
                  )}
                  {currentEnvObj?.istio_grayscale_is_base && (
                    <Tag color="magenta">灰度·基准环境</Tag>
                  )}
                  {currentEnvObj?.istio_grayscale_base_env && (
                    <Tag color="cyan">灰度·子环境 (基准: {currentEnvObj.istio_grayscale_base_env})</Tag>
                  )}
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
                onClick={() => {
                  setSvcModalOpen(true);
                  loadServiceManagement();
                }}
                disabled={!currentEnv}
              >
                管理服务
              </Button>
              {isHelmEnv && (
                <>
                  <Button
                    icon={<RocketOutlined />}
                    onClick={() => setHelmReleasesOpen(true)}
                    disabled={!currentEnv}
                  >
                    Helm Releases
                  </Button>
                  <Button
                    icon={<CodeOutlined />}
                    onClick={() => setHelmRendersetOpen(true)}
                    disabled={!currentEnv}
                  >
                    Helm 渲染配置
                  </Button>
                </>
              )}
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
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setEventsDrawerOpen(true)}
                disabled={!currentEnv}
              >
                环境事件
              </Button>
              <Button
                icon={<ClusterOutlined />}
                onClick={() => setNodesDrawerOpen(true)}
                disabled={!currentEnv}
              >
                节点列表
              </Button>
              <Button
                icon={<DeploymentUnitOutlined />}
                onClick={() => setRevisionDrawerOpen(true)}
                disabled={!currentEnv}
              >
                环境版本
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
                      key: 'revision',
                      icon: <DeploymentUnitOutlined />,
                      label: '环境版本与快照',
                      disabled: !currentEnv,
                      onClick: () => setRevisionDrawerOpen(true),
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
                    {
                      key: 'sleep-cron',
                      icon: <FieldTimeOutlined />,
                      label: '定时睡眠/唤醒',
                      disabled: !currentEnv,
                      onClick: () => {
                        setSleepCronModalOpen(true);
                      },
                    },
                    // ShareEnv (Non-production environments)
                    ...(!currentEnvObj?.production
                      ? currentEnvObj?.share_env_enable
                        ? [
                            {
                              key: 'share-portal',
                              icon: <GlobalOutlined />,
                              label: '自测网关配置',
                              onClick: () => {
                                setPortalTargetService('');
                                setPortalIsGrayscale(false);
                                setPortalModalOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                            {
                              key: 'share-disable',
                              icon: <ControlOutlined />,
                              label: '关闭自测模式',
                              danger: true,
                              onClick: () => {
                                setShareModalMode('disable');
                                setShareModalOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                          ]
                        : [
                            {
                              key: 'share-enable',
                              icon: <ControlOutlined />,
                              label: '开启自测模式',
                              onClick: () => {
                                setShareModalMode('enable');
                                setShareModalOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                          ]
                      : []),
                    // IstioGrayscale (Production environments)
                    ...(currentEnvObj?.production
                      ? currentEnvObj?.istio_grayscale_enable
                        ? [
                            {
                              key: 'grayscale-config',
                              icon: <RocketOutlined />,
                              label: '灰度发布配置',
                              onClick: () => {
                                setGrayscaleDrawerOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                            {
                              key: 'grayscale-portal',
                              icon: <GlobalOutlined />,
                              label: '灰度网关配置',
                              onClick: () => {
                                setPortalTargetService('');
                                setPortalIsGrayscale(true);
                                setPortalModalOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                          ]
                        : [
                            {
                              key: 'grayscale-enable',
                              icon: <RocketOutlined />,
                              label: '开启灰度发布',
                              onClick: () => {
                                setGrayscaleDrawerOpen(true);
                              },
                              disabled: !currentEnv,
                            },
                          ]
                      : []),
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
            production={environments.find((e) => e.name === currentEnv)?.production ?? false}
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

      {/* Helm Releases Drawer (对齐旧版 Helm 环境的 Release 状态与 diff) */}
      {isHelmEnv && (
        <HelmReleasesDrawer
          open={helmReleasesOpen}
          onClose={() => setHelmReleasesOpen(false)}
          envName={currentEnv || ''}
          projectName={activeProject || ''}
          production={environments.find((e) => e.name === currentEnv)?.production ?? false}
        />
      )}

      {/* 节点列表抽屉 (对齐旧版 kube GET /nodes 节点健康与 IP) */}
      <EnvNodesDrawer
        open={nodesDrawerOpen}
        onClose={() => setNodesDrawerOpen(false)}
        clusterId={currentEnvObj?.cluster_id || ''}
        envName={currentEnv || ''}
      />

      {/* 环境级与资源级实时事件抽屉 (对齐旧版 kube GET /events) */}
      <EnvEventsDrawer
        open={eventsDrawerOpen}
        onClose={() => setEventsDrawerOpen(false)}
        projectName={activeProject || ''}
        envName={currentEnv || ''}
        production={currentEnvObj?.production ?? false}
      />

      {/* 服务版本历史抽屉 (对齐旧版 GET /environments/:name/version/:serviceName) */}
      <EnvServiceHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => {
          setHistoryDrawerOpen(false);
          setHistoryServiceName('');
        }}
        projectName={activeProject || ''}
        envName={currentEnv || ''}
        serviceName={historyServiceName}
        isHelmChart={Boolean(isHelmEnv)}
        production={currentEnvObj?.production ?? false}
        onRollbackSuccess={() => {
          loadWorkloadPods();
        }}
      />

      {/* Helm 渲染配置抽屉 (对齐旧版 /rendersets/*) */}
      {isHelmEnv && (
        <HelmRendersetDrawer
          open={helmRendersetOpen}
          onClose={() => setHelmRendersetOpen(false)}
          projectName={activeProject || ''}
          envName={currentEnv || ''}
          production={currentEnvObj?.production ?? false}
        />
      )}

      {/* 服务模板差异对比弹窗 (对齐旧版 GET /diff/products/:name/service/:svc) */}
      <ServiceDiffModal
        open={diffModalOpen}
        onClose={() => {
          setDiffModalOpen(false);
          setDiffTargetService('');
        }}
        projectName={activeProject || ''}
        envName={currentEnv || ''}
        serviceName={diffTargetService}
        production={currentEnvObj?.production ?? false}
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

      {/* Manage Services Modal (对齐旧版「管理服务」添加/移除) */}
      <Modal
        title={`管理服务: ${currentEnv}`}
        open={svcModalOpen}
        onCancel={() => setSvcModalOpen(false)}
        onOk={handleSaveServices}
        confirmLoading={svcSaving}
        okText="确定"
        cancelText="取消"
        width={520}
      >
        {svcLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : availableSvcs.length > 0 ? (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {availableSvcs.map((s) => (
              <label
                key={s.service_name}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={() => {
                    setAvailableSvcs((prev) =>
                      prev.map((x) => (x.service_name === s.service_name ? { ...x, selected: !x.selected } : x))
                    );
                  }}
                />
                <Text strong style={{ fontSize: 13 }}>{s.service_name}</Text>
                <Tag color="geekblue" style={{ marginLeft: 'auto' }}>{s.type}</Tag>
              </label>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="项目内暂无服务，请先在「服务配置」中创建" />
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

      {/* Share Environment Modal (自测模式开启/关闭) */}
      {shareModalOpen && (
        <ShareEnvModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          projectName={activeProject || ''}
          envName={currentEnv}
          clusterId={currentEnvObj?.cluster_id}
          mode={shareModalMode}
          onSuccess={() => {
            loadEnvironments();
          }}
        />
      )}

      {/* Portal Service Gateway Configuration Modal (入口服务网关配置) */}
      {portalModalOpen && (
        <PortalServiceModal
          open={portalModalOpen}
          onClose={() => setPortalModalOpen(false)}
          projectName={activeProject || ''}
          envName={currentEnv}
          serviceName={portalTargetService}
          availableServices={pods.map((p) => p.name)}
          isGrayscale={portalIsGrayscale}
          onSuccess={() => {
            loadEnvironments();
          }}
        />
      )}

      {/* Istio Grayscale Drawer (灰度发布管理) */}
      {grayscaleDrawerOpen && (
        <IstioGrayscaleDrawer
          open={grayscaleDrawerOpen}
          onClose={() => setGrayscaleDrawerOpen(false)}
          projectName={activeProject || ''}
          envName={currentEnv}
          clusterId={currentEnvObj?.cluster_id}
          namespace={currentEnvObj?.namespace}
          isBase={currentEnvObj?.istio_grayscale_is_base}
          isGrayscaleEnabled={currentEnvObj?.istio_grayscale_enable}
          environments={environments}
          availableServices={pods.map((p) => p.name)}
          onSuccess={() => {
            loadEnvironments();
          }}
        />
      )}

      {/* Scheduled Sleep and Wake Cron Modal (F8) */}
      <SleepCronModal
        open={sleepCronModalOpen}
        projectName={activeProject || ''}
        envName={currentEnv || ''}
        production={currentEnvObj?.production ?? false}
        onClose={() => setSleepCronModalOpen(false)}
        onSuccess={() => {
          loadEnvironments();
        }}
      />

      {/* Environment Revision and Snapshots Drawer (F10) */}
      <EnvRevisionDrawer
        open={revisionDrawerOpen}
        projectName={activeProject || ''}
        envName={currentEnv || ''}
        production={currentEnvObj?.production ?? false}
        onClose={() => setRevisionDrawerOpen(false)}
        onSuccess={() => {
          loadEnvironments();
        }}
      />
    </div>
  );
};

export default EnvironmentsPage;
