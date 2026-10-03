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
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DiffOutlined,
  CloudServerOutlined,
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
} from '@ant-design/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import YamlEditor from '../../components/Editor/YamlEditor';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { serviceApi, ServiceDetail } from '../../api/service';
import ImportFromRepoModal, { SyncServiceInfo } from './ImportFromRepoModal';
import ImportFromTemplateModal, { SyncTemplateServiceInfo } from './ImportFromTemplateModal';
import ServiceModulesDrawer from './ServiceModulesDrawer';
import ServiceVariablesDrawer from './ServiceVariablesDrawer';
import HelmServiceDrawer from './HelmServiceDrawer';
import PmServiceModal from './PmServiceModal';

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
      if (list.length > 0) {
        const chosen = (queryServiceName && list.find((s) => s.service_name === queryServiceName)) || list[0];
        setSelectedService(chosen.service_name);
        setYamlContent(chosen.yaml || '');
        setOriginalYaml(chosen.yaml || '');
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
    } catch {
      setServiceDetail(null);
    }
  }, [activeProject, isProduction]);

  useEffect(() => {
    if (selectedService) {
      loadServiceDetail(selectedService);
    } else {
      setServiceDetail(null);
    }
  }, [selectedService, loadServiceDetail]);

  const handleSaveYaml = async () => {
    if (!selectedService || !activeProject) return;
    try {
      // 对齐旧版 saveServiceAPI（zadig-portal/src/api/index.js:388）：
      // POST /service/services?projectName=<product>&force=true。
      // createServiceTemplateRequest 的 source/type/visibility/yaml 均 binding:required；
      // visibility 沿用当前服务值（缺失则 'private'），variable_yaml 需先取详情保留。
      let visibility = 'private';
      let variableYaml = '';
      let serviceVariableKVs: unknown[] = [];
      try {
        const detail = await http.get<{
          visibility?: string;
          variable_yaml?: string;
          service_variable_kvs?: unknown[];
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
      const res = await http.get<{ yaml?: string }>(
        `/api/aslan/service/version/${encodeURIComponent(selectedService)}/revision/${revision}?projectName=${activeProject}&production=${isProduction}`,
        { skipErrorHandler: true }
      );
      setVersionYaml({ revision, yaml: res?.yaml || '' });
    } catch {
      setVersionYaml(null);
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
      await loadServices();
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
                        setSelectedService(item.service_name);
                        setYamlContent(item.yaml || '');
                        setOriginalYaml(item.yaml || '');
                        setIsDiffMode(false);
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
                      {item.type === 'pm' ? (
                        <Tag color="purple">PM</Tag>
                      ) : item.type === 'helm' ? (
                        <Tag color="blue">Helm</Tag>
                      ) : (
                        <Tag color="cyan">K8s</Tag>
                      )}
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
              isDiffMode ? (
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
              )
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
    </div>
  );
};

export default ServicesPage;
