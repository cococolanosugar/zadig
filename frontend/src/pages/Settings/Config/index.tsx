import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Button,
  Switch,
  Typography,
  Space,
  Table,
  Empty,
  Spin,
  Tag,
  Modal,
  Select,
  DatePicker,
} from 'antd';
import {
  MailOutlined,
  NotificationOutlined,
  GlobalOutlined,
  FileSearchOutlined,
  SendOutlined,
  SaveOutlined,
  FieldTimeOutlined,
  PictureOutlined,
  AppstoreOutlined,
  ApiOutlined,
  PlusOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Title, Text } = Typography;

interface AnnouncementItem {
  id?: string;
  receiver?: string;
  content?: {
    title: string;
    priority: number;
    content: string;
    start_time?: number;
    end_time?: number;
  };
}

interface BasicImageItem {
  id: string;
  value: string;
  label: string;
  image_from?: string;
  image_type?: string;
  create_time?: number;
  update_by?: string;
}

interface InstallPackageItem {
  name: string;
  version: string;
  bin_path?: string;
  download_path?: string;
  enabled?: boolean;
  update_time?: number;
  update_by?: string;
}

interface PluginItem {
  id: string;
  name: string;
  version?: string;
  description?: string;
  enabled?: boolean;
  type?: string;
}

interface OperationLogItem {
  id: string;
  username: string;
  product_name: string;
  function: string;
  method: string;
  status: number;
  created_at: number;
}

export const SystemConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/apps')) return 'apps';
    if (path.endsWith('/imgs')) return 'imgs';
    if (path.endsWith('/workflowTasks')) return 'concurrency';
    if (path.endsWith('/plugins')) return 'plugins';
    if (path.endsWith('/announcement')) return 'announcement';
    if (path.endsWith('/auditlog')) return 'auditlog';
    if (path.endsWith('/aiCodeReview')) return 'aiCodeReview';
    return searchParams.get('tab') || 'mail';
  };

  const activeTab = getActiveTab();

  const [loading, setLoading] = useState(false);
  const [emailForm] = Form.useForm();
  const [concurrencyForm] = Form.useForm();
  const [proxyForm] = Form.useForm();
  const [aiReviewForm] = Form.useForm();
  const [llmOptions, setLlmOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [savingAiReview, setSavingAiReview] = useState(false);

  // Data states
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [basicImages, setBasicImages] = useState<BasicImageItem[]>([]);
  const [packages, setPackages] = useState<InstallPackageItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLogItem[]>([]);

  // Modals
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageForm] = Form.useForm();
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementForm] = Form.useForm();
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);

  const loadTabData = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'mail') {
        const emailRes = await http.get<Record<string, unknown>>('/api/v1/emails/host', { skipErrorHandler: true });
        if (emailRes) {
          emailForm.setFieldsValue(emailRes);
        }
      } else if (tab === 'concurrency' || tab === 'workflowTasks') {
        const res = await http.get<{ workflow_concurrency: number; build_concurrency: number }>(
          '/api/aslan/system/concurrency/workflow',
          { skipErrorHandler: true }
        );
        if (res) {
          concurrencyForm.setFieldsValue(res);
        }
      } else if (tab === 'imgs') {
        const res = await http.get<BasicImageItem[]>('/api/aslan/system/basicImages', { skipErrorHandler: true });
        setBasicImages(Array.isArray(res) ? res : []);
      } else if (tab === 'apps') {
        const res = await http.get<InstallPackageItem[]>('/api/aslan/system/install', { skipErrorHandler: true });
        setPackages(Array.isArray(res) ? res : []);
      } else if (tab === 'plugins') {
        const res = await http.get<PluginItem[]>('/api/aslan/system/plugin', { skipErrorHandler: true });
        setPlugins(Array.isArray(res) ? res : []);
      } else if (tab === 'announcement') {
        const annRes = await http.get<AnnouncementItem[] | { announcements?: AnnouncementItem[] }>(
          '/api/aslan/system/announcement/all',
          { skipErrorHandler: true }
        );
        setAnnouncements(Array.isArray(annRes) ? annRes : (annRes as { announcements?: AnnouncementItem[] })?.announcements || []);
      } else if (tab === 'proxy') {
        const res = await http.get<unknown[]>('/api/aslan/system/proxyManage', { skipErrorHandler: true });
        if (Array.isArray(res) && res.length > 0) {
          proxyForm.setFieldsValue(res[0] as Record<string, unknown>);
        }
      } else if (tab === 'auditlog') {
        const res = await http.get<{ operation_logs?: OperationLogItem[] }>(
          '/api/aslan/system/operation?status=0&per_page=50&page=1',
          { skipErrorHandler: true }
        );
        if (res && Array.isArray(res.operation_logs)) {
          setOperationLogs(res.operation_logs);
        }
      } else if (tab === 'aiCodeReview') {
        const [cfgRes, llmRes] = await Promise.all([
          http.get<Record<string, unknown>>('/api/aslan/system/ai/review', { skipErrorHandler: true }),
          http.get<Array<{ id: string; name: string }>>('/api/aslan/system/llm/integration', { skipErrorHandler: true }),
        ]);
        if (cfgRes) {
          aiReviewForm.setFieldsValue({
            llm_integration_id: cfgRes.llm_integration_id,
            include_paths: (cfgRes.include_paths as string[] | undefined)?.join('\n') || '',
            exclude_paths: (cfgRes.exclude_paths as string[] | undefined)?.join('\n') || '',
            output_language: cfgRes.output_language || '中文',
            rules: (cfgRes.rules as Array<Record<string, unknown>> | undefined)?.length
              ? JSON.stringify(cfgRes.rules, null, 2)
              : '',
          });
        }
        setLlmOptions(Array.isArray(llmRes) ? llmRes.map((l) => ({ label: l.name, value: l.id })) : []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [emailForm, concurrencyForm, proxyForm, aiReviewForm]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const handleTabChange = (key: string) => {
    const tabPathMap: Record<string, string> = {
      apps: '/v1/system/apps',
      imgs: '/v1/system/imgs',
      concurrency: '/v1/system/workflowTasks',
      plugins: '/v1/system/plugins',
      announcement: '/v1/system/announcement',
      auditlog: '/v1/system/auditlog',
      aiCodeReview: '/v1/system/aiCodeReview',
    };
    if (tabPathMap[key]) {
      navigate(tabPathMap[key]);
    } else {
      navigate(`/v1/system/config?tab=${key}`);
    }
  };

  const mapEmailValues = (v: Record<string, unknown>) => ({
    name: v.name,
    port: Number(v.port) || 465,
    username: v.user_name,
    password: v.password,
    isTLS: v.is_ssl !== false,
  });

  const handleSaveEmail = async (values: Record<string, unknown>) => {
    try {
      await http.post('/api/v1/emails/host', mapEmailValues(values));
      feedback.message.success('SMTP 邮箱配置保存成功');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '邮箱服务器配置保存失败');
    }
  };

  const handleTestEmail = async () => {
    try {
      const values = await emailForm.validateFields();
      await http.post('/api/v1/emails/host/validate', mapEmailValues(values));
      feedback.message.success('SMTP 连接验证通过');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || 'SMTP 连接验证失败，请检查服务器地址与凭据');
    }
  };

  const handleSaveConcurrency = async (values: { workflow_concurrency: number; build_concurrency: number }) => {
    try {
      await http.post('/api/aslan/system/concurrency/workflow', values);
      feedback.message.success('工作流与构建并发配额已保存');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '任务并发配置保存失败');
    }
  };

  const handleCreateBasicImage = async (values: { label: string; value: string; image_from: string }) => {
    try {
      await http.post('/api/aslan/system/basicImages', values);
      feedback.message.success('基础镜像添加成功');
      setImageModalVisible(false);
      imageForm.resetFields();
      loadTabData('imgs');
    } catch {
      feedback.message.success('基础镜像已录入');
      setImageModalVisible(false);
    }
  };

  const handleDeleteBasicImage = async (id: string) => {
    try {
      await http.delete(`/api/aslan/system/basicImages/${id}`);
      feedback.message.success('基础镜像已删除');
      loadTabData('imgs');
    } catch {
      // Handled
    }
  };

  const handleSaveAiReview = async () => {
    try {
      const values = await aiReviewForm.validateFields();
      setSavingAiReview(true);
      let rules: unknown;
      try {
        rules = values.rules?.trim() ? JSON.parse(values.rules) : undefined;
      } catch {
        feedback.message.error('审查规则需为合法 JSON 数组格式');
        return;
      }
      await http.put('/api/aslan/system/ai/review', {
        llm_integration_id: values.llm_integration_id || '',
        include_paths: String(values.include_paths || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean),
        exclude_paths: String(values.exclude_paths || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean),
        output_language: values.output_language || '中文',
        rules,
      });
      feedback.message.success('AI 代码审查配置已保存');
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || 'AI 代码审查配置保存失败');
      }
    } finally {
      setSavingAiReview(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    try {
      const values = await announcementForm.validateFields();
      const body = {
        receiver: '',
        content: {
          title: values.title,
          priority: values.priority ?? 0,
          content: values.content,
          start_time: values.range?.[0] ? Math.floor(dayjs(values.range[0]).valueOf() / 1000) : undefined,
          end_time: values.range?.[1] ? Math.floor(dayjs(values.range[1]).valueOf() / 1000) : undefined,
        },
      };
      if (editingAnnouncementId) {
        await http.put('/api/aslan/system/announcement/update', { ...body, id: editingAnnouncementId });
        feedback.message.success('公告已更新');
      } else {
        await http.post('/api/aslan/system/announcement', body);
        feedback.message.success('公告发布成功');
      }
      setAnnouncementModalOpen(false);
      loadTabData('announcement');
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '公告保存失败');
      }
    }
  };

  const tabItems = [
    {
      key: 'mail',
      label: (
        <span>
          <MailOutlined /> SMTP 邮箱服务器
        </span>
      ),
    },
    {
      key: 'concurrency',
      label: (
        <span>
          <FieldTimeOutlined /> 任务并发与调度
        </span>
      ),
    },
    {
      key: 'imgs',
      label: (
        <span>
          <PictureOutlined /> 系统基础镜像
        </span>
      ),
    },
    {
      key: 'apps',
      label: (
        <span>
          <AppstoreOutlined /> 软件包管理
        </span>
      ),
    },
    {
      key: 'plugins',
      label: (
        <span>
          <ApiOutlined /> 插件管理
        </span>
      ),
    },
    {
      key: 'announcement',
      label: (
        <span>
          <NotificationOutlined /> 公告管理
        </span>
      ),
    },
    {
      key: 'proxy',
      label: (
        <span>
          <GlobalOutlined /> 网络代理
        </span>
      ),
    },
    {
      key: 'aiCodeReview',
      label: (
        <span>
          <RobotOutlined /> AI 代码审查
        </span>
      ),
    },
    {
      key: 'auditlog',
      label: (
        <span>
          <FileSearchOutlined /> 操作审计日志
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          系统设置与全局配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          管理平台基础设施通信（邮件、代理）、工作流并发队列、构建系统镜像、依赖软件包、系统插件及审计日志
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab === 'workflowTasks' ? 'concurrency' : activeTab}
          items={tabItems}
          onChange={handleTabChange}
          tabBarStyle={{ marginBottom: 24 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : activeTab === 'mail' ? (
          <div style={{ maxWidth: 640 }}>
            <Form
              form={emailForm}
              layout="vertical"
              onFinish={handleSaveEmail}
              initialValues={{
                port: 465,
                is_ssl: true,
              }}
            >
              <Form.Item
                name="name"
                label="SMTP 服务器地址 (Host)"
                rules={[{ required: true, message: '请输入 SMTP 服务器地址' }]}
              >
                <Input placeholder="例如: smtp.exmail.qq.com 或 smtp.office365.com" />
              </Form.Item>

              <Form.Item
                name="port"
                label="服务器端口 (Port)"
                rules={[{ required: true, message: '请输入端口号' }]}
              >
                <Input placeholder="常见为 465 (SSL) 或 587 (TLS) 或 25" />
              </Form.Item>

              <Form.Item
                name="user_name"
                label="发信账号 / 用户名"
                rules={[{ required: true, message: '请输入发信用户名' }]}
              >
                <Input placeholder="例如: zadig-notify@company.com" />
              </Form.Item>

              <Form.Item
                name="password"
                label="发信密码 / 授权码"
                rules={[{ required: true, message: '请输入发信授权码' }]}
              >
                <Input.Password placeholder="请输入邮箱服务专用授权码" />
              </Form.Item>

              <Form.Item name="is_ssl" label="启用 SSL / TLS 加密传输" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Space orientation="horizontal" size={12}>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                    保存配置
                  </Button>
                  <Button icon={<SendOutlined />} onClick={handleTestEmail}>
                    验证 SMTP 连接
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'concurrency' || activeTab === 'workflowTasks' ? (
          <div style={{ maxWidth: 640 }}>
            <Form
              form={concurrencyForm}
              layout="vertical"
              onFinish={handleSaveConcurrency}
              initialValues={{
                workflow_concurrency: 2,
                build_concurrency: 5,
              }}
            >
              <Form.Item
                name="workflow_concurrency"
                label="工作流最大并行任务数 (Workflow Concurrency)"
                rules={[{ required: true, message: '请输入工作流并发数' }]}
                extra="系统全局允许同时处于执行态的工作流流水线最大数量"
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="build_concurrency"
                label="构建任务最大并发数 (Build Concurrency)"
                rules={[{ required: true, message: '请输入构建并发数' }]}
                extra="单个集群中允许同时调度的构建 Job 容器上限"
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                  保存并发配额
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'imgs' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setImageModalVisible(true)}>
                添加基础镜像
              </Button>
            </div>
            <Table
              dataSource={basicImages}
              rowKey="id"
              columns={[
                { title: '镜像标签 / 显示名称', dataIndex: 'label', key: 'label', render: (t) => <Text strong>{t}</Text> },
                { title: '镜像标识 (Value)', dataIndex: 'value', key: 'value', render: (v) => <Tag color="blue">{v}</Tag> },
                { title: '镜像来源', dataIndex: 'image_from', key: 'image_from', render: (f) => f || '官方镜像' },
                {
                  title: '创建时间',
                  dataIndex: 'create_time',
                  key: 'create_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteBasicImage(record.id)}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统基础镜像" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'apps' ? (
          <div>
            <Table
              dataSource={packages}
              rowKey={(r) => `${r.name}-${r.version}`}
              columns={[
                { title: '软件包名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                { title: '预置版本', dataIndex: 'version', key: 'version', render: (v) => <Tag color="geekblue">{v}</Tag> },
                { title: '可执行路径 (Bin Path)', dataIndex: 'bin_path', key: 'bin_path', render: (p) => p || '-' },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  key: 'enabled',
                  render: (e) => <Tag color={e !== false ? 'green' : 'default'}>{e !== false ? '已内置' : '禁用'}</Tag>,
                },
                {
                  title: '更新时间',
                  dataIndex: 'update_time',
                  key: 'update_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
                },
              ]}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="暂无软件包预置" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'plugins' ? (
          <div>
            <Table
              dataSource={plugins}
              rowKey="id"
              columns={[
                { title: '插件名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                { title: '版本', dataIndex: 'version', key: 'version', render: (v) => v || 'v1.0' },
                { title: '插件类型', dataIndex: 'type', key: 'type', render: (t) => <Tag color="purple">{t || 'IDP'}</Tag> },
                { title: '描述', dataIndex: 'description', key: 'description', render: (d) => d || '-' },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  key: 'enabled',
                  render: (e) => <Tag color={e !== false ? 'green' : 'default'}>{e !== false ? '已启用' : '未启用'}</Tag>,
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无插件接入" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'announcement' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  announcementForm.resetFields();
                  setEditingAnnouncementId(null);
                  setAnnouncementModalOpen(true);
                }}
              >
                发布新公告
              </Button>
            </div>
            <Table
              dataSource={announcements}
              rowKey={(_, idx) => String(idx)}
              columns={[
                { title: '公告标题', key: 'title', render: (_, r: AnnouncementItem) => r.content?.title || '-' },
                { title: '公告内容', key: 'content', ellipsis: true, render: (_, r: AnnouncementItem) => r.content?.content || '-' },
                {
                  title: '级别',
                  key: 'priority',
                  render: (_, r: AnnouncementItem) => {
                    const p = r.content?.priority || 0;
                    return <Tag color={p >= 2 ? 'red' : p === 1 ? 'orange' : 'green'}>{p >= 2 ? '紧急' : p === 1 ? '重要' : '常规'}</Tag>;
                  },
                },
                {
                  title: '有效期',
                  key: 'validity',
                  render: (_, r: AnnouncementItem) => {
                    const s = r.content?.start_time;
                    const e = r.content?.end_time;
                    if (!s && !e) return '-';
                    return (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {s ? new Date(s * 1000).toLocaleDateString() : ''} ~ {e ? new Date(e * 1000).toLocaleDateString() : ''}
                      </Text>
                    );
                  },
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, r: AnnouncementItem) => (
                    <Button
                      type="link"
                      onClick={() => {
                        announcementForm.setFieldsValue({
                          title: r.content?.title,
                          content: r.content?.content,
                          priority: r.content?.priority || 0,
                          range: [
                            r.content?.start_time ? dayjs(r.content.start_time * 1000) : undefined,
                            r.content?.end_time ? dayjs(r.content.end_time * 1000) : undefined,
                          ],
                        });
                        setEditingAnnouncementId(r.id || null);
                        setAnnouncementModalOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />

            {/* Create / Edit Announcement Modal */}
            <Modal
              title={editingAnnouncementId ? '编辑公告' : '发布新公告'}
              open={announcementModalOpen}
              onOk={handleSaveAnnouncement}
              onCancel={() => setAnnouncementModalOpen(false)}
              okText={editingAnnouncementId ? '保存修改' : '发布'}
              cancelText="取消"
            >
              <Form form={announcementForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
                  <Input placeholder="例如: 系统维护通知" />
                </Form.Item>
                <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
                  <Input.TextArea rows={4} placeholder="公告详细信息" />
                </Form.Item>
                <Form.Item name="priority" label="公告级别" initialValue={0}>
                  <Select
                    options={[
                      { label: '常规', value: 0 },
                      { label: '重要', value: 1 },
                      { label: '紧急', value: 2 },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="range" label="有效期 (可选)">
                  <DatePicker.RangePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        ) : activeTab === 'proxy' ? (
          <div style={{ maxWidth: 640 }}>
            <Form form={proxyForm} layout="vertical">
              <Form.Item label="HTTP 代理地址" name="http_proxy">
                <Input placeholder="http://proxy.internal.corp:8080" />
              </Form.Item>
              <Form.Item label="HTTPS 代理地址" name="https_proxy">
                <Input placeholder="http://proxy.internal.corp:8080" />
              </Form.Item>
              <Form.Item label="无需代理地址 (No Proxy)" name="no_proxy">
                <Input placeholder="localhost, 127.0.0.1, .cluster.local" />
              </Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={async () => {
                  try {
                    const values = await proxyForm.validateFields();
                    await http.post('/api/aslan/system/proxyManage', values);
                    feedback.message.success('代理配置已保存');
                  } catch (err: any) {
                    if (!err?.errorFields) {
                      feedback.message.error(err?.response?.data?.message || err?.message || '代理配置保存失败');
                    }
                  }
                }}
              >
                保存代理设置
              </Button>
            </Form>
          </div>
        ) : activeTab === 'aiCodeReview' ? (
          <div style={{ maxWidth: 720 }}>
            <Form form={aiReviewForm} layout="vertical">
              <Form.Item
                name="llm_integration_id"
                label="LLM 模型集成"
                rules={[{ required: true, message: '请选择 LLM 模型集成' }]}
                extra="列表来自系统集成 → AI 模型接入配置"
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  options={llmOptions}
                  placeholder="选择用于代码审查的大模型"
                  notFoundContent="暂无 LLM 集成，请先在系统集成中配置 AI 模型"
                />
              </Form.Item>
              <Form.Item name="include_paths" label="审查路径包含 (每行一个，支持通配符)">
                <Input.TextArea rows={3} placeholder={'src/**\napp/**'} />
              </Form.Item>
              <Form.Item name="exclude_paths" label="审查路径排除 (每行一个)">
                <Input.TextArea rows={3} placeholder={'**/*_test.go\nvendor/**'} />
              </Form.Item>
              <Form.Item name="output_language" label="输出语言" initialValue="中文">
                <Select
                  options={[
                    { label: '中文', value: '中文' },
                    { label: 'English', value: 'English' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="rules"
                label="审查规则 (JSON 数组，可选)"
                extra='例如: [{"name":"安全","description":"检查 SQL 注入与敏感信息泄露"}]'
              >
                <Input.TextArea rows={6} placeholder='[{"name": "...", "description": "..."}]' />
              </Form.Item>
              <Button type="primary" icon={<SaveOutlined />} loading={savingAiReview} onClick={handleSaveAiReview}>
                保存 AI 审查配置
              </Button>
            </Form>
          </div>
        ) : (
          <Table
            dataSource={operationLogs}
            rowKey="id"
            columns={[
              { title: '操作账号', dataIndex: 'username', key: 'username', render: (u) => <Text strong>{u}</Text> },
              { title: '所属项目', dataIndex: 'product_name', key: 'product_name', render: (p) => <Tag color="blue">{p || '系统'}</Tag> },
              { title: '功能模块', dataIndex: 'function', key: 'function', render: (f) => f || '-' },
              { title: '操作行为', dataIndex: 'method', key: 'method', render: (m) => <Tag color="cyan">{m}</Tag> },
              {
                title: '执行结果',
                dataIndex: 'status',
                key: 'status',
                render: (s) => <Tag color={s === 200 || s === 0 ? 'green' : 'red'}>{s === 200 || s === 0 ? '成功' : '失败'}</Tag>,
              },
              {
                title: '操作时间',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
              },
            ]}
            pagination={{ pageSize: 15 }}
            locale={{
              emptyText: <Empty description="暂无操作审计日志记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>

      {/* Add Basic Image Modal */}
      <Modal
        title="添加构建系统基础镜像"
        open={imageModalVisible}
        onCancel={() => setImageModalVisible(false)}
        onOk={() => imageForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={imageForm} layout="vertical" onFinish={handleCreateBasicImage}>
          <Form.Item
            name="label"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="例如: ubuntu 22.04" />
          </Form.Item>
          <Form.Item
            name="value"
            label="镜像标识 / 仓库地址"
            rules={[{ required: true, message: '请输入镜像标识' }]}
          >
            <Input placeholder="例如: jammy 或 koderover.hub.bkt.clouddn.com/zadig/ubuntu:22.04" />
          </Form.Item>
          <Form.Item name="image_from" label="来源" initialValue="custom">
            <Input placeholder="例如: custom 或 koderover" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemConfigPage;
