import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Input, Button, Typography, Space, Alert, Carousel, Modal } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  LineChartOutlined,
  RocketOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';
import ZadigLogo from '../../components/Brand/ZadigLogo';

const { Title, Text } = Typography;

interface LoginFormValues {
  account: string;
  password: string;
  captcha_answer?: string;
}

const CAROUSEL_SLIDES = [
  {
    title: '灵活易用的高并发工作流',
    desc: '多架构容器构建、多集群自动发布与分发，自由编排交付流水线',
    icon: <BranchesOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '面向开发者的云原生环境',
    desc: '分钟级拉起隔离的多套独立开发/测试环境，支持一键休眠与唤醒',
    icon: <CloudServerOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '高效协同的测试管理',
    desc: '自动化测试平台与测试用例联动，提供可溯源的测试质量报告',
    icon: <CheckCircleOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '强大免运维的模板库',
    desc: '开箱即用的 Kubernetes YAML 与 Helm Chart 模板统一标准治理',
    icon: <AppstoreOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '客观精确的效能洞察',
    desc: '从代码提交到上线端到端追踪，多维构建与交付效能看板',
    icon: <LineChartOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: 'AI 助力开启智能新时代',
    desc: '结合大语言模型深度分析错误日志与构建瓶颈，智能生成交付配置',
    icon: <RocketOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
];

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm<LoginFormValues>();
  const [resetForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [retrieveModalOpen, setRetrieveModalOpen] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveAccount, setRetrieveAccount] = useState('');
  const [retrieveResult, setRetrieveResult] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string }>>([]);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaMode, setMfaMode] = useState<'verify' | 'enroll'>('verify');
  const [mfaQrCode, setMfaQrCode] = useState<string>('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaUseRecovery, setMfaUseRecovery] = useState(false);
  const [mfaForm] = Form.useForm();
  const [mfaEnrollForm] = Form.useForm();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingLoginRes, setPendingLoginRes] = useState<{
    token: string;
    uid: string;
    name?: string;
    account: string;
    email?: string;
    phone?: string;
    identityType?: string;
  } | null>(null);

  // 第三方登录连接器（Dex）：有启用的连接器时展示入口
  useEffect(() => {
    if (resetMode) return;
    fetch('/api/v1/connectors')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setConnectors(list.filter((c: { id?: string }) => c.id).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => setConnectors([]));
  }, [resetMode]);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setRoles = useAuthStore((state) => state.setRoles);
  const idToken = searchParams.get('idtoken') || '';

  // /signin?idtoken=<jwt> — password-reset link from the retrieve email
  React.useEffect(() => {
    if (idToken) {
      setResetMode(true);
    }
  }, [idToken]);

  // /mfa-enroll?mfa_challenge_token=...&required_action=enroll|verify — MFA 挑战回链（第三方登录等场景）
  const routeMfaChallenge = searchParams.get('mfa_challenge_token') || '';
  const routeMfaAction = searchParams.get('required_action') || '';
  React.useEffect(() => {
    if (routeMfaChallenge) {
      setMfaChallenge(routeMfaChallenge);
      setMfaMode(routeMfaAction === 'enroll' ? 'enroll' : 'verify');
    }
  }, [routeMfaChallenge, routeMfaAction]);

  const handleRetrievePassword = async (account: string) => {
    setRetrieving(true);
    setRetrieveResult(null);
    try {
      const res = await fetch(`/api/v1/retrieve?account=${encodeURIComponent(account)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRetrieveResult(
          `重置链接已发送至 ${data.email || '您的邮箱'}，请在 5 分钟内查收邮件并按提示重置密码。`
        );
      } else {
        setRetrieveResult(data?.errorMsg || data?.description || data?.message || '发送失败，请确认账号或联系管理员配置 SMTP');
      }
    } catch {
      setRetrieveResult('网络异常，请稍后重试');
    } finally {
      setRetrieving(false);
    }
  };

  const handleResetPassword = async (values: { password: string }) => {
    setResetting(true);
    try {
      const res = await fetch('/api/v1/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ password: values.password }),
      });
      if (res.ok) {
        feedback.message.success('密码重置成功，请使用新密码登录');
        setResetMode(false);
        navigate('/signin', { replace: true });
      } else {
        setErrorMessage('密码重置失败，链接可能已过期（有效期 5 分钟），请重新申请找回密码');
        setResetMode(false);
      }
    } catch {
      setErrorMessage('网络异常，密码重置失败，请稍后重试');
    } finally {
      setResetting(false);
    }
  };

  const fetchCaptcha = async (accountName?: string) => {
    try {
      const acc = accountName || form.getFieldValue('account') || '';
      const res = await fetch(`/api/v1/captcha?account=${encodeURIComponent(acc)}`);
      if (res.ok) {
        const data = await res.json();
        setCaptchaId(data.id || data.captcha_id);
        setCaptchaImage(data.content || data.data || data.image);
        setShowCaptcha(true);
      }
    } catch {
      // Captcha optional
    }
  };

  // 完成登录态写入与跳转（账号密码登录与 MFA 验证成功共用）
  const completeLogin = async (loginRes: {
    token: string;
    uid: string;
    name?: string;
    account?: string;
    email?: string;
    phone?: string;
    identityType?: string;
  }) => {
    setAuth(loginRes.token, {
      uid: loginRes.uid,
      name: loginRes.name || loginRes.account || '',
      email: loginRes.email || '',
      phone: loginRes.phone,
      account: loginRes.account || '',
      identity_type: loginRes.identityType,
    });

    try {
      const perm = await authApi.getUserPermissions();
      if (perm?.is_system_admin) {
        setRoles(['admin']);
      } else {
        setRoles(['user']);
      }
    } catch {
      setRoles(['admin']);
    }

    feedback.message.success('登录成功，欢迎使用 Zadig！');

    let target = searchParams.get('redirect') ? decodeURIComponent(searchParams.get('redirect')!) : '/v1/dashboard';
    while (target.startsWith('/login') || target.startsWith('/signin')) {
      const match = target.match(/[?&]redirect=([^&]+)/);
      if (match) {
        target = decodeURIComponent(match[1]);
      } else {
        target = '/v1/dashboard';
        break;
      }
    }
    navigate(target, { replace: true });
  };

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const captchaPayload =
        showCaptcha && captchaId && values.captcha_answer
          ? { id: captchaId, answer: values.captcha_answer }
          : undefined;

      const loginRes = await authApi.login(values.account, values.password, captchaPayload);

      if (loginRes && loginRes.mfa_required && loginRes.mfa_challenge_token) {
        // 账号开启了 MFA：进入验证 / 注册挑战阶段
        setMfaChallenge(loginRes.mfa_challenge_token);
        setMfaMode(loginRes.required_action === 'enroll' ? 'enroll' : 'verify');
        setLoading(false);
        return;
      }

      if (loginRes && loginRes.token) {
        await completeLogin(loginRes);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { errorMsg?: string; message?: string; description?: string } } };
      const msg =
        error?.response?.data?.description ||
        error?.response?.data?.message ||
        error?.response?.data?.errorMsg ||
        '登录失败，请检查账号和密码';

      setErrorMessage(msg);

      if (msg.includes('captcha') || msg.includes('验证码')) {
        await fetchCaptcha(values.account);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPasswordLogin = () => {
    setMfaChallenge(null);
    setMfaQrCode('');
    setMfaUseRecovery(false);
    setErrorMessage(null);
    mfaForm.resetFields();
    mfaEnrollForm.resetFields();
    if (routeMfaChallenge) {
      navigate('/signin', { replace: true });
    }
  };

  const handleMfaVerify = async (values: { otp_code?: string; recovery_code?: string }) => {
    if (!mfaChallenge) return;
    setMfaSubmitting(true);
    setErrorMessage(null);
    try {
      const otp = mfaUseRecovery ? undefined : values.otp_code;
      const recovery = mfaUseRecovery ? (values.otp_code || values.recovery_code) : undefined;
      const res = await authApi.mfaVerify(mfaChallenge, otp, recovery);
      if (res && res.token) {
        await completeLogin(res);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data
        ?.message || 'MFA 验证失败，请检查验证码';
      setErrorMessage(msg);
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleMfaEnroll = async (values: { otp_code: string }) => {
    if (!mfaChallenge) return;
    setMfaSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await authApi.mfaEnroll(mfaChallenge, values.otp_code);
      if (res && res.token) {
        // 先展示恢复码再进入系统（恢复码仅此一次展示）
        setRecoveryCodes(res.recovery_codes || []);
        setPendingLoginRes(res);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data
        ?.message || 'MFA 绑定失败，请检查验证码';
      setErrorMessage(msg);
    } finally {
      setMfaSubmitting(false);
    }
  };

  // enroll 模式进入时拉取 QR 码
  useEffect(() => {
    if (mfaMode === 'enroll' && mfaChallenge && !mfaQrCode) {
      authApi
        .mfaSetup(mfaChallenge)
        .then((res) => setMfaQrCode(res?.qrcode || res?.otpauth_url || ''))
        .catch(() => setMfaQrCode(''));
    }
  }, [mfaMode, mfaChallenge, mfaQrCode]);

  const handleDownloadRecoveryCodes = () => {
    if (!recoveryCodes.length) return;
    const content = recoveryCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zadig-mfa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Row style={{ minHeight: '100vh', margin: 0, overflow: 'hidden' }}>
      {/* Left Column: Authentic White Product Capability Showcase */}
      <Col
        xs={0}
        md={11}
        lg={13}
        style={{
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
        }}
      >
        <div>
          <ZadigLogo height={32} mode="light" />
          <div style={{ marginTop: 40 }}>
            <Title level={2} style={{ color: '#1f2d3d', margin: 0, fontWeight: 700, fontSize: 32 }}>
              工程师信赖的
            </Title>
            <Title level={2} style={{ color: '#fd2968', margin: '8px 0 0 0', fontWeight: 700, fontSize: 32 }}>
              AI 智能 · 云原生 DevOps 平台
            </Title>
          </div>
        </div>

        {/* 6-Card Capability Showcase Carousel */}
        <div style={{ maxWidth: 520, margin: '40px 0' }}>
          <Carousel autoplay dots autoplaySpeed={4500}>
            {CAROUSEL_SLIDES.map((slide, index) => (
              <div key={index}>
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: 16,
                    padding: '40px 32px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 20,
                      backgroundColor: '#e6f0ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {slide.icon}
                  </div>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: 18, color: '#1e293b', fontWeight: 600 }}>
                    {slide.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6, maxWidth: 360 }}>
                    {slide.desc}
                  </p>
                </div>
              </div>
            ))}
          </Carousel>
        </div>

        <div>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            KodeRover Inc. Enterprise Continuous Delivery Platform
          </Text>
        </div>
      </Col>

      {/* Right Column: Signature Dark Navy Form Container */}
      <Col
        xs={24}
        md={13}
        lg={11}
        style={{
          backgroundColor: '#0a1120',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px 32px',
          position: 'relative',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Centered White Zadig Brand Header */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <ZadigLogo height={36} mode="dark" />
          </div>

          {errorMessage && (
            <Alert
              title={errorMessage}
              type="error"
              showIcon
              closable={{ onClose: () => setErrorMessage(null) }}
              style={{ marginBottom: 24, borderRadius: 6 }}
            />
          )}

          {mfaChallenge ? (
            mfaMode === 'enroll' ? (
              /* MFA 首次绑定：扫码 + OTP */
              <Form form={mfaEnrollForm} name="mfaEnrollForm" layout="vertical" size="large" onFinish={handleMfaEnroll} requiredMark={false}>
                <Alert title="开启多因子认证 (MFA)" description="使用认证器 App（如 Google Authenticator）扫描下方二维码，并输入 6 位动态验证码完成绑定。" type="info" showIcon style={{ marginBottom: 20, borderRadius: 6 }} />
                {mfaQrCode && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <img src={mfaQrCode} alt="MFA QR Code" style={{ width: 180, height: 180, borderRadius: 6, background: '#fff', padding: 8 }} />
                  </div>
                )}
                <Form.Item
                  name="otp_code"
                  label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>动态验证码</span>}
                  rules={[{ required: true, message: '请输入 6 位动态验证码' }, { pattern: /^\d{6}$/, message: '请输入 6 位数字' }]}
                >
                  <Input
                    prefix={<SafetyCertificateOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="6 位动态验证码"
                    maxLength={6}
                    style={{ height: 42, borderRadius: 6, backgroundColor: '#ffffff' }}
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 12, marginTop: 24 }}>
                  <Button type="primary" htmlType="submit" loading={mfaSubmitting} block style={{ height: 42, fontSize: 15, fontWeight: 500, borderRadius: 6, backgroundColor: '#0066ff' }}>
                    完成绑定并登录
                  </Button>
                </Form.Item>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <a onClick={handleBackToPasswordLogin} style={{ fontSize: 13, color: '#94a3b8' }}>
                    返回账号密码登录
                  </a>
                </div>
              </Form>
            ) : (
              /* MFA 登录验证：OTP 或恢复码 */
              <Form form={mfaForm} name="mfaVerifyForm" layout="vertical" size="large" onFinish={handleMfaVerify} requiredMark={false}>
                <Alert title="多因子认证验证" description="该账号已开启 MFA，请输入认证器中的 6 位动态验证码继续登录。" type="info" showIcon style={{ marginBottom: 20, borderRadius: 6 }} />
                <Form.Item
                  name="otp_code"
                  label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>{mfaUseRecovery ? '恢复码' : '动态验证码'}</span>}
                  rules={[{ required: true, message: mfaUseRecovery ? '请输入恢复码' : '请输入 6 位动态验证码' }]}
                >
                  <Input
                    prefix={<SafetyCertificateOutlined style={{ color: '#94a3b8' }} />}
                    placeholder={mfaUseRecovery ? '例如: 4a5b-6c7d' : '6 位动态验证码'}
                    maxLength={mfaUseRecovery ? 12 : 6}
                    style={{ height: 42, borderRadius: 6, backgroundColor: '#ffffff' }}
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 12, marginTop: 24 }}>
                  <Button type="primary" htmlType="submit" loading={mfaSubmitting} block style={{ height: 42, fontSize: 15, fontWeight: 500, borderRadius: 6, backgroundColor: '#0066ff' }}>
                    验证并登录
                  </Button>
                </Form.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <a
                    onClick={() => {
                      setMfaUseRecovery(!mfaUseRecovery);
                      mfaForm.resetFields();
                      setErrorMessage(null);
                    }}
                    style={{ fontSize: 13, color: '#38bdf8' }}
                  >
                    {mfaUseRecovery ? '使用动态验证码' : '使用恢复码登录'}
                  </a>
                  <a onClick={handleBackToPasswordLogin} style={{ fontSize: 13, color: '#94a3b8' }}>
                    返回账号密码登录
                  </a>
                </div>
              </Form>
            )
          ) : resetMode ? (
            <Form
              form={resetForm}
              name="resetPasswordForm"
              layout="vertical"
              size="large"
              onFinish={handleResetPassword}
              requiredMark={false}
            >
              <Alert
                title="重置登录密码"
                description="密码必须包含大小写字母和数字，且长度不小于 8 位。"
                type="info"
                showIcon
                style={{ marginBottom: 24, borderRadius: 6 }}
              />
              <Form.Item
                name="password"
                label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>新密码</span>}
                rules={[
                  { required: true, message: '请输入新密码' },
                  {
                    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                    message: '密码必须包含大小写字母和数字，且长度不小于 8 位',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请输入新密码"
                  style={{ height: 42, borderRadius: 6, backgroundColor: '#ffffff' }}
                />
              </Form.Item>
              <Form.Item
                name="confirm"
                label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>确认新密码</span>}
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      !v || getFieldValue('password') === v
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致')),
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请再次输入新密码"
                  style={{ height: 42, borderRadius: 6, backgroundColor: '#ffffff' }}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 12, marginTop: 24 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={resetting}
                  block
                  style={{ height: 42, fontSize: 15, fontWeight: 500, borderRadius: 6, backgroundColor: '#0066ff' }}
                >
                  重置密码
                </Button>
              </Form.Item>
            </Form>
          ) : (
          <Form
            form={form}
            name="loginForm"
            layout="vertical"
            size="large"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              name="account"
              label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>用户名</span>}
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="请输入用户名"
                autoFocus
                style={{
                  height: 42,
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>密码</span>}
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="请输入密码"
                style={{
                  height: 42,
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                }}
              />
            </Form.Item>

            {showCaptcha && (
              <Form.Item
                name="captcha_answer"
                label={<span style={{ color: '#e2e8f0', fontSize: 14 }}>验证码</span>}
                rules={[{ required: true, message: '请输入图形验证码' }]}
              >
                <Space orientation="horizontal" style={{ width: '100%' }}>
                  <Input
                    prefix={<SafetyCertificateOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入图形验证码"
                    style={{ width: 180, height: 42, borderRadius: 6, backgroundColor: '#ffffff' }}
                  />
                  {captchaImage && (
                    <img
                      src={captchaImage}
                      alt="验证码"
                      onClick={() => fetchCaptcha()}
                      style={{ cursor: 'pointer', height: 42, borderRadius: 6 }}
                      title="点击刷新验证码"
                    />
                  )}
                </Space>
              </Form.Item>
            )}

            <Form.Item style={{ marginBottom: 12, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 42,
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: 6,
                  backgroundColor: '#0066ff',
                }}
              >
                登 录
              </Button>
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <a
                onClick={() => {
                  setRetrieveResult(null);
                  setRetrieveModalOpen(true);
                }}
                style={{ fontSize: 13, color: '#38bdf8' }}
              >
                找回密码
              </a>
            </div>

            {connectors.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.4)' }} />
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>第三方账号登录</Text>
                  <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.4)' }} />
                </div>
                <Space orientation="horizontal" wrap style={{ justifyContent: 'center', marginBottom: 16 }}>
                  {connectors.map((c) => (
                    <Button
                      key={c.id}
                      style={{ borderRadius: 6 }}
                      onClick={() => {
                        window.location.href = '/api/v1/login';
                      }}
                    >
                      {c.name}
                    </Button>
                  ))}
                </Space>
              </>
            )}
          </Form>
          )}

          {/* MFA Enrollment Recovery Codes (one-time display) */}
          <Modal
            title="MFA 恢复码"
            open={recoveryCodes.length > 0 && !!pendingLoginRes}
            onCancel={() => {
              setRecoveryCodes([]);
              if (pendingLoginRes) {
                const res = pendingLoginRes;
                setPendingLoginRes(null);
                completeLogin(res);
              }
            }}
            okText="我已保存，进入系统"
            cancelText="取消"
            onOk={() => {
              setRecoveryCodes([]);
              if (pendingLoginRes) {
                const res = pendingLoginRes;
                setPendingLoginRes(null);
                completeLogin(res);
              }
            }}
          >
            <Alert
              title="请妥善保存以下恢复码"
              description="当认证器不可用时，可使用恢复码登录。每个恢复码仅可使用一次，且不会再次展示。"
              type="warning"
              showIcon
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
            <Space size={8} wrap>
              {recoveryCodes.map((code) => (
                <Text key={code} code copyable style={{ fontSize: 14 }}>{code}</Text>
              ))}
            </Space>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadRecoveryCodes}
                style={{ borderRadius: 6 }}
              >
                下载恢复码文件 (zadig-mfa-recovery-codes.txt)
              </Button>
            </div>
          </Modal>

          {/* Retrieve Password Modal */}          <Modal
            title="找回密码"
            open={retrieveModalOpen}
            onCancel={() => setRetrieveModalOpen(false)}
            footer={null}
            width={420}
          >
            <div style={{ padding: '8px 0 16px' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                输入注册的用户名，系统将向绑定邮箱发送重置链接（需管理员已配置 SMTP 邮箱服务器）。
              </Text>
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="请输入用户名"
                style={{ height: 40, borderRadius: 6 }}
                value={retrieveAccount}
                onChange={(e) => {
                  setRetrieveAccount(e.target.value);
                  if (retrieveResult) setRetrieveResult(null);
                }}
                onPressEnter={() => {
                  if (!retrieveAccount.trim()) {
                    setRetrieveResult('请输入用户名');
                    return;
                  }
                  handleRetrievePassword(retrieveAccount.trim());
                }}
                autoFocus
              />
              <Button
                type="primary"
                block
                loading={retrieving}
                style={{ marginTop: 12, height: 40, borderRadius: 6 }}
                onClick={() => {
                  if (!retrieveAccount.trim()) {
                    setRetrieveResult('请输入用户名');
                    return;
                  }
                  handleRetrievePassword(retrieveAccount.trim());
                }}
              >
                发送重置链接
              </Button>
              {retrieveResult && (
                <Alert
                  title={retrieveResult}
                  type={retrieveResult.includes('已发送') ? 'success' : 'warning'}
                  showIcon
                  style={{ marginTop: 12, borderRadius: 6 }}
                />
              )}
            </div>
          </Modal>

          {/* Bottom Copyright */}
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              筑栈（上海）信息技术有限公司 ©{new Date().getFullYear()}
            </Text>
          </div>
        </div>
      </Col>
    </Row>
  );
};

export default LoginPage;
