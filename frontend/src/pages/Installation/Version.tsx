import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Input, Button, Typography, Alert, Carousel, Card, Divider } from 'antd';
import {
  SafetyCertificateOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  LineChartOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { installationApi, InstallationLicenseInfo } from '../../api/installation';
import { feedback } from '../../utils/feedback';
import ZadigLogo from '../../components/Brand/ZadigLogo';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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

export const InstallationVersionPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [licenseInfo, setLicenseInfo] = useState<InstallationLicenseInfo>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    installationApi
      .getLicenseInfo()
      .then((info) => setLicenseInfo(info || {}))
      .catch(() => setLicenseInfo({}));
  }, []);

  const handleActivateLicense = async (values: { license: string }) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await installationApi.createLicense({ license: values.license.trim() });
      feedback.message.success('企业许可证激活成功，系统已完成初始化！');
      navigate('/signin', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data?.message ||
        '许可证激活失败，请检查密钥是否有效';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    feedback.message.info('已选择开源社区版，后续可在企业管理中绑定许可证');
    navigate('/signin', { replace: true });
  };

  return (
    <Row style={{ minHeight: '100vh', margin: 0, overflow: 'hidden' }}>
      {/* Left Column: Brand Banner */}
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
            系统初始化向导 · 第二步：版本与许可证设置
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
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              padding: '40px 36px',
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <Title level={3} style={{ margin: '0 0 6px 0', color: '#0f172a' }}>
                版本与许可证配置
              </Title>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                系统初始管理员已就绪。如果您持有企业版许可证，可在此完成激活；也可直接进入开源社区版体验。
              </Text>
            </div>

            {licenseInfo.system_id && (
              <Card
                size="small"
                variant="borderless"
                style={{ backgroundColor: '#f1f5f9', borderRadius: 8, marginBottom: 20 }}
              >
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>当前系统 ID (System ID)：</div>
                <Paragraph copyable style={{ margin: 0, fontFamily: 'monospace', fontSize: 13, color: '#0f172a' }}>
                  {licenseInfo.system_id}
                </Paragraph>
              </Card>
            )}

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
              name="licenseForm"
              layout="vertical"
              size="large"
              onFinish={handleActivateLicense}
              requiredMark={false}
            >
              <Form.Item
                name="license"
                label={<span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>企业许可证密钥 (License Token)</span>}
                rules={[{ required: true, message: '请输入许可证密钥' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="请粘贴您的企业版许可证密钥文本..."
                  style={{ borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<SafetyCertificateOutlined />}
                  block
                  style={{
                    height: 42,
                    fontSize: 15,
                    fontWeight: 500,
                    borderRadius: 6,
                    backgroundColor: '#0066ff',
                  }}
                >
                  激活企业许可证并进入系统
                </Button>
              </Form.Item>

              <Divider style={{ margin: '20px 0' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>或</span>
              </Divider>

              <Button
                block
                onClick={handleSkip}
                style={{
                  height: 42,
                  fontSize: 14,
                  borderRadius: 6,
                  color: '#475569',
                }}
              >
                跳过，使用开源社区版
              </Button>
            </Form>
          </div>
        </div>
      </Col>
    </Row>
  );
};

export default InstallationVersionPage;
