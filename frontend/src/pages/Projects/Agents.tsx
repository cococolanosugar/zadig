import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Tooltip,
  Drawer,
  Form,
  Input,
  Select,
  Row,
  Col,
  Empty,
  Spin,
  Popconfirm,
} from 'antd';
import {
  RobotOutlined,
  ToolOutlined,
  BookOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  PlusOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  ExportOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import agentApi, {
  type AgentIntegration,
  type AgentIntegrationPayload,
} from '../../api/agent';
import { feedback } from '../../utils/feedback';

const { Title, Paragraph } = Typography;
const { Option } = Select;

interface DisabledTab {
  name: string;
  icon: React.ReactNode;
}

const DISABLED_TABS: DisabledTab[] = [
  { name: '工具与技能', icon: <ToolOutlined /> },
  { name: '模型', icon: <DeploymentUnitOutlined /> },
  { name: '知识库', icon: <BookOutlined /> },
  { name: '记忆', icon: <DatabaseOutlined /> },
];

const DEMAND_LINK = 'https://koderover.feishu.cn/share/base/form/shrcnGBw4s7V6lIk8pFBETsGGag';

export const ProjectAgentsPage: React.FC = () => {
  const { projectName = '' } = useParams<{ projectName: string }>();

  const [loading, setLoading] = useState<boolean>(false);
  const [agents, setAgents] = useState<AgentIntegration[]>([]);

  // Drawer / Form state
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [editingAgent, setEditingAgent] = useState<AgentIntegration | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);

  const [form] = Form.useForm<AgentIntegrationPayload>();
  const authType = Form.useWatch('auth_type', form);

  const loadAgents = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const data = await agentApi.list(projectName);
      setAgents(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取智能体列表失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleOpenCreate = () => {
    setEditingAgent(null);
    form.resetFields();
    form.setFieldsValue({
      protocol: 'openai',
      auth_type: 'api_key',
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (agent: AgentIntegration) => {
    setEditingAgent(agent);
    form.resetFields();
    form.setFieldsValue({
      name: agent.name,
      description: agent.description,
      base_url: agent.base_url,
      protocol: agent.protocol || 'openai',
      model: agent.model,
      auth_type: agent.auth_type || 'api_key',
      api_key: agent.api_key,
      access_key: agent.access_key,
      secret_key: agent.secret_key,
    });
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingAgent(null);
    form.resetFields();
  };

  const handleValidate = async () => {
    try {
      const values = await form.validateFields();
      setValidating(true);
      await agentApi.validate(projectName, {
        ...values,
        id: editingAgent?.id,
      });
      feedback.message.success('智能体连通性验证成功！');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '连通性验证失败，请检查服务地址与授权凭据';
      feedback.message.error(msg);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingAgent?.id) {
        await agentApi.update(projectName, editingAgent.id, values);
        feedback.message.success('智能体配置已更新');
      } else {
        await agentApi.create(projectName, values);
        feedback.message.success('智能体接入成功');
      }
      handleCloseDrawer();
      loadAgents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存智能体配置失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (agent: AgentIntegration) => {
    if (!agent.id) return;
    try {
      await agentApi.delete(projectName, agent.id);
      feedback.message.success(`已删除智能体 ${agent.name}`);
      loadAgents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除智能体失败';
      feedback.message.error(msg);
    }
  };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Top Toolbar matching Chunk 65 layout */}
      <Card
        variant="borderless"
        style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: Tab items */}
          <Space orientation="horizontal" size={8}>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              style={{ fontWeight: 500 }}
            >
              智能体管理
            </Button>
            {DISABLED_TABS.map((tab) => (
              <Tooltip key={tab.name} title="敬请期待">
                <Button disabled icon={tab.icon}>
                  {tab.name}
                </Button>
              </Tooltip>
            ))}
          </Space>

          {/* Right: Actions */}
          <Space orientation="horizontal" size={12}>
            <a
              href={DEMAND_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0066ff', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              场景需求调研 <ExportOutlined style={{ fontSize: 12 }} />
            </a>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              注册接入
            </Button>
            <Tooltip title="敬请期待">
              <span>
                <Button disabled icon={<RobotOutlined />}>
                  创建智能体
                </Button>
              </span>
            </Tooltip>
          </Space>
        </div>
      </Card>

      {/* Agents Card Grid */}
      <Spin spinning={loading}>
        {agents.length === 0 && !loading ? (
          <Card
            variant="borderless"
            style={{ borderRadius: 8, border: '1px solid #ebeef5', textAlign: 'center', padding: '60px 0' }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前项目尚未接入智能体"
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                注册接入智能体
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {agents.map((agent) => (
              <Col xs={24} sm={12} md={8} lg={8} xl={6} key={agent.id || agent.name}>
                <Card
                  variant="borderless"
                  hoverable
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  styles={{ body: { padding: 16, flex: 1, display: 'flex', flexDirection: 'column' } }}
                  onClick={() => handleOpenEdit(agent)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <Space orientation="horizontal" size={10} style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: '#e6f4ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0066ff',
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        >
                          <RobotOutlined />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <Title
                            level={5}
                            ellipsis={{ tooltip: agent.name }}
                            style={{ margin: 0, fontSize: 15, fontWeight: 600 }}
                          >
                            {agent.name}
                          </Title>
                          <Space orientation="horizontal" size={4} style={{ marginTop: 2 }}>
                            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                              {agent.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                            </Tag>
                            {agent.model && (
                              <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
                                {agent.model}
                              </Tag>
                            )}
                          </Space>
                        </div>
                      </Space>

                      {/* Remove Button */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Popconfirm
                          title="删除智能体"
                          description={`确认删除智能体 ${agent.name} 吗？`}
                          onConfirm={() => handleDelete(agent)}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{ opacity: 0.7 }}
                          />
                        </Popconfirm>
                      </div>
                    </div>

                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2, tooltip: agent.description || '暂无描述信息' }}
                      style={{ fontSize: 12, minHeight: 36, marginBottom: 12 }}
                    >
                      {agent.description || '暂无描述信息'}
                    </Paragraph>
                  </div>

                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, marginTop: 'auto' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 12,
                        color: '#8c8c8c',
                        marginBottom: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={agent.base_url}
                    >
                      <LinkOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {agent.base_url || '-'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#bfbfbf' }}>
                      <span>
                        鉴权: {agent.auth_type === 'ak_sk' ? 'AK/SK' : 'API Key'}
                      </span>
                      <span>
                        {agent.update_time
                          ? dayjs.unix(agent.update_time).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Registration & Configuration Drawer */}
      <Drawer
        title={editingAgent ? `配置智能体: ${editingAgent.name}` : '注册接入智能体'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        size={560}
        styles={{ body: { paddingBottom: 80 } }}
        extra={
          <Space orientation="horizontal" size={8}>
            <Button onClick={handleValidate} loading={validating} icon={<SafetyCertificateOutlined />}>
              校验配置
            </Button>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              保存配置
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{
            protocol: 'openai',
            auth_type: 'api_key',
          }}
        >
          <Form.Item
            name="name"
            label="智能体名称"
            rules={[
              { required: true, message: '请输入智能体名称' },
              { max: 64, message: '名称最多 64 个字符' },
            ]}
          >
            <Input placeholder="例如: zadig-review-agent, code-assistant" />
          </Form.Item>

          <Form.Item name="description" label="描述信息">
            <Input.TextArea
              rows={3}
              placeholder="请输入智能体的功能描述、适用场景或技能说明"
            />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="服务地址 (Base URL)"
            rules={[
              { required: true, message: '请输入服务地址' },
              { type: 'url', message: '请输入有效的服务 URL (包含 http:// 或 https://)' },
            ]}
            extra="大模型推理服务或兼容 OpenAI/Anthropic 协议的代理接入网关"
          >
            <Input
              prefix={<LinkOutlined style={{ color: '#8c8c8c' }} />}
              placeholder="例如: https://api.openai.com/v1 或 http://vllm-service:8000/v1"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="protocol"
                label="协议类型"
                rules={[{ required: true, message: '请选择协议类型' }]}
              >
                <Select placeholder="请选择协议">
                  <Option value="openai">OpenAI 协议</Option>
                  <Option value="anthropic">Anthropic 协议</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model"
                label="默认模型"
                extra="可选，指定调用时的默认模型标识"
              >
                <Input placeholder="例如: gpt-4o, claude-3-5-sonnet" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="auth_type"
                label="鉴权方式"
                rules={[{ required: true, message: '请选择鉴权方式' }]}
              >
                <Select placeholder="请选择鉴权方式">
                  <Option value="api_key">API Key</Option>
                  <Option value="ak_sk">AccessKey / SecretKey</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {authType === 'api_key' ? (
            <Form.Item
              name="api_key"
              label="API Key"
              rules={[{ required: !editingAgent, message: '请输入 API Key' }]}
              extra={editingAgent ? '已保存密钥在服务端加密存储，若无需修改请保留空白' : undefined}
            >
              <Input.Password
                prefix={<KeyOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="sk-..."
              />
            </Form.Item>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="access_key"
                  label="Access Key (AK)"
                  rules={[{ required: !editingAgent, message: '请输入 Access Key' }]}
                >
                  <Input.Password placeholder="Access Key ID" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="secret_key"
                  label="Secret Key (SK)"
                  rules={[{ required: !editingAgent, message: '请输入 Secret Key' }]}
                >
                  <Input.Password placeholder="Secret Access Key" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Drawer>
    </div>
  );
};

export default ProjectAgentsPage;
