import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Tag,
  Empty,
  Modal,
  Input,
  Radio,
  Spin,
  Drawer,
  Table,
  Popconfirm,
  Select,
  Dropdown,
  Popover,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DiffOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CodeOutlined,
  ReloadOutlined,
  HistoryOutlined,
  DownOutlined,
  CloudSyncOutlined,
  FileAddOutlined,
  AppstoreAddOutlined,
  AppstoreOutlined,
  ControlOutlined,
  DesktopOutlined,
  HeartOutlined,
  DeleteOutlined,
  MoreOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import YamlEditor from '../../components/Editor/YamlEditor';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { serviceApi, ServiceDetail, type ServiceVariableKV } from '../../api/service';
import ImportFromRepoModal, { SyncServiceInfo } from './ImportFromRepoModal';
import ImportFromTemplateModal, { SyncTemplateServiceInfo } from './ImportFromTemplateModal';
import ServiceModulesDrawer from './ServiceModulesDrawer';
import ServiceVariablesDrawer from './ServiceVariablesDrawer';
import HelmServiceDrawer from './HelmServiceDrawer';
import PmServiceModal from './PmServiceModal';
import ImportFromKubeWorkloadsModal from './ImportFromKubeWorkloadsModal';
import { WorkspaceBrowserDrawer } from '../../components/Workspace/WorkspaceBrowserDrawer';
import { CollaborationAwarenessBar } from './CollaborationAwarenessBar';

const { Title, Text } = Typography;

interface ServiceItem {
  service_name: string;
  type?: string;
  yaml?: string;
  status?: string;
}

export const ServicesPage: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  const { currentProject } = useProjectStore();
  const location = useLocation();
  const navigate = useNavigate();
  const activeProject = projectName || currentProject;
  const isProduction = location.pathname.endsWith('/services/production');

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [originalYaml, setOriginalYaml] = useState<string>('');
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [creatingService, setCreatingService] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>('');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  // 版本历史抽屉（对齐旧版服务版本管理）
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ revision: number; create_time: number; create_by: string }>>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionYaml, setVersionYaml] = useState<{ revision: number; yaml: string } | null>(null);

  // 代码库导入 / 同步状态
  const [serviceDetail, setServiceDetail] = useState<ServiceDetail | null>(null);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [syncServiceInfo, setSyncServiceInfo] = useState<SyncServiceInfo | null>(null);

  // 模板导入 / 同步状态
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [syncTemplateInfo, setSyncTemplateInfo] = useState<SyncTemplateServiceInfo | null>(null);

  // 组件模块管理抽屉
  const [modulesDrawerOpen, setModulesDrawerOpen] = useState(false);

  // 变量配置与转换抽屉
  const [variablesDrawerOpen, setVariablesDrawerOpen] = useState(false);

  // Helm 服务管理抽屉
  const [helmDrawerOpen, setHelmDrawerOpen] = useState(false);

  // PM 主机服务弹窗
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [editingPmService, setEditingPmService] = useState<string | null>(null);

  // K8s 集群工作负载载入弹窗
  const [kubeWorkloadModalOpen, setKubeWorkloadModalOpen] = useState(false);

  // 工作空间代码库浏览器抽屉
  const [workspaceDrawerOpen, setWorkspaceDrawerOpen] = useState(false);

  // 协同编辑：仅保留远端 YAML 同步，移除未与后端通信的假独占锁
  const [syncingRemote, setSyncingRemote] = useState<boolean>(false);

  // 服务标签（R1-A2：GET/POST/DELETE /api/aslan/service/labels 接线）
  const [serviceLabels, setServiceLabels] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelSettings, setLabelSettings] = useState<Array<{ id: string; key: string; description?: string }>>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [labelSaving, setLabelSaving] = useState(false);
  const [newLabelId, setNewLabelId] = useState<string | undefined>(undefined);
  const [newLabelValue, setNewLabelValue] = useState('');

  const handleSyncRemoteYaml = async () => {
    if (!selectedService || !activeProject) return;
    setSyncingRemote(true);
    try {
      const detail = await serviceApi.getServiceDetail(
        selectedService,
        activeProject,
        isProduction,
        serviceDetail?.type || 'k8s'
      );
      const remoteYaml = detail.yaml || '';
      if (remoteYaml === yamlContent) {
        feedback.message.info('当前编辑内容与远端最新配置一致，无需合并');
      } else {
        setOriginalYaml(remoteYaml);
        setIsDiffMode(true);
        feedback.message.warning('远端配置存在更新！已自动进入 Diff 模式，左侧为远端最新，右侧为您当前编辑内容');
      }
    } catch {
      feedback.message.error('拉取远端配置失败，请检查网络');
    } finally {
      setSyncingRemote(false);
    }
  };

  const loadServices = useCallback(async () => {
    if (!activeProject) {
      setServices([]);
      return;
    }

    setLoading(true);
    try {
      const res = await http.get<ServiceItem[] | { data: ServiceItem[] }>(
        `/api/aslan/service/services?projectName=${activeProject}&production=${isProduction}`
      );
      const list = Array.isArray(res) ? res : ('data' in res && Array.isArray(res.data) ? res.data : []);
      setServices(list);
      const searchParams = new URLSearchParams(location.search);
      const queryServiceName = searchParams.get('serviceName') || searchParams.get('service');
      // LOOP1-A1: 列表无 yaml 字段，YAML 统一由 loadServiceDetail 回填；保留仍存在的当前选中项
      if (list.length > 0) {
        setSelectedService((prev) => {
          const byQuery = queryServiceName
            ? list.find((s) => s.service_name === queryServiceName)
            : undefined;
          if (byQuery) return byQuery.service_name;
          const byPrev = prev ? list.find((s) => s.service_name === prev) : undefined;
          if (byPrev) return byPrev.service_name;
          return list[0].service_name;
        });
      } else {
        setSelectedService(null);
        setYamlContent('');
        setOriginalYaml('');
      }
    } catch {
      setServices([]);
      setSelectedService(null);
      setYamlContent('');
      setOriginalYaml('');
      feedback.message.error('获取服务列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeProject, isProduction]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const loadServiceDetail = useCallback(async (serviceName: string) => {
    if (!activeProject || !serviceName) {
      setServiceDetail(null);
      return;
    }
    try {
      const detail = await serviceApi.getServiceDetail(serviceName, activeProject, isProduction);
      setServiceDetail(detail);
      // LOOP1-A1: 详情接口才返回 yaml，回填主编辑器
      setYamlContent(detail.yaml || '');
      setOriginalYaml(detail.yaml || '');
      setIsDiffMode(false);
    } catch {
      setServiceDetail(null);
      feedback.message.error('服务详情加载失败');
    }
  }, [activeProject, isProduction]);

  useEffect(() => {
    if (selectedService) {
      loadServiceDetail(selectedService);
    } else {
      setServiceDetail(null);
    }
  }, [selectedService, loadServiceDetail]);

  // --- 服务标签（R1-A2 接线） ---
  const loadServiceLabels = useCallback(async () => {
    if (!selectedService || !activeProject) {
      setServiceLabels([]);
      return;
    }
    setLabelsLoading(true);
    try {
      const list = await serviceApi.getServiceLabels(selectedService, activeProject, isProduction);
      setServiceLabels(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      setServiceLabels([]);
      feedback.message.error(err instanceof Error ? err.message : '服务标签加载失败');
    } finally {
      setLabelsLoading(false);
    }
  }, [selectedService, activeProject, isProduction]);

  useEffect(() => {
    loadServiceLabels();
    setLabelPopoverOpen(false);
    setNewLabelId(undefined);
    setNewLabelValue('');
  }, [loadServiceLabels]);

  // 标签键注册表：Popover 首次展开时懒加载（GET /api/aslan/system/labels）
  const openLabelPopover = async (nextOpen: boolean) => {
    setLabelPopoverOpen(nextOpen);
    if (nextOpen && labelSettings.length === 0) {
      try {
        const list = await serviceApi.getLabelSettings();
        setLabelSettings(Array.isArray(list) ? list : []);
      } catch (err: unknown) {
        feedback.message.error(err instanceof Error ? err.message : '标签键注册表获取失败');
      }
    }
  };

  const handleAddLabel = async () => {
    if (!selectedService || !activeProject || !newLabelId) {
      feedback.message.warning('请选择标签键');
      return;
    }
    const setting = labelSettings.find((s) => s.id === newLabelId);
    setLabelSaving(true);
    try {
      await serviceApi.createServiceLabel({
        label_id: newLabelId,
        project_key: activeProject,
        service_name: selectedService,
        value: newLabelValue,
        production: isProduction,
        key: setting?.key,
      });
      feedback.message.success('服务标签已添加');
      setLabelPopoverOpen(false);
      setNewLabelId(undefined);
      setNewLabelValue('');
      loadServiceLabels();
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '服务标签添加失败');
    } finally {
      setLabelSaving(false);
    }
  };

  const handleDeleteLabel = async (label: { id: string; key: string; value: string }) => {
    try {
      await serviceApi.deleteServiceLabel(label.id);
      feedback.message.success(`标签 [${label.key}] 已移除`);
      loadServiceLabels();
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '服务标签删除失败');
    }
  };

  // --- 服务删除（R1-A1 P0 闭环） ---
  const handleDeleteService = (serviceName: string) => {
    if (!serviceName || !activeProject) return;
    const svcType = serviceDetail?.service_name === serviceName
      ? serviceDetail?.type || 'k8s'
      : services.find((s) => s.service_name === serviceName)?.type || 'k8s';
    feedback.modal?.confirm({
      title: '确认删除服务？',
      content: `确定删除服务 [${serviceName}] 吗？删除后该服务的 YAML 配置与组件将被移除。`,
      okText: '删除服务',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await serviceApi.deleteService(serviceName, svcType, activeProject, isProduction);
          feedback.message.success('服务已成功删除');
          if (selectedService === serviceName) {
            setSelectedService(null);
            setYamlContent('');
            setOriginalYaml('');
            setServiceDetail(null);
            setServiceLabels([]);
          }
          loadServices();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            || (err instanceof Error ? err.message : '服务删除失败');
          feedback.message.error(msg);
        }
      },
    });
  };

  const handleSaveYaml = async () => {
    if (!selectedService || !activeProject) return;
    try {
      // 对齐旧版 saveServiceAPI（zadig-portal/src/api/index.js:388）：
      // POST /service/services?projectName=<product>&force=true。
      // createServiceTemplateRequest 的 source/type/visibility/yaml 均 binding:required；
      // visibility 沿用当前服务值（缺失则 'private'），variable_yaml 需先取详情保留。
      let visibility = 'private';
      let variableYaml = '';
      let serviceVariableKVs: ServiceVariableKV[] = [];
      try {
        const detail = await http.get<{
          visibility?: string;
          variable_yaml?: string;
          service_variable_kvs?: ServiceVariableKV[];
        }>(
          `/api/aslan/service/services/${encodeURIComponent(selectedService)}/k8s?projectName=${activeProject}&production=${isProduction}`,
          { skipErrorHandler: true }
        );
        visibility = detail?.visibility || 'private';
        variableYaml = detail?.variable_yaml || '';
        serviceVariableKVs = detail?.service_variable_kvs || [];
      } catch {
        // 详情获取失败时按默认 visibility 保存
      }

      // 保存前进行 YAML 合法性与占位符校验（对齐后端 /api/aslan/service/services/yaml/validator）
      try {
        const validationErrors = await serviceApi.validateServiceYaml({
          service_name: selectedService,
          variable_yaml: variableYaml,
          yaml: yamlContent,
        });
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          const errList = validationErrors.map((e) =>
            typeof e === 'string' ? e : (e as { message?: string })?.message || JSON.stringify(e)
          );
          feedback.message.error(`YAML 校验未通过: ${errList.join('; ')}`);
          return;
        }
      } catch {
        // 校验端点异常不阻断保存流程
      }

      // REA-S2-1: 若存在 variable_yaml，保存前将 YAML 占位变量转换为 service_variable_kvs，
      // 确保 YAML 与后端结构体 100% 同步，杜绝变量漂移。
      // 后端契约: ConvertVaraibleKVAndYamlArgs { action: 'toKV', yaml, kvs }
      if (variableYaml && variableYaml.trim()) {
        try {
          const converted = await serviceApi.convertVariableKVAndYaml({
            action: 'toKV',
            yaml: variableYaml,
            kvs: serviceVariableKVs,
          });
          if (converted && Array.isArray(converted.kvs)) {
            serviceVariableKVs = converted.kvs;
          }
        } catch {
          // 转换失败不阻断保存，沿用详情中的 service_variable_kvs
        }
      }

      await http.post(
        `/api/aslan/service/services?projectName=${activeProject}&force=true&production=${isProduction}`,
        {
          product_name: activeProject,
          service_name: selectedService,
          visibility,
          type: 'k8s',
          yaml: yamlContent,
          source: 'spock',
          variable_yaml: variableYaml,
          service_variable_kvs: serviceVariableKVs,
        },
        { skipErrorHandler: true }
      );
      setOriginalYaml(yamlContent);
      feedback.message.success(`服务 ${selectedService} 配置已保存成功！`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查网络与权限';
      feedback.message.error(msg);
    }
  };

  // 版本历史（对齐旧版服务版本管理；rollback 需专业版许可）
  const loadVersions = useCallback(async () => {
    if (!selectedService || !activeProject) return;
    setVersionLoading(true);
    try {
      const res = await http.get<Array<{ revision: number; create_time: number; create_by: string }>>(
        `/api/aslan/service/version/${encodeURIComponent(selectedService)}?projectName=${activeProject}&production=${isProduction}`,
        { skipErrorHandler: true }
      );
      setVersions(Array.isArray(res) ? res : []);
    } catch {
      setVersions([]);
      feedback.message.error('服务版本历史加载失败');
    } finally {
      setVersionLoading(false);
    }
  }, [selectedService, activeProject, isProduction]);

  // 版本对比（GET /service/version/:name/diff?revisionA=&revisionB=）
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<{
    yamlA: string; yamlB: string; variableA: string; variableB: string; type: string;
  } | null>(null);

  const handleCompare = async () => {
    if (!selectedService || !activeProject || !diffA || !diffB) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const res = await http.get<{
        type?: string; yaml_a?: string; yaml_b?: string; variable_yaml_a?: string; variable_yaml_b?: string;
      }>(
        `/api/aslan/service/version/${encodeURIComponent(selectedService)}/diff?projectName=${activeProject}&production=${isProduction}&revisionA=${diffA}&revisionB=${diffB}`,
        { skipErrorHandler: true }
      );
      setDiffResult({
        yamlA: res?.yaml_a || '',
        yamlB: res?.yaml_b || '',
        variableA: res?.variable_yaml_a || '',
        variableB: res?.variable_yaml_b || '',
        type: res?.type || 'k8s',
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.message || '获取版本对比失败';
      feedback.message.error(msg);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleViewRevision = async (revision: number) => {
    if (!selectedService || !activeProject) return;
    try {
      // CC-Loop02: Helm 服务可能只返回 variable_yaml
      const res = await http.get<{ yaml?: string; variable_yaml?: string }>(
        `/api/aslan/service/version/${encodeURIComponent(selectedService)}/revision/${revision}?projectName=${activeProject}&production=${isProduction}`,
        { skipErrorHandler: true }
      );
      const yamlContent = res.variable_yaml || res.yaml || '';
      setVersionYaml({ revision, yaml: yamlContent });
    } catch {
      setVersionYaml(null);
      feedback.message.error('版本 YAML 获取失败');
    }
  };

  const handleRollback = async (revision: number) => {
    if (!selectedService || !activeProject) return;
    try {
      await http.post(
        `/api/aslan/service/version/${encodeURIComponent(selectedService)}/rollback?projectName=${activeProject}&production=${isProduction}&revision=${revision}`,
        {}
      );
      feedback.message.success(`服务已回滚至版本 ${revision}`);
      // LOOP1-A2: 关闭版本预览并刷新当前服务详情（YAML / 变量）
      setVersionYaml(null);
      setIsDiffMode(false);
      await loadServiceDetail(selectedService);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '回滚失败';
      feedback.message.error(msg);
    }
  };

  const handleCreateService = async () => {
    const trimmedName = newServiceName.trim();
    if (!trimmedName) {
      feedback.message.warning('请输入服务名称');
      return;
    }
    if (!activeProject) {
      feedback.message.warning('未指定所属项目');
      return;
    }

    const defaultYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${trimmedName}
  labels:
    app.kubernetes.io/name: ${trimmedName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: ${trimmedName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${trimmedName}
    spec:
      containers:
        - name: ${trimmedName}
          image: nginx:alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: ${trimmedName}
spec:
  selector:
    app.kubernetes.io/name: ${trimmedName}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
`;

    setCreatingService(true);
    try {
      await http.post(`/api/aslan/service/services?production=${isProduction}&force=true`, {
        product_name: activeProject,
        service_name: trimmedName,
        source: 'spock',
        type: 'k8s',
        visibility: 'private',
        yaml: defaultYaml,
      });

      feedback.message.success(`服务 [${trimmedName}] 创建成功！`);
      setCreateModalVisible(false);
      setNewServiceName('');
      await loadServices();
      setSelectedService(trimmedName);
      setYamlContent(defaultYaml);
      setOriginalYaml(defaultYaml);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建服务失败，请检查名称是否重复或服务状态';
      feedback.message.error(msg);
    } finally {
      setCreatingService(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top action header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <CloudServerOutlined style={{ fontSize: 20, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {isProduction ? '生产服务配置' : '服务配置管理'}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  所属项目: <Tag color="blue">{activeProject || '全局工作区'}</Tag>
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal">
              <Radio.Group
                size="small"
                value={isProduction ? 'production' : 'testing'}
                onChange={(e) => {
                  const base = `/v1/projects/detail/${activeProject}/services`;
                  navigate(e.target.value === 'production' ? `${base}/production` : base);
                }}
              >
                <Radio.Button value="testing">测试配置</Radio.Button>
                <Radio.Button value="production">生产配置</Radio.Button>
              </Radio.Group>
              <Radio.Group
                size="small"
                value={editorTheme}
                onChange={(e) => setEditorTheme(e.target.value)}
              >
                <Radio.Button value="vs-dark">深色主题</Radio.Button>
                <Radio.Button value="light">浅色主题</Radio.Button>
              </Radio.Group>
              <Button
                icon={<DiffOutlined />}
                type={isDiffMode ? 'primary' : 'default'}
                onClick={() => setIsDiffMode(!isDiffMode)}
              >
                {isDiffMode ? '退出对比' : '版本对比'}
              </Button>
              <Button
                icon={<HistoryOutlined />}
                disabled={!selectedService}
                onClick={() => {
                  setVersionDrawerOpen(true);
                  loadVersions();
                }}
              >
                版本历史
              </Button>
              {Boolean(serviceDetail?.codehost_id) && (
                <Button
                  icon={<CloudSyncOutlined />}
                  onClick={() => {
                    setSyncServiceInfo({
                      service_name: serviceDetail!.service_name,
                      codehost_id: serviceDetail!.codehost_id,
                      repo_name: serviceDetail!.repo_name,
                      repo_owner: serviceDetail!.repo_owner,
                      repo_namespace: serviceDetail!.repo_namespace,
                      branch_name: serviceDetail!.branch_name,
                      load_path: serviceDetail!.load_path,
                      is_dir: serviceDetail!.is_dir,
                    });
                    setRepoModalOpen(true);
                  }}
                >
                  从代码库同步
                </Button>
              )}
              {Boolean(serviceDetail?.template_id) && (
                <Button
                  icon={<AppstoreAddOutlined />}
                  onClick={() => {
                    setSyncTemplateInfo({
                      service_name: serviceDetail!.service_name,
                      template_id: serviceDetail!.template_id,
                      auto_sync: serviceDetail!.auto_sync,
                      variable_yaml: serviceDetail!.variable_yaml,
                      service_variable_kvs: serviceDetail!.service_variable_kvs,
                    });
                    setTemplateModalOpen(true);
                  }}
                >
                  从模板同步
                </Button>
              )}
              <Button
                icon={<AppstoreOutlined />}
                disabled={!selectedService}
                onClick={() => setModulesDrawerOpen(true)}
              >
                组件模块
              </Button>
              <Button
                icon={<ControlOutlined />}
                disabled={!selectedService}
                onClick={() => setVariablesDrawerOpen(true)}
              >
                变量配置
              </Button>
              {serviceDetail?.type === 'pm' && (
                <Button
                  icon={<HeartOutlined />}
                  onClick={() => {
                    setEditingPmService(selectedService);
                    setPmModalOpen(true);
                  }}
                >
                  主机配置 & 探活
                </Button>
              )}
              <Button
                icon={<CloudServerOutlined />}
                onClick={() => setHelmDrawerOpen(true)}
              >
                Helm 服务
              </Button>
              <Button
                icon={<CodeOutlined />}
                onClick={() => setWorkspaceDrawerOpen(true)}
              >
                浏览代码库
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedService}
                onClick={() => selectedService && handleDeleteService(selectedService)}
              >
                删除服务
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveYaml}
              >
                保存配置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main editor area */}
      <Row gutter={[16, 16]}>
        {/* Service list column */}
        <Col xs={24} md={6}>
          <Card
            variant="borderless"
            title="服务组件列表"
            extra={
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'blank',
                      icon: <FileAddOutlined />,
                      label: '新建空白服务',
                      onClick: () => setCreateModalVisible(true),
                    },
                    {
                      key: 'workload',
                      icon: <ClusterOutlined />,
                      label: '从集群工作负载导入',
                      onClick: () => setKubeWorkloadModalOpen(true),
                    },
                    {
                      key: 'pm',
                      icon: <DesktopOutlined />,
                      label: '新建主机 (PM) 服务',
                      onClick: () => {
                        setEditingPmService(null);
                        setPmModalOpen(true);
                      },
                    },
                    {
                      key: 'repo',
                      icon: <CloudSyncOutlined />,
                      label: '从代码库导入服务',
                      onClick: () => {
                        setSyncServiceInfo(null);
                        setRepoModalOpen(true);
                      },
                    },
                    {
                      key: 'template',
                      icon: <AppstoreAddOutlined />,
                      label: '使用模板新建服务',
                      onClick: () => {
                        setSyncTemplateInfo(null);
                        setTemplateModalOpen(true);
                      },
                    },
                    {
                      key: 'helm',
                      icon: <CloudServerOutlined />,
                      label: 'Helm 服务管理 / 导入',
                      onClick: () => setHelmDrawerOpen(true),
                    },
                  ],
                }}
              >
                <Button type="link" icon={<PlusOutlined />}>
                  新建服务 <DownOutlined style={{ fontSize: 10 }} />
                </Button>
              </Dropdown>
            }
            styles={{ body: { padding: 0 } }}
            style={{ borderRadius: 8, height: 600, overflowY: 'auto' }}
          >
            <Spin spinning={loading}>
              {services.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                {services.map((item) => {
                  const isSelected = item.service_name === selectedService;
                  return (
                    <div
                      key={item.service_name}
                      onClick={() => {
                        // LOOP1-A1: 列表无 yaml；切换选中后由 loadServiceDetail 回填编辑器
                        if (item.service_name !== selectedService) {
                          setSelectedService(item.service_name);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: isSelected ? '#e6f4ff' : 'transparent',
                        borderLeft: isSelected ? '3px solid #0066ff' : '3px solid transparent',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Space orientation="horizontal">
                        <CodeOutlined style={{ color: isSelected ? '#0066ff' : '#8c8c8c' }} />
                        <Text strong={isSelected}>{item.service_name}</Text>
                      </Space>
                      <Space orientation="horizontal" size={4}>
                        {item.type === 'pm' ? (
                          <Tag color="purple">PM</Tag>
                        ) : item.type === 'helm' ? (
                          <Tag color="blue">Helm</Tag>
                        ) : (
                          <Tag color="cyan">K8s</Tag>
                        )}
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              {
                                key: 'delete',
                                icon: <DeleteOutlined />,
                                label: '删除服务',
                                danger: true,
                                onClick: ({ domEvent }) => {
                                  domEvent.stopPropagation();
                                  handleDeleteService(item.service_name);
                                },
                              },
                            ],
                          }}
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<MoreOutlined style={{ color: '#8c8c8c' }} />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Dropdown>
                      </Space>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无服务"
                style={{ padding: '40px 0' }}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalVisible(true)}
                >
                  创建服务
                </Button>
              </Empty>
            )}
            </Spin>
          </Card>
        </Col>

        {/* Monaco Editor / Diff Editor column */}
        <Col xs={24} md={18}>
          <Card
            variant="borderless"
            title={
              <Space orientation="horizontal">
                <Text strong>{selectedService || 'Kubernetes Manifest YAML'}</Text>
                {isDiffMode && <Tag color="orange">Diff 模式 (左: 线上基线 | 右: 当前编辑)</Tag>}
              </Space>
            }
            extra={
              <Space orientation="horizontal">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  disabled={!selectedService}
                  onClick={() => setYamlContent(originalYaml)}
                >
                  放弃修改
                </Button>
              </Space>
            }
            style={{ borderRadius: 8 }}
          >
            {selectedService ? (
              <>
                {/* 服务标签（R1-A2 接线：展示 + 快捷增删） */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                    padding: '6px 0',
                  }}
                >
                  <TagsOutlined style={{ color: '#8c8c8c' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>服务标签</Text>
                  {labelsLoading ? (
                    <Spin size="small" />
                  ) : serviceLabels.length > 0 ? (
                    serviceLabels.map((label) => (
                      <Tag
                        key={label.id}
                        color="blue"
                        closable
                        onClose={(e) => {
                          e.preventDefault();
                          handleDeleteLabel(label);
                        }}
                      >
                        {label.key}{label.value ? `: ${label.value}` : ''}
                      </Tag>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>暂无标签</Text>
                  )}
                  <Popover
                    title="添加服务标签"
                    trigger="click"
                    open={labelPopoverOpen}
                    onOpenChange={openLabelPopover}
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 260 }}>
                        <Select
                          placeholder="选择标签键（系统标签注册表）"
                          value={newLabelId}
                          onChange={setNewLabelId}
                          options={labelSettings.map((s) => ({
                            label: s.description ? `${s.key} (${s.description})` : s.key,
                            value: s.id,
                          }))}
                          notFoundContent="暂无可用标签键，请先在系统设置-标签中创建"
                        />
                        <Input
                          placeholder="标签值（可选）"
                          value={newLabelValue}
                          onChange={(e) => setNewLabelValue(e.target.value)}
                        />
                        <Button
                          type="primary"
                          size="small"
                          loading={labelSaving}
                          onClick={handleAddLabel}
                        >
                          添加标签
                        </Button>
                      </div>
                    }
                  >
                    <Button type="dashed" size="small" icon={<PlusOutlined />}>
                      添加标签
                    </Button>
                  </Popover>
                </div>
                <CollaborationAwarenessBar
                  serviceName={selectedService}
                  onSyncRemote={handleSyncRemoteYaml}
                  syncing={syncingRemote}
                />
                {isDiffMode ? (
                  <YamlDiffEditor
                    original={originalYaml}
                    modified={yamlContent}
                    theme={editorTheme}
                    height={520}
                  />
                ) : (
                  <YamlEditor
                    value={yamlContent}
                    onChange={setYamlContent}
                    theme={editorTheme}
                    height={520}
                  />
                )}
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="请在左侧选择或新建服务组件以查看并编辑 YAML 配置"
                style={{ padding: '120px 0' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Create Service Modal */}
      <Modal
        title="新建 Kubernetes 容器服务"
        open={createModalVisible}
        confirmLoading={creatingService}
        onOk={handleCreateService}
        onCancel={() => setCreateModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>服务组件标识 (DNS 命名规范):</Text>
          <Input
            placeholder="例如: backend-api, auth-service"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Version History Drawer (对齐旧版服务版本管理) */}
      <Drawer
        title={`版本历史: ${selectedService || ''}`}
        placement="right"
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        size="large"
        extra={
          <Button icon={<ReloadOutlined />} size="small" onClick={loadVersions}>
            刷新
          </Button>
        }
      >
        <Table
          dataSource={versions}
          rowKey="revision"
          loading={versionLoading}
          pagination={false}
          size="small"
          columns={[
            { title: '版本', dataIndex: 'revision', key: 'revision', render: (r: number) => <Tag color="geekblue">v{String(r)}</Tag> },
            { title: '创建人', dataIndex: 'create_by', key: 'create_by', render: (c: string) => <Text type="secondary">{String(c || '-')}</Text> },
            {
              title: '创建时间',
              dataIndex: 'create_time',
              key: 'create_time',
              render: (t: number) => (t ? new Date(t * 1000).toLocaleString() : '-'),
            },
            {
              title: '操作',
              key: 'action',
              render: (_: unknown, r: { revision: number }) => (
                <Space size={0}>
                  <Button type="link" size="small" onClick={() => handleViewRevision(r.revision)}>
                    查看 YAML
                  </Button>
                  <Popconfirm
                    title={`确定回滚至版本 ${r.revision}？`}
                    onConfirm={() => handleRollback(r.revision)}
                    okText="回滚"
                    cancelText="取消"
                  >
                    <Button type="link" size="small">
                      回滚
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史版本" /> }}
        />
        {versionYaml && (
          <Card size="small" style={{ marginTop: 16 }} title={`版本 ${versionYaml.revision} YAML`}>
            <YamlEditor value={versionYaml.yaml} theme="light" height={320} />
          </Card>
        )}

        {/* 版本对比（对齐旧版 DiffServiceVersions） */}
        <Card size="small" style={{ marginTop: 16 }} title="版本对比">
          <Space style={{ marginBottom: 12 }} wrap>
            <Select
              placeholder="版本 A"
              style={{ width: 140 }}
              value={diffA}
              onChange={setDiffA}
              options={versions.map((v) => ({ value: v.revision, label: `v${v.revision}` }))}
            />
            <Text type="secondary">→</Text>
            <Select
              placeholder="版本 B"
              style={{ width: 140 }}
              value={diffB}
              onChange={setDiffB}
              options={versions.map((v) => ({ value: v.revision, label: `v${v.revision}` }))}
            />
            <Button type="primary" loading={diffLoading} disabled={!diffA || !diffB || diffA === diffB} onClick={handleCompare}>
              对比
            </Button>
          </Space>
          {diffResult && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {diffResult.type === 'helm' ? 'Helm 服务：对比 values.yaml' : 'K8s 服务：对比服务 YAML'}
              </Text>
              {diffResult.type === 'helm' ? (
                <div style={{ marginTop: 8 }}>
                  <YamlDiffEditor original={diffResult.variableA} modified={diffResult.variableB} theme="light" height={360} />
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 8 }}>
                    <YamlDiffEditor original={diffResult.yamlA} modified={diffResult.yamlB} theme="light" height={360} />
                  </div>
                  {(diffResult.variableA || diffResult.variableB) && (
                    <>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>变量 YAML 对比</Text>
                      <div style={{ marginTop: 8 }}>
                        <YamlDiffEditor original={diffResult.variableA} modified={diffResult.variableB} theme="light" height={240} />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </Drawer>

      {/* Import / Sync from Git Codehost Modal */}
      <ImportFromRepoModal
        open={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        projectName={activeProject || ''}
        isProduction={isProduction}
        syncService={syncServiceInfo}
        onSuccess={(names) => {
          loadServices();
          if (names.length > 0) {
            setSelectedService(names[0]);
          }
        }}
      />

      {/* Import / Reload from YAML Template Modal */}
      <ImportFromTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        projectName={activeProject || ''}
        isProduction={isProduction}
        syncService={syncTemplateInfo}
        onSuccess={(name) => {
          loadServices();
          if (name) {
            setSelectedService(name);
          }
        }}
      />

      {/* Service Modules Management Drawer */}
      <ServiceModulesDrawer
        open={modulesDrawerOpen}
        onClose={() => setModulesDrawerOpen(false)}
        serviceName={selectedService || ''}
        projectName={activeProject || ''}
        isProduction={isProduction}
        containers={serviceDetail?.containers}
      />

      {/* Service Variables Configuration & Convert Drawer */}
      <ServiceVariablesDrawer
        open={variablesDrawerOpen}
        onClose={() => setVariablesDrawerOpen(false)}
        serviceName={selectedService || ''}
        projectName={activeProject || ''}
        isProduction={isProduction}
        initialKvs={serviceDetail?.service_variable_kvs || []}
        initialYaml={serviceDetail?.variable_yaml || ''}
        onSaved={(newKvs, newYaml) => {
          if (serviceDetail) {
            setServiceDetail({
              ...serviceDetail,
              service_variable_kvs: newKvs,
              variable_yaml: newYaml,
            });
          }
        }}
      />

      {/* Helm Service Management Drawer */}
      <HelmServiceDrawer
        open={helmDrawerOpen}
        onClose={() => {
          setHelmDrawerOpen(false);
          loadServices();
        }}
        projectName={activeProject || ''}
        isProduction={isProduction}
      />

      {/* PM Host Service Modal */}
      <PmServiceModal
        open={pmModalOpen}
        onClose={() => setPmModalOpen(false)}
        projectName={activeProject || ''}
        isProduction={isProduction}
        serviceName={editingPmService}
        serviceDetail={editingPmService ? serviceDetail : null}
        onSuccess={(name) => {
          loadServices();
          if (name) {
            setSelectedService(name);
          }
        }}
      />

      {/* K8s Workload Import Modal */}
      <ImportFromKubeWorkloadsModal
        open={kubeWorkloadModalOpen}
        onClose={() => setKubeWorkloadModalOpen(false)}
        projectName={activeProject || ''}
        isProduction={isProduction}
        onSuccess={(name) => {
          loadServices();
          if (name) {
            setSelectedService(name);
          }
        }}
      />

      {/* Code Workspace Browser Drawer */}
      <WorkspaceBrowserDrawer
        open={workspaceDrawerOpen}
        onClose={() => setWorkspaceDrawerOpen(false)}
        defaultCodeHostId={(serviceDetail as any)?.codehost_id}
        defaultRepo={(serviceDetail as any)?.repo_name || ''}
        defaultBranch={(serviceDetail as any)?.branch_name || 'master'}
      />
    </div>
  );
};

export default ServicesPage;
