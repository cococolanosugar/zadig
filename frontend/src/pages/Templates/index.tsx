import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Tag, Typography, Button, Space, Input, Row, Col, Spin, Empty, Badge, Drawer, Tooltip, Modal, Form, Popconfirm, Alert, Select, InputNumber, Switch, Descriptions } from 'antd';
import {
  AppstoreOutlined,
  BranchesOutlined,
  FileTextOutlined,
  ContainerOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  PlusOutlined,
  RocketOutlined,
  ReloadOutlined,
  TagsOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import templateApi, {
  type WorkflowTemplateItem,
  type WorkflowTemplateI18n,
  type YamlTemplateItem,
  type DockerfileTemplateItem,
  type ChartTemplateItem,
  type BuildTemplateItem,
  type ScannerTemplateItem,
  templateCrudApi,
} from '../../api/template';
import { settingsApi } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Title, Text, Paragraph } = Typography;

export const TemplateCenterPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegment = location.pathname.split('/')[3];
  const initialTab = tab || pathSegment || searchParams.get('tab') || 'k8s-yamls';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const current = tab || pathSegment || searchParams.get('tab');
    if (current) {
      setActiveTab(current);
    }
  }, [tab, pathSegment, searchParams]);

  const handleTabChange = (k: string) => {
    setActiveTab(k);
    navigate(`/v1/template/${k}`);
  };
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  // 页面级错误通道：列表接口失败时展示错误与重试，不再以空数据误导（P1-05）
  const [listError, setListError] = useState<string | null>(null);
  // 模板内容查看抽屉（对齐旧版「查看内容」）
  const [viewing, setViewing] = useState<{ title: string; content: string; variables?: Array<{ key: string; value?: string }> } | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<WorkflowTemplateItem | null>(null);

  // 模板新建/编辑：YAML/Dockerfile 内容型 + Chart 仓库源 + Build 脚本 + Scanning 配置（P1-02 写能力）
  const [editing, setEditing] = useState<
    | { kind: 'yaml'; id?: string; name: string; content: string }
    | { kind: 'dockerfile'; id?: string; name: string; content: string }
    | { kind: 'chart'; id?: string; name: string }
    | { kind: 'build'; id?: string; name: string }
    | { kind: 'scanning'; id?: string; name: string }
    | null
  >(null);
  const [editingForm] = Form.useForm();
  const [editingSaving, setEditingSaving] = useState(false);
  // Chart 模板编辑需代码源下拉（settingsApi.getCodeHosts）
  const [codehostOptions, setCodehostOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ---------- R9 任务二: 模板引用（Reference）抽屉与一键同步 ----------
  type ReferenceTarget = { kind: 'yaml' | 'dockerfile' | 'chart' | 'build' | 'scanning'; id?: string; name: string };
  const [refTarget, setRefTarget] = useState<ReferenceTarget | null>(null);
  const [refDrawerOpen, setRefDrawerOpen] = useState(false);
  const [refList, setRefList] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refSyncing, setRefSyncing] = useState(false);

  const openReferenceDrawer = async (target: ReferenceTarget) => {
    setRefTarget(target);
    setRefDrawerOpen(true);
    setRefList([]);
    setRefLoading(true);
    try {
      let list: any[] = [];
      if (target.kind === 'yaml' && target.id) {
        list = await templateCrudApi.getYamlTemplateReference(target.id);
      } else if (target.kind === 'dockerfile' && target.id) {
        list = await templateCrudApi.getDockerfileTemplateReference(target.id);
      } else if (target.kind === 'build' && target.id) {
        list = await templateCrudApi.getBuildTemplateReference(target.id);
      } else if (target.kind === 'scanning' && target.id) {
        list = await templateCrudApi.getScanningTemplateReference(target.id);
      } else if (target.kind === 'chart' && target.name) {
        list = await templateApi.getChartTemplateReference(target.name);
      }
      setRefList(list);
    } catch (err: unknown) {
      setRefList([]);
      feedback.message.error(err instanceof Error ? err.message : '模板引用列表获取失败');
    } finally {
      setRefLoading(false);
    }
  };

  const handleSyncReference = async () => {
    if (!refTarget) return;
    setRefSyncing(true);
    try {
      if (refTarget.kind === 'yaml' && refTarget.id) {
        await templateCrudApi.syncYamlTemplateReference(refTarget.id);
      } else if (refTarget.kind === 'chart' && refTarget.name) {
        await templateCrudApi.syncChartTemplateReference(refTarget.name);
      }
      feedback.message.success('模板变更已成功同步到引用服务');
      setRefDrawerOpen(false);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '模板同步失败');
    } finally {
      setRefSyncing(false);
    }
  };

  // ---------- R9 任务三: YAML 变量提取与 Dockerfile 语法校验 ----------
  const [extractingVars, setExtractingVars] = useState(false);
  const [extractedVars, setExtractedVars] = useState<Array<{ key: string; value?: string }>>([]);

  const handleExtractVars = async () => {
    const content = editingForm.getFieldValue('content');
    if (!content) {
      feedback.message.warning('请先填写模板内容再提取变量');
      return;
    }
    setExtractingVars(true);
    try {
      const vars = await templateApi.extractYamlVariables({ content });
      setExtractedVars(Array.isArray(vars) ? vars : []);
      feedback.message.success(`成功识别 ${Array.isArray(vars) ? vars.length : 0} 个模板变量`);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '模板变量提取失败');
    } finally {
      setExtractingVars(false);
    }
  };

  const [validatingDockerfile, setValidatingDockerfile] = useState(false);
  const handleValidateDockerfile = async () => {
    const content = editingForm.getFieldValue('content');
    if (!content) {
      feedback.message.warning('请先填写 Dockerfile 内容再校验');
      return;
    }
    setValidatingDockerfile(true);
    try {
      await templateApi.validateDockerfile({ content });
      feedback.message.success('Dockerfile 语法校验通过');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '');
      feedback.message.error(msg ? `Dockerfile 语法校验未通过: ${msg}` : 'Dockerfile 语法校验未通过');
    } finally {
      setValidatingDockerfile(false);
    }
  };

  // ---------- R9 任务四: Chart 模板 values 变量配置抽屉 ----------
  const [chartVarsOpen, setChartVarsOpen] = useState(false);
  const [chartVarsName, setChartVarsName] = useState('');
  const [chartVarsContent, setChartVarsContent] = useState('');
  const [chartVarsLoading, setChartVarsLoading] = useState(false);
  const [chartVarsSaving, setChartVarsSaving] = useState(false);

  const openChartVarsDrawer = async (chartName: string) => {
    setChartVarsName(chartName);
    setChartVarsOpen(true);
    setChartVarsLoading(true);
    setChartVarsContent('');
    try {
      const res = await templateApi.getChartTemplateVariables(chartName);
      // 后端返回 values yaml 内容（string 或 {content} 包裹），防御性归一
      const content = typeof res === 'string' ? res : (res as { content?: string })?.content || JSON.stringify(res, null, 2);
      setChartVarsContent(content);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : 'Chart 模板变量获取失败');
    } finally {
      setChartVarsLoading(false);
    }
  };

  const handleSaveChartVars = async () => {
    if (!chartVarsName) return;
    setChartVarsSaving(true);
    try {
      await templateApi.saveChartTemplateVariables(chartVarsName, { content: chartVarsContent });
      feedback.message.success('Chart 模板变量已更新');
      setChartVarsOpen(false);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : 'Chart 模板变量保存失败');
    } finally {
      setChartVarsSaving(false);
    }
  };

  // ---------- R9 任务五: 发布计划模板详情抽屉与删除 ----------
  const [planTplDetailOpen, setPlanTplDetailOpen] = useState(false);
  const [planTplDetail, setPlanTplDetail] = useState<any>(null);
  const [planTplLoading, setPlanTplLoading] = useState(false);

  const openPlanTplDetail = async (id: string) => {
    setPlanTplDetailOpen(true);
    setPlanTplLoading(true);
    setPlanTplDetail(null);
    try {
      const detail = await templateCrudApi.getReleasePlanTemplateDetail(id);
      setPlanTplDetail(detail || null);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '发布计划模板详情获取失败');
    } finally {
      setPlanTplLoading(false);
    }
  };

  const handleDeletePlanTemplate = async (id: string, name?: string) => {
    try {
      await templateCrudApi.deleteReleasePlanTemplate(id);
      feedback.message.success('发布计划模板已删除');
      setReleasePlanTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : `删除发布计划模板 [${name || id}] 失败`);
    }
  };

  const openCreateTemplate = () => {
    const kindByTab: Record<string, 'yaml' | 'dockerfile' | 'chart' | 'build' | 'scanning'> = {
      'k8s-yamls': 'yaml',
      dockerfiles: 'dockerfile',
      charts: 'chart',
      builds: 'build',
      scanners: 'scanning',
    };
    const kind = kindByTab[activeTab];
    if (!kind) {
      feedback.message.info('该类模板由对应功能模块内创建（工作流/发布计划配置保存后自动收录）');
      return;
    }
    if (kind === 'build') {
      editingForm.setFieldsValue({ name: '', scripts: '', timeout: 600 });
    } else if (kind === 'scanning') {
      editingForm.setFieldsValue({ name: '', scanner_type: 'sonar', enable_scanner: true, parameter: '', scripts: '' });
    } else if (kind === 'chart') {
      editingForm.setFieldsValue({ name: '', codeHostID: undefined, owner: '', namespace: '', repo: '', branch: '', path: '' });
    } else {
      editingForm.setFieldsValue({ name: '', content: '' });
    }
    setExtractedVars([]);
    setEditing({ kind, name: '' } as NonNullable<typeof editing>);
  };

  const openEditTemplate = async (kind: 'yaml' | 'dockerfile' | 'chart' | 'build' | 'scanning', id: string | undefined, name: string, content?: string) => {
    setEditing({ kind, id, name } as NonNullable<typeof editing>);
    setExtractedVars([]);
    if (kind === 'yaml' || kind === 'dockerfile') {
      editingForm.setFieldsValue({ name, content: content || '' });
      return;
    }
    // Chart/Build/Scanning：先拉取详情回填（GET /template/charts/:name | /build/:id | /scanning/:id）
    setDetailLoading(true);
    try {
      if (kind === 'chart' && name) {
        const detail = await templateCrudApi.getChartTemplate(name);
        editingForm.setFieldsValue({
          name: detail.name || name,
          codeHostID: (detail as { codeHostID?: number }).codeHostID,
          owner: detail.owner || '',
          namespace: detail.namespace || '',
          repo: detail.repo || '',
          branch: detail.branch || '',
          path: detail.path || '',
        });
      } else if (kind === 'build' && id) {
        const detail = await templateCrudApi.getBuildTemplate(id);
        editingForm.setFieldsValue({
          name: detail.name || name,
          scripts: detail.scripts || '',
          timeout: detail.timeout || 600,
        });
      } else if (kind === 'scanning' && id) {
        const detail = await templateCrudApi.getScanningTemplate(id);
        editingForm.setFieldsValue({
          name: detail.name || name,
          scanner_type: detail.scanner_type || 'sonar',
          enable_scanner: detail.enable_scanner !== false,
          parameter: detail.parameter || '',
          scripts: detail.scripts || '',
        });
      }
    } catch {
      feedback.message.error('模板详情获取失败，请重试');
    } finally {
      setDetailLoading(false);
    }
  };

  // Chart 模板编辑需要代码源下拉：首次打开时懒加载（/api/v1/codehosts）
  useEffect(() => {
    if (editing?.kind !== 'chart' || codehostOptions.length > 0) return;
    settingsApi
      .getCodeHosts()
      .then((hosts) => {
        setCodehostOptions(
          (hosts || []).map((h) => ({ label: `${h.alias || h.name || h.type} (${h.address})`, value: h.id }))
        );
      })
      .catch(() => {
        feedback.message.warning('代码源列表获取失败，请先在「系统集成 → 代码源」中确认配置');
      });
  }, [editing?.kind, codehostOptions.length]);

  // 刷新当前 tab 的模板列表（保存/删除后复用）
  const reloadActiveTabList = async () => {
    try {
      if (activeTab === 'k8s-yamls') {
        const res = await templateApi.getYamlTemplates();
        setYamlTemplates(res.yaml_template || []);
      } else if (activeTab === 'dockerfiles') {
        const res = await templateApi.getDockerfileTemplates();
        setDockerfileTemplates(res.dockerfile_template || []);
      } else if (activeTab === 'charts') {
        const res = await templateApi.getChartTemplates();
        setChartTemplates(res.chartTemplates || []);
      } else if (activeTab === 'builds') {
        const res = await templateApi.getBuildTemplates();
        setBuildTemplates(res.build_templates || []);
      } else if (activeTab === 'scanners') {
        const res = await templateApi.getScannerTemplates();
        setScannerTemplates(res.scanning_templates || []);
      } else if (activeTab === 'releasePlan') {
        setReleasePlanTemplates(await templateApi.getReleasePlanTemplates());
      }
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : '模板列表加载失败');
    }
  };

  const handleSaveEditing = async () => {
    if (!editing) return false;
    try {
      const values = await editingForm.validateFields();
      setEditingSaving(true);
      if (editing.kind === 'yaml') {
        if (editing.id) {
          await templateCrudApi.updateYamlTemplate(editing.id, { name: values.name, content: values.content });
        } else {
          await templateCrudApi.createYamlTemplate({ name: values.name, content: values.content });
        }
        feedback.message.success('模板已保存（保存时自动提取变量）');
      } else if (editing.kind === 'dockerfile') {
        if (editing.id) {
          await templateCrudApi.updateDockerfileTemplate(editing.id, { name: values.name, content: values.content });
        } else {
          await templateCrudApi.createDockerfileTemplate({ name: values.name, content: values.content });
        }
        feedback.message.success('Dockerfile 模板已保存');
      } else if (editing.kind === 'chart') {
        const payload = {
          name: values.name,
          codeHostID: Number(values.codeHostID),
          owner: values.owner,
          namespace: values.namespace || values.owner,
          repo: values.repo,
          branch: values.branch,
          path: values.path,
        };
        if (editing.id || editing.name) {
          await templateCrudApi.updateChartTemplate(editing.name, payload);
        } else {
          await templateCrudApi.createChartTemplate(payload);
        }
        feedback.message.success('Helm Chart 模板已保存（已从代码源同步）');
      } else if (editing.kind === 'build') {
        const payload = {
          name: values.name,
          script_type: 'shell',
          scripts: values.scripts,
          timeout: Number(values.timeout) || 600,
          // 后端 AddBuildTemplate 直接解引用 PreBuild（service/build.go:47），固定携带低配资源请求
          pre_build: { res_req: 'low', res_req_spec: {} },
        };
        if (editing.id) {
          await templateCrudApi.updateBuildTemplate(editing.id, payload);
        } else {
          await templateCrudApi.createBuildTemplate(payload);
        }
        feedback.message.success('构建模板已保存');
      } else if (editing.kind === 'scanning') {
        const payload = {
          name: values.name,
          scanner_type: values.scanner_type || 'sonar',
          enable_scanner: Boolean(values.enable_scanner),
          parameter: values.parameter || '',
          scripts: values.scripts || '',
          installs: [],
        };
        if (editing.id) {
          await templateCrudApi.updateScanningTemplate(editing.id, payload);
        } else {
          await templateCrudApi.createScanningTemplate(payload);
        }
        feedback.message.success('代码扫描模板已保存');
      }
      setEditing(null);
      await reloadActiveTabList();
      return true;
    } catch (err: unknown) {
      // 校验错误（validateFields reject）与接口错误均在此归集，接口错误由全局拦截器提示
      const isValidate = err && typeof err === 'object' && 'errorFields' in (err as Record<string, unknown>);
      if (!isValidate) {
        const msg = err instanceof Error ? err.message : '';
        if (msg) feedback.message.error(msg);
      }
      return false;
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDeleteYamlTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteYamlTemplate(id);
      feedback.message.success('模板已删除');
      setYamlTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '删除失败（可能仍被服务引用）');
    }
  };

  const handleDeleteDockerfileTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteDockerfileTemplate(id);
      feedback.message.success('模板已删除');
      setDockerfileTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '删除失败（可能仍被服务引用）');
    }
  };

  const handleDeleteChartTemplate = async (name: string) => {
    try {
      await templateCrudApi.deleteChartTemplate(name);
      feedback.message.success('Chart 模板已删除');
      setChartTemplates((prev) => prev.filter((t) => t.name !== name));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '删除失败（可能仍被服务引用）');
    }
  };

  const handleDeleteBuildTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteBuildTemplate(id);
      feedback.message.success('构建模板已删除');
      setBuildTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '删除失败（可能仍被服务引用）');
    }
  };

  const handleDeleteScanningTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteScanningTemplate(id);
      feedback.message.success('扫描模板已删除');
      setScannerTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '删除失败（可能仍被服务引用）');
    }
  };

  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [i18nMap, setI18nMap] = useState<Record<string, WorkflowTemplateI18n>>({});
  const [yamlTemplates, setYamlTemplates] = useState<YamlTemplateItem[]>([]);
  const [dockerfileTemplates, setDockerfileTemplates] = useState<DockerfileTemplateItem[]>([]);
  const [chartTemplates, setChartTemplates] = useState<ChartTemplateItem[]>([]);
  const [buildTemplates, setBuildTemplates] = useState<BuildTemplateItem[]>([]);
  const [scannerTemplates, setScannerTemplates] = useState<ScannerTemplateItem[]>([]);
  const [releasePlanTemplates, setReleasePlanTemplates] = useState<Array<{ id: string; name: string; description?: string; update_time?: number }>>([]);

  // Load workflow + yaml templates once (workflow list is also used for search header)
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setListError(null);
      try {
        const [wfRes, yamlRes] = await Promise.all([
          templateApi.getWorkflowTemplates(),
          templateApi.getYamlTemplates(),
        ]);

        setWorkflowTemplates(wfRes.workflow_templates || []);
        if (wfRes.build_in_workflow_template_i18ns) {
          const map: Record<string, WorkflowTemplateI18n> = {};
          wfRes.build_in_workflow_template_i18ns.forEach((item) => {
            map[item.name_key] = item;
          });
          setI18nMap(map);
        }

        setYamlTemplates(yamlRes.yaml_template || []);
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : '模板列表加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Lazily load the active tab's template list
  useEffect(() => {
    if (!['dockerfiles', 'charts', 'builds', 'scanners', 'releasePlan'].includes(activeTab)) return;
    setListError(null);
    setLoading(true);
    const run = async () => {
      try {
        if (activeTab === 'dockerfiles') {
          const res = await templateApi.getDockerfileTemplates();
          setDockerfileTemplates(res.dockerfile_template || []);
        } else if (activeTab === 'charts') {
          const res = await templateApi.getChartTemplates();
          setChartTemplates(res.chartTemplates || []);
        } else if (activeTab === 'builds') {
          const res = await templateApi.getBuildTemplates();
          setBuildTemplates(res.build_templates || []);
        } else if (activeTab === 'scanners') {
          const res = await templateApi.getScannerTemplates();
          setScannerTemplates(res.scanning_templates || []);
        } else if (activeTab === 'releasePlan') {
          setReleasePlanTemplates(await templateApi.getReleasePlanTemplates());
        }
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : '模板列表加载失败');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeTab]);

  const filteredWorkflows = workflowTemplates.filter((item) => {
    const i18n = i18nMap[item.template_name];
    const name = i18n?.name_zh || item.template_name;
    const desc = i18n?.description_zh || item.description || '';
    if (!searchText) return true;
    return (
      name.toLowerCase().includes(searchText.toLowerCase()) ||
      desc.toLowerCase().includes(searchText.toLowerCase()) ||
      item.template_name.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const tabItems = [
    {
      key: 'k8s-yamls',
      label: (
        <span>
          <FileTextOutlined /> Kubernetes YAML 模板库
        </span>
      ),
    },
    {
      key: 'charts',
      label: (
        <span>
          <AppstoreOutlined /> Helm Chart 模板库
        </span>
      ),
    },
    {
      key: 'dockerfiles',
      label: (
        <span>
          <ContainerOutlined /> Dockerfile 模板库
        </span>
      ),
    },
    {
      key: 'builds',
      label: (
        <span>
          <ToolOutlined /> 构建模板库
        </span>
      ),
    },
    {
      key: 'scanners',
      label: (
        <span>
          <SafetyCertificateOutlined /> 代码扫描模板库
        </span>
      ),
    },
    {
      key: 'workflows',
      label: (
        <span>
          <BranchesOutlined /> 工作流模板库
        </span>
      ),
    },
    {
      key: 'releasePlan',
      label: (
        <span>
          <RocketOutlined /> 发布计划模板库
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            模板库
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            规范化交付资产库，沉淀开箱即用的构建、部署、测试及工作流蓝图
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索模板"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Tooltip title="YAML / Dockerfile / Helm Chart / 构建 / 扫描 模板均可在此新建；工作流与发布计划模板由对应功能模块维护">
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }} onClick={openCreateTemplate}>
              新建模板
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Main Tabs Container */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={handleTabChange}
          tabBarStyle={{ marginBottom: 20 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : listError ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Alert
              type="error"
              showIcon
              title="模板列表加载失败"
              description={listError}
              style={{ maxWidth: 520, margin: '0 auto 16px', textAlign: 'left' }}
            />
            <Button icon={<ReloadOutlined />} onClick={reloadActiveTabList}>
              重试
            </Button>
          </div>
        ) : activeTab === 'workflows' ? (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 15 }}>
                系统内置工作流模板 ({filteredWorkflows.length})
              </Text>
            </div>

            <Row gutter={[16, 16]}>
              {filteredWorkflows.map((item) => {
                const i18n = i18nMap[item.template_name];
                const displayName = i18n?.name_zh || item.template_name;
                const desc = i18n?.description_zh || item.description || '沉淀企业最佳交付编排流水线';
                const stages = item.stages || [];

                return (
                  <Col xs={24} md={12} lg={8} key={item.id}>
                    <Card
                      hoverable
                      variant="borderless"
                      style={{
                        borderRadius: 8,
                        border: '1px solid #ebeef5',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      styles={{
                        body: {
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: 20,
                        },
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <Space orientation="horizontal" size={8}>
                            <RocketOutlined style={{ color: '#0066ff', fontSize: 18 }} />
                            <Text strong style={{ fontSize: 15, color: '#1f2d3d' }}>
                              {displayName}
                            </Text>
                          </Space>
                          {item.build_in && <Badge count="内置" style={{ backgroundColor: '#52c41a' }} />}
                        </div>

                        <Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ fontSize: 12, lineHeight: 1.6, minHeight: 38, marginBottom: 16 }}
                        >
                          {desc}
                        </Paragraph>

                        <div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                            流水线阶段 ({stages.length})
                          </Text>
                          <Space orientation="horizontal" size={[4, 6]} wrap>
                            {stages.map((stage, sIdx) => (
                              <Tag key={sIdx} color="geekblue" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                                {stage.replace(/^stage-\d+-/, '')}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      </div>

                      <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0 }}
                          onClick={() => setViewingWorkflow(item)}
                        >
                          查看编排详情
                        </Button>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        ) : activeTab === 'k8s-yamls' ? (
          <Table
            dataSource={yamlTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              { title: '模板标识', dataIndex: 'name', key: 'name' },
              { title: '变量定义', dataIndex: 'variables', key: 'variables', render: (_, r) => <Text type="secondary">{r.variables?.length || 0} 个变量</Text> },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              { title: '操作', key: 'action', render: (_, r: YamlTemplateItem) => (
                <Space size={0}>
                  <Button type="link" onClick={() => setViewing({ title: r.name, content: r.content || '', variables: r.variables })}>
                    查看内容
                  </Button>
                  {r.id && (
                    <>
                      <Button type="link" onClick={() => openReferenceDrawer({ kind: 'yaml', id: r.id as string, name: r.name })}>
                        引用
                      </Button>
                      <Button type="link" onClick={() => openEditTemplate('yaml', r.id as string, r.name, r.content || '')}>
                        编辑
                      </Button>
                      <Popconfirm title={`确定删除模板 [${r.name}]？`} onConfirm={() => handleDeleteYamlTemplate(r.id as string)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ) },
            ]}
            locale={{
              emptyText: <Empty description="暂无该分类模板数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'dockerfiles' ? (
          <Table
            dataSource={dockerfileTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <ContainerOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '内容预览',
                dataIndex: 'content',
                key: 'content',
                ellipsis: true,
                render: (content: string | undefined) => (
                  <Text code style={{ fontSize: 12 }}>{String(content || '').slice(0, 120) || '-'}</Text>
                ),
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              { title: '操作', key: 'action', render: (_, r: DockerfileTemplateItem) => (
                <Space size={0}>
                  <Button type="link" onClick={() => setViewing({ title: r.name, content: r.content || '' })}>
                    查看内容
                  </Button>
                  {r.id && (
                    <>
                      <Button type="link" onClick={() => openReferenceDrawer({ kind: 'dockerfile', id: r.id as string, name: r.name })}>
                        引用
                      </Button>
                      <Button type="link" onClick={() => openEditTemplate('dockerfile', r.id as string, r.name, r.content || '')}>
                        编辑
                      </Button>
                      <Popconfirm title={`确定删除模板 [${r.name}]？`} onConfirm={() => handleDeleteDockerfileTemplate(r.id as string)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ) },
            ]}
            locale={{
              emptyText: <Empty description="暂无 Dockerfile 模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'charts' ? (
          <Table
            dataSource={chartTemplates}
            rowKey={(r) => `${r.repo_name || ''}-${r.name || r.chart_name || ''}`}
            columns={[
              {
                title: 'Chart 名称',
                key: 'name',
                render: (_, r) => (
                  <Space orientation="horizontal">
                    <AppstoreOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{r.name || r.chart_name || '-'}</Text>
                  </Space>
                ),
              },
              { title: '所属仓库', dataIndex: 'repo_name', key: 'repo_name', render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag> },
              { title: '版本', dataIndex: 'version', key: 'version', render: (t) => <Tag color="blue">{String(t || '-')}</Tag> },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
              {
                title: '操作',
                key: 'action',
                render: (_, r: ChartTemplateItem) => (
                  <Space size={0}>
                    {r.name && (
                      <>
                        <Button type="link" onClick={() => openReferenceDrawer({ kind: 'chart', name: r.name as string })}>
                          引用
                        </Button>
                        <Button type="link" onClick={() => openChartVarsDrawer(r.name as string)}>
                          变量配置
                        </Button>
                        <Button type="link" onClick={() => openEditTemplate('chart', undefined, r.name as string)}>
                          编辑
                        </Button>
                        <Popconfirm title={`确定删除 Chart 模板 [${r.name}]？`} onConfirm={() => handleDeleteChartTemplate(r.name as string)}>
                          <Button type="link" danger>删除</Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无 Helm Chart 模板，支持通过关联代码源导入 Chart 模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'builds' ? (
          <Table
            dataSource={buildTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <ToolOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '构建脚本预览',
                dataIndex: 'scripts',
                key: 'scripts',
                ellipsis: true,
                render: (scripts: string | undefined) => (
                  <Text code style={{ fontSize: 12 }}>{String(scripts || '').slice(0, 120) || '-'}</Text>
                ),
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              {
                title: '操作',
                key: 'action',
                render: (_, r: BuildTemplateItem) => (
                  <Space size={0}>
                    {r.id && (
                      <>
                        <Button type="link" onClick={() => openReferenceDrawer({ kind: 'build', id: r.id as string, name: r.name })}>
                          引用
                        </Button>
                        <Button type="link" onClick={() => openEditTemplate('build', r.id as string, r.name)}>
                          编辑
                        </Button>
                        <Popconfirm title={`确定删除构建模板 [${r.name}]？`} onConfirm={() => handleDeleteBuildTemplate(r.id as string)}>
                          <Button type="link" danger>删除</Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无构建模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'scanners' ? (
          <Table
            dataSource={scannerTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <SafetyCertificateOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
              {
                title: '启用状态',
                dataIndex: 'enable',
                key: 'enable',
                render: (enabled: boolean | undefined) =>
                  enabled === false ? <Tag color="default">停用</Tag> : <Tag color="success">启用</Tag>,
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              {
                title: '操作',
                key: 'action',
                render: (_, r: ScannerTemplateItem) => (
                  <Space size={0}>
                    {r.id && (
                      <>
                        <Button type="link" onClick={() => openReferenceDrawer({ kind: 'scanning', id: r.id as string, name: r.name })}>
                          引用
                        </Button>
                        <Button type="link" onClick={() => openEditTemplate('scanning', r.id as string, r.name)}>
                          编辑
                        </Button>
                        <Popconfirm title={`确定删除扫描模板 [${r.name}]？`} onConfirm={() => handleDeleteScanningTemplate(r.id as string)}>
                          <Button type="link" danger>删除</Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无代码扫描模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : (
          <Table
            rowKey={(r: any) => r.id || r.name}
            dataSource={releasePlanTemplates}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <RocketOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              {
                title: '操作',
                key: 'action',
                render: (_, r) => (
                  <Space size={0}>
                    <Button type="link" size="small" onClick={() => openPlanTplDetail(r.id as string)}>
                      查看详情
                    </Button>
                    <Popconfirm
                      title={`确定删除发布计划模板 [${r.name}]？`}
                      onConfirm={() => handleDeletePlanTemplate(r.id as string, r.name)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无发布计划模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>

      {/* 模板新建/编辑（YAML / Dockerfile / Chart / 构建 / 扫描） */}
      <Modal
        title={`${editing?.id || (editing?.kind === 'chart' && editing?.name) ? '编辑' : '新建'}${
          editing?.kind === 'dockerfile' ? 'Dockerfile' : editing?.kind === 'chart' ? 'Helm Chart' : editing?.kind === 'build' ? '构建' : editing?.kind === 'scanning' ? '代码扫描' : 'K8s YAML'
        }模板`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSaveEditing}
        okText="保存"
        cancelText="取消"
        width={720}
        confirmLoading={editingSaving || detailLoading}
        destroyOnHidden
      >
        <Form form={editingForm} layout="vertical">
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="模板唯一标识" disabled={editing?.kind === 'chart' && !!editing?.name} />
          </Form.Item>

          {/* K8s YAML / Dockerfile 内容型模板 */}
          {editing?.kind === 'yaml' || editing?.kind === 'dockerfile' ? (
            <>
              <Form.Item
                label={editing?.kind === 'dockerfile' ? 'Dockerfile 内容' : 'K8s YAML 内容（{{.变量}} 语法自动提取为模板变量）'}
                required
              >
                <Space style={{ marginBottom: 8 }}>
                  {editing?.kind === 'yaml' && (
                    <Button size="small" icon={<TagsOutlined />} loading={extractingVars} onClick={handleExtractVars}>
                      提取变量
                    </Button>
                  )}
                  {editing?.kind === 'dockerfile' && (
                    <Button size="small" icon={<CheckCircleOutlined />} loading={validatingDockerfile} onClick={handleValidateDockerfile}>
                      语法校验
                    </Button>
                  )}
                </Space>
                <Form.Item
                  name="content"
                  noStyle
                  rules={[{ required: true, message: '请输入模板内容' }]}
                >
                  <Input.TextArea
                    rows={16}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                    placeholder={
                      editing?.kind === 'dockerfile'
                        ? 'FROM {{.base_image}}\n...'
                        : 'apiVersion: apps/v1\nkind: Deployment\n...\nspec:\n  template:\n    spec:\n      containers:\n      - image: {{.image_name}}'
                    }
                  />
                </Form.Item>
              </Form.Item>
              {editing?.kind === 'yaml' && extractedVars.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    已识别模板变量 ({extractedVars.length}):
                  </Text>
                  <Space wrap size={[4, 4]}>
                    {extractedVars.map((v, i) => (
                      <Tag key={`${v.key}-${i}`} color="geekblue">{v.key}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </>
          ) : null}

          {/* Helm Chart 模板：代码仓库源（对齐后端 addChartArgs = name + fs.DownloadFromSourceArgs） */}
          {editing?.kind === 'chart' ? (
            <>
              <Form.Item
                name="codeHostID"
                label="代码源"
                rules={[{ required: true, message: '请选择代码源' }]}
              >
                <Select
                  placeholder="请选择代码源（可在系统集成-代码源中添加）"
                  options={codehostOptions}
                  showSearch={{ optionFilterProp: 'label' }}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="owner" label="仓库所有者 / 组织" rules={[{ required: true, message: '请输入所有者' }]}>
                    <Input placeholder="如 koderover" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="namespace" label="命名空间（可选）">
                    <Input placeholder="默认同所有者" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="repo" label="仓库名" rules={[{ required: true, message: '请输入仓库名' }]}>
                    <Input placeholder="如 helm-charts" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="branch" label="分支" rules={[{ required: true, message: '请输入分支' }]}>
                    <Input placeholder="如 master" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="path" label="Chart 子目录（相对仓库根）" rules={[{ required: true, message: '请输入 Chart 所在路径' }]}>
                    <Input placeholder="如 charts/my-chart" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : null}

          {/* 构建模板：脚本（对齐后端 BuildTemplate{name, scripts, timeout, pre_build}） */}
          {editing?.kind === 'build' ? (
            <>
              <Form.Item
                name="scripts"
                label="构建脚本"
                rules={[{ required: true, message: '请输入构建脚本' }]}
              >
                <Input.TextArea
                  rows={12}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                  placeholder={'#!/bin/bash\necho "build steps..."'}
                />
              </Form.Item>
              <Form.Item
                name="timeout"
                label="超时时间（分钟）"
                rules={[{ required: true, message: '请输入超时时间' }]}
                initialValue={600}
              >
                <InputNumber min={1} max={1440} style={{ width: 200 }} />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                title="保存后默认使用低配资源请求（可在构建模块中按需调整），创建成功后即可在构建配置中引用该模板。"
                style={{ borderRadius: 6 }}
              />
            </>
          ) : null}

          {/* 代码扫描模板：扫描类型与脚本（对齐后端 ScanningTemplate） */}
          {editing?.kind === 'scanning' ? (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="scanner_type" label="扫描工具类型" rules={[{ required: true, message: '请选择扫描类型' }]}>
                    <Select
                      options={[
                        { label: 'SonarQube', value: 'sonar' },
                        { label: '其他（自定义脚本）', value: 'other' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="enable_scanner" label="启用 Sonar 扫描器" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="parameter" label="Sonar 参数（scanner_type 为 sonar 时生效）">
                <Input.TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 13 }} placeholder="sonar.projectKey=my-project" />
              </Form.Item>
              <Form.Item name="scripts" label="扫描脚本（自定义脚本扫描时使用）">
                <Input.TextArea rows={8} style={{ fontFamily: 'monospace', fontSize: 13 }} placeholder="#!/bin/bash" />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>

      {/* Template Content View Drawer (k8s-yamls / dockerfiles) */}
      <Drawer
        title={`模板内容: ${viewing?.title || ''}`}
        placement="right"
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="large"
      >
        {viewing && (
          <div>
            {viewing.variables && viewing.variables.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>变量定义</Text>
                <Space orientation="horizontal" size={4} wrap>
                  {viewing.variables.map((v) => (
                    <Tag key={v.key} color="geekblue">{v.key}</Tag>
                  ))}
                </Space>
              </div>
            )}
            <pre
              style={{
                background: '#f5f7fa',
                padding: 16,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 520,
                overflow: 'auto',
              }}
            >
              {viewing.content || '（无内容）'}
            </pre>
          </div>
        )}
      </Drawer>

      {/* Workflow Template Orchestration View Drawer */}
      <Drawer
        title={`编排详情: ${viewingWorkflow ? i18nMap[viewingWorkflow.template_name]?.name_zh || viewingWorkflow.template_name : ''}`}
        placement="right"
        open={!!viewingWorkflow}
        onClose={() => setViewingWorkflow(null)}
        size="large"
      >
        {viewingWorkflow && (
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {viewingWorkflow.description || i18nMap[viewingWorkflow.template_name]?.description_zh || ''}
            </Text>
            <Tabs
              items={[
                {
                  key: 'stages',
                  label: '编排阶段',
                  children: (
                    <Table
                      dataSource={viewingWorkflow.stages || []}
                      rowKey={(s, i) => `${s}-${i}`}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '阶段', dataIndex: 'stages', key: 'stage', render: (s) => <Tag color="geekblue">{String(s).replace(/^stage-\d+-/, '')}</Tag> },
                      ]}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段信息" /> }}
                    />
                  ),
                },
                {
                  key: 'details',
                  label: '阶段明细',
                  children: (
                    <Table
                      dataSource={viewingWorkflow.stage_details || []}
                      rowKey={(s, i) => `${s.name}-${i}`}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '阶段名', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{String(n)}</Text> },
                        {
                          title: '任务列表',
                          dataIndex: 'jobs',
                          key: 'jobs',
                          render: (_, r) => (
                            <Space orientation="horizontal" size={4} wrap>
                              {(r.jobs || []).map((j) => (
                                <Tag key={j.name} color="blue">{`${j.name} (${j.job_type})`}</Tag>
                              ))}
                            </Space>
                          ),
                        },
                      ]}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段明细" /> }}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>

      {/* R9 任务二: 模板引用服务抽屉 */}
      <Drawer
        title={`模板引用服务: ${refTarget?.name || ''}`}
        placement="right"
        open={refDrawerOpen}
        onClose={() => setRefDrawerOpen(false)}
        size="large"
        extra={
          (refTarget?.kind === 'yaml' || refTarget?.kind === 'chart') && refList.length > 0 ? (
            <Popconfirm
              title="确定将最新模板内容同步更新到所有引用的服务配置中吗？"
              onConfirm={handleSyncReference}
              okText="同步"
              cancelText="取消"
            >
              <Button type="primary" size="small" icon={<SyncOutlined />} loading={refSyncing}>
                同步到引用服务
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        {refLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : refList.length > 0 ? (
          <Table
            dataSource={refList}
            rowKey={(_, idx) => String(idx)}
            pagination={false}
            size="small"
            columns={[
              {
                title: '所属项目',
                dataIndex: 'project_name',
                key: 'project_name',
                render: (p) => <Tag color="blue">{String(p || '-')}</Tag>,
              },
              {
                title: refTarget?.kind === 'dockerfile' ? '引用构建' : '引用服务/模块',
                key: 'target',
                render: (_, r) => (
                  <Text strong>{String(r.service_name || r.build_name || '-')}</Text>
                ),
              },
              ...(refTarget?.kind === 'yaml'
                ? [
                    {
                      title: '环境类型',
                      dataIndex: 'production',
                      key: 'production',
                      width: 110,
                      render: (p: boolean | undefined) =>
                        p ? <Tag color="orange">生产</Tag> : <Tag color="cyan">测试</Tag>,
                    },
                  ]
                : []),
              ...(refTarget?.kind === 'build' || refTarget?.kind === 'scanning'
                ? [
                    {
                      title: '引用模块',
                      dataIndex: 'service_modules',
                      key: 'service_modules',
                      render: (mods: string[] | undefined) =>
                        mods && mods.length > 0 ? (
                          <Space wrap size={[4, 4]}>
                            {mods.map((m) => (
                              <Tag key={m} color="geekblue">{m}</Tag>
                            ))}
                          </Space>
                        ) : (
                          <Text type="secondary">全部模块</Text>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无服务引用该模板"
            style={{ padding: '40px 0' }}
          />
        )}
      </Drawer>

      {/* R9 任务四: Chart 模板 values 变量配置抽屉 */}
      <Drawer
        title={`Chart 模板变量配置: ${chartVarsName}`}
        placement="right"
        open={chartVarsOpen}
        onClose={() => setChartVarsOpen(false)}
        size="large"
        extra={
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            loading={chartVarsSaving}
            onClick={handleSaveChartVars}
          >
            保存变量
          </Button>
        }
      >
        {chartVarsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Input.TextArea
            rows={24}
            value={chartVarsContent}
            onChange={(e) => setChartVarsContent(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder="Chart 模板 values 变量内容"
          />
        )}
      </Drawer>

      {/* R9 任务五: 发布计划模板详情抽屉 */}
      <Drawer
        title={`发布计划模板详情: ${planTplDetail?.template_name || ''}`}
        placement="right"
        open={planTplDetailOpen}
        onClose={() => setPlanTplDetailOpen(false)}
        size="large"
      >
        <Spin spinning={planTplLoading}>
          {planTplDetail ? (
            <div>
              <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="模板名称">{planTplDetail.template_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建人">{planTplDetail.created_by || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {planTplDetail.create_time ? new Date(planTplDetail.create_time * 1000).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="最近更新">
                  {planTplDetail.update_time ? `${planTplDetail.updated_by || '-'} · ${new Date(planTplDetail.update_time * 1000).toLocaleString()}` : '-'}
                </Descriptions.Item>
              </Descriptions>

              <Title level={5}>
                <Space size={6}>
                  <ApartmentOutlined />
                  <span>任务编排 ({(planTplDetail.jobs || []).length})</span>
                </Space>
              </Title>
              {(planTplDetail.jobs || []).length > 0 ? (
                <Table
                  dataSource={planTplDetail.jobs}
                  rowKey={(j: any, idx) => String(j?.id || idx)}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Job 名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{String(n || '-')}</Text> },
                    { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag> },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该模板暂无任务编排定义" />
              )}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到模板详情" />
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default TemplateCenterPage;
