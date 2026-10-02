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
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DiffOutlined,
  CloudServerOutlined,
  CodeOutlined,
  ReloadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import YamlEditor from '../../components/Editor/YamlEditor';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

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

  const handleSaveYaml = async () => {
    if (!selectedService || !activeProject) return;
    try {
      await http.put(
        `/api/aslan/service/services/${selectedService}?production=${isProduction}`,
        {
          service_name: selectedService,
          yaml: yamlContent,
          projectName: activeProject,
        }
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
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                新建服务
              </Button>
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
                      <Tag color="cyan">K8s</Tag>
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
      </Drawer>
    </div>
  );
};

export default ServicesPage;
