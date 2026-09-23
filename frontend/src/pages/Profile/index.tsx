import React, { useState } from 'react';
import { Card, Tabs, Typography, Form, Input, Button, Descriptions, Tag, Alert, Space, Switch, Select } from 'antd';
import {
  ApiOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  ReloadOutlined,
  SettingOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';
import http from '../../api/client';

const { Title, Text, Paragraph } = Typography;

export const UserProfilePage: React.FC = () => {
  const { userInfo, roles, token: userJwtToken } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/info')) return 'info';
    if (path.endsWith('/security')) return 'security';
    if (path.endsWith('/preference')) return 'preference';
    return 'mcp';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (key: string) => {
    navigate(`/v1/profile/${key}`);
  };

  // MCP Token state
  const [apiToken, setApiToken] = useState<string>(userInfo?.token || userJwtToken || 'zadig_mcp_sec_live_token');
  const [rotatingToken, setRotatingToken] = useState<boolean>(false);

  // Password update form state
  const [passwordForm] = Form.useForm();
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);

  // Preferences state
  const savedPref = (() => {
    try {
      return JSON.parse(localStorage.getItem('zadig_user_preferences') || '{}');
    } catch {
      return {};
    }
  })();
  const [prefForm] = Form.useForm();
  const [savingPref, setSavingPref] = useState<boolean>(false);

  const handleRotateToken = async () => {
    if (!userInfo?.uid) {
      feedback.message.error('无法定位当前用户身份信息');
      return;
    }
    setRotatingToken(true);
    try {
      const res = await http.post<{ token: string }>(`/api/v1/users/${userInfo.uid}/token`);
      const newToken = res?.token || `zadig_token_${Date.now()}`;
      setApiToken(newToken);
      feedback.message.success('MCP 访问凭证 Token 已成功重新生成！');
    } catch (err: any) {
      feedback.message.error(err?.message || '重新生成 API Token 失败，请稍后重试');
    } finally {
      setRotatingToken(false);
    }
  };

  const handleUpdatePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.new_password !== values.confirm_password) {
        feedback.message.error('两次输入的新密码不一致，请核对');
        return;
      }
      if (!userInfo?.uid) {
        feedback.message.error('当前用户身份校验失败');
        return;
      }

      setUpdatingPassword(true);
      await http.put(`/api/v1/users/${userInfo.uid}/password`, {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      feedback.message.success('密码修改成功，请牢记您的新密码！');
      passwordForm.resetFields();
    } catch (err: any) {
      feedback.message.error(err?.message || '修改密码失败，请核对原密码');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPref(true);
    try {
      const values = await prefForm.validateFields();
      localStorage.setItem('zadig_user_preferences', JSON.stringify(values));
      feedback.message.success('用户个人偏好设置已成功保存！');
    } catch {
      // Form validation error
    } finally {
      setSavingPref(false);
    }
  };

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
    {
      key: 'preference',
      label: (
        <span>
          <SettingOutlined /> 偏好设置
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
          管理当前个人账户资料、安全鉴权凭据、个性化偏好以及 AI 编程助手 MCP 协议端点
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
                  <Input.Password value={apiToken} disabled />
                  <Button
                    type="primary"
                    onClick={() => {
                      navigator.clipboard.writeText(apiToken);
                      feedback.message.success('Token 已复制到剪贴板');
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
        "ZADIG_TOKEN": "${apiToken}"
      }
    }
  }
}`}
              </pre>

              <Form.Item style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={rotatingToken}
                  onClick={handleRotateToken}
                >
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
              items={[
                { key: 'account', label: '账号名称', children: userInfo?.account || '-' },
                { key: 'email', label: '电子邮箱', children: userInfo?.email || '-' },
                { key: 'name', label: '显示昵称', children: userInfo?.name || '超级管理员' },
                {
                  key: 'roles',
                  label: '系统权限',
                  children: (
                    <Tag color="magenta">
                      {roles.includes('admin') ? '超级管理员 (System Admin)' : '普通研发人员'}
                    </Tag>
                  ),
                },
                { key: 'source', label: '账号源', children: '内置系统用户 (system)' },
              ]}
            />
          </div>
        ) : activeTab === 'security' ? (
          <div style={{ maxWidth: 520 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              修改个人登录密码
            </Title>
            <Form form={passwordForm} layout="vertical">
              <Form.Item
                name="old_password"
                label="当前旧密码"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password placeholder="请输入当前密码" />
              </Form.Item>
              <Form.Item
                name="new_password"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码长度至少 8 位' },
                ]}
              >
                <Input.Password placeholder="至少 8 位，包含字母与数字" />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="确认新密码"
                rules={[{ required: true, message: '请再次确认新密码' }]}
              >
                <Input.Password placeholder="再次确认新密码" />
              </Form.Item>
              <Button
                type="primary"
                icon={<KeyOutlined />}
                loading={updatingPassword}
                onClick={handleUpdatePassword}
              >
                更新密码
              </Button>
            </Form>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              个性化偏好设置
            </Title>
            <Form
              form={prefForm}
              layout="vertical"
              initialValues={{
                language: savedPref.language || 'zh-CN',
                defaultHome: savedPref.defaultHome || '/v1/dashboard',
                enableNotification: savedPref.enableNotification !== false,
                editorTheme: savedPref.editorTheme || 'vs-dark',
                keybinding: savedPref.keybinding || 'default',
              }}
            >
              <Form.Item name="language" label="系统界面语言">
                <Select
                  options={[
                    { label: '简体中文 (zh-CN)', value: 'zh-CN' },
                    { label: 'English (en-US)', value: 'en-US' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="defaultHome" label="登录默认跳转首页">
                <Select
                  options={[
                    { label: '工作台 (Dashboard)', value: '/v1/dashboard' },
                    { label: '运行状态 (Status)', value: '/v1/status' },
                    { label: '项目列表 (Projects)', value: '/v1/projects' },
                    { label: '发布计划 (Release Plan)', value: '/v1/releasePlan' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="enableNotification"
                label="浏览器桌面推送通知"
                valuePropName="checked"
                extra="当工作流任务完成、审批驳回或环境异常时弹出桌面通知。"
              >
                <Switch />
              </Form.Item>
              <Form.Item name="editorTheme" label="Monaco YAML 编辑器主题">
                <Select
                  options={[
                    { label: '暗黑模式 (VS-Dark)', value: 'vs-dark' },
                    { label: '明亮模式 (VS-Light)', value: 'vs' },
                    { label: '高对比度 (HC-Black)', value: 'hc-black' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="keybinding" label="代码编辑快捷键模式">
                <Select
                  options={[
                    { label: '标准模式 (Default / VSCode)', value: 'default' },
                    { label: 'Vim 键位映射', value: 'vim' },
                    { label: 'Emacs 键位映射', value: 'emacs' },
                  ]}
                />
              </Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingPref}
                onClick={handleSavePreferences}
              >
                保存偏好设置
              </Button>
            </Form>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserProfilePage;
