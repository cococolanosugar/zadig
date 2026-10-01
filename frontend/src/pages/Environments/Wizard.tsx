import React, { useState, useEffect } from 'react';
import {
  Card,
  Steps,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Typography,
  Divider,
  Checkbox,
  Row,
  Col,
  Descriptions,
  Tag,
  Empty,
} from 'antd';
import {
  ClusterOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { useProjectStore } from '../../stores/project';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ClusterItem {
  id: string;
  name: string;
  is_local?: boolean;
  status?: string;
}

interface ServiceItem {
  service_name: string;
  type?: string;
  status?: string;
}

export const EnvironmentWizardPage: React.FC = () => {
  const { projectName: routeProject } = useParams<{ projectName?: string }>();
  const { currentProject } = useProjectStore();
  const projectName = routeProject || currentProject || '';
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loadingResources, setLoadingResources] = useState<boolean>(false);

  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [form] = Form.useForm();

  // Load clusters and project services
  useEffect(() => {
    const fetchResources = async () => {
      setLoadingResources(true);
      try {
        const [clusterRes, serviceRes] = await Promise.all([
          http.get<ClusterItem[] | { data: ClusterItem[] }>('/api/aslan/cluster/clusters', {
            skipErrorHandler: true,
          }),
          projectName
            ? http.get<ServiceItem[] | { data: ServiceItem[] }>(
                `/api/aslan/service/services?projectName=${projectName}`,
                { skipErrorHandler: true }
              )
            : Promise.resolve([]),
        ]);

        const clusterList = Array.isArray(clusterRes)
          ? clusterRes
          : (clusterRes as any)?.data || [];
        setClusters(clusterList);
        if (clusterList.length > 0 && !form.getFieldValue('cluster_id')) {
          form.setFieldsValue({ cluster_id: clusterList[0].id });
        }

        const svcList = Array.isArray(serviceRes)
          ? serviceRes
          : (serviceRes as any)?.data || [];
        setAvailableServices(svcList);
        // Default select all available services
        setSelectedServices(svcList.map((s: ServiceItem) => s.service_name));
      } catch {
        // Fallback to local default cluster if list fails
        setClusters([{ id: 'local', name: 'local-cluster (内置控制面集群)' }]);
      } finally {
        setLoadingResources(false);
      }
    };

    fetchResources();
  }, [projectName]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['env_name', 'cluster_id', 'namespace']);
      }
      if (currentStep < 2) {
        setCurrentStep((prev) => prev + 1);
      }
    } catch {
      // Form validation failed
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = [
        {
          product_name: projectName,
          env_name: values.env_name,
          alias: values.alias || values.env_name,
          namespace: values.namespace || `${projectName}-env-${values.env_name}`,
          cluster_id: values.cluster_id,
          production: Boolean(values.production),
          services: selectedServices.map((name) => [
            {
              service_name: name,
              type: 'k8s',
            },
          ]),
        },
      ];

      await http.post(`/api/aslan/environment/environments?projectName=${projectName}&type=k8s`, payload);
      feedback.message.success(`环境 [${values.env_name}] 创建成功！正在调度集群初始化...`);
      navigate(`/v1/projects/detail/${projectName}/envs`);
    } catch (err: any) {
      feedback.message.error(err?.message || '环境创建失败，请检查集群资源配额与命名空间');
    } finally {
      setSubmitting(false);
    }
  };

  const stepItems = [
    {
      title: '基本配置与集群',
      description: '指定环境名、Kubernetes 集群与命名空间',
      icon: <ClusterOutlined />,
    },
    {
      title: '服务实例编排',
      description: '选择部署进该环境的声明式微服务',
      icon: <CloudServerOutlined />,
    },
    {
      title: '确认并创建',
      description: '核对资源清单并触发初始化流水线',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px' }}>
      <Card
        variant="borderless"
        styles={{ body: { padding: '32px 40px' } }}
        style={{ borderRadius: 8, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              新建项目环境向导
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              所属项目: <Tag color="blue">{projectName || '默认项目'}</Tag>
            </Text>
          </div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/v1/projects/detail/${projectName}/envs`)}
          >
            返回环境列表
          </Button>
        </div>

        {/* Steps navigation */}
        <Steps current={currentStep} items={stepItems} style={{ marginBottom: 36 }} />

        <Divider style={{ margin: '20px 0' }} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            production: false,
            cluster_id: clusters[0]?.id || 'local',
          }}
        >
          {/* Step 0: Basic & Cluster */}
          {currentStep === 0 && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <Form.Item
                name="env_name"
                label="环境标识 (Environment Name)"
                rules={[
                  { required: true, message: '请输入环境英文标识' },
                  { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及中划线' },
                ]}
                extra="用于在 Kubernetes 资源和工作流中唯一标识该环境，例如 dev、qa、staging"
              >
                <Input
                  placeholder="例如: dev"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !form.getFieldValue('namespace')) {
                      form.setFieldsValue({ namespace: `${projectName}-env-${val}` });
                    }
                  }}
                />
              </Form.Item>

              <Form.Item name="alias" label="环境显示别名 (Alias)">
                <Input placeholder="例如: 日常研发联调环境" />
              </Form.Item>

              <Form.Item
                name="cluster_id"
                label="目标 Kubernetes 集群"
                rules={[{ required: true, message: '请选择部署集群' }]}
              >
                <Select placeholder="选择集群" loading={loadingResources}>
                  {clusters.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name} {c.is_local ? '(当前控制面集群)' : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="namespace"
                label="Kubernetes Namespace (命名空间)"
                rules={[{ required: true, message: '请输入命名空间' }]}
                extra="系统将在选定集群中自动创建或绑定该 Namespace"
              >
                <Input placeholder={`例如: ${projectName}-env-dev`} />
              </Form.Item>

              <Form.Item
                name="production"
                label="生产环境标记 (Production Flag)"
                valuePropName="checked"
                extra="开启后将启用生产级别发布审批及敏感配置保护策略"
              >
                <Switch checkedChildren="生产环境" unCheckedChildren="测试环境" />
              </Form.Item>
            </div>
          )}

          {/* Step 1: Services Selection */}
          {currentStep === 1 && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 15 }}>
                  选择需部署的服务组件 ({selectedServices.length}/{availableServices.length})
                </Text>
                <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
                  环境初始化时将自动同步勾选服务的 K8s YAML 配置并在集群中调度 Pod 工作负载。
                </Paragraph>
              </div>

              {availableServices.length === 0 ? (
                <Empty
                  description="当前项目下暂无服务定义，可在环境创建完成后随时添加"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div
                  style={{
                    border: '1px solid #ebeef5',
                    borderRadius: 6,
                    padding: '16px 20px',
                    maxHeight: 320,
                    overflowY: 'auto',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Checkbox.Group
                    value={selectedServices}
                    onChange={(vals) => setSelectedServices(vals as string[])}
                    style={{ width: '100%' }}
                  >
                    <Row gutter={[16, 12]}>
                      {availableServices.map((svc) => (
                        <Col span={12} key={svc.service_name}>
                          <Checkbox value={svc.service_name}>
                            <Space orientation="horizontal" size={6}>
                              <CloudServerOutlined style={{ color: '#0066ff' }} />
                              <Text strong>{svc.service_name}</Text>
                              <Tag color="cyan">{svc.type || 'k8s'}</Tag>
                            </Space>
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review & Submit */}
          {currentStep === 2 && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <Title level={5} style={{ marginBottom: 16 }}>
                环境资源创建清单核对
              </Title>
              <Descriptions bordered column={1} size="middle">
                <Descriptions.Item label="所属项目">{projectName}</Descriptions.Item>
                <Descriptions.Item label="环境标识">
                  <Tag color="blue">{form.getFieldValue('env_name')}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="显示别名">
                  {form.getFieldValue('alias') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="目标集群 ID">
                  {form.getFieldValue('cluster_id')}
                </Descriptions.Item>
                <Descriptions.Item label="K8s 命名空间">
                  <Text code>{form.getFieldValue('namespace')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="环境类型">
                  {form.getFieldValue('production') ? (
                    <Tag color="red">生产环境</Tag>
                  ) : (
                    <Tag color="green">非生产测试环境</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="已选服务清单">
                  {selectedServices.length > 0 ? (
                    <Space wrap size={[6, 6]}>
                      {selectedServices.map((s) => (
                        <Tag key={s} color="blue">
                          {s}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">未选择服务（创建空环境）</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </Form>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid #ebeef5',
          }}
        >
          <Button disabled={currentStep === 0} onClick={handlePrev} icon={<ArrowLeftOutlined />}>
            上一步
          </Button>

          {currentStep < 2 ? (
            <Button type="primary" onClick={handleNext}>
              下一步 <ArrowRightOutlined />
            </Button>
          ) : (
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSubmit}
              icon={<CheckCircleOutlined />}
            >
              确认并创建环境
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EnvironmentWizardPage;
