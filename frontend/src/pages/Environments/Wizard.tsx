import React, { useState, useEffect, useCallback } from 'react';
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
  AutoComplete,
  Alert,
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
import environmentApi, { AvailableNamespace } from '../../api/environment';
import { feedback } from '../../utils/feedback';
import { useProjectStore } from '../../stores/project';

const { Title, Text, Paragraph } = Typography;

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

  const [envType, setEnvType] = useState<'k8s' | 'helm' | 'pm' | 'external'>('k8s');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loadingResources, setLoadingResources] = useState<boolean>(false);

  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availableNamespaces, setAvailableNamespaces] = useState<AvailableNamespace[]>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState<boolean>(false);

  const [form] = Form.useForm();

  const fetchNamespaces = useCallback(async (clusterId: string) => {
    if (!clusterId) {
      setAvailableNamespaces([]);
      return;
    }
    setLoadingNamespaces(true);
    try {
      const res = await environmentApi.getAvailableNamespaces(clusterId, 'create');
      setAvailableNamespaces(Array.isArray(res) ? res : []);
    } catch {
      setAvailableNamespaces([]);
    } finally {
      setLoadingNamespaces(false);
    }
  }, []);

  // Load project deploy type, clusters and services
  useEffect(() => {
    if (!projectName) return;
    // 探测项目部署架构类型 (k8s / helm / pm / external)
    http
      .get<{ product_feature?: { basic_facility?: string; deploy_type?: string; create_env_type?: string } }>(
        `/api/aslan/project/products/${encodeURIComponent(projectName)}`,
        { skipErrorHandler: true }
      )
      .then((res) => {
        const feature = res?.product_feature;
        if (feature?.basic_facility === 'cloud_host') {
          setEnvType('pm');
        } else if (feature?.deploy_type === 'helm') {
          setEnvType('helm');
        } else if (feature?.create_env_type === 'external') {
          setEnvType('external');
        } else {
          setEnvType('k8s');
        }
      })
      .catch(() => setEnvType('k8s'));

    const fetchResources = async () => {
      setLoadingResources(true);
      try {
        const [clusterRes, serviceRes] = await Promise.all([
          http.get<ClusterItem[] | { data: ClusterItem[] }>('/api/aslan/cluster/clusters', {
            skipErrorHandler: true,
          }),
          projectName
            ? http.get<ServiceItem[] | { data: ServiceItem[] }>(
                `/api/aslan/service/services?projectName=${encodeURIComponent(projectName)}`,
                { skipErrorHandler: true }
              )
            : Promise.resolve([]),
        ]);

        const clusterList = Array.isArray(clusterRes)
          ? clusterRes
          : (clusterRes as any)?.data || [];
        setClusters(clusterList);
        const defaultClusterId = clusterList[0]?.id || 'local';
        if (clusterList.length > 0 && !form.getFieldValue('cluster_id')) {
          form.setFieldsValue({ cluster_id: defaultClusterId });
          fetchNamespaces(defaultClusterId);
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
  }, [projectName, fetchNamespaces, form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        if (envType === 'pm') {
          await form.validateFields(['env_name', 'alias']);
        } else {
          await form.validateFields(['env_name', 'cluster_id', 'namespace']);
        }
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

      // 主机 (PM) 环境采用 /init/type/pm 端点；容器环境 (K8s/Helm) 采用 /environments?type= 端点
      if (envType === 'pm') {
        const payload = [
          {
            product_name: projectName,
            env_name: values.env_name,
            alias: values.alias || values.env_name,
            services: selectedServices.map((name) => [
              {
                service_name: name,
              },
            ]),
          },
        ];
        await http.post(
          `/api/aslan/environment/init/type/pm?projectName=${encodeURIComponent(projectName)}`,
          payload
        );
      } else {
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
                type: envType === 'helm' ? 'helm' : 'k8s',
              },
            ]),
          },
        ];

        await http.post(
          `/api/aslan/environment/environments?projectName=${encodeURIComponent(projectName)}&type=${envType}`,
          payload
        );
      }

      feedback.message.success(`环境 [${values.env_name}] 创建成功！正在调度初始化...`);
      navigate(`/v1/projects/detail/${projectName}/envs`);
    } catch (err: any) {
      feedback.message.error(err?.message || '环境创建失败，请检查参数与集群配额');
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
              <Tag color={envType === 'helm' ? 'cyan' : envType === 'pm' ? 'purple' : 'geekblue'} style={{ marginLeft: 8 }}>
                {envType === 'pm' ? '主机 (PM) 环境' : envType === 'helm' ? 'Helm Chart 环境' : 'Kubernetes 原生环境'}
              </Tag>
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

              {envType === 'pm' && (
                <Alert
                  type="info"
                  showIcon
                  title="主机 (PM) 交付架构环境"
                  description="当前项目为物理机/虚拟机架构。创建主机环境时将与主机探活服务直接关联，无需选择或分配 Kubernetes 集群和命名空间。"
                  style={{ marginBottom: 16 }}
                />
              )}

              {envType !== 'pm' && (
                <>
                  <Form.Item
                    name="cluster_id"
                    label="目标 Kubernetes 集群"
                    rules={[{ required: true, message: '请选择部署集群' }]}
                  >
                    <Select
                      placeholder="选择集群"
                      loading={loadingResources}
                      onChange={(val) => fetchNamespaces(val)}
                      options={clusters.map((c) => ({
                        value: c.id,
                        label: `${c.name} ${c.is_local ? '(当前控制面集群)' : ''}`,
                      }))}
                    />
                  </Form.Item>

                  <Form.Item
                    name="namespace"
                    label="Kubernetes Namespace (命名空间)"
                    rules={[{ required: true, message: '请输入命名空间' }]}
                    extra={
                      <div>
                        <div>系统将在选定集群中自动创建或托管该 Namespace（支持自由输入或选择集群现有命名空间）。</div>
                        {loadingNamespaces && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>正在从目标集群检测命名空间...</Text>
                          </div>
                        )}
                        {availableNamespaces.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>集群已发现命名空间快捷填入: </Text>
                            <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
                              {availableNamespaces.map((ns) => (
                                <Tag
                                  key={ns.name}
                                  color={ns.used_by_other_env ? 'default' : 'geekblue'}
                                  style={{
                                    cursor: ns.used_by_other_env ? 'not-allowed' : 'pointer',
                                    opacity: ns.used_by_other_env ? 0.6 : 1,
                                  }}
                                  onClick={() => {
                                    if (!ns.used_by_other_env) {
                                      form.setFieldsValue({ namespace: ns.name });
                                    }
                                  }}
                                >
                                  {ns.name} {ns.used_by_other_env ? '(已占用)' : ''}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        )}
                      </div>
                    }
                  >
                    <AutoComplete
                      placeholder={`例如: ${projectName}-env-dev 或从下拉列表中选择`}
                      options={availableNamespaces.map((ns) => ({
                        value: ns.name,
                        disabled: ns.used_by_other_env,
                        label: (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: ns.used_by_other_env ? 'normal' : 500 }}>{ns.name}</span>
                            {ns.used_by_other_env ? (
                              <Tag color="warning" style={{ marginInlineEnd: 0 }}>已被其他环境占用</Tag>
                            ) : (
                              <Tag color="success" style={{ marginInlineEnd: 0 }}>集群可用</Tag>
                            )}
                          </div>
                        ),
                      }))}
                    >
                      <Input placeholder={`例如: ${projectName}-env-dev`} />
                    </AutoComplete>
                  </Form.Item>
                </>
              )}

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
                <Descriptions.Item label="交付架构类型">
                  <Tag color={envType === 'helm' ? 'cyan' : envType === 'pm' ? 'purple' : 'geekblue'}>
                    {envType === 'pm' ? '主机 (PM) 架构' : envType === 'helm' ? 'Helm Chart 架构' : 'Kubernetes 原生'}
                  </Tag>
                </Descriptions.Item>
                {envType !== 'pm' && (
                  <>
                    <Descriptions.Item label="目标集群 ID">
                      {form.getFieldValue('cluster_id')}
                    </Descriptions.Item>
                    <Descriptions.Item label="K8s 命名空间">
                      <Text code>{form.getFieldValue('namespace')}</Text>
                    </Descriptions.Item>
                  </>
                )}
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
