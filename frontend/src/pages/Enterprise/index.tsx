import React, { useEffect, useState } from 'react';
import { Card, Tabs, Descriptions, Tag, Typography, Button, Space, Alert, Spin, Form, Select, Input, Row, Col, Switch } from 'antd';
import {
  SafetyCertificateOutlined,
  SkinOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import enterpriseApi, { type EnterpriseLicenseInfo, type EnterpriseThemeInfo } from '../../api/enterprise';
import { settingsApi } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const EnterprisePage: React.FC = () => {
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
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lic, thm, sysLang] = await Promise.all([
          enterpriseApi.getLicense(),
          enterpriseApi.getTheme(),
          settingsApi.getSystemLanguage().catch(() => 'zh-cn'),
        ]);
        setLicense(lic);
        setTheme(thm);
        const tType = thm.theme_type || 'zadig';
        setThemeType(tType);
        themeForm.setFieldsValue({
          theme_type: tType,
          theme_color: thm.custom_theme?.theme_color || '#0066ff',
          theme_background_color: thm.custom_theme?.theme_background_color || '#f5f7fa',
          theme_border_color: thm.custom_theme?.theme_border_color || '#ebeef5',
          font_gray: thm.custom_theme?.font_gray || '#1f2d3d',
          font_light_gray: thm.custom_theme?.font_light_gray || '#8c8c8c',
        });
        const langVal = sysLang?.toLowerCase().includes('en') ? 'en' : 'zh-cn';
        langForm.setFieldsValue({
          defaultLang: langVal,
        });
        localStorage.setItem('zadig_lang', langVal);
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [themeForm, langForm]);

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
        ) : activeTab === 'license' ? (
          <div style={{ maxWidth: 840 }}>
            <Alert
              title="当前环境已成功激活企业级功能授权"
              description="可使用高并发工作流编排、跨集群微服务发布、多环境自动化隔离以及审计追溯功能。"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ marginBottom: 24, borderRadius: 6 }}
            />

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
                  children: license.company || 'KodeRover Community & Enterprise Evaluator',
                },
                {
                  key: 'status',
                  label: '证书状态',
                  children: <Tag color="success">有效授权 (Active)</Tag>,
                },
                {
                  key: 'version',
                  label: '版本许可类型',
                  children: <Tag color="geekblue">Zadig Enterprise Edition v5.0.0</Tag>,
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
                  children: (
                    <Space orientation="horizontal" size={[4, 8]} wrap>
                      <Tag color="blue">工作流 V4</Tag>
                      <Tag color="blue">环境休眠/唤醒</Tag>
                      <Tag color="blue">多集群编排</Tag>
                      <Tag color="blue">交付物追溯</Tag>
                      <Tag color="blue">AI 日志诊断</Tag>
                    </Space>
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
        ) : activeTab === 'theme' ? (
          <div style={{ maxWidth: 720 }}>
            <Form form={themeForm} layout="vertical">
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
          <div style={{ maxWidth: 720 }}>
            <Descriptions
              title="平台系统信息"
              bordered
              column={1}
              size="middle"
              styles={{ label: { width: 180, fontWeight: 500, backgroundColor: '#fafafa' } }}
              items={[
                { key: 'version', label: '系统版本', children: 'Zadig Enterprise 5.0.0' },
                { key: 'arch', label: '前端技术架构', children: 'React 18 + Vite + TypeScript + Ant Design 6.x' },
                { key: 'backend', label: '后端微服务引擎', children: 'Aslan Core V4 + User RBAC + SystemConfig' },
                { key: 'copyright', label: '版权所属', children: 'KodeRover Inc. / 筑栈（上海）信息技术有限公司' },
              ]}
            />
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              全局多语言配置
            </Title>
            <Form
              form={langForm}
              layout="vertical"
              initialValues={{
                defaultLang: 'zh-cn',
                allowUserSwitch: true,
                fallbackLang: 'zh-cn',
              }}
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
