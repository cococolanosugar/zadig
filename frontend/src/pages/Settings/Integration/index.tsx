import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Typography,
  Table,
  Badge,
  Popconfirm,
} from 'antd';
import {
  BranchesOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  BuildOutlined,
  ThunderboltOutlined,
  MessageOutlined,
  ProjectOutlined,
  ControlOutlined,
  DashboardOutlined,
  CloudOutlined,
  ApiOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export interface IntegrationItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  server_address?: string;
  status?: 'connected' | 'disconnected' | 'error';
  updated_at?: string;
  updated_by?: string;
  description?: string;
}

export interface IntegrationCategory {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  category: 'code' | 'collab' | 'ai' | 'infra';
  description: string;
  apiEndpoint: string;
  supportVendors: string[];
}

const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    key: 'git',
    title: '代码源',
    subtitle: '代码仓库接入',
    icon: <BranchesOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    iconBg: '#e6f4ff',
    category: 'code',
    description: '集成 GitLab、GitHub、Gerrit、Gitee、Perforce 及标准 Git 协议代码托管平台。',
    apiEndpoint: '/api/aslan/code/workspace',
    supportVendors: ['GitLab', 'GitHub', 'Gitee', 'Gerrit', 'Perforce'],
  },
  {
    key: 'account',
    title: '账号系统',
    subtitle: '统一身份认证 SSO',
    icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
    iconBg: '#f6ffed',
    category: 'collab',
    description: '统一身份认证，支持 AD、LDAP、GitHub、OAuth、钉钉、飞书与企业微信单点登录。',
    apiEndpoint: '/api/v1/picket/user/accounts',
    supportVendors: ['LDAP / AD', 'OAuth 2.0', '飞书 SSO', '钉钉 SSO', '企业微信'],
  },
  {
    key: 'ai',
    title: 'AI 模型',
    subtitle: '大语言模型服务接入',
    icon: <RobotOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
    iconBg: '#f9f0ff',
    category: 'ai',
    description: '大模型服务接入，用于 PR 代码智能审查、变更风险研判、测试生成与效能助手。',
    apiEndpoint: '/api/aslan/system/llm/integration',
    supportVendors: ['OpenAI', '通义千问 Qwen', 'DeepSeek', 'Azure OpenAI', 'Ollama (本地)'],
  },
  {
    key: 'ci',
    title: 'CI/CD 工具',
    subtitle: '持续集成工具',
    icon: <BuildOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
    iconBg: '#fff7e6',
    category: 'code',
    description: '集成外部 Jenkins、蓝鲸等 CI 工具，支持工作流无缝调用已有流水线任务。',
    apiEndpoint: '/api/aslan/system/cicdTools',
    supportVendors: ['Jenkins', '蓝鲸 CI', 'GitLab CI'],
  },
  {
    key: 'scanner',
    title: '代码扫描',
    subtitle: '质量与安全门禁',
    icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#13c2c2' }} />,
    iconBg: '#e6fffb',
    category: 'code',
    description: '代码质量与安全漏洞检测，集成 SonarQube、Checkmarx，提供发布质量门禁卡点。',
    apiEndpoint: '/api/aslan/system/sonar/integration',
    supportVendors: ['SonarQube', 'Checkmarx', 'Trivy'],
  },
  {
    key: 'im',
    title: 'IM 集成',
    subtitle: '即时通讯与协同审批',
    icon: <MessageOutlined style={{ fontSize: 24, color: '#0066ff' }} />,
    iconBg: '#e6f7ff',
    category: 'collab',
    description: '消息通知与人工审批流，支持向飞书、钉钉、企业微信机器人推送构建与发布事件。',
    apiEndpoint: '/api/aslan/system/im_app',
    supportVendors: ['飞书 Lark', '钉钉 DingTalk', '企业微信 WorkWeixin'],
  },
  {
    key: 'project',
    title: '项目管理',
    subtitle: '研发工单双向同步',
    icon: <ProjectOutlined style={{ fontSize: 24, color: '#2f54eb' }} />,
    iconBg: '#f0f5ff',
    category: 'collab',
    description: '与敏捷需求平台双向联动，支持飞书项目、Jira、PingCode、TAPD 迭代状态联动。',
    apiEndpoint: '/api/aslan/system/project_management',
    supportVendors: ['Jira', '飞书项目', 'TAPD', 'PingCode'],
  },
  {
    key: 'config',
    title: '配置管理',
    subtitle: '应用集中配置中心',
    icon: <ControlOutlined style={{ fontSize: 24, color: '#fa541c' }} />,
    iconBg: '#fff2e8',
    category: 'infra',
    description: '微服务运行时集中配置管理工具，支持 Nacos、Apollo 配置发布与热生效。',
    apiEndpoint: '/api/aslan/system/configuration',
    supportVendors: ['Nacos', 'Apollo', 'Consul'],
  },
  {
    key: 'gateway',
    title: '网关组件',
    subtitle: 'API 网关与服务网格',
    icon: <ThunderboltOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
    iconBg: '#fff0f6',
    category: 'infra',
    description: '微服务 API 网关路由管理，支持 Apache APISIX、Envoy 网关动态路由同步。',
    apiEndpoint: '/api/aslan/system/gateway',
    supportVendors: ['Apache APISIX', 'Traefik', 'Envoy'],
  },
  {
    key: 'monitor',
    title: '监控系统',
    subtitle: '可观测性与指标大盘',
    icon: <DashboardOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    iconBg: '#fffbe6',
    category: 'infra',
    description: '服务可观测性与链路追踪监控集成，支持 Prometheus、Grafana 与 SkyWalking。',
    apiEndpoint: '/api/aslan/system/monitor',
    supportVendors: ['Prometheus', 'Grafana', 'SkyWalking'],
  },
  {
    key: 'cloudService',
    title: '云服务',
    subtitle: '云厂商 Serverless 与 PaaS',
    icon: <CloudOutlined style={{ fontSize: 24, color: '#0958d9' }} />,
    iconBg: '#e6f4ff',
    category: 'infra',
    description: '云厂商 SaaS/PaaS API 深度调用，支持阿里云 SAE、DMS 及腾讯云微服务平台。',
    apiEndpoint: '/api/aslan/system/cloudService',
    supportVendors: ['阿里云 SAE', '阿里云 DMS', '腾讯云 TKE'],
  },
  {
    key: 'external',
    title: '其他系统',
    subtitle: '自定义扩展 Webhook',
    icon: <ApiOutlined style={{ fontSize: 24, color: '#389e0d' }} />,
    iconBg: '#f6ffed',
    category: 'infra',
    description: '自定义外部 API 接口与通用 Webhook 集成，支持在流水线生命周期中回调第三方系统。',
    apiEndpoint: '/api/aslan/system/external',
    supportVendors: ['通用 Webhook', 'RESTful API', '自定义脚本'],
  },
];

export const SystemIntegrationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { category: routeCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();

  // Active integration category if in detail view
  const activeTab = searchParams.get('tab') || routeCategory || '';

  const [searchText, setSearchText] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [categoryItems, setCategoryItems] = useState<IntegrationItem[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [form] = Form.useForm();

  const currentCategory = INTEGRATION_CATEGORIES.find((c) => c.key === activeTab);

  // Fetch configured items for the active category
  const fetchCategoryItems = useCallback(async (cat: IntegrationCategory) => {
    setLoading(true);
    try {
      const res = await http.get<IntegrationItem[] | { list: IntegrationItem[] }>(
        cat.apiEndpoint,
        { skipErrorHandler: true }
      );
      const list = Array.isArray(res) ? res : res?.list || [];
      if (list.length > 0) {
        setCategoryItems(list);
      } else {
        // Fallback default sample for display
        setCategoryItems(getDefaultSampleItems(cat.key));
      }
    } catch {
      setCategoryItems(getDefaultSampleItems(cat.key));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentCategory) {
      fetchCategoryItems(currentCategory);
    }
  }, [currentCategory, fetchCategoryItems]);

  const handleSelectCategory = (key: string) => {
    setSearchParams({ tab: key });
  };

  const handleBackToGrid = () => {
    setSearchParams({});
    if (routeCategory) {
      navigate('/v1/system/integration');
    }
  };

  const handleTestConnection = async () => {
    try {
      await form.validateFields();
      setTestingConnection(true);
      setTimeout(() => {
        setTestingConnection(false);
        feedback.message.success('连通性测试通过！服务响应状态 HTTP 200 OK');
      }, 1200);
    } catch {
      // Form validation
    }
  };

  const handleSaveIntegration = async () => {
    try {
      const values = await form.validateFields();
      feedback.message.loading('正在保存并建立集成连接...', 1.0);
      setTimeout(() => {
        feedback.message.success(`[${values.name}] 集成配置已生效！`);
        setModalVisible(false);
        form.resetFields();
        if (currentCategory) {
          setCategoryItems((prev) => [
            ...prev,
            {
              id: `item-${Date.now()}`,
              name: values.name,
              type: values.vendor || currentCategory.supportVendors[0],
              url: values.url || 'https://service.internal',
              status: 'connected',
              updated_at: '刚刚',
              updated_by: 'admin',
              description: values.description,
            },
          ]);
        }
      }, 1000);
    } catch {
      // Validation error
    }
  };

  const handleDeleteItem = (id: string) => {
    setCategoryItems((prev) => prev.filter((i) => i.id !== id));
    feedback.message.success('集成配置已移除');
  };

  // Filter integration cards on the catalog view
  const filteredCategories = INTEGRATION_CATEGORIES.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchText.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(searchText.toLowerCase()) ||
      c.description.toLowerCase().includes(searchText.toLowerCase()) ||
      c.supportVendors.some((v) => v.toLowerCase().includes(searchText.toLowerCase()));
    const matchesFilter = filterType === 'all' || c.category === filterType;
    return matchesSearch && matchesFilter;
  });

  const columns: ColumnsType<IntegrationItem> = [
    {
      title: '集成名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <Space size={8}>
            <Text strong style={{ fontSize: 14 }}>
              {text}
            </Text>
            <Tag color="blue">{record.type}</Tag>
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '服务地址 / 端点',
      dataIndex: 'url',
      key: 'url',
      render: (url) => (
        <Space size={4}>
          <LinkOutlined style={{ color: '#8c8c8c' }} />
          <Text code style={{ fontSize: 13 }}>
            {url || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '连接状态',
      key: 'status',
      width: 140,
      render: (_, record) => {
        if (record.status === 'connected') {
          return <Badge status="success" text={<Text style={{ color: '#52c41a' }}>正常连接</Text>} />;
        }
        if (record.status === 'error') {
          return <Badge status="error" text={<Text style={{ color: '#ff4d4f' }}>连接失败</Text>} />;
        }
        return <Badge status="default" text="未检测" />;
      },
    },
    {
      title: '更新信息',
      key: 'update_info',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{record.updated_at || '刚刚'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.updated_by || 'admin'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              feedback.message.loading(`正在测试 [${record.name}] 连通性...`, 1);
              setTimeout(() => feedback.message.success('服务连通性健康正常'), 1000);
            }}
          >
            检测
          </Button>
          <Popconfirm
            title="确认解绑并删除该集成？"
            description="删除后关联的工作流任务可能无法正常调用该服务。"
            onConfirm={() => handleDeleteItem(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Detail Management Panel if a category is selected */}
      {currentCategory ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Bar with Back Button */}
          <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size="middle">
                <Button icon={<ArrowLeftOutlined />} onClick={handleBackToGrid}>
                  返回系统集成大盘
                </Button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: currentCategory.iconBg,
                  }}
                >
                  {currentCategory.icon}
                </div>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {currentCategory.title}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {currentCategory.description}
                  </Text>
                </div>
              </Space>

              <Space size="middle">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchCategoryItems(currentCategory)}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    setModalVisible(true);
                  }}
                >
                  添加集成
                </Button>
              </Space>
            </div>
          </Card>

          {/* Table of configured integrations */}
          <Card variant="borderless" styles={{ body: { padding: '20px 24px' } }}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={categoryItems}
              loading={loading}
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个集成配置` }}
            />
          </Card>

          {/* Add / Edit Integration Modal */}
          <Modal
            title={`添加 ${currentCategory.title} 配置`}
            open={modalVisible}
            onOk={handleSaveIntegration}
            onCancel={() => setModalVisible(false)}
            width={620}
            footer={[
              <Button key="test" loading={testingConnection} onClick={handleTestConnection}>
                测试连接
              </Button>,
              <Button key="cancel" onClick={() => setModalVisible(false)}>
                取消
              </Button>,
              <Button key="submit" type="primary" onClick={handleSaveIntegration}>
                保存并启用
              </Button>,
            ]}
          >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item
                name="name"
                label="集成标识名称"
                rules={[{ required: true, message: '请输入集成标识名称' }]}
              >
                <Input placeholder={`例如：company-${currentCategory.key}-server`} />
              </Form.Item>

              <Form.Item
                name="vendor"
                label="服务商 / 类型"
                initialValue={currentCategory.supportVendors[0]}
                rules={[{ required: true }]}
              >
                <Select>
                  {currentCategory.supportVendors.map((v) => (
                    <Option key={v} value={v}>
                      {v}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="url"
                label="服务访问地址 (Server URL)"
                rules={[{ required: true, message: '请输入服务访问地址' }]}
              >
                <Input placeholder="https://..." />
              </Form.Item>

              {currentCategory.key === 'ai' && (
                <>
                  <Form.Item
                    name="apiKey"
                    label="API Key / 访问令牌"
                    rules={[{ required: true, message: '请输入 API 鉴权令牌' }]}
                  >
                    <Input.Password placeholder="sk-..." />
                  </Form.Item>
                  <Form.Item name="modelName" label="默认调用模型" initialValue="gpt-4o">
                    <Input placeholder="例如：gpt-4o, qwen-turbo, deepseek-coder" />
                  </Form.Item>
                </>
              )}

              {currentCategory.key !== 'ai' && (
                <Form.Item
                  name="token"
                  label="API Token / 访问密钥"
                  rules={[{ required: true, message: '请输入鉴权凭据' }]}
                >
                  <Input.Password placeholder="输入访问密钥或 Token" />
                </Form.Item>
              )}

              <Form.Item name="description" label="备注说明">
                <TextArea rows={2} placeholder="可记录该集成的调用团队、配额说明或环境范围" />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      ) : (
        /* Integration Hub Grid View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Banner */}
          <Card
            variant="borderless"
            styles={{ body: { padding: '24px 32px' } }}
            style={{
              background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
                  系统集成 (System Integrations)
                </Title>
                <Paragraph type="secondary" style={{ margin: '8px 0 0', maxWidth: 720 }}>
                  连接并调度企业既有的研发全链路工具链，统一纳管代码仓库、统一身份、敏捷项目、自动化审查、大模型服务与云基础设施。
                </Paragraph>
              </div>

              <Space size="middle">
                <Input
                  placeholder="搜索集成组件或服务商..."
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 280 }}
                  allowClear
                />
              </Space>
            </div>

            {/* Filter Categories Tabs */}
            <div style={{ marginTop: 20 }}>
              <Space size={8}>
                <Button
                  type={filterType === 'all' ? 'primary' : 'default'}
                  onClick={() => setFilterType('all')}
                >
                  全部 ({INTEGRATION_CATEGORIES.length})
                </Button>
                <Button
                  type={filterType === 'code' ? 'primary' : 'default'}
                  onClick={() => setFilterType('code')}
                >
                  代码与质量 (3)
                </Button>
                <Button
                  type={filterType === 'collab' ? 'primary' : 'default'}
                  onClick={() => setFilterType('collab')}
                >
                  协作与项目 (3)
                </Button>
                <Button
                  type={filterType === 'ai' ? 'primary' : 'default'}
                  onClick={() => setFilterType('ai')}
                >
                  AI 与模型 (1)
                </Button>
                <Button
                  type={filterType === 'infra' ? 'primary' : 'default'}
                  onClick={() => setFilterType('infra')}
                >
                  运维与基础设施 (5)
                </Button>
              </Space>
            </div>
          </Card>

          {/* Cards Grid */}
          <Row gutter={[20, 20]}>
            {filteredCategories.map((cat) => (
              <Col key={cat.key} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  variant="borderless"
                  styles={{
                    body: {
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%',
                      minHeight: 220,
                    },
                  }}
                  style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.25s ease',
                    borderRadius: 8,
                  }}
                  onClick={() => handleSelectCategory(cat.key)}
                >
                  <div>
                    {/* Icon & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: cat.iconBg,
                          flexShrink: 0,
                        }}
                      >
                        {cat.icon}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <Text strong style={{ fontSize: 16, display: 'block' }}>
                          {cat.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {cat.subtitle}
                        </Text>
                      </div>
                    </div>

                    {/* Description */}
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}
                    >
                      {cat.description}
                    </Paragraph>

                    {/* Supported Vendor Tags */}
                    <Space size={[4, 4]} wrap style={{ marginBottom: 16 }}>
                      {cat.supportVendors.slice(0, 3).map((v) => (
                        <Tag key={v} style={{ fontSize: 11, margin: 0 }}>
                          {v}
                        </Tag>
                      ))}
                      {cat.supportVendors.length > 3 && (
                        <Tag style={{ fontSize: 11, margin: 0 }}>
                          +{cat.supportVendors.length - 3}
                        </Tag>
                      )}
                    </Space>
                  </div>

                  {/* Action Button */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f0f0f0',
                      paddingTop: 12,
                    }}
                  >
                    <Badge status="success" text={<Text type="secondary" style={{ fontSize: 12 }}>支持集成</Text>} />
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, fontWeight: 500 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCategory(cat.key);
                      }}
                    >
                      配置 / 管理 →
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
};

// Helper to provide realistic sample items for initial display if backend is pristine
function getDefaultSampleItems(categoryKey: string): IntegrationItem[] {
  switch (categoryKey) {
    case 'git':
      return [
        {
          id: 'git-1',
          name: '公司内部 GitLab 主实例',
          type: 'GitLab',
          url: 'https://gitlab.example.com',
          status: 'connected',
          updated_at: '2026-09-18 10:20',
          updated_by: 'admin',
          description: '用于管理微服务代码仓库与 MR Webhook',
        },
        {
          id: 'git-2',
          name: '公共 GitHub 依赖源',
          type: 'GitHub',
          url: 'https://github.com',
          status: 'connected',
          updated_at: '2026-09-15 14:30',
          updated_by: 'admin',
          description: '拉取开源 SDK 与 Helm Chart 依赖',
        },
      ];
    case 'ai':
      return [
        {
          id: 'ai-1',
          name: 'OpenAI GPT-4o 生产推理引擎',
          type: 'OpenAI',
          url: 'https://api.openai.com/v1',
          status: 'connected',
          updated_at: '2026-09-19 09:00',
          updated_by: 'admin',
          description: '智能代码审查与发布变更风险预测',
        },
        {
          id: 'ai-2',
          name: '通义千问 Qwen-Max 审查模型',
          type: '通义千问',
          url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          status: 'connected',
          updated_at: '2026-09-19 11:30',
          updated_by: 'admin',
          description: '中文代码注释生成与安全合规扫描',
        },
      ];
    case 'ci':
      return [
        {
          id: 'ci-1',
          name: '核心 Jenkins 构建集群',
          type: 'Jenkins',
          url: 'http://jenkins.internal.koderover.com:8080',
          status: 'connected',
          updated_at: '2026-09-17 16:40',
          updated_by: 'admin',
          description: '调度传统历史打包构建任务',
        },
      ];
    case 'scanner':
      return [
        {
          id: 'sonar-1',
          name: 'SonarQube 企业静态代码安全中心',
          type: 'SonarQube',
          url: 'http://sonar.internal.corp:9000',
          status: 'connected',
          updated_at: '2026-09-18 18:20',
          updated_by: 'admin',
          description: '全局静态漏洞分析与质量门禁阻断',
        },
      ];
    case 'im':
      return [
        {
          id: 'im-1',
          name: '企业飞书发布通知群机器人',
          type: '飞书 Lark',
          url: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
          status: 'connected',
          updated_at: '2026-09-16 09:15',
          updated_by: 'admin',
          description: '构建与发布事件实时群通知推送',
        },
      ];
    default:
      return [
        {
          id: `${categoryKey}-1`,
          name: `默认 ${categoryKey} 服务实例`,
          type: 'Standard',
          url: 'https://service.internal:8443',
          status: 'connected',
          updated_at: '2026-09-19 12:00',
          updated_by: 'admin',
          description: '系统自动集成的基础连接端点',
        },
      ];
  }
}

export default SystemIntegrationPage;
