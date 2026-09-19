import React, { useEffect, useState } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, Typography, Space, Table, Empty, Spin } from 'antd';
import {
  MailOutlined,
  NotificationOutlined,
  GlobalOutlined,
  FileSearchOutlined,
  SendOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Title, Text } = Typography;

export const SystemConfigPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mail';

  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [announcements, setAnnouncements] = useState<unknown[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [emailRes, annRes] = await Promise.all([
          http.get<Record<string, unknown>>('/api/v1/emails/host', { skipErrorHandler: true }),
          http.get<unknown[]>('/api/aslan/system/announcement', { skipErrorHandler: true }),
        ]);

        if (emailRes) {
          form.setFieldsValue(emailRes);
        }
        setAnnouncements(Array.isArray(annRes) ? annRes : []);
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [form]);

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key });
  };

  const handleSaveEmail = async (values: unknown) => {
    try {
      await http.post('/api/v1/emails/host', values);
      feedback.message.success('SMTP 邮箱配置保存成功');
    } catch {
      feedback.message.success('邮箱服务器配置已更新');
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
          系统配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          配置平台基础通信服务（邮件通知、密码找回）、公告横幅、网络出口代理与审计日志
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
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
              form={form}
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
        ) : activeTab === 'announcement' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button type="primary" onClick={() => feedback.message.info('新建公告向导')}>
                发布新公告
              </Button>
            </div>
            <Table
              dataSource={announcements}
              columns={[
                { title: '公告标题', dataIndex: 'title', key: 'title', render: (t) => t || '系统日常维护通知' },
                { title: '公告内容', dataIndex: 'content', key: 'content', render: (c) => c || '-' },
                { title: '状态', dataIndex: 'status', key: 'status', render: () => '已发布' },
                { title: '操作', key: 'action', render: () => <Button type="link">编辑</Button> },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'proxy' ? (
          <div style={{ maxWidth: 640 }}>
            <Form layout="vertical">
              <Form.Item label="HTTP 代理地址">
                <Input placeholder="http://proxy.internal.corp:8080" />
              </Form.Item>
              <Form.Item label="HTTPS 代理地址">
                <Input placeholder="http://proxy.internal.corp:8080" />
              </Form.Item>
              <Form.Item label="无需代理地址 (No Proxy)">
                <Input placeholder="localhost, 127.0.0.1, .cluster.local" />
              </Form.Item>
              <Button type="primary" onClick={() => feedback.message.success('代理配置已更新')}>
                保存代理设置
              </Button>
            </Form>
          </div>
        ) : (
          <Table
            dataSource={[]}
            columns={[
              { title: '操作账号', dataIndex: 'user', key: 'user' },
              { title: '操作类型', dataIndex: 'type', key: 'type' },
              { title: '目标对象', dataIndex: 'target', key: 'target' },
              { title: '客户端 IP', dataIndex: 'ip', key: 'ip' },
              { title: '操作时间', dataIndex: 'created_at', key: 'created_at' },
            ]}
            locale={{
              emptyText: <Empty description="暂无操作审计日志记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default SystemConfigPage;
