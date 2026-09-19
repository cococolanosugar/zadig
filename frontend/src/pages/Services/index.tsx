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

const DEFAULT_SAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-service
  labels:
    app.kubernetes.io/name: demo-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: demo-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: demo-service
    spec:
      containers:
        - name: demo-service
          image: nginx:alpine
          ports:
            - containerPort: 80
          resources:
            limits:
              cpu: 200m
              memory: 256Mi
            requests:
              cpu: 100m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: demo-service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
  selector:
    app.kubernetes.io/name: demo-service
`;

export const ServicesPage: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject;

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [yamlContent, setYamlContent] = useState<string>(DEFAULT_SAMPLE_YAML);
  const [originalYaml, setOriginalYaml] = useState<string>(DEFAULT_SAMPLE_YAML);
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>('');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  const loadServices = useCallback(async () => {
    if (!activeProject) {
      setServices([
        { service_name: 'demo-service', type: 'k8s', status: 'normal' },
      ]);
      setSelectedService('demo-service');
      return;
    }

    setLoading(true);
    try {
      const res = await http.get<ServiceItem[] | { data: ServiceItem[] }>(
        `/api/aslan/service/services?projectName=${activeProject}`
      );
      const list = Array.isArray(res) ? res : ('data' in res && Array.isArray(res.data) ? res.data : []);
      if (list.length > 0) {
        setServices(list);
        setSelectedService(list[0].service_name);
      } else {
        // Fallback default sample for testing
        setServices([{ service_name: 'demo-service', type: 'k8s', status: 'normal' }]);
        setSelectedService('demo-service');
      }
    } catch {
      setServices([{ service_name: 'demo-service', type: 'k8s', status: 'normal' }]);
      setSelectedService('demo-service');
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSaveYaml = async () => {
    if (!selectedService) return;
    try {
      if (activeProject) {
        await http.put(`/api/aslan/service/services/${selectedService}`, {
          service_name: selectedService,
          yaml: yamlContent,
          projectName: activeProject,
        });
      }
      setOriginalYaml(yamlContent);
      feedback.message.success(`服务 ${selectedService} 配置已保存成功！`);
    } catch {
      // Handled
    }
  };

  const handleCreateService = () => {
    if (!newServiceName.trim()) {
      feedback.message.warning('请输入服务名称');
      return;
    }
    const newService: ServiceItem = {
      service_name: newServiceName.trim(),
      type: 'k8s',
      status: 'created',
      yaml: DEFAULT_SAMPLE_YAML,
    };
    setServices([...services, newService]);
    setSelectedService(newService.service_name);
    setYamlContent(DEFAULT_SAMPLE_YAML);
    setOriginalYaml(DEFAULT_SAMPLE_YAML);
    setCreateModalVisible(false);
    setNewServiceName('');
    feedback.message.success(`服务 ${newService.service_name} 创建成功`);
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
                  所属项目: <Tag color="blue">{currentProject || '全局工作区'}</Tag>
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
                  onClick={() => setYamlContent(DEFAULT_SAMPLE_YAML)}
                >
                  重置示例
                </Button>
              </Space>
            }
            style={{ borderRadius: 8 }}
          >
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
          </Card>
        </Col>
      </Row>

      {/* Create Service Modal */}
      <Modal
        title="新建 Kubernetes 容器服务"
        open={createModalVisible}
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
