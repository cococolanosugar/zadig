import React, { useEffect, useState } from 'react';
import {
  App,
  Card,
  Tabs,
  Descriptions,
  Tag,
  Typography,
  Button,
  Space,
  Alert,
  Spin,
  Form,
  Select,
  Input,
  Row,
  Col,
  Switch,
  Upload,
  Image,
} from 'antd';
import {
  SafetyCertificateOutlined,
  SkinOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  UploadOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import enterpriseApi, {
  type EnterpriseLicenseInfo,
  type EnterpriseThemeInfo,
  type Organization,
} from '../../api/enterprise';
import { settingsApi } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

type LogoSlotKey = 'big_light_logo' | 'big_logo' | 'small_logo' | 'favicon';

const LOGO_SLOTS: Array<{
  key: LogoSlotKey;
  label: string;
  hint: string;
}> = [
  { key: 'big_light_logo', label: '浅色 Logo', hint: '建议 200×60' },
  { key: 'big_logo', label: '深色 Logo', hint: '建议 200×60' },
  { key: 'small_logo', label: '折叠态小 Logo', hint: '建议 60×60' },
  { key: 'favicon', label: 'Favicon', hint: '建议 16×16 / 32×32' },
];

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_LOGO_BYTES = 1024 * 1024;

export const EnterprisePage: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/info')) return 'info';
    if (path.endsWith('/theme')) return 'theme';
    if (path.endsWith('/language')) return 'language';
    return 'license';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (key: string) => {
    navigate(`/v1/enterprise/${key}`);
  };

  const [loading, setLoading] = useState(false);
  const [license, setLicense] = useState<EnterpriseLicenseInfo>({});
  const [theme, setTheme] = useState<EnterpriseThemeInfo>({});
  const [themeType, setThemeType] = useState<string>('zadig');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeForm] = Form.useForm();
  const [langForm] = Form.useForm();
  const [orgForm] = Form.useForm();
  const [savingLang, setSavingLang] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [organization, setOrganization] = useState<Organization>({});
  const [logos, setLogos] = useState<Record<LogoSlotKey, string>>({
    big_light_logo: '',
    big_logo: '',
    small_logo: '',
    favicon: '',
  });
  const [themeInitialValues, setThemeInitialValues] = useState<Record<string, any>>({
    theme_type: 'zadig',
    theme_color: '#0066ff',
    theme_background_color: '#f5f7fa',
    theme_border_color: '#ebeef5',
    font_gray: '#1f2d3d',
    font_light_gray: '#8c8c8c',
  });
  const [langInitialValues, setLangInitialValues] = useState<Record<string, any>>({
    defaultLang: 'zh-cn',
    allowUserSwitch: true,
    fallbackLang: 'zh-cn',
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lic, thm, sysLang, org] = await Promise.all([
          enterpriseApi.getLicense(),
          enterpriseApi.getTheme(),
          settingsApi.getSystemLanguage().catch(() => 'zh-cn'),
          enterpriseApi.getOrganization(),
        ]);
        setLicense(lic);
        setTheme(thm);
        setOrganization(org || {});
        setLogos({
          big_light_logo: org?.big_light_logo || '',
          big_logo: org?.big_logo || '',
          small_logo: org?.small_logo || '',
          favicon: org?.favicon || '',
        });
        orgForm.setFieldsValue({
          name: org?.name || '',
          website: org?.website || '',
          copyright_enabled: org?.copyright_enabled !== false,
        });
        const tType = thm.theme_type || 'zadig';
        setThemeType(tType);
        const nextThemeValues = {
          theme_type: tType,
          theme_color: thm.custom_theme?.theme_color || '#0066ff',
          theme_background_color: thm.custom_theme?.theme_background_color || '#f5f7fa',
          theme_border_color: thm.custom_theme?.theme_border_color || '#ebeef5',
          font_gray: thm.custom_theme?.font_gray || '#1f2d3d',
          font_light_gray: thm.custom_theme?.font_light_gray || '#8c8c8c',
        };
        setThemeInitialValues(nextThemeValues);
        const langVal = sysLang?.toLowerCase().includes('en') ? 'en' : 'zh-cn';
        const nextLangValues = {
          defaultLang: langVal,
          allowUserSwitch: true,
          fallbackLang: 'zh-cn',
        };
        setLangInitialValues(nextLangValues);
        localStorage.setItem('zadig_lang', langVal);
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orgForm]);

  useEffect(() => {
    if (activeTab === 'theme') {
      themeForm.setFieldsValue(themeInitialValues);
    } else if (activeTab === 'language') {
      langForm.setFieldsValue(langInitialValues);
    } else if (activeTab === 'info') {
      orgForm.setFieldsValue({
        name: organization.name || '',
        website: organization.website || '',
        copyright_enabled: organization.copyright_enabled !== false,
      });
    }
  }, [activeTab, themeInitialValues, langInitialValues, themeForm, langForm, orgForm, organization]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });

  const makeLogoUploadProps = (slot: LogoSlotKey): UploadProps => ({
    accept: '.jpg,.jpeg,.png,.svg,.ico',
    showUploadList: false,
    beforeUpload: async (file) => {
      const isAllowed =
        ALLOWED_LOGO_TYPES.includes(file.type) ||
        /\.(jpe?g|png|svg|ico)$/i.test(file.name);
      if (!isAllowed) {
        message.error('仅支持 JPG / PNG / SVG / ICO 格式');
        return false;
      }
      if (file.size > MAX_LOGO_BYTES) {
        message.error('图片大小需小于 1MB');
        return false;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setLogos((prev) => ({ ...prev, [slot]: dataUrl }));
        message.success('已加载预览');
      } catch {
        message.error('读取图片失败');
      }
      return false;
    },
  });

  const handleSaveOrganization = async () => {
    setSavingOrg(true);
    try {
      const values = await orgForm.validateFields();
      const payload: Partial<Organization> = {
        ...organization,
        name: values.name,
        website: values.website,
        copyright_enabled: Boolean(values.copyright_enabled),
        big_light_logo: logos.big_light_logo || '',
        big_logo: logos.big_logo || '',
        small_logo: logos.small_logo || '',
        favicon: logos.favicon || '',
      };
      const saved = await enterpriseApi.updateOrganization(payload);
      setOrganization(saved || payload);
      message.success('企业信息与品牌定制已保存');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '保存企业信息失败';
      message.error(msg);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleResetLogos = async () => {
    setSavingOrg(true);
    try {
      const values = await orgForm.validateFields();
      const cleared = {
        big_light_logo: '',
        big_logo: '',
        small_logo: '',
        favicon: '',
      };
      setLogos(cleared);
      const payload: Partial<Organization> = {
        ...organization,
        name: values.name,
        website: values.website,
        copyright_enabled: Boolean(values.copyright_enabled),
        ...cleared,
      };
      const saved = await enterpriseApi.updateOrganization(payload);
      setOrganization(saved || payload);
      message.success('已恢复默认 Logo');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg = err instanceof Error ? err.message : '恢复默认失败';
      message.error(msg);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    try {
      const values = await themeForm.validateFields();
      await enterpriseApi.updateTheme({
        theme_type: values.theme_type,
        custom_theme: {
          ...theme.custom_theme,
          theme_color: values.theme_color,
          theme_background_color: values.theme_background_color,
          theme_border_color: values.theme_border_color,
          font_gray: values.font_gray,
          font_light_gray: values.font_light_gray,
        },
      });
      feedback.message.success('外观主题配置已保存');
    } catch (err: any) {
      if (err?.errorFields) {
        return; // form validation error
      }
      feedback.message.error(err?.response?.data?.message || err?.message || '主题保存失败');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSavingLang(true);
    try {
      const values = await langForm.validateFields();
      const langVal = values.defaultLang?.toLowerCase().includes('en') ? 'en' : 'zh-cn';
      await settingsApi.setSystemLanguage(langVal);
      localStorage.setItem('zadig_system_language', JSON.stringify(values));
      localStorage.setItem('zadig_lang', langVal);
      feedback.message.success('系统语言与多语言策略配置已保存并同步至服务器！');
    } catch (err: any) {
      if (err?.errorFields) return;
      feedback.message.error(err?.response?.data?.message || err?.message || '保存语言设置失败');
    } finally {
      setSavingLang(false);
    }
  };

  const tabItems = [
    {
      key: 'license',
      label: (
        <span>
          <SafetyCertificateOutlined /> 许可证管理 (License)
        </span>
      ),
    },
    {
      key: 'theme',
      label: (
        <span>
          <SkinOutlined /> 主题与品牌定制
        </span>
      ),
    },
    {
      key: 'info',
      label: (
        <span>
          <InfoCircleOutlined /> 基本信息
        </span>
      ),
    },
    {
      key: 'language',
      label: (
        <span>
          <GlobalOutlined /> 语言与国际化
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          企业管理
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          管理企业级授权证书、席位配额、个性化平台品牌与多语言环境配置
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
        ) : activeTab === 'license' ? (() => {
          // R11 任务三: 真实契约映射 — status(normal/active/valid)/expire_at/type 由后端数据驱动
          const normalizedStatus = String(license.status || '').toLowerCase();
          const isLicenseActive = ['normal', 'active', 'valid'].includes(normalizedStatus);
          const rawExpire = license.expire_at ?? license.expire_time;
          const expireMs = rawExpire !== undefined && rawExpire !== null
            ? (Number(rawExpire) > 1e11 ? Number(rawExpire) : Number(rawExpire) * 1000)
            : undefined;
          const isExpired = expireMs !== undefined && !Number.isNaN(expireMs) && expireMs < Date.now();
          const isEffective = isLicenseActive && !isExpired;
          const licenseType = license.type || license.license_type;
          const featureList = Array.isArray(license.features) ? license.features : [];

          return (
            <div style={{ maxWidth: 840 }}>
              {isEffective ? (
                <Alert
                  title="当前环境已成功激活企业级功能授权"
                  description="可使用高并发工作流编排、跨集群微服务发布、多环境自动化隔离以及审计追溯功能。"
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ marginBottom: 24, borderRadius: 6 }}
                />
              ) : isExpired ? (
                <Alert
                  title="企业级功能授权已过期"
                  description="授权证书已超出有效使用期限，部分高并发特性受限，请联系官方商务获取最新证书更新。"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24, borderRadius: 6 }}
                />
              ) : (
                <Alert
                  title="当前运行为社区评估 / 未激活企业特权状态"
                  description="社区开源版本可使用核心持续交付与工作流功能；如需跨集群多租户、交付中心等企业特权，请导入官方 License。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24, borderRadius: 6 }}
                />
              )}

              <Descriptions
                title="授权证书详细信息"
                bordered
                column={1}
                size="middle"
                styles={{ label: { width: 180, fontWeight: 500, backgroundColor: '#fafafa' } }}
                items={[
                  {
                    key: 'company',
                    label: '授权公司 / 实体',
                    children: license.company || '-',
                  },
                  {
                    key: 'status',
                    label: '证书状态',
                    children: isEffective ? (
                      <Tag color="success">正常生效</Tag>
                    ) : isExpired ? (
                      <Tag color="warning">已过期 (Expired)</Tag>
                    ) : (
                      <Tag color="default">未激活 / 社区评估</Tag>
                    ),
                  },
                  {
                    key: 'expire',
                    label: '到期时间',
                    children: expireMs !== undefined && !Number.isNaN(expireMs) ? new Date(expireMs).toLocaleString() : '-',
                  },
                  {
                    key: 'version',
                    label: '版本许可类型',
                    children: (
                      <Tag color={isEffective ? 'geekblue' : 'default'}>
                        {licenseType || 'Zadig Community Edition'}
                      </Tag>
                    ),
                  },
                  {
                    key: 'users',
                    label: '席位与用户上限',
                    children: license.user_limit ? `${license.user_limit} 席位` : '无限制 (Unlimited)',
                  },
                  {
                    key: 'clusters',
                    label: '接入集群上限',
                    children: license.cluster_limit ? `${license.cluster_limit} 集群` : '无限制 (Unlimited)',
                  },
                  {
                    key: 'features',
                    label: '支持企业特性',
                    children: featureList.length > 0 ? (
                      <Space orientation="horizontal" size={[4, 8]} wrap>
                        {featureList.map((f) => (
                          <Tag key={f} color="blue">{f}</Tag>
                        ))}
                      </Space>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                  },
                ]}
              />

              <div style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  onClick={() => feedback.message.info('请联系 KodeRover 官方商务获取更新 License 文件')}
                >
                  更新 License 证书
                </Button>
              </div>
            </div>
          );
        })() : activeTab === 'theme' ? (
          <div style={{ maxWidth: 720 }}>
            <Form form={themeForm} layout="vertical" initialValues={themeInitialValues}>
              <Form.Item name="theme_type" label="主题类型">
                <Select
                  options={[
                    { label: '默认主题 (Zadig)', value: 'zadig' },
                    { label: '暗色主题', value: 'dark' },
                    { label: '自定义主题', value: 'custom' },
                  ]}
                  onChange={setThemeType}
                />
              </Form.Item>

              {themeType === 'custom' && (
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Form.Item name="theme_color" label="主色调 (Primary)">
                      <Input type="color" style={{ height: 32, padding: 2 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="theme_background_color" label="强调背景色">
                      <Input type="color" style={{ height: 32, padding: 2 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="theme_border_color" label="边框色">
                      <Input type="color" style={{ height: 32, padding: 2 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="font_gray" label="主文字色">
                      <Input type="color" style={{ height: 32, padding: 2 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="font_light_gray" label="次要文字色">
                      <Input type="color" style={{ height: 32, padding: 2 }} />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Form>

            <div style={{ marginTop: 24 }}>
              <Button type="primary" loading={savingTheme} onClick={handleSaveTheme}>
                保存主题设置
              </Button>
            </div>
          </div>
        ) : activeTab === 'info' ? (
          <div style={{ maxWidth: 840 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              企业信息与品牌定制
            </Title>
            <Form form={orgForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="企业名称"
                    rules={[{ required: true, message: '请输入企业名称' }]}
                  >
                    <Input placeholder="例如：KodeRover" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="website" label="企业网址">
                    <Input placeholder="例如：https://www.koderover.com" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="copyright_enabled"
                label="登录页版权展示"
                valuePropName="checked"
                extra="关闭后登录页将隐藏版权文案"
              >
                <Switch />
              </Form.Item>

              <Title level={5} style={{ marginTop: 8, marginBottom: 12 }}>
                四维 Logo 定制
              </Title>
              <Row gutter={[16, 16]}>
                {LOGO_SLOTS.map((slot) => (
                  <Col xs={24} sm={12} key={slot.key}>
                    <Card
                      variant="outlined"
                      size="small"
                      title={slot.label}
                      extra={<Text type="secondary">{slot.hint}</Text>}
                    >
                      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                        <div
                          style={{
                            minHeight: 72,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fafafa',
                            borderRadius: 6,
                            border: '1px dashed #d9d9d9',
                            padding: 8,
                          }}
                        >
                          {logos[slot.key] ? (
                            <Image
                              src={logos[slot.key]}
                              alt={slot.label}
                              style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                              preview
                            />
                          ) : (
                            <Text type="secondary">暂无预览，将使用系统默认</Text>
                          )}
                        </div>
                        <Space>
                          <Upload {...makeLogoUploadProps(slot.key)}>
                            <Button icon={<UploadOutlined />}>上传</Button>
                          </Upload>
                          {logos[slot.key] && (
                            <Button
                              onClick={() =>
                                setLogos((prev) => ({ ...prev, [slot.key]: '' }))
                              }
                            >
                              清除
                            </Button>
                          )}
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Space style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingOrg}
                  onClick={handleSaveOrganization}
                >
                  保存设置
                </Button>
                <Button
                  icon={<RedoOutlined />}
                  loading={savingOrg}
                  onClick={handleResetLogos}
                >
                  恢复默认
                </Button>
              </Space>
            </Form>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              全局多语言配置
            </Title>
            <Form
              form={langForm}
              layout="vertical"
              initialValues={langInitialValues}
            >
              <Form.Item name="defaultLang" label="平台默认语言">
                <Select
                  options={[
                    { label: '简体中文 (zh-cn)', value: 'zh-cn' },
                    { label: 'English (en)', value: 'en' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="allowUserSwitch"
                label="允许用户自主切换语言"
                valuePropName="checked"
                extra="若关闭，则所有非管理员用户将强制采用平台默认语言。"
              >
                <Switch />
              </Form.Item>
              <Form.Item name="fallbackLang" label="回退缺失语言 (Fallback)">
                <Select
                  options={[
                    { label: '简体中文 (zh-cn)', value: 'zh-cn' },
                    { label: 'English (en)', value: 'en' },
                  ]}
                />
              </Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingLang}
                onClick={handleSaveLanguage}
              >
                保存多语言配置
              </Button>
            </Form>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnterprisePage;
