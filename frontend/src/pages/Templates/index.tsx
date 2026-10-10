import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Tag, Typography, Button, Space, Input, Row, Col, Spin, Empty, Badge, Drawer, Tooltip, Modal, Form, Popconfirm } from 'antd';
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
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import templateApi, {
  type WorkflowTemplateItem,
  type WorkflowTemplateI18n,
  type YamlTemplateItem,
  type DockerfileTemplateItem,
  type ChartTemplateItem,
  type BuildTemplateItem,
  type ScannerTemplateItem,
  templateCrudApi,
} from '../../api/template';
import { feedback } from '../../utils/feedback';

const { Title, Text, Paragraph } = Typography;

export const TemplateCenterPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegment = location.pathname.split('/')[3];
  const initialTab = tab || pathSegment || searchParams.get('tab') || 'k8s-yamls';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const current = tab || pathSegment || searchParams.get('tab');
    if (current) {
      setActiveTab(current);
    }
  }, [tab, pathSegment, searchParams]);

  const handleTabChange = (k: string) => {
    setActiveTab(k);
    navigate(`/v1/template/${k}`);
  };
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  // 模板内容查看抽屉（对齐旧版「查看内容」）
  const [viewing, setViewing] = useState<{ title: string; content: string; variables?: Array<{ key: string; value?: string }> } | null>(null);
  const [viewingWorkflow, setViewingWorkflow] = useState<WorkflowTemplateItem | null>(null);

  // 模板新建/编辑（YAML 与 Dockerfile 模板为内容型，可完整 CRUD；Chart/构建/扫描模板由各自模块维护）
  const [editing, setEditing] = useState<
    | { kind: 'yaml'; id?: string; name: string; content: string }
    | { kind: 'dockerfile'; id?: string; name: string; content: string }
    | null
  >(null);
  const [editingForm] = Form.useForm();
  const [editingSaving, setEditingSaving] = useState(false);

  const openCreateTemplate = () => {
    const kind = activeTab === 'dockerfiles' ? 'dockerfile' : activeTab === 'k8s-yamls' ? 'yaml' : null;
    if (!kind) {
      feedback.message.info('该类模板由对应功能模块内创建（服务/构建/扫描配置保存后自动收录）');
      return;
    }
    setEditing({ kind, name: '', content: '' });
    editingForm.setFieldsValue({ name: '', content: '' });
  };

  const openEditTemplate = (kind: 'yaml' | 'dockerfile', id: string, name: string, content: string) => {
    setEditing({ kind, id, name, content });
    editingForm.setFieldsValue({ name, content });
  };

  const handleSaveEditing = async () => {
    if (!editing) return false;
    try {
      const values = await editingForm.validateFields();
      setEditingSaving(true);
      if (editing.kind === 'yaml') {
        if (editing.id) {
          await templateCrudApi.updateYamlTemplate(editing.id, { name: values.name, content: values.content });
        } else {
          await templateCrudApi.createYamlTemplate({ name: values.name, content: values.content });
        }
      } else if (editing.id) {
        await templateCrudApi.updateDockerfileTemplate(editing.id, { name: values.name, content: values.content });
      } else {
        await templateCrudApi.createDockerfileTemplate({ name: values.name, content: values.content });
      }
      feedback.message.success('模板已保存（保存时自动提取变量）');
      setEditing(null);
      // 重新拉取当前 tab 列表
      if (editing.kind === 'yaml') {
        templateApi.getYamlTemplates().then((res) => setYamlTemplates(res.yaml_template || []));
      } else {
        templateApi.getDockerfileTemplates().then((res) => setDockerfileTemplates(res.dockerfile_template || []));
      }
      return true;
    } catch {
      return false;
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDeleteYamlTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteYamlTemplate(id);
      feedback.message.success('模板已删除');
      setYamlTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      feedback.message.error('删除失败（可能仍被服务引用）');
    }
  };

  const handleDeleteDockerfileTemplate = async (id: string) => {
    try {
      await templateCrudApi.deleteDockerfileTemplate(id);
      feedback.message.success('模板已删除');
      setDockerfileTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      feedback.message.error('删除失败（可能仍被服务引用）');
    }
  };

  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [i18nMap, setI18nMap] = useState<Record<string, WorkflowTemplateI18n>>({});
  const [yamlTemplates, setYamlTemplates] = useState<YamlTemplateItem[]>([]);
  const [dockerfileTemplates, setDockerfileTemplates] = useState<DockerfileTemplateItem[]>([]);
  const [chartTemplates, setChartTemplates] = useState<ChartTemplateItem[]>([]);
  const [buildTemplates, setBuildTemplates] = useState<BuildTemplateItem[]>([]);
  const [scannerTemplates, setScannerTemplates] = useState<ScannerTemplateItem[]>([]);
  const [releasePlanTemplates, setReleasePlanTemplates] = useState<Array<{ id: string; name: string; description?: string; update_time?: number }>>([]);

  // Load workflow + yaml templates once (workflow list is also used for search header)
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

  // Lazily load the active tab's template list
  useEffect(() => {
    if (activeTab === 'dockerfiles') {
      templateApi.getDockerfileTemplates().then((res) => setDockerfileTemplates(res.dockerfile_template || []));
    } else if (activeTab === 'charts') {
      templateApi.getChartTemplates().then((res) => setChartTemplates(res.chartTemplates || []));
    } else if (activeTab === 'builds') {
      templateApi.getBuildTemplates().then((res) => setBuildTemplates(res.build_templates || []));
    } else if (activeTab === 'scanners') {
      templateApi.getScannerTemplates().then((res) => setScannerTemplates(res.scanning_templates || []));
    } else if (activeTab === 'releasePlan') {
      templateApi.getReleasePlanTemplates().then((res) => setReleasePlanTemplates(res));
    }
  }, [activeTab]);

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
      key: 'k8s-yamls',
      label: (
        <span>
          <FileTextOutlined /> Kubernetes YAML 模板库
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
      key: 'dockerfiles',
      label: (
        <span>
          <ContainerOutlined /> Dockerfile 模板库
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
    {
      key: 'workflows',
      label: (
        <span>
          <BranchesOutlined /> 工作流模板库
        </span>
      ),
    },
    {
      key: 'releasePlan',
      label: (
        <span>
          <RocketOutlined /> 发布计划模板库
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
          <Tooltip title="YAML / Dockerfile 模板可直接新建；其余模板由对应功能模块维护">
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }} onClick={openCreateTemplate}>
              新建模板
            </Button>
          </Tooltip>
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
          onChange={handleTabChange}
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
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0 }}
                          onClick={() => setViewingWorkflow(item)}
                        >
                          查看编排详情
                        </Button>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        ) : activeTab === 'k8s-yamls' ? (
          <Table
            dataSource={yamlTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              { title: '模板标识', dataIndex: 'name', key: 'name' },
              { title: '变量定义', dataIndex: 'variables', key: 'variables', render: (_, r) => <Text type="secondary">{r.variables?.length || 0} 个变量</Text> },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              { title: '操作', key: 'action', render: (_, r: YamlTemplateItem) => (
                <Space size={0}>
                  <Button type="link" onClick={() => setViewing({ title: r.name, content: r.content || '', variables: r.variables })}>
                    查看内容
                  </Button>
                  {r.id && (
                    <>
                      <Button type="link" onClick={() => openEditTemplate('yaml', r.id as string, r.name, r.content || '')}>
                        编辑
                      </Button>
                      <Popconfirm title={`确定删除模板 [${r.name}]？`} onConfirm={() => handleDeleteYamlTemplate(r.id as string)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ) },
            ]}
            locale={{
              emptyText: <Empty description="暂无该分类模板数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'dockerfiles' ? (
          <Table
            dataSource={dockerfileTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <ContainerOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '内容预览',
                dataIndex: 'content',
                key: 'content',
                ellipsis: true,
                render: (content: string | undefined) => (
                  <Text code style={{ fontSize: 12 }}>{String(content || '').slice(0, 120) || '-'}</Text>
                ),
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
              { title: '操作', key: 'action', render: (_, r: DockerfileTemplateItem) => (
                <Space size={0}>
                  <Button type="link" onClick={() => setViewing({ title: r.name, content: r.content || '' })}>
                    查看内容
                  </Button>
                  {r.id && (
                    <>
                      <Button type="link" onClick={() => openEditTemplate('dockerfile', r.id as string, r.name, r.content || '')}>
                        编辑
                      </Button>
                      <Popconfirm title={`确定删除模板 [${r.name}]？`} onConfirm={() => handleDeleteDockerfileTemplate(r.id as string)}>
                        <Button type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ) },
            ]}
            locale={{
              emptyText: <Empty description="暂无 Dockerfile 模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'charts' ? (
          <Table
            dataSource={chartTemplates}
            rowKey={(r) => `${r.repo_name || ''}-${r.name || r.chart_name || ''}`}
            columns={[
              {
                title: 'Chart 名称',
                key: 'name',
                render: (_, r) => (
                  <Space orientation="horizontal">
                    <AppstoreOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{r.name || r.chart_name || '-'}</Text>
                  </Space>
                ),
              },
              { title: '所属仓库', dataIndex: 'repo_name', key: 'repo_name', render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag> },
              { title: '版本', dataIndex: 'version', key: 'version', render: (t) => <Tag color="blue">{String(t || '-')}</Tag> },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无 Helm Chart 模板，请先在资源配置中接入 Chart 仓库" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'builds' ? (
          <Table
            dataSource={buildTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <ToolOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '构建脚本预览',
                dataIndex: 'scripts',
                key: 'scripts',
                ellipsis: true,
                render: (scripts: string | undefined) => (
                  <Text code style={{ fontSize: 12 }}>{String(scripts || '').slice(0, 120) || '-'}</Text>
                ),
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无构建模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : activeTab === 'scanners' ? (
          <Table
            dataSource={scannerTemplates}
            rowKey={(r) => r.id || r.name}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <SafetyCertificateOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
              {
                title: '启用状态',
                dataIndex: 'enable',
                key: 'enable',
                render: (enabled: boolean | undefined) =>
                  enabled === false ? <Tag color="default">停用</Tag> : <Tag color="success">启用</Tag>,
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无代码扫描模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        ) : (
          <Table
            rowKey={(r: any) => r.id || r.name}
            dataSource={releasePlanTemplates}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <RocketOutlined style={{ color: '#0066ff' }} />
                    <Text strong>{name}</Text>
                  </Space>
                ),
              },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (t) => <Text type="secondary">{String(t || '-')}</Text>,
              },
              {
                title: '更新时间',
                dataIndex: 'update_time',
                key: 'update_time',
                render: (t: number | undefined) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无发布计划模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>

      {/* 模板新建/编辑（YAML / Dockerfile） */}
      <Modal
        title={`${editing?.id ? '编辑' : '新建'}${editing?.kind === 'dockerfile' ? 'Dockerfile' : 'K8s YAML'}模板`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSaveEditing}
        okText="保存"
        cancelText="取消"
        width={720}
        confirmLoading={editingSaving}
        destroyOnHidden
      >
        <Form form={editingForm} layout="vertical">
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="模板唯一标识" />
          </Form.Item>
          <Form.Item
            name="content"
            label={editing?.kind === 'dockerfile' ? 'Dockerfile 内容' : 'K8s YAML 内容（{{.变量}} 语法自动提取为模板变量）'}
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <Input.TextArea
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              placeholder={
                editing?.kind === 'dockerfile'
                  ? 'FROM {{.base_image}}\n...'
                  : 'apiVersion: apps/v1\nkind: Deployment\n...\nspec:\n  template:\n    spec:\n      containers:\n      - image: {{.image_name}}'
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Content View Drawer (k8s-yamls / dockerfiles) */}
      <Drawer
        title={`模板内容: ${viewing?.title || ''}`}
        placement="right"
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="large"
      >
        {viewing && (
          <div>
            {viewing.variables && viewing.variables.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>变量定义</Text>
                <Space orientation="horizontal" size={4} wrap>
                  {viewing.variables.map((v) => (
                    <Tag key={v.key} color="geekblue">{v.key}</Tag>
                  ))}
                </Space>
              </div>
            )}
            <pre
              style={{
                background: '#f5f7fa',
                padding: 16,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 520,
                overflow: 'auto',
              }}
            >
              {viewing.content || '（无内容）'}
            </pre>
          </div>
        )}
      </Drawer>

      {/* Workflow Template Orchestration View Drawer */}
      <Drawer
        title={`编排详情: ${viewingWorkflow ? i18nMap[viewingWorkflow.template_name]?.name_zh || viewingWorkflow.template_name : ''}`}
        placement="right"
        open={!!viewingWorkflow}
        onClose={() => setViewingWorkflow(null)}
        size="large"
      >
        {viewingWorkflow && (
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {viewingWorkflow.description || i18nMap[viewingWorkflow.template_name]?.description_zh || ''}
            </Text>
            <Tabs
              items={[
                {
                  key: 'stages',
                  label: '编排阶段',
                  children: (
                    <Table
                      dataSource={viewingWorkflow.stages || []}
                      rowKey={(s, i) => `${s}-${i}`}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '阶段', dataIndex: 'stages', key: 'stage', render: (s) => <Tag color="geekblue">{String(s).replace(/^stage-\d+-/, '')}</Tag> },
                      ]}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段信息" /> }}
                    />
                  ),
                },
                {
                  key: 'details',
                  label: '阶段明细',
                  children: (
                    <Table
                      dataSource={viewingWorkflow.stage_details || []}
                      rowKey={(s, i) => `${s.name}-${i}`}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '阶段名', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{String(n)}</Text> },
                        {
                          title: '任务列表',
                          dataIndex: 'jobs',
                          key: 'jobs',
                          render: (_, r) => (
                            <Space orientation="horizontal" size={4} wrap>
                              {(r.jobs || []).map((j) => (
                                <Tag key={j.name} color="blue">{`${j.name} (${j.job_type})`}</Tag>
                              ))}
                            </Space>
                          ),
                        },
                      ]}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段明细" /> }}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default TemplateCenterPage;
