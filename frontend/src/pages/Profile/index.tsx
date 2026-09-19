import React, { useState } from 'react';
import { Card, Tabs, Typography, Form, Input, Button, Descriptions, Tag, Alert, Space } from 'antd';
import {
  ApiOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';

const { Title, Text, Paragraph } = Typography;

export const UserProfilePage: React.FC = () => {
  const { userInfo, roles } = useAuthStore();
  const [activeTab, setActiveTab] = useState('mcp');

  const tabItems = [
    {
      key: 'mcp',
      label: (
        <span>
          <ApiOutlined /> 配置 MCP (Model Context Protocol)
        </span>
      ),
    },
    {
      key: 'info',
      label: (
        <span>
          <UserOutlined /> 账号设置
        </span>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyCertificateOutlined /> 安全设置
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          个人中心与配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          管理当前个人账户资料、安全鉴权凭据以及 AI 编程助手 MCP 协议端点
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
          onChange={(k) => setActiveTab(k)}
          tabBarStyle={{ marginBottom: 24 }}
        />

        {activeTab === 'mcp' ? (
          <div style={{ maxWidth: 780 }}>
            <Alert
              title="Zadig Model Context Protocol (MCP) 服务集成"
              description="启用 MCP 后，Cursor、Claude Code、Windsurf 等 AI 客户端可直接读取 Zadig 中的工作流状态、集群 Pod 容器日志及发布事件。"
              type="info"
              showIcon
              style={{ marginBottom: 24, borderRadius: 6 }}
            />

            <Form layout="vertical" initialValues={{ enabled: true, serverPort: 8080 }}>
              <Form.Item label="MCP 服务访问端点 (Endpoint)">
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={`${window.location.origin}/api/mcp/sse`} disabled />
                  <Button
                    type="primary"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/mcp/sse`);
                      feedback.message.success('已复制 MCP SSE 地址到剪贴板');
                    }}
                  >
                    复制
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item label="用户专属 API Token">
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password value="zadig_mcp_sec_live_9f83a812b10927c3" disabled />
                  <Button
                    type="primary"
                    onClick={() => {
                      navigator.clipboard.writeText('zadig_mcp_sec_live_9f83a812b10927c3');
                      feedback.message.success('Token 已复制');
                    }}
                  >
                    复制 Token
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 12 }}>
                在您的 `claude_desktop_config.json` 或 `.mcp.json` 中添加以下配置即可连通：
              </Paragraph>

              <pre
                style={{
                  backgroundColor: '#0a1120',
                  color: '#38bdf8',
                  padding: 16,
                  borderRadius: 6,
                  fontSize: 12,
                  overflowX: 'auto',
                }}
              >
{`{
  "mcpServers": {
    "zadig": {
      "command": "npx",
      "args": ["-y", "@koderover/zadig-mcp@latest"],
      "env": {
        "ZADIG_BASE_URL": "${window.location.origin}",
        "ZADIG_TOKEN": "zadig_mcp_sec_live_9f83a812b10927c3"
      }
    }
  }
}`}
              </pre>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" onClick={() => feedback.message.success('MCP 访问凭证已重新生成')}>
                  重新生成 Token
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'info' ? (
          <div style={{ maxWidth: 720 }}>
            <Descriptions
              title="当前用户基础信息"
              bordered
              column={1}
              size="middle"
              styles={{ label: { width: 160, fontWeight: 500, backgroundColor: '#fafafa' } }}
            >
              <Descriptions.Item label="账号名称">{userInfo?.account || 'admin@qq.com'}</Descriptions.Item>
              <Descriptions.Item label="电子邮箱">{userInfo?.email || 'admin@qq.com'}</Descriptions.Item>
              <Descriptions.Item label="显示昵称">{userInfo?.name || '超级管理员'}</Descriptions.Item>
              <Descriptions.Item label="系统权限">
                <Tag color="magenta">
                  {roles.includes('admin') ? '超级管理员 (System Admin)' : '普通研发人员'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="账号源">内置系统用户 (system)</Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <div style={{ maxWidth: 520 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              修改密码
            </Title>
            <Form layout="vertical">
              <Form.Item label="原密码" required>
                <Input.Password placeholder="请输入当前密码" />
              </Form.Item>
              <Form.Item label="新密码" required>
                <Input.Password placeholder="至少 8 位，包含字母与数字" />
              </Form.Item>
              <Form.Item label="确认新密码" required>
                <Input.Password placeholder="再次确认新密码" />
              </Form.Item>
              <Button
                type="primary"
                icon={<KeyOutlined />}
                onClick={() => feedback.message.info('密码已成功修改')}
              >
                更新密码
              </Button>
            </Form>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserProfilePage;
