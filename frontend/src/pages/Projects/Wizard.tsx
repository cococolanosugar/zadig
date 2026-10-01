import React, { useState, useEffect } from 'react';
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

export const ProjectWizardPage: React.FC = () => {
  const {
    projectName: initialProjectName,
    deployType: routeDeployType,
    step: routeStep,
  } = useParams<{
    projectName?: string;
    deployType?: string;
    step?: string;
  }>();
  const navigate = useNavigate();

  const getInitialStep = () => {
    if (!routeStep) return 0;
    if (routeStep === 'info') return 0;
    if (routeStep === 'service' || routeStep === 'config') return 1;
    if (routeStep === 'runtime' || routeStep === 'deploy') return 2;
    if (routeStep === 'delivery' || routeStep === 'release') return 3;
    const num = parseInt(routeStep, 10);
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 3);
  };

  const [currentStep, setCurrentStep] = useState<number>(getInitialStep);
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  const [projectName, setProjectName] = useState<string>(initialProjectName || '');
  const [projectKey, setProjectKey] = useState<string>('');
  const [deployType, setDeployType] = useState<string>(
    routeDeployType && ['k8s', 'helm', 'host', 'pm'].includes(routeDeployType)
      ? routeDeployType
      : 'k8s'
  );

  // Step 2: service config (受控)
  const [serviceName, setServiceName] = useState<string>('');
  const [servicePort, setServicePort] = useState<string>('8080');
  const [serviceImage, setServiceImage] = useState<string>('');

  // Step 3: environment config (受控 + 真实集群)
  const [clusters, setClusters] = useState<Array<{ id: string; name: string }>>([]);
  // 集群 ID 必须是真实 ObjectID（'local' 字面量会被后端拒绝）
  const [clusterId, setClusterId] = useState<string>('');
  const [selectedEnvs, setSelectedEnvs] = useState<string[]>(['dev', 'qa']);

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

  const projectCreatedRef = React.useRef(false);

  // 进入环境设置步骤时加载真实集群列表
  useEffect(() => {
    if (currentStep === 2) {
      http
        .get<Array<{ id: string; name: string }>>('/api/aslan/cluster/clusters', { skipErrorHandler: true })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setClusters(list.map((c) => ({ id: c.id, name: c.name })));
          // 默认选中本地集群（若存在）；必须使用真实 ObjectID
          const local = list.find((c) => c.id && (c as { is_local?: boolean }).is_local) || list[0];
          if (local?.id) setClusterId(local.id);
        })
        .catch(() => setClusters([]));
    }
  }, [currentStep]);

  const buildDefaultServiceYaml = () => {
    const name = serviceName || `${projectName || 'demo'}-backend`;
    const image = serviceImage || 'nginx:alpine';
    const port = Number(servicePort) || 8080;
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  labels:
    app.kubernetes.io/name: ${name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: ${name}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: ${port}
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  selector:
    app.kubernetes.io/name: ${name}
  ports:
    - protocol: TCP
      port: ${port}
      targetPort: ${port}
`;
  };

  const createProjectResources = async (): Promise<{ ok: boolean; failures: string[] }> => {
    const failures: string[] = [];
    const targetProject = projectName || projectKey;

    // 1. 创建服务
    if (serviceName.trim()) {
      try {
        await http.post(
          `/api/aslan/service/services?production=false&force=true`,
          {
            product_name: targetProject,
            service_name: serviceName.trim(),
            source: 'spock',
            type: 'k8s',
            visibility: 'private',
            yaml: buildDefaultServiceYaml(),
          },
          { skipErrorHandler: true }
        );
        feedback.message.success(`服务 [${serviceName.trim()}] 创建成功`);
      } catch (err: any) {
        failures.push(`服务 ${serviceName.trim()}: ${err?.response?.data?.message || err?.message || '创建失败'}`);
      }
    }

    // 2. 创建环境
    for (const envName of selectedEnvs) {
      try {
        await http.post(
          `/api/aslan/environment/environments?projectName=${targetProject}&type=k8s`,
          [
            {
              product_name: targetProject,
              env_name: envName,
              alias: envName,
              namespace: `${targetProject}-${envName}`,
              cluster_id: clusterId,
              production: envName === 'prod',
              services: serviceName.trim()
                ? [[{ service_name: serviceName.trim(), type: 'k8s' }]]
                : [],
            },
          ],
          { skipErrorHandler: true }
        );
        feedback.message.success(`环境 [${envName}] 创建成功`);
      } catch (err: any) {
        failures.push(`环境 ${envName}: ${err?.response?.data?.message || err?.message || '创建失败'}`);
      }
    }

    // 3. 创建交付工作流（构建 → 部署）
    if (serviceName.trim() && selectedEnvs.length > 0) {
      try {
        await http.post(
          `/api/aslan/workflow/v4`,
          {
            name: `${targetProject}-delivery`,
            project: targetProject,
            description: '项目向导生成的构建-部署交付流水线',
            stages: [
              {
                name: '构建',
                parallel: false,
                jobs: [
                  {
                    name: 'build',
                    type: 'zadig-build',
                    spec: { service_name: serviceName.trim() },
                  },
                ],
              },
              {
                name: '部署',
                parallel: false,
                jobs: [
                  {
                    name: 'deploy',
                    type: 'zadig-deploy',
                    spec: { service_name: serviceName.trim(), env: selectedEnvs[0] },
                  },
                ],
              },
            ],
          },
          { skipErrorHandler: true }
        );
        feedback.message.success(`工作流 [${targetProject}-delivery] 创建成功`);
      } catch (err: any) {
        failures.push(`工作流: ${err?.response?.data?.message || err?.message || '创建失败'}`);
      }
    }

    return { ok: failures.length === 0, failures };
  };

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
          projectCreatedRef.current = true;
        } catch (err: any) {
          // Project may already exist — allow continuing only in that case
          const msg = String(err?.response?.data?.message || err?.message || '');
          if (!/exist|重复|已存在/i.test(msg)) {
            feedback.message.error(`项目创建失败: ${msg || '请检查网络与权限后重试'}`);
            return;
          }
        } finally {
          setLoading(false);
        }
      }

      if (currentStep < 3) {
        setCurrentStep((prev) => prev + 1);
      } else {
        // 完成向导：批量创建服务/环境/工作流
        setLoading(true);
        const { ok, failures } = await createProjectResources();
        setLoading(false);
        const target = projectName || projectKey || 'default';
        if (ok) {
          feedback.message.success(`项目 [${projectKey || projectName}] 初始化完成！`);
          navigate(`/v1/projects/detail/${target}/detail`);
        } else {
          feedback.message.error(`部分资源创建失败: ${failures.join('；')}`);
          // 仍进入项目页以便用户继续手动补齐
          navigate(`/v1/projects/detail/${target}/detail`);
        }
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
    feedback.message.info('已跳过项目向导，返回项目列表');
    navigate('/v1/projects');
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
              title="创建首个微服务组件"
              description="向导将按以下配置生成声明式 K8s YAML 并创建服务；完成后可在「服务配置」页面用 Monaco YAML 深度定制。"
              type="info"
              showIcon
            />

            <Form layout="vertical">
              <Form.Item label="服务名称" required>
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder={`${projectName || 'demo'}-backend`}
                />
              </Form.Item>

              <Form.Item label="容器镜像">
                <Input
                  value={serviceImage}
                  onChange={(e) => setServiceImage(e.target.value)}
                  placeholder="nginx:alpine（后续可在构建任务中替换为构建产物）"
                />
              </Form.Item>

              <Form.Item label="暴露端口">
                <Input
                  value={servicePort}
                  onChange={(e) => setServicePort(e.target.value)}
                  placeholder="8080"
                />
              </Form.Item>
            </Form>
          </div>
        )}

        {/* Step 3: Environment Setup */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="初始化环境"
              description="为项目在所选集群中创建初始环境；标记为生产的集群创建的环境会走生产配置通道。"
              type="info"
              showIcon
            />

            <Form layout="vertical">
              <Form.Item label="目标部署 Kubernetes 集群" required validateStatus={clusters.length === 0 ? 'warning' : undefined} extra={clusters.length === 0 ? '集群列表加载失败，请刷新页面后重试' : undefined}>
                <Select
                  value={clusterId || undefined}
                  onChange={setClusterId}
                  placeholder="请选择集群"
                  options={clusters.map((c) => ({ label: c.name, value: c.id }))}
                  notFoundContent="未获取到集群列表"
                />
              </Form.Item>

              <Form.Item label="初始创建环境" required>
                <Select
                  mode="multiple"
                  value={selectedEnvs}
                  onChange={setSelectedEnvs}
                  options={[
                    { label: '开发联调环境 (dev)', value: 'dev' },
                    { label: '测试验收环境 (qa)', value: 'qa' },
                    { label: '预发验证环境 (staging)', value: 'staging' },
                    { label: '生产环境 (prod)', value: 'prod' },
                  ]}
                  placeholder="选择要创建的环境"
                />
              </Form.Item>
            </Form>
          </div>
        )}

        {/* Step 4: Workflow Delivery */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="确认后向导将依次创建以下资源"
              description="每一步的结果都会如实反馈；失败项可稍后在对应页面手动补齐。"
              type="info"
              showIcon
            />

            <Card variant="borderless" style={{ background: '#f5f5f5' }}>
              <Space orientation="vertical" size={8}>
                <Text strong>1. 服务: {serviceName.trim() || '(未填写，跳过)'}</Text>
                <Text>
                  2. 环境: {selectedEnvs.length > 0 ? selectedEnvs.join('、') : '(未选择，跳过)'}
                  {clusterId ? ` @ 集群 ${clusterId}` : ''}
                </Text>
                <Text>
                  3. 工作流: {serviceName.trim() && selectedEnvs.length > 0 ? `${projectName || projectKey}-delivery (构建 → 部署至 ${selectedEnvs[0]})` : '(前置条件不满足，跳过)'}
                </Text>
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
