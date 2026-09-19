import React, { useState } from 'react';
import { Row, Col, Form, Input, Button, Typography, Space, Alert, Carousel } from 'antd';
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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setRoles = useAuthStore((state) => state.setRoles);

  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/v1/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptchaId(data.id || data.captcha_id);
        setCaptchaImage(data.data || data.image);
        setShowCaptcha(true);
      }
    } catch {
      // Captcha optional
    }
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

      if (loginRes && loginRes.token) {
        setAuth(loginRes.token, {
          uid: loginRes.uid,
          name: loginRes.name || loginRes.account,
          email: loginRes.email,
          phone: loginRes.phone,
          account: loginRes.account,
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

        const redirect = searchParams.get('redirect');
        navigate(redirect ? decodeURIComponent(redirect) : '/v1/dashboard', { replace: true });
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
        await fetchCaptcha();
      }
    } finally {
      setLoading(false);
    }
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
                      onClick={fetchCaptcha}
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
                onClick={() => feedback.message.info('请联系管理员重置密码')}
                style={{ fontSize: 13, color: '#38bdf8' }}
              >
                找回密码
              </a>
            </div>
          </Form>

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
