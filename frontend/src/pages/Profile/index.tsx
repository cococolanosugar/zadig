import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Typography, Form, Input, Button, Descriptions, Tag, Alert, Space, Switch, Select, Spin } from 'antd';
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

  // MFA 管理（对齐旧版安全设置；后端: /api/v1/users/:uid/mfa/*）
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ qrcode?: string; secret?: string } | null>(null);
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);

  const loadMfaStatus = useCallback(async () => {
    if (!userInfo?.uid) return;
    setMfaLoading(true);
    try {
      const res = await http.get<{ enabled: boolean; system_forced_enabled: boolean }>(
        `/api/v1/users/${userInfo.uid}/mfa/status`,
        { skipErrorHandler: true }
      );
      setMfaEnabled(!!res?.enabled);
    } catch {
      setMfaEnabled(null);
    } finally {
      setMfaLoading(false);
    }
  }, [userInfo?.uid]);

  useEffect(() => {
    if (activeTab === 'security') {
      loadMfaStatus();
    }
  }, [activeTab, loadMfaStatus]);

  const handleMfaSetup = async () => {
    if (!userInfo?.uid) return;
    setMfaLoading(true);
    try {
      const res = await http.post<{ qrcode?: string; secret?: string }>(
        `/api/v1/users/${userInfo.uid}/mfa/setup`,
        {},
        { skipErrorHandler: true }
      );
      setMfaSetupData(res || {});
      feedback.message.success('已生成 MFA 绑定二维码，请使用认证器扫描');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.description || err?.message || 'MFA 初始化失败');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaEnable = async () => {
    if (!userInfo?.uid || !mfaOtp.trim()) {
      feedback.message.warning('请输入 6 位动态验证码');
      return;
    }
    setMfaSubmitting(true);
    try {
      const res = await http.post<{ recovery_codes?: string[] }>(
        `/api/v1/users/${userInfo.uid}/mfa/enable`,
        { otp_code: mfaOtp.trim() },
        { skipErrorHandler: true }
      );
      feedback.message.success('MFA 已启用');
      setMfaEnabled(true);
      setMfaSetupData(null);
      setMfaOtp('');
      if (res?.recovery_codes?.length) {
        setMfaRecoveryCodes(res.recovery_codes);
      }
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.description || err?.message || 'MFA 启用失败，请检查验证码');
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!userInfo?.uid || !mfaOtp.trim()) {
      feedback.message.warning('请输入动态验证码或恢复码以确认关闭 MFA');
      return;
    }
    setMfaSubmitting(true);
    try {
      await http.post(
        `/api/v1/users/${userInfo.uid}/mfa/disable`,
        { otp_code: mfaOtp.trim() },
        { skipErrorHandler: true }
      );
      feedback.message.success('MFA 已关闭');
      setMfaEnabled(false);
      setMfaOtp('');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.description || err?.message || '关闭 MFA 失败');
    } finally {
      setMfaSubmitting(false);
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
          <div style={{ maxWidth: 720 }}>
            {/* MFA 管理（对齐旧版安全设置） */}
            <Title level={5} style={{ marginBottom: 12 }}>
              多因素认证 (MFA)
            </Title>
            <Alert
              title={`状态：${mfaEnabled === null ? '未知' : mfaEnabled ? '已启用' : '未启用'}`}
              description="启用后登录时需输入认证器动态验证码，为账户增加一层安全保护。"
              type={mfaEnabled ? 'success' : 'info'}
              showIcon
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
            {mfaLoading && <Spin size="small" style={{ display: 'block', marginBottom: 12 }} />}

            {mfaEnabled === false && !mfaSetupData && (
              <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={handleMfaSetup} loading={mfaLoading}>
                启用 MFA
              </Button>
            )}

            {mfaSetupData && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ textAlign: 'center', margin: '12px 0 16px' }}>
                  {mfaSetupData.qrcode ? (
                    <img src={mfaSetupData.qrcode} alt="MFA QR Code" style={{ width: 180, height: 180, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #ebeef5' }} />
                  ) : (
                    <Text code copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>{mfaSetupData.secret}</Text>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      密钥: <Text code copyable style={{ fontSize: 12 }}>{mfaSetupData.secret}</Text>
                    </Text>
                  </div>
                </div>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="输入认证器 6 位动态验证码"
                    maxLength={6}
                    value={mfaOtp}
                    onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button type="primary" loading={mfaSubmitting} onClick={handleMfaEnable}>
                    确认绑定
                  </Button>
                </Space.Compact>
              </div>
            )}

            {mfaEnabled && (
              <div style={{ marginBottom: 24 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="输入动态验证码或恢复码以确认关闭"
                    value={mfaOtp}
                    onChange={(e) => setMfaOtp(e.target.value)}
                  />
                  <Button danger loading={mfaSubmitting} onClick={handleMfaDisable}>
                    关闭 MFA
                  </Button>
                </Space.Compact>
              </div>
            )}

            {mfaRecoveryCodes.length > 0 && (
              <Alert
                title="请妥善保存以下恢复码（仅展示一次）"
                description={
                  <Space orientation="horizontal" size={8} wrap>
                    {mfaRecoveryCodes.map((c) => (
                      <Text key={c} code copyable>{c}</Text>
                    ))}
                  </Space>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 24, borderRadius: 6 }}
              />
            )}

            <Title level={5} style={{ marginBottom: 16, marginTop: 32 }}>
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
