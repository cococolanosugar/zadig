import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Layout,
  Menu,
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Button,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  BankOutlined,
  CloudServerOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  TeamOutlined,
  SettingOutlined,
  DatabaseOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import templateApi, {
  type WorkflowTemplateI18n,
  type WorkflowTemplateItem,
} from '../../api/template';
import { feedback } from '../../utils/feedback';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

export type WorkflowTemplateCategoryId =
  | 'createWorkflow'
  | 'enterpriseTemplate'
  | 'serviceDeployment'
  | 'testAndSecurity'
  | 'productionRelease'
  | 'projectCollaboration'
  | 'configChanges'
  | 'dataChanges';

const BUILTIN_CATEGORY_ORDER: Array<{
  id: WorkflowTemplateCategoryId;
  name: string;
  icon: React.ReactNode;
  templateKeys: string[];
}> = [
  {
    id: 'serviceDeployment',
    name: '服务部署',
    icon: <CloudServerOutlined />,
    templateKeys: [
      'single-environment-multi-service-update',
      'multi-environment-multi-service-update',
      'online-service',
      'offline-service',
    ],
  },
  {
    id: 'testAndSecurity',
    name: '测试及安全',
    icon: <SafetyCertificateOutlined />,
    templateKeys: [
      'api-test',
      'e2e-test',
      'static-code-scanning',
      'dynamic-security-scanning',
    ],
  },
  {
    id: 'productionRelease',
    name: '生产发布',
    icon: <RocketOutlined />,
    templateKeys: [
      'chart-deployment',
      'multi-stage-gray-release',
      'blue-green-release',
      'canary-release',
      'istio-release',
      'mse-release',
    ],
  },
  {
    id: 'projectCollaboration',
    name: '项目协同',
    icon: <TeamOutlined />,
    templateKeys: ['jira-issue-status-change', 'lark-issue-status-change'],
  },
  {
    id: 'configChanges',
    name: '配置变更',
    icon: <SettingOutlined />,
    templateKeys: ['nacos-configuration-change', 'apollo-configuration-change'],
  },
  {
    id: 'dataChanges',
    name: '数据变更',
    icon: <DatabaseOutlined />,
    templateKeys: ['sql-data-and-business-change', 'dms-data-change-and-service-upgrade'],
  },
];

export interface WorkflowTemplateModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  viewName?: string;
}

interface DisplayTemplate {
  id: string;
  template_name: string;
  description: string;
  stages: string[];
  build_in: boolean;
  raw_name: string;
}

function localizeTemplate(
  item: WorkflowTemplateItem,
  i18ns: WorkflowTemplateI18n[]
): DisplayTemplate {
  const i18n = i18ns.find((x) => x.name_key === item.template_name);
  const stageNames =
    i18n?.stages?.map((s) => s.name_zh) ||
    item.stages ||
    item.stage_details?.map((s) => s.name) ||
    [];
  return {
    id: item.id,
    raw_name: item.template_name,
    template_name: i18n?.name_zh || item.template_name,
    description: i18n?.description_zh || item.description || '',
    stages: stageNames,
    build_in: Boolean(item.build_in),
  };
}

export const WorkflowTemplateModal: React.FC<WorkflowTemplateModalProps> = ({
  open,
  onClose,
  projectName,
  viewName = '',
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<WorkflowTemplateCategoryId>('createWorkflow');
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [i18ns, setI18ns] = useState<WorkflowTemplateI18n[]>([]);

  const loadTemplates = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const res = await templateApi.getWorkflowTemplates({
        excludeBuildIn: false,
        projectName,
      });
      setTemplates(res.workflow_templates || []);
      setI18ns(res.build_in_workflow_template_i18ns || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取工作流模板失败';
      feedback.message.error(msg);
      setTemplates([]);
      setI18ns([]);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    if (open) {
      setActiveCategory('createWorkflow');
      loadTemplates();
    }
  }, [open, loadTemplates]);

  const buildInByName = useMemo(() => {
    const map = new Map<string, WorkflowTemplateItem>();
    templates.filter((t) => t.build_in).forEach((t) => map.set(t.template_name, t));
    return map;
  }, [templates]);

  const enterpriseTemplates = useMemo(
    () =>
      templates
        .filter((t) => !t.build_in)
        .map((t) => localizeTemplate(t, i18ns)),
    [templates, i18ns]
  );

  const categoryTemplates = useMemo(() => {
    if (activeCategory === 'enterpriseTemplate') return enterpriseTemplates;
    if (activeCategory === 'createWorkflow') return [];
    const group = BUILTIN_CATEGORY_ORDER.find((g) => g.id === activeCategory);
    if (!group) return [];
    return group.templateKeys
      .map((key) => buildInByName.get(key))
      .filter((t): t is WorkflowTemplateItem => Boolean(t))
      .map((t) => localizeTemplate(t, i18ns));
  }, [activeCategory, enterpriseTemplates, buildInByName, i18ns]);

  const buildCreateLink = (tplId?: string, strongBind = false) => {
    const params = new URLSearchParams();
    params.set('projectName', projectName);
    if (viewName) params.set('viewName', viewName);
    if (tplId) params.set('id', tplId);
    if (strongBind) params.set('templateBinding', 'true');
    return `/v1/projects/detail/${projectName}/pipelines/custom/create?${params.toString()}`;
  };

  const goBlank = () => {
    onClose();
    navigate(buildCreateLink());
  };

  const goTemplate = (tpl: DisplayTemplate, strongBind = false) => {
    onClose();
    navigate(buildCreateLink(tpl.id, strongBind));
  };

  const menuItems = [
    {
      key: 'createWorkflow',
      icon: <PlusOutlined />,
      label: '新建工作流',
    },
    {
      key: 'enterpriseTemplate',
      icon: <BankOutlined />,
      label: '企业模板',
    },
    ...BUILTIN_CATEGORY_ORDER.map((g) => ({
      key: g.id,
      icon: g.icon,
      label: g.name,
    })),
  ];

  return (
    <Modal
      title="选择工作流模板"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width="78%"
      styles={{ body: { padding: 0, minHeight: 520 } }}
    >
      <Layout style={{ background: '#fff', minHeight: 520 }}>
        <Sider width={220} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeCategory]}
            items={menuItems}
            onClick={({ key }) => {
              const id = key as WorkflowTemplateCategoryId;
              if (id === 'createWorkflow') {
                goBlank();
                return;
              }
              setActiveCategory(id);
            }}
            style={{ borderInlineEnd: 'none', height: '100%' }}
          />
        </Sider>
        <Content style={{ padding: 20 }}>
          <Spin spinning={loading}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              {/* 置顶空白工作流卡片 */}
              <Card
                hoverable
                variant="outlined"
                onClick={goBlank}
                styles={{ body: { padding: 16 } }}
              >
                <Space>
                  <PlusOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                  <div>
                    <Title level={5} style={{ margin: 0 }}>
                      新建空白工作流
                    </Title>
                    <Text type="secondary">从空画布开始编排自定义阶段与任务</Text>
                  </div>
                </Space>
              </Card>

              {activeCategory === 'enterpriseTemplate' && categoryTemplates.length === 0 ? (
                <Empty description="暂无企业自定义模板" />
              ) : (
                <Row gutter={[16, 16]}>
                  {categoryTemplates.map((tpl) => (
                    <Col xs={24} sm={12} lg={8} key={tpl.id}>
                      <Card
                        hoverable
                        variant="outlined"
                        styles={{ body: { padding: 16, minHeight: 168 } }}
                        actions={[
                          <Tooltip title={"使用该模板"} key="use">
                            <Button
                              type="link"
                              icon={<LinkOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                goTemplate(tpl, false);
                              }}
                            >
                              {"使用"}
                            </Button>
                          </Tooltip>,
                          <Tooltip title={"强绑定模板，后续可同步模板变更"} key="bind">
                            <Button
                              type="link"
                              onClick={(e) => {
                                e.stopPropagation();
                                goTemplate(tpl, true);
                              }}
                            >
                              {"强绑定"}
                            </Button>
                          </Tooltip>,
                        ]}
                        onClick={() => goTemplate(tpl, false)}
                      >
                        <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                          {tpl.template_name}
                        </Title>
                        <Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ minHeight: 40, marginBottom: 12 }}
                        >
                          {tpl.description || '暂无描述'}
                        </Paragraph>
                        <Space wrap size={[4, 4]}>
                          {tpl.stages.slice(0, 4).map((stage) => (
                            <Tag key={stage} color="blue">
                              {stage}
                            </Tag>
                          ))}
                          {tpl.stages.length > 4 && <Tag>+{tpl.stages.length - 4}</Tag>}
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}

              {activeCategory !== 'enterpriseTemplate' &&
                activeCategory !== 'createWorkflow' &&
                !loading &&
                categoryTemplates.length === 0 && (
                  <Empty description="该分类暂无可用内置模板" />
                )}
            </Space>
          </Spin>
        </Content>
      </Layout>
    </Modal>
  );
};

export default WorkflowTemplateModal;
