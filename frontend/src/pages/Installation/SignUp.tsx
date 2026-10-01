import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Input, Button, Typography, Checkbox, Alert, Carousel, Result, Spin } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  BankOutlined,
  PhoneOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  LineChartOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { installationApi, UserInitializationReq } from '../../api/installation';
import { feedback } from '../../utils/feedback';
import ZadigLogo from '../../components/Brand/ZadigLogo';

const { Title, Text } = Typography;

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
    desc: 'K8s YAML / Helm 统一模板化托管，极大缩短业务微服务接入周期',
    icon: <AppstoreOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '全景效能洞察与度量',
    desc: '交付周期、构建成功率、部署频度全面图表化，让交付瓶颈无所遁形',
    icon: <LineChartOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
  {
    title: '现代化的云原生交付体验',
    desc: '打通云厂商基础设施，为微服务与云原生架构提供坚实底座',
    icon: <RocketOutlined style={{ fontSize: 52, color: '#0066ff' }} />,
  },
];

export const InstallationSignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [checking, setChecking] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    installationApi
      .getStatus()
      .then((res) => {
        setInitialized(Boolean(res?.initialized));
      })
      .catch(() => {
        // 若检查失败（例如已有配置），保守起见按未初始化处理
        setInitialized(false);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  const handleSignUp = async (values: UserInitializationReq) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: UserInitializationReq = {
        username: values.username.trim(),
        password: values.password,
        company: values.company.trim(),
        email: values.email.trim(),
        phone: values.phone ? Number(values.phone) || null : null,
        improvement_plan: values.improvement_plan ?? true,
      };
      await installationApi.initializeUser(payload);
      feedback.message.success('管理员账号注册成功，正在进入版本配置向导');
      navigate('/v1/installation/version');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data?.message ||
        (err as { response?: { data?: { description?: string } } })?.response?.data?.description ||
        '管理员注册失败，请检查网络或配置';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Row style={{ minHeight: '100vh', margin: 0, overflow: 'hidden' }}>
      {/* Left Column: Brand Showcase Banner */}
      <Col
        xs={0}
        md={11}
        lg={10}
        xl={9}
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 40px',
          position: 'relative',
        }}
      >
        <div>
          <div style={{ marginBottom: 32 }}>
            <ZadigLogo />
          </div>
          <Title level={2} style={{ color: '#f8fafc', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: -0.5 }}>
            KodeRover 云原生交付系统
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 15 }}>
            系统初始化向导 · 第一步：创建初始管理员
          </Text>
        </div>

        <div style={{ margin: '40px 0' }}>
          <Carousel autoplay autoplaySpeed={4500} dots={{ className: 'custom-carousel-dots' }}>
            {CAROUSEL_SLIDES.map((slide) => (
              <div key={slide.title} style={{ outline: 'none' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: '32px 24px',
                    textAlign: 'center',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <div style={{ marginBottom: 16 }}>{slide.icon}</div>
                  <Title level={4} style={{ color: '#ffffff', marginBottom: 8 }}>
                    {slide.title}
                  </Title>
                  <Text style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>{slide.desc}</Text>
                </div>
              </div>
            ))}
          </Carousel>
        </div>

        <div>
          <Text style={{ color: '#64748b', fontSize: 12 }}>
            © {new Date().getFullYear()} KodeRover. All rights reserved.
          </Text>
        </div>
      </Col>

      {/* Right Column: Form Section */}
      <Col
        xs={24}
        md={13}
        lg={14}
        xl={15}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '32px 24px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          {checking ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#64748b' }}>检查系统初始化状态...</div>
            </div>
          ) : initialized ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                padding: '40px 36px',
                textAlign: 'center',
              }}
            >
              <Result
                status="info"
                title="系统已完成初始化"
                subTitle="当前环境已存在管理员账号，无需重复初始化。请直接使用已有账号登录。"
                extra={[
                  <Button type="primary" key="login" size="large" onClick={() => navigate('/signin')} style={{ borderRadius: 6, minWidth: 140 }}>
                    前往登录
                  </Button>,
                ]}
              />
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                padding: '40px 36px',
              }}
            >
              <div style={{ marginBottom: 28 }}>
                <Title level={3} style={{ margin: '0 0 6px 0', color: '#0f172a' }}>
                  管理员注册
                </Title>
                <Text style={{ color: '#64748b', fontSize: 13 }}>
                  首次安装 Zadig，请填写初始系统管理员与企业信息
                </Text>
              </div>

              {errorMessage && (
                <Alert
                  description={errorMessage}
                  type="error"
                  showIcon
                  closable={{ onClose: () => setErrorMessage(null) }}
                  style={{ marginBottom: 20, borderRadius: 6 }}
                />
              )}

              <Form
                form={form}
                name="adminSignUpForm"
                layout="vertical"
                size="large"
                onFinish={handleSignUp}
                initialValues={{ improvement_plan: true }}
                requiredMark={false}
              >
                <Form.Item
                  name="username"
                  label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>用户名</span>}
                  rules={[{ required: true, message: '请输入管理员用户名' }]}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入管理员用户名"
                    style={{ height: 42, borderRadius: 6 }}
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>登录密码</span>}
                  rules={[
                    { required: true, message: '请输入密码' },
                    {
                      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                      message: '密码必须包含大小写字母和数字，且长度不小于 8 位',
                    },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入登录密码（至少 8 位包含大小写及数字）"
                    style={{ height: 42, borderRadius: 6 }}
                  />
                </Form.Item>

                <Form.Item
                  name="email"
                  label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>电子邮箱</span>}
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入管理员电子邮箱"
                    style={{ height: 42, borderRadius: 6 }}
                  />
                </Form.Item>

                <Form.Item
                  name="company"
                  label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>企业名称</span>}
                  rules={[{ required: true, message: '请输入企业名称' }]}
                >
                  <Input
                    prefix={<BankOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入企业/团队名称"
                    style={{ height: 42, borderRadius: 6 }}
                  />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>联系电话（选填）</span>}
                >
                  <Input
                    prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                    placeholder="请输入联系电话"
                    style={{ height: 42, borderRadius: 6 }}
                  />
                </Form.Item>

                <Form.Item name="improvement_plan" valuePropName="checked" style={{ marginBottom: 20 }}>
                  <Checkbox>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      加入用户体验改善计划（仅收集匿名系统使用度量）
                    </span>
                  </Checkbox>
                </Form.Item>

                <Form.Item style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    block
                    style={{
                      height: 42,
                      fontSize: 15,
                      fontWeight: 500,
                      borderRadius: 6,
                      backgroundColor: '#0066ff',
                    }}
                  >
                    完成注册并继续
                  </Button>
                </Form.Item>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Link to="/signin" style={{ fontSize: 13, color: '#64748b' }}>
                    已有账号？直接登录
                  </Link>
                </div>
              </Form>
            </div>
          )}
        </div>
      </Col>
    </Row>
  );
};

export default InstallationSignUpPage;
