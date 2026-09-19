import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Tag, Typography, Button, Space, Input, Row, Col, Spin, Empty, Badge } from 'antd';
import {
  AppstoreOutlined,
  BranchesOutlined,
  FileTextOutlined,
  ContainerOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import templateApi, { type WorkflowTemplateItem, type WorkflowTemplateI18n } from '../../api/template';

const { Title, Text, Paragraph } = Typography;

export const TemplateCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workflows');
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [i18nMap, setI18nMap] = useState<Record<string, WorkflowTemplateI18n>>({});
  const [yamlTemplates, setYamlTemplates] = useState<unknown[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const [wfRes, yamlRes] = await Promise.all([
          templateApi.getWorkflowTemplates(),
          templateApi.getYamlTemplates(),
        ]);

        setWorkflowTemplates(wfRes.workflow_templates || []);
        if (wfRes.build_in_workflow_template_i18ns) {
          const map: Record<string, WorkflowTemplateI18n> = {};
          wfRes.build_in_workflow_template_i18ns.forEach((item) => {
            map[item.name_key] = item;
          });
          setI18nMap(map);
        }

        setYamlTemplates(yamlRes.yaml_template || []);
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const filteredWorkflows = workflowTemplates.filter((item) => {
    const i18n = i18nMap[item.template_name];
    const name = i18n?.name_zh || item.template_name;
    const desc = i18n?.description_zh || item.description || '';
    if (!searchText) return true;
    return (
      name.toLowerCase().includes(searchText.toLowerCase()) ||
      desc.toLowerCase().includes(searchText.toLowerCase()) ||
      item.template_name.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const tabItems = [
    {
      key: 'workflows',
      label: (
        <span>
          <BranchesOutlined /> 工作流模板库
        </span>
      ),
    },
    {
      key: 'k8s-yamls',
      label: (
        <span>
          <FileTextOutlined /> Kubernetes YAML 模板库
        </span>
      ),
    },
    {
      key: 'dockerfiles',
      label: (
        <span>
          <ContainerOutlined /> Dockerfile 模板库
        </span>
      ),
    },
    {
      key: 'charts',
      label: (
        <span>
          <AppstoreOutlined /> Helm Chart 模板库
        </span>
      ),
    },
    {
      key: 'builds',
      label: (
        <span>
          <ToolOutlined /> 构建模板库
        </span>
      ),
    },
    {
      key: 'scanners',
      label: (
        <span>
          <SafetyCertificateOutlined /> 代码扫描模板库
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            模板库
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            规范化交付资产库，沉淀开箱即用的构建、部署、测试及工作流蓝图
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索模板"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }}>
            新建模板
          </Button>
        </Space>
      </div>

      {/* Main Tabs Container */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={(k) => setActiveTab(k)}
          tabBarStyle={{ marginBottom: 20 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : activeTab === 'workflows' ? (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 15 }}>
                系统内置工作流模板 ({filteredWorkflows.length})
              </Text>
            </div>

            <Row gutter={[16, 16]}>
              {filteredWorkflows.map((item) => {
                const i18n = i18nMap[item.template_name];
                const displayName = i18n?.name_zh || item.template_name;
                const desc = i18n?.description_zh || item.description || '沉淀企业最佳交付编排流水线';
                const stages = item.stages || [];

                return (
                  <Col xs={24} md={12} lg={8} key={item.id}>
                    <Card
                      hoverable
                      variant="borderless"
                      style={{
                        borderRadius: 8,
                        border: '1px solid #ebeef5',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      styles={{
                        body: {
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: 20,
                        },
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <Space orientation="horizontal" size={8}>
                            <RocketOutlined style={{ color: '#0066ff', fontSize: 18 }} />
                            <Text strong style={{ fontSize: 15, color: '#1f2d3d' }}>
                              {displayName}
                            </Text>
                          </Space>
                          {item.build_in && <Badge count="内置" style={{ backgroundColor: '#52c41a' }} />}
                        </div>

                        <Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ fontSize: 12, lineHeight: 1.6, minHeight: 38, marginBottom: 16 }}
                        >
                          {desc}
                        </Paragraph>

                        <div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                            流水线阶段 ({stages.length})
                          </Text>
                          <Space orientation="horizontal" size={[4, 6]} wrap>
                            {stages.map((stage, sIdx) => (
                              <Tag key={sIdx} color="geekblue" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                                {stage.replace(/^stage-\d+-/, '')}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      </div>

                      <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="link" size="small" style={{ padding: 0 }}>
                          基于模板创建工作流
                        </Button>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        ) : (
          <Table
            dataSource={yamlTemplates}
            columns={[
              { title: '模板标识', dataIndex: 'name', key: 'name' },
              { title: '变量定义', dataIndex: 'variables', key: 'variables', render: () => '-' },
              { title: '更新时间', dataIndex: 'update_time', key: 'update_time', render: () => '-' },
              { title: '操作', key: 'action', render: () => <Button type="link">查看内容</Button> },
            ]}
            locale={{
              emptyText: <Empty description="暂无该分类模板数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default TemplateCenterPage;
