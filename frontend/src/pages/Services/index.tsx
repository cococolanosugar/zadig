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
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DiffOutlined,
  CloudServerOutlined,
  CodeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
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
  const activeProject = projectName || currentProject;

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

  const loadServices = useCallback(async () => {
    if (!activeProject) {
      setServices([]);
      return;
    }

    setLoading(true);
    try {
      const res = await http.get<ServiceItem[] | { data: ServiceItem[] }>(
        `/api/aslan/service/services?projectName=${activeProject}`
      );
      const list = Array.isArray(res) ? res : ('data' in res && Array.isArray(res.data) ? res.data : []);
      setServices(list);
      if (list.length > 0) {
        setSelectedService(list[0].service_name);
        setYamlContent(list[0].yaml || '');
        setOriginalYaml(list[0].yaml || '');
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
  }, [activeProject]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSaveYaml = async () => {
    if (!selectedService || !activeProject) return;
    try {
      await http.put(`/api/aslan/service/services/${selectedService}`, {
        service_name: selectedService,
        yaml: yamlContent,
        projectName: activeProject,
      });
      setOriginalYaml(yamlContent);
      feedback.message.success(`服务 ${selectedService} 配置已保存成功！`);
    } catch {
      // Handled
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
      await http.post('/api/aslan/service/services', {
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
                  服务配置管理
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
    </div>
  );
};

export default ServicesPage;
