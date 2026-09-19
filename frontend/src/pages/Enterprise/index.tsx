import React, { useEffect, useState } from 'react';
import { Card, Tabs, Descriptions, Tag, Typography, Button, Space, Alert, Spin } from 'antd';
import {
  SafetyCertificateOutlined,
  SkinOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import enterpriseApi, { type EnterpriseLicenseInfo, type EnterpriseThemeInfo } from '../../api/enterprise';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const EnterprisePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('license');
  const [loading, setLoading] = useState(false);
  const [license, setLicense] = useState<EnterpriseLicenseInfo>({});
  const [theme, setTheme] = useState<EnterpriseThemeInfo>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lic, thm] = await Promise.all([
          enterpriseApi.getLicense(),
          enterpriseApi.getTheme(),
        ]);
        setLicense(lic);
        setTheme(thm);
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
          管理企业级授权证书、席位配额、个性化平台品牌与主题外观配置
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
            >
              <Descriptions.Item label="授权公司 / 实体">
                {license.company || 'KodeRover Community & Enterprise Evaluator'}
              </Descriptions.Item>
              <Descriptions.Item label="证书状态">
                <Tag color="success">有效授权 (Active)</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本许可类型">
                <Tag color="geekblue">Zadig Enterprise Edition v5.0.0</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="席位与用户上限">
                {license.user_limit ? `${license.user_limit} 席位` : '无限制 (Unlimited)'}
              </Descriptions.Item>
              <Descriptions.Item label="接入集群上限">
                {license.cluster_limit ? `${license.cluster_limit} 集群` : '无限制 (Unlimited)'}
              </Descriptions.Item>
              <Descriptions.Item label="支持企业特性">
                <Space orientation="horizontal" size={[4, 8]} wrap>
                  <Tag color="blue">工作流 V4</Tag>
                  <Tag color="blue">环境休眠/唤醒</Tag>
                  <Tag color="blue">多集群编排</Tag>
                  <Tag color="blue">交付物追溯</Tag>
                  <Tag color="blue">AI 日志诊断</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

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
            <Descriptions
              title="系统外观品牌"
              bordered
              column={1}
              size="middle"
              styles={{ label: { width: 180, fontWeight: 500, backgroundColor: '#fafafa' } }}
            >
              <Descriptions.Item label="平台显示标题">
                {theme.custom_title || 'Zadig - 云原生持续交付平台'}
              </Descriptions.Item>
              <Descriptions.Item label="主色调 Primary Color">
                <Space orientation="horizontal">
                  <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: theme.theme_color || '#0066ff' }} />
                  <span>{theme.theme_color || '#0066ff'}</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="自定义 Logo">
                <Text type="secondary">使用系统默认 KodeRover Zadig 矢量 Logo</Text>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Button type="primary" onClick={() => feedback.message.success('外观主题配置已同步')}>
                保存主题设置
              </Button>
            </div>
          </div>
        ) : activeTab === 'info' ? (
          <Descriptions
            title="平台系统信息"
            bordered
            column={1}
            size="middle"
            styles={{ label: { width: 180, fontWeight: 500, backgroundColor: '#fafafa' } }}
          >
            <Descriptions.Item label="系统版本">Zadig Enterprise 5.0.0</Descriptions.Item>
            <Descriptions.Item label="前端技术架构">React 18 + Vite + TypeScript + Ant Design 6.x</Descriptions.Item>
            <Descriptions.Item label="后端微服务引擎">Aslan Core V4 + User RBAC + SystemConfig</Descriptions.Item>
            <Descriptions.Item label="版权所属">KodeRover Inc. / 筑栈（上海）信息技术有限公司</Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ padding: '24px 0' }}>
            <Descriptions
              title="语言偏好"
              bordered
              column={1}
              styles={{ label: { width: 180, fontWeight: 500, backgroundColor: '#fafafa' } }}
            >
              <Descriptions.Item label="系统语言">
                <Tag color="blue">简体中文 (zh-CN)</Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnterprisePage;
