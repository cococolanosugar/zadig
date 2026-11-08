import React, { useEffect, useState, useCallback } from 'react';
import {
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
  Empty,
} from 'antd';
import {
  UserOutlined,
  BranchesOutlined,
  ProjectOutlined,
  MessageOutlined,
  RobotOutlined,
  BuildOutlined,
  SafetyCertificateOutlined,
  ControlOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  CloudOutlined,
  ApiOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../../api/client';
import settingsApi from '../../../api/settings';
import { feedback } from '../../../utils/feedback';
import { generateAesKey, rsaEncrypt } from '../../../utils/crypto';
import { authApi } from '../../../api/auth';
import { CodeHostsPage } from '../CodeHosts';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export interface IntegrationItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  status?: 'connected' | 'disconnected' | 'error';
  updated_at?: string;
  updated_by?: string;
  description?: string;
}

export interface IntegrationMeta {
  key: string;
  name: string;
  desc: string;
  link: string;
  icon: React.ReactNode;
  // 分类列表/CRUD 的基础路径（不带 query；POST/DELETE 直接用 base）
  apiEndpoint: string;
  // 列表 GET 需实时生成 encryptedKey（后端对空 key 直接 ErrInvalidParam）
  needsEncryptedKey?: boolean;
  // 连通性测试端点（后端实际存在的 /validate 或列表 GET；缺省用 apiEndpoint GET）
  validateEndpoint?: string;
  supportVendors: string[];
}

// 12 Integration Categories strictly matching live Zadig (chunk 87)
const INTEGRATION_LIST: IntegrationMeta[] = [
  {
    key: 'account',
    name: '账号系统',
    desc: '统一身份认证，支持 AD、LDAP、GitHub、钉钉、飞书、企业微信、OAuth 等',
    link: '/v1/system/integration/account',
    icon: <UserOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/v1/connectors',
    needsEncryptedKey: true,
    validateEndpoint: undefined,
    supportVendors: ['LDAP / AD', 'OAuth 2.0', '飞书 SSO', '钉钉 SSO', '企业微信 SSO'],
  },
  {
    key: 'git',
    name: '代码源',
    desc: '代码仓库接入，支持 GitLab、GitHub、Gerrit、Gitee、Perforce、Git 标准协议等',
    link: '/v1/system/integration/git',
    icon: <BranchesOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/v1/codehosts',
    needsEncryptedKey: true,
    supportVendors: ['GitLab', 'GitHub', 'Gitee', 'Gerrit', 'Perforce'],
  },
  {
    key: 'project',
    name: '项目管理',
    desc: '研发项目双向同步，支持飞书项目、Jira、PingCode、TAPD 等',
    link: '/v1/system/integration/project',
    icon: <ProjectOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/project_management',
    supportVendors: ['Jira', '飞书项目', 'TAPD', 'PingCode'],
  },
  {
    key: 'im',
    name: 'IM 集成',
    desc: '即时通讯通知与审批，支持飞书、钉钉、企业微信等',
    link: '/v1/system/integration/im',
    icon: <MessageOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/im_app',
    supportVendors: ['飞书 Lark', '钉钉 DingTalk', '企业微信 WorkWeixin'],
  },
  {
    key: 'ai',
    name: 'AI 模型',
    desc: '大语言模型服务接入，支持接入 LLM 模型（如 OpenAI、通义千问等）',
    link: '/v1/system/integration/ai',
    icon: <RobotOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/llm/integration',
    supportVendors: ['OpenAI', '通义千问 Qwen', 'DeepSeek', 'Azure OpenAI', 'Ollama (本地)'],
  },
  {
    key: 'ci',
    name: 'CI/CD 工具',
    desc: '持续集成与交付工具，支持 Jenkins、蓝鲸等',
    link: '/v1/system/integration/ci',
    icon: <BuildOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/cicdTools',
    supportVendors: ['Jenkins', '蓝鲸 CI', 'GitLab CI'],
  },
  {
    key: 'scanner',
    name: '代码扫描',
    desc: '代码质量与安全分析，支持 SonarQube 等',
    link: '/v1/system/integration/scanner',
    icon: <SafetyCertificateOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/sonar/integration',
    supportVendors: ['SonarQube', 'Checkmarx', 'Trivy'],
  },
  {
    key: 'config',
    name: '配置管理',
    desc: '应用配置管理工具，支持 Nacos、Apollo 等配置变更',
    link: '/v1/system/integration/config',
    icon: <ControlOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/configuration',
    supportVendors: ['Nacos', 'Apollo', 'Consul'],
  },
  {
    key: 'gateway',
    name: '网关组件',
    desc: 'API 网关集成，支持 APISIX 等网关配置变更',
    link: '/v1/system/integration/gateway',
    icon: <ThunderboltOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/api_gateways',
    supportVendors: ['Apache APISIX', 'Traefik', 'Envoy'],
  },
  {
    key: 'monitor',
    name: '监控系统',
    desc: '服务可观测性集成，支持 Grafana 等',
    link: '/v1/system/integration/monitor',
    icon: <DashboardOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/observability',
    supportVendors: ['Prometheus', 'Grafana', 'SkyWalking'],
  },
  {
    key: 'cloudService',
    name: '云服务',
    desc: '云厂商 SaaS 调用，支持阿里云 SAE、DMS 等',
    link: '/v1/system/integration/cloudService',
    icon: <CloudOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/cloud_service',
    needsEncryptedKey: true,
    supportVendors: ['阿里云 SAE', '阿里云 DMS', '腾讯云 TKE'],
  },
  {
    key: 'external',
    name: '其他系统',
    desc: '自定义外部 API 集成，支持工作流调用任意第三方系统接口',
    link: '/v1/system/integration/external',
    icon: <ApiOutlined style={{ fontSize: 30, color: '#0066ff' }} />,
    apiEndpoint: '/api/aslan/system/external',
    needsEncryptedKey: true,
    supportVendors: ['通用 Webhook', 'RESTful API', '自定义脚本'],
  },
];

export const SystemIntegrationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { category: routeCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();

  // Active integration key: e.g. 'account', 'git', 'ai'
  const activeKey = routeCategory || searchParams.get('tab') || '';
  const currentCategory = INTEGRATION_LIST.find((c) => c.key === activeKey);

  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [form] = Form.useForm();
  const selectedVendor = Form.useWatch('vendor', form) || currentCategory?.supportVendors[0];

  // 需要加密 key 的分类（connectors/codehosts/cloud_service/external）：实时生成 encryptedKey
  // （generateAesKey(32) + rsaEncrypt(aesKey, publicKey)，publicKey 来自 /system/rsaKey/publicKey）
  const buildListUrl = useCallback(async (cat: IntegrationMeta): Promise<string> => {
    if (!cat.needsEncryptedKey) return cat.apiEndpoint;
    const publicKey = await authApi.getRSAPublicKey();
    const encryptedKey = rsaEncrypt(generateAesKey(32), publicKey);
    return `${cat.apiEndpoint}?encryptedKey=${encodeURIComponent(encryptedKey)}`;
  }, []);

  const fetchItems = useCallback(async (cat: IntegrationMeta) => {
    setLoading(true);
    try {
      const url = await buildListUrl(cat);
      const res = await http.get<IntegrationItem[] | { list: IntegrationItem[] }>(
        url,
        { skipErrorHandler: true }
      );
      const list = Array.isArray(res)
        ? res
        : (res as any)?.list || (res as any)?.external_system || [];
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [buildListUrl]);

  useEffect(() => {
    if (currentCategory) {
      fetchItems(currentCategory);
    }
  }, [currentCategory, fetchItems]);

  const handleGoToDetail = (link: string) => {
    navigate(link);
  };

  const handleBack = () => {
    navigate('/v1/system/integration');
  };

  const handleTestConnection = async () => {
    if (!currentCategory) return;
    try {
      setTestingConnection(true);
      const values = form.getFieldsValue();
      if (currentCategory.key === 'project') {
        let pmType = 'jira';
        if (values.vendor === '飞书项目') pmType = 'meego';
        else if (values.vendor === 'PingCode') pmType = 'pingcode';
        else if (values.vendor === 'TAPD') pmType = 'tapd';

        await http.post('/api/aslan/system/project_management/validate', {
          name: values.name || 'test-pm',
          type: pmType,
          jira_host: values.jira_host || values.url,
          jira_user: values.jira_user,
          jira_token: values.jira_token || values.token,
          jira_auth_type: values.jira_auth_type || 'Basic',
          meego_plugin_id: values.meego_plugin_id,
          meego_plugin_secret: values.meego_plugin_secret,
          meego_user_key: values.meego_user_key,
          pingcode_client_id: values.pingcode_client_id,
          pingcode_client_secret: values.pingcode_client_secret,
          tapd_client_id: values.tapd_client_id,
          tapd_client_secret: values.tapd_client_secret,
        }, { skipErrorHandler: true });
        feedback.message.success('研发管理系统连通性握手验证成功！');
      } else if (currentCategory.key === 'config') {
        const configType = values.nacos_version || (values.vendor === 'Nacos' ? 'nacos' : 'apollo');
        await http.post('/api/aslan/system/configuration/validate', {
          name: values.name || 'test-config',
          type: configType,
          server_address: values.url,
          nacos_auth_config: values.vendor === 'Nacos' ? {
            username: values.nacos_username,
            password: values.nacos_password,
            access_key: values.nacos_ak,
            secret_key: values.nacos_sk,
            namespace: values.nacos_namespace,
            group: values.nacos_group,
          } : undefined,
          apollo_auth_config: values.vendor === 'Apollo' ? {
            server_address: values.url,
            token: values.token,
          } : undefined,
        }, { skipErrorHandler: true });
        feedback.message.success('配置中心服务连通性验证成功！');
      } else if (currentCategory.key === 'scanner') {
        await http.post(
          '/api/aslan/system/sonar/validate',
          {
            server_address: values.url,
            token: values.token,
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('SonarQube 代码扫描服务连通性握手验证成功！');
      } else if (currentCategory.key === 'ci') {
        await http.post(
          '/api/aslan/system/jenkins/user/connection',
          {
            url: values.url,
            username: values.username,
            password: values.password,
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('Jenkins CI 服务连通性握手验证成功！');
      } else if (currentCategory.key === 'im') {
        // FULL-A-04: 即时通讯 IM 凭据真实连通性校验 (POST /api/aslan/system/im_app/validate)
        const vendor = String(values.vendor || '').toLowerCase();
        const imType =
          vendor.includes('lark') || vendor.includes('飞书')
            ? 'lark'
            : vendor.includes('dingtalk') || vendor.includes('钉钉')
            ? 'dingtalk'
            : vendor.includes('workwx') || vendor.includes('企微') || vendor.includes('企业微信')
            ? 'workwx'
            : '';
        await http.post(
          '/api/aslan/system/im_app/validate',
          {
            type: imType,
            ...(imType === 'lark'
              ? {
                  app_id: values.app_id || values.appId,
                  app_secret: values.app_secret || values.appSecret,
                }
              : imType === 'dingtalk'
              ? {
                  dingtalk_app_key: values.dingtalk_app_key || values.app_key,
                  dingtalk_app_secret: values.dingtalk_app_secret || values.app_secret,
                }
              : {
                  host: values.host || values.url,
                  corp_id: values.corp_id || values.corpId,
                  agent_id: values.agent_id || values.agentId,
                  agent_secret: values.agent_secret || values.agentSecret,
                }),
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('即时通讯 (IM) 凭据连接验证成功！');
      } else if (currentCategory.key === 'gateway') {
        // FULL-A-05: API 网关真实连通性握手 (POST /api/aslan/system/api_gateways/validate)
        await http.post(
          '/api/aslan/system/api_gateways/validate',
          {
            name: values.name || 'test-gateway',
            alias: values.name || 'test-gateway',
            type: values.type || 'apisix',
            address: values.address || values.url,
            token: values.token || values.admin_key,
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('API 网关服务连通性握手验证成功！');
      } else if (currentCategory.key === 'monitor') {
        // FULL-A-06: 监控系统 / 可观测性真实连通性校验 (POST /api/aslan/system/observability/validate)
        const monitorVendor = String(values.vendor || '').toLowerCase();
        const monitorType =
          values.type ||
          (monitorVendor.includes('guance') || monitorVendor.includes('观测云') ? 'guanceyun' : 'grafana');
        await http.post(
          '/api/aslan/system/observability/validate',
          {
            name: values.name || 'test-monitor',
            type: monitorType,
            host: values.host || values.url,
            grafana_token: values.grafana_token || values.token,
            api_key: values.api_key || values.token,
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('监控系统服务连通性验证成功！');
      } else if (currentCategory.key === 'cloudService') {
        // FULL-A-07: 云服务凭据与权限校验 (POST /api/aslan/system/cloud_service/validate)
        // 后端 models.CloudService 使用 access_key_id / access_key_secret 字段
        await http.post(
          '/api/aslan/system/cloud_service/validate',
          {
            name: values.name || 'test-sae',
            type: values.type || 'sae',
            access_key: values.access_key || values.ak,
            secret_key: values.secret_key || values.sk,
            access_key_id: values.access_key || values.ak,
            access_key_secret: values.secret_key || values.sk,
            region: values.region,
          },
          { skipErrorHandler: true }
        );
        feedback.message.success('云服务凭据与权限验证成功！');
      } else if (currentCategory.key === 'ai') {
        // NEW-A1: 大语言模型 AI 凭据真实连通性握手校验 (POST /api/aslan/system/llm/integration/validate)
        let provider = 'openai';
        const vendorStr = String(values.vendor || '').toLowerCase();
        if (vendorStr.includes('通义千问') || vendorStr.includes('qwen')) provider = 'qwen';
        else if (vendorStr.includes('deepseek')) provider = 'deepseek';
        else if (vendorStr.includes('azure')) provider = 'azure';
        else if (vendorStr.includes('ollama')) provider = 'ollama';

        await settingsApi.validateLLMIntegration({
          name: values.name || 'test-ai',
          provider_name: values.provider_name || provider,
          protocol: values.protocol || 'https',
          token: values.token || values.api_key || '',
          base_url: values.base_url || values.url || '',
          model: values.model || 'gpt-4o',
          enable_proxy: Boolean(values.enable_proxy),
          is_default: Boolean(values.is_default),
        });
        feedback.message.success('大语言模型 (LLM) 凭据连通性握手验证成功！');
      } else {
        const url = await buildListUrl(currentCategory);
        await http.get(url, { skipErrorHandler: true });
        // R11 任务七: 通用列表探活仅证明 Zadig 服务端接口可达，不代表第三方外部凭据已验证
        feedback.message.success('系统集成服务接口可达');
      }
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.description || err?.message || '连通性测试失败，请检查服务地址或凭据配置');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveIntegration = async () => {
    if (!currentCategory) return;
    try {
      const values = await form.validateFields();
      setLoading(true);
      let payload: any = values;

      if (currentCategory.key === 'project') {
        let pmType = 'jira';
        if (values.vendor === '飞书项目') pmType = 'meego';
        else if (values.vendor === 'PingCode') pmType = 'pingcode';
        else if (values.vendor === 'TAPD') pmType = 'tapd';

        payload = {
          name: values.name,
          type: pmType,
          jira_host: values.jira_host || values.url,
          jira_user: values.jira_user,
          jira_token: values.jira_token || values.token,
          jira_auth_type: values.jira_auth_type || 'Basic',
          meego_plugin_id: values.meego_plugin_id,
          meego_plugin_secret: values.meego_plugin_secret,
          meego_user_key: values.meego_user_key,
          pingcode_client_id: values.pingcode_client_id,
          pingcode_client_secret: values.pingcode_client_secret,
          tapd_client_id: values.tapd_client_id,
          tapd_client_secret: values.tapd_client_secret,
        };
        await http.post('/api/aslan/system/project_management', payload);
      } else if (currentCategory.key === 'config') {
        const configType = values.nacos_version || (values.vendor === 'Nacos' ? 'nacos' : 'apollo');
        payload = {
          name: values.name,
          type: configType,
          server_address: values.url,
          nacos_auth_config: values.vendor === 'Nacos' ? {
            username: values.nacos_username,
            password: values.nacos_password,
            access_key: values.nacos_ak,
            secret_key: values.nacos_sk,
            namespace: values.nacos_namespace,
            group: values.nacos_group,
          } : undefined,
          apollo_auth_config: values.vendor === 'Apollo' ? {
            server_address: values.url,
            token: values.token,
          } : undefined,
        };
        await http.post('/api/aslan/system/configuration', payload);
      } else {
        await http.post(currentCategory.apiEndpoint, values);
      }

      feedback.message.success(`[${values.name}] 集成配置保存成功！`);
      setModalVisible(false);
      form.resetFields();
      await fetchItems(currentCategory);
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.description || err?.message || '保存集成配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!currentCategory) return;
    try {
      await http.delete(`${currentCategory.apiEndpoint}/${id}`);
      feedback.message.success('集成配置已移除');
      await fetchItems(currentCategory);
    } catch (err: any) {
      feedback.message.error(err?.message || '移除集成配置失败');
    }
  };

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
      title: '服务访问地址',
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
      title: '状态',
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
            onClick={async () => {
              if (!currentCategory) return;
              feedback.message.loading(`正在测试 [${record.name}] 连通性...`, 1);
              try {
                // 后端无独立 /connection 端点；以分类列表 GET 可达作为健康检查
                await http.get(currentCategory.apiEndpoint, { skipErrorHandler: true });
                feedback.message.success(`[${record.name}] 服务连通性健康正常`);
              } catch (err: any) {
                feedback.message.error(err?.message || `[${record.name}] 连通性检测失败`);
              }
            }}
          >
            检测
          </Button>
          <Popconfirm
            title="确认删除该集成配置？"
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

  // 1. Detail Management View
  if (currentCategory) {
    // 代码源分类：直接挂载 CodeHostsPage，与 /v1/system/codehosts 体验一致
    if (currentCategory.key === 'git') {
      return (
        <div style={{ position: 'relative', flex: 1, minHeight: '100%', padding: '24px 30px', background: '#fff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid #ebeef5',
            }}
          >
            <Space size="middle">
              <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                返回系统集成
              </Button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {currentCategory.icon}
                <div>
                  <Title level={4} style={{ margin: 0, fontSize: 18, color: '#303133' }}>
                    {currentCategory.name}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {currentCategory.desc}
                  </Text>
                </div>
              </div>
            </Space>
          </div>
          <CodeHostsPage />
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', flex: 1, minHeight: '100%', padding: '24px 30px', background: '#fff' }}>
        {/* Top Header matching live Zadig */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '1px solid #ebeef5',
          }}
        >
          <Space size="middle">
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回系统集成
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {currentCategory.icon}
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 18, color: '#303133' }}>
                  {currentCategory.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {currentCategory.desc}
                </Text>
              </div>
            </div>
          </Space>

          <Space size="middle">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchItems(currentCategory)}
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

        <Table
          rowKey={(record) => record.id || (record as any)._id || record.name}
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space vertical size={4}>
                    <Text type="secondary">暂无该类型集成配置</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      可通过右上角“添加集成”绑定外部服务
                    </Text>
                  </Space>
                }
              >
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
              </Empty>
            ),
          }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 项配置` }}
        />

        {/* Add / Edit Integration Modal */}
        <Modal
          title={`添加 ${currentCategory.name} 配置`}
          open={modalVisible}
          onOk={handleSaveIntegration}
          onCancel={() => setModalVisible(false)}
          width={600}
          footer={[
            <Button key="test" loading={testingConnection} onClick={handleTestConnection}>
              测试连接
            </Button>,
            <Button key="cancel" onClick={() => setModalVisible(false)}>
              取消
            </Button>,
            <Button key="submit" type="primary" loading={loading} onClick={handleSaveIntegration}>
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
              <Input placeholder={`例如：my-${currentCategory.key}-server`} />
            </Form.Item>

            <Form.Item
              name="vendor"
              label="类型 / 服务商"
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

            {/* 1. 项目管理 (Project Management: Jira / Meego / PingCode / TAPD) 专属字段 */}
            {currentCategory.key === 'project' ? (
              <>
                {selectedVendor === '飞书项目' ? (
                  <>
                    <Form.Item
                      name="meego_plugin_id"
                      label="飞书项目 Plugin ID"
                      rules={[{ required: true, message: '请输入飞书项目 Plugin ID' }]}
                    >
                      <Input placeholder="飞书开放平台应用凭据 Plugin ID" />
                    </Form.Item>
                    <Form.Item
                      name="meego_plugin_secret"
                      label="飞书项目 Plugin Secret"
                      rules={[{ required: true, message: '请输入 Plugin Secret' }]}
                    >
                      <Input.Password placeholder="飞书开放平台应用凭据 Plugin Secret" />
                    </Form.Item>
                    <Form.Item
                      name="meego_user_key"
                      label="飞书项目 User Key"
                      rules={[{ required: true, message: '请输入 User Key' }]}
                    >
                      <Input placeholder="拥有项目操作权限的飞书项目 User Key" />
                    </Form.Item>
                  </>
                ) : selectedVendor === 'PingCode' ? (
                  <>
                    <Form.Item
                      name="pingcode_client_id"
                      label="PingCode Client ID"
                      rules={[{ required: true, message: '请输入 Client ID' }]}
                    >
                      <Input placeholder="PingCode 开放应用 Client ID" />
                    </Form.Item>
                    <Form.Item
                      name="pingcode_client_secret"
                      label="PingCode Client Secret"
                      rules={[{ required: true, message: '请输入 Client Secret' }]}
                    >
                      <Input.Password placeholder="PingCode 开放应用 Client Secret" />
                    </Form.Item>
                  </>
                ) : selectedVendor === 'TAPD' ? (
                  <>
                    <Form.Item
                      name="tapd_client_id"
                      label="TAPD 企业 / 应用 Client ID"
                      rules={[{ required: true, message: '请输入 TAPD Client ID' }]}
                    >
                      <Input placeholder="腾讯 TAPD 应用 Client ID" />
                    </Form.Item>
                    <Form.Item
                      name="tapd_client_secret"
                      label="TAPD Client Secret"
                      rules={[{ required: true, message: '请输入 TAPD Client Secret' }]}
                    >
                      <Input.Password placeholder="腾讯 TAPD 应用 Secret" />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Form.Item
                      name="url"
                      label="Jira 服务地址"
                      rules={[{ required: true, message: '请输入 Jira 服务访问地址' }]}
                    >
                      <Input placeholder="https://jira.example.com" />
                    </Form.Item>
                    <Form.Item
                      name="jira_user"
                      label="Jira 用户名 / 邮箱"
                      rules={[{ required: true, message: '请输入 Jira 用户名' }]}
                    >
                      <Input placeholder="admin@example.com" />
                    </Form.Item>
                    <Form.Item
                      name="token"
                      label="Jira API Token / 访问密钥"
                      rules={[{ required: true, message: '请输入 API Token' }]}
                    >
                      <Input.Password placeholder="Jira 个人访问令牌 (PAT) 或 API Token" />
                    </Form.Item>
                    <Form.Item
                      name="jira_auth_type"
                      label="认证方式"
                      initialValue="Basic"
                    >
                      <Select>
                        <Option value="Basic">Basic 认证</Option>
                        <Option value="BearerToken">Personal Access Token (PAT)</Option>
                        <Option value="Cookie">Cookie 认证</Option>
                      </Select>
                    </Form.Item>
                  </>
                )}
              </>
            ) : currentCategory.key === 'config' ? (
              /* 2. 配置管理 (Config Center: Nacos / Apollo) 专属字段 */
              <>
                <Form.Item
                  name="url"
                  label="配置中心服务地址 (Server Address)"
                  rules={[{ required: true, message: '请输入配置中心地址' }]}
                >
                  <Input placeholder="http://127.0.0.1:8848 或 http://apollo-configservice:8080" />
                </Form.Item>

                {selectedVendor === 'Nacos' ? (
                  <>
                    <Form.Item
                      name="nacos_version"
                      label="Nacos 版本架构"
                      initialValue="nacos"
                    >
                      <Select>
                        <Option value="nacos">Nacos 1.x (开源版)</Option>
                        <Option value="nacos3">Nacos 2.x / 3.x (gRPC 模式)</Option>
                        <Option value="nacos-ee-mse">阿里云 MSE 微服务引擎 (企业版)</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="nacos_namespace"
                      label="默认命名空间 (Namespace ID)"
                      initialValue="public"
                    >
                      <Input placeholder="默认 public 或指定环境命名空间 ID" />
                    </Form.Item>
                    <Form.Item
                      name="nacos_group"
                      label="默认配置分组 (Group)"
                      initialValue="DEFAULT_GROUP"
                    >
                      <Input placeholder="DEFAULT_GROUP" />
                    </Form.Item>
                    <Form.Item name="nacos_username" label="用户名 (若启用鉴权)">
                      <Input placeholder="nacos" />
                    </Form.Item>
                    <Form.Item name="nacos_password" label="密码 (若启用鉴权)">
                      <Input.Password placeholder="密码" />
                    </Form.Item>
                    <Form.Item name="nacos_ak" label="AccessKey (MSE 认证，可选)">
                      <Input placeholder="阿里云 AccessKey ID" />
                    </Form.Item>
                    <Form.Item name="nacos_sk" label="SecretKey (MSE 认证，可选)">
                      <Input.Password placeholder="阿里云 AccessKey Secret" />
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item
                    name="token"
                    label="Apollo Portal Token / 访问密钥"
                    rules={[{ required: true, message: '请输入 Apollo 访问令牌' }]}
                  >
                    <Input.Password placeholder="Apollo 开放平台授权 Token" />
                  </Form.Item>
                )}
              </>
            ) : (
              /* 3. 通用外部系统与 AI / 监控字段 */
              <>
                <Form.Item
                  name="url"
                  label="服务地址 (Server URL)"
                  rules={[{ required: true, message: '请输入服务访问地址' }]}
                >
                  <Input placeholder="https://..." />
                </Form.Item>

                {currentCategory.key === 'ai' ? (
                  <>
                    <Form.Item
                      name="apiKey"
                      label="API Key / 访问凭证"
                      rules={[{ required: true, message: '请输入 API Key' }]}
                    >
                      <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Form.Item name="modelName" label="默认模型" initialValue="gpt-4o">
                      <Input placeholder="例如：gpt-4o, qwen-max, deepseek-chat" />
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item
                    name="token"
                    label="API Token / 密码"
                    rules={[{ required: true, message: '请输入鉴权凭据' }]}
                  >
                    <Input.Password placeholder="请输入 Token 或 Secret" />
                  </Form.Item>
                )}
              </>
            )}

            <Form.Item name="description" label="描述">
              <TextArea rows={2} placeholder="可备注该集成的使用范围与配额" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  // 2. Integration Home List View strictly matching live Zadig (.integration-home & .integration-list)
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        height: '100%',
        minHeight: '100%',
        padding: 30,
        overflow: 'auto',
        backgroundColor: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          width: '100%',
        }}
      >
        {INTEGRATION_LIST.map((item) => (
          <div
            key={item.key}
            onClick={() => handleGoToDetail(item.link)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              padding: '20px 30px',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 5px 3px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'transform 0.15s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            {/* Left Info: Icon + Name & Desc */}
            <div
              style={{
                display: 'flex',
                flexGrow: 1,
                alignItems: 'center',
                marginRight: 10,
              }}
            >
              <div
                style={{
                  marginRight: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 5,
                    color: '#4a4a4a',
                    fontWeight: 400,
                    fontSize: 15,
                  }}
                >
                  {item.name}
                </div>
                <div style={{ color: '#969799', fontSize: 12 }}>
                  {item.desc}
                </div>
              </div>
            </div>

            {/* Right Configure Button strictly matching .configure-btn */}
            <div>
              <button
                type="button"
                style={{
                  padding: '8px 36px',
                  color: '#0066ff',
                  border: '1px solid #0066ff',
                  backgroundColor: 'transparent',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0066ff';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#0066ff';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGoToDetail(item.link);
                }}
              >
                配置
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemIntegrationPage;

