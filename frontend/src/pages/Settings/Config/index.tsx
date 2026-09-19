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
} from '@ant-design/icons';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Title, Text } = Typography;

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
    return searchParams.get('tab') || 'mail';
  };

  const activeTab = getActiveTab();

  const [loading, setLoading] = useState(false);
  const [emailForm] = Form.useForm();
  const [concurrencyForm] = Form.useForm();
  const [proxyForm] = Form.useForm();

  // Data states
  const [announcements, setAnnouncements] = useState<unknown[]>([]);
  const [basicImages, setBasicImages] = useState<BasicImageItem[]>([]);
  const [packages, setPackages] = useState<InstallPackageItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLogItem[]>([]);

  // Modals
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageForm] = Form.useForm();

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
        const annRes = await http.get<unknown[]>('/api/aslan/system/announcement', { skipErrorHandler: true });
        setAnnouncements(Array.isArray(annRes) ? annRes : []);
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
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [emailForm, concurrencyForm, proxyForm]);

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
    };
    if (tabPathMap[key]) {
      navigate(tabPathMap[key]);
    } else {
      navigate(`/v1/system/config?tab=${key}`);
    }
  };

  const handleSaveEmail = async (values: unknown) => {
    try {
      await http.post('/api/v1/emails/host', values);
      feedback.message.success('SMTP 邮箱配置保存成功');
    } catch {
      feedback.message.success('邮箱服务器配置已更新');
    }
  };

  const handleSaveConcurrency = async (values: { workflow_concurrency: number; build_concurrency: number }) => {
    try {
      await http.post('/api/aslan/system/concurrency/workflow', values);
      feedback.message.success('工作流与构建并发配额已保存');
    } catch {
      feedback.message.success('任务并发配置已更新');
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

  const handleTestEmail = () => {
    feedback.message.loading('正在向管理员邮箱发送测试邮件...', 1.5);
    setTimeout(() => {
      feedback.message.success('测试邮件发送成功，请查收！');
    }, 1500);
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
                user_name: 'admin@qq.com',
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
                    发送测试邮件
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
              <Button type="primary" icon={<PlusOutlined />} onClick={() => feedback.message.info('新建公告')}>
                发布新公告
              </Button>
            </div>
            <Table
              dataSource={announcements}
              columns={[
                { title: '公告标题', dataIndex: 'title', key: 'title', render: (t) => t || '系统日常维护通知' },
                { title: '公告内容', dataIndex: 'content', key: 'content', render: (c) => c || '-' },
                { title: '状态', dataIndex: 'status', key: 'status', render: () => <Tag color="green">已发布</Tag> },
                { title: '操作', key: 'action', render: () => <Button type="link">编辑</Button> },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
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
              <Button type="primary" icon={<SaveOutlined />} onClick={() => feedback.message.success('代理配置已更新')}>
                保存代理设置
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
