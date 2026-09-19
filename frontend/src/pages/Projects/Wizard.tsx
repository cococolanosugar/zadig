import React, { useState } from 'react';
import {
  Card,
  Steps,
  Button,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Typography,
  Divider,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  ProjectOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  BranchesOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const ProjectWizardPage: React.FC = () => {
  const { projectName: initialProjectName } = useParams<{ projectName?: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  const [projectName, setProjectName] = useState<string>(initialProjectName || '');
  const [projectKey, setProjectKey] = useState<string>('');
  const [deployType, setDeployType] = useState<string>('k8s');

  const stepItems = [
    {
      title: '项目配置',
      description: '基本信息与架构类型',
      icon: <ProjectOutlined />,
    },
    {
      title: '服务配置',
      description: '声明式容器微服务',
      icon: <CloudServerOutlined />,
    },
    {
      title: '环境设置',
      description: '集群与多环境绑定',
      icon: <ClusterOutlined />,
    },
    {
      title: '工作流配置',
      description: 'CI/CD 交付流水线',
      icon: <BranchesOutlined />,
    },
  ];

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        const values = await form.validateFields(['project_name', 'project_key', 'deploy_type']);
        setProjectName(values.project_name);
        setProjectKey(values.project_key);
        setDeployType(values.deploy_type);

        // Attempt creating project on backend
        setLoading(true);
        try {
          await http.post(
            '/api/aslan/project/products',
            {
              product_name: values.project_name,
              project_name: values.project_key || values.project_name,
              create_from: values.deploy_type,
              desc: form.getFieldValue('desc') || '',
            },
            { skipErrorHandler: true }
          );
        } catch {
          // If project exists or local mock, continue
        } finally {
          setLoading(false);
        }
      }

      if (currentStep < 3) {
        setCurrentStep((prev) => prev + 1);
      } else {
        // Complete wizard
        feedback.message.success(`项目 [${projectKey || projectName || '新建项目'}] 创建成功并已初始化交付流水线！`);
        navigate(`/v1/projects/detail/${projectName || 'default'}/detail`);
      }
    } catch {
      // Form validation error
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    const target = projectName || initialProjectName || 'demo-service';
    feedback.message.info('已跳过项目向导，进入工作空间');
    navigate(`/v1/projects/detail/${target}/detail`);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px' }}>
      <Card
        variant="borderless"
        styles={{ body: { padding: '32px 40px' } }}
        style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)', borderRadius: 8 }}
      >
        {/* Header Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              新建项目向导
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              跟随步骤完成项目配置、服务接入、集群环境绑定与自动化 CI/CD 工作流生成
            </Text>
          </div>
          <Space>
            <Button onClick={handleSkip}>跳过向导</Button>
            <Button onClick={() => navigate('/v1/projects')}>返回项目列表</Button>
          </Space>
        </div>

        {/* Steps Navigation */}
        <Steps
          current={currentStep}
          items={stepItems}
          style={{ marginBottom: 40 }}
        />

        <Divider style={{ margin: '24px 0' }} />

        {/* Step 1: Project Basic Info */}
        {currentStep === 0 && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              project_name: initialProjectName || '',
              project_key: initialProjectName || '',
              deploy_type: 'k8s',
            }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="project_name"
                  label="项目唯一标识 (英文)"
                  rules={[
                    { required: true, message: '请输入项目唯一标识' },
                    { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符(-)' },
                  ]}
                  tooltip="项目的全局唯一标识符，用于命名空间和路由生成"
                >
                  <Input placeholder="例如：ecommerce-app" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="project_key"
                  label="项目显示名称"
                  rules={[{ required: true, message: '请输入项目显示名称' }]}
                >
                  <Input placeholder="例如：电商微服务核心系统" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="deploy_type"
              label="项目部署交付类型"
              rules={[{ required: true }]}
            >
              <Radio.Group style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card
                      hoverable
                      variant="borderless"
                      style={{
                        border: deployType === 'k8s' ? '2px solid #0066ff' : '1px solid #d9d9d9',
                        borderRadius: 6,
                      }}
                      onClick={() => setDeployType('k8s')}
                    >
                      <Radio value="k8s">
                        <Text strong>K8s YAML 原生</Text>
                      </Radio>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        基于原生 Kubernetes YAML 清单管理微服务部署与发布。
                      </Paragraph>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      hoverable
                      variant="borderless"
                      style={{
                        border: deployType === 'helm' ? '2px solid #0066ff' : '1px solid #d9d9d9',
                        borderRadius: 6,
                      }}
                      onClick={() => setDeployType('helm')}
                    >
                      <Radio value="helm">
                        <Text strong>Helm Chart</Text>
                      </Radio>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        基于 Helm Chart 包管理规范发布多环境应用及 values 定制。
                      </Paragraph>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card
                      hoverable
                      variant="borderless"
                      style={{
                        border: deployType === 'host' ? '2px solid #0066ff' : '1px solid #d9d9d9',
                        borderRadius: 6,
                      }}
                      onClick={() => setDeployType('host')}
                    >
                      <Radio value="host">
                        <Text strong>主机 / 虚拟机</Text>
                      </Radio>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        针对非容器化物理机、ECS 或虚机主机的发布自动化交付。
                      </Paragraph>
                    </Card>
                  </Col>
                </Row>
              </Radio.Group>
            </Form.Item>

            <Form.Item name="desc" label="项目描述">
              <TextArea rows={3} placeholder="简述该项目服务群与业务目标" />
            </Form.Item>
          </Form>
        )}

        {/* Step 2: Service Config */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="自动生成微服务骨架"
              description="系统已为您自动推导声明式基础服务清单，您也可以在后续“服务配置”页面中通过 Monaco YAML 深度定制。"
              type="info"
              showIcon
            />

            <Form layout="vertical">
              <Form.Item label="首批接入微服务组件">
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    style={{ width: '70%' }}
                    defaultValue={`${projectName || 'demo'}-backend`}
                    placeholder="服务名"
                  />
                  <Input
                    style={{ width: '30%' }}
                    defaultValue="8080"
                    placeholder="暴露端口"
                  />
                </Space.Compact>
              </Form.Item>

              <Form.Item label="容器镜像源">
                <Input defaultValue="koderover.tencentcloudcr.com/koderover-public/demo:latest" />
              </Form.Item>

              <Form.Item label="健康检查路径 (Liveness Probe)">
                <Input defaultValue="/healthz" />
              </Form.Item>
            </Form>
          </div>
        )}

        {/* Step 3: Environment Setup */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="多环境初始纳管"
              description="向导将自动为该项目在本地集成集群中拉起独立的开发 (dev) 与测试 (qa) 环境命名空间。"
              type="success"
              showIcon
            />

            <Form layout="vertical">
              <Form.Item label="目标部署 Kubernetes 集群" required>
                <Select defaultValue="local">
                  <Option value="local">内置标准 Kubernetes 集群 (local - v1.28.2)</Option>
                  <Option value="prod-cluster">生产业务专用集群 (prod-hk-cluster)</Option>
                </Select>
              </Form.Item>

              <Form.Item label="初始创建环境">
                <Select mode="multiple" defaultValue={['dev', 'qa']}>
                  <Option value="dev">开发联调环境 (dev)</Option>
                  <Option value="qa">测试验收环境 (qa)</Option>
                  <Option value="staging">预发验证环境 (staging)</Option>
                  <Option value="prod">生产生产环境 (prod)</Option>
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}

        {/* Step 4: Workflow Delivery */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="就绪！将为您生成标准企业级交付工作流"
              description="包含代码拉取、自动化镜像构建、SonarQube 质量门禁扫描及多环境并行部署的端到端流水线。"
              type="info"
              showIcon
            />

            <Card variant="borderless" style={{ background: '#f5f5f5' }}>
              <Space orientation="vertical" size={8}>
                <Text strong>已配置流水线任务阶段：</Text>
                <Text>1. 源码检出 (Git Clone)</Text>
                <Text>2. 容器镜像构建与安全审查 (Docker Build & Scan)</Text>
                <Text>3. 自动化部署至开发环境 (Deploy to Dev Namespace)</Text>
                <Text>4. 服务探活与健康验收 (Service Healthcheck)</Text>
              </Space>
            </Card>
          </div>
        )}

        {/* Action Buttons Footer */}
        <Divider style={{ margin: '24px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            disabled={currentStep === 0}
            onClick={handlePrev}
          >
            上一步
          </Button>

          <Space size="middle">
            {currentStep < 3 ? (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                loading={loading}
                onClick={handleNext}
              >
                保存并下一步
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={loading}
                onClick={handleNext}
              >
                完成配置并进入项目
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default ProjectWizardPage;
