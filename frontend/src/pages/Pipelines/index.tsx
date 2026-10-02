import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Input,
  Popconfirm,
  Tabs,
  Empty,
} from 'antd';
import {
  BranchesOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  SyncOutlined,
  StarFilled,
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import { workflowApi, type WorkflowV4Item, type WorkflowTaskPreview } from '../../api/workflow';
import WorkflowCanvas from '../../components/WorkflowDAG/WorkflowCanvas';
import WorkflowTriggerModal from '../../components/WorkflowDAG/WorkflowTriggerModal';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const PipelinesPage: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentProject, projects } = useProjectStore();
  const activeProject = projectName || currentProject;

  const isCreateRoute = location.pathname.endsWith('/custom/create');
  const isGlobalRoute = location.pathname.startsWith('/v1/releaseWorkflow') || location.pathname === '/v1/pipelines';
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>(projectName || 'all');

  const [workflows, setWorkflows] = useState<WorkflowV4Item[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowV4Item | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'tasks' | 'dag'>('list');
  const [loading, setLoading] = useState(false);

  // 任务历史（对齐旧版全局工作流任务列表）
  const [tasks, setTasks] = useState<WorkflowTaskPreview[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await workflowApi.getWorkflowTasks({
        pageNum: 1,
        pageSize: 20,
        projectName: isGlobalRoute ? undefined : projectName,
      });
      setTasks(res.workflow_list || []);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [isGlobalRoute, projectName]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    }
  }, [activeTab, loadTasks]);

  // Trigger Modal
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [triggerWorkflowName, setTriggerWorkflowName] = useState('');

  // Create Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await workflowApi.getWorkflows(activeProject || '');
      setWorkflows(list);
      if (!isCreateRoute) {
        setActiveWorkflow(list.length > 0 ? list[0] : null);
      }
    } catch {
      setWorkflows([]);
      setActiveWorkflow(null);
      feedback.message.error('获取工作流列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeProject, isCreateRoute]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    if (isCreateRoute) {
      setActiveTab('dag');
      setActiveWorkflow({
        name: '',
        project: activeProject || 'default',
        description: '',
        stages: [
          {
            name: '构建阶段',
            jobs: [
              {
                name: 'build-job',
                type: 'zadig-build',
                spec: {},
              },
            ],
          },
          {
            name: '部署阶段',
            jobs: [
              {
                name: 'deploy-job',
                type: 'zadig-deploy',
                spec: {},
              },
            ],
          },
        ],
      });
    }
  }, [isCreateRoute, activeProject]);

  const handleOpenTrigger = (name: string) => {
    setTriggerWorkflowName(name);
    setTriggerModalVisible(true);
  };

  const handleOpenDAG = (wf: WorkflowV4Item) => {
    setActiveWorkflow(wf);
    setActiveTab('dag');
  };

  const handleDelete = async (name: string) => {
    try {
      if (activeProject) {
        await workflowApi.deleteWorkflow(name, activeProject);
      }
      setWorkflows(workflows.filter((w) => w.name !== name));
      feedback.message.success(`工作流 ${name} 已删除`);
    } catch {
      // Handled
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      feedback.message.warning('请输入工作流名称');
      return;
    }

    const newWf: WorkflowV4Item = {
      name: newWorkflowName.trim(),
      project: activeProject || 'default',
      description: newWorkflowDesc.trim() || '自定义 V4 流水线',
      stages: [
        {
          name: 'Stage-1',
          jobs: [
            {
              name: 'build-job',
              type: 'zadig-build',
              spec: {},
            },
          ],
        },
      ],
    };

    try {
      if (activeProject) {
        await workflowApi.createWorkflow(newWf);
      }
      setWorkflows([...workflows, newWf]);
      setActiveWorkflow(newWf);
      setCreateModalVisible(false);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
      feedback.message.success(`工作流 ${newWf.name} 创建成功`);
      setActiveTab('dag');
    } catch {
      // Handled
    }
  };

  const toggleFavorite = async (record: WorkflowV4Item) => {
    if (!activeProject && !record.project) return;
    try {
      if (record.isFavorite) {
        await workflowApi.deleteFavorite(record.project || activeProject || '', record.name);
      } else {
        await workflowApi.addFavorite(record.project || activeProject || '', record.name);
      }
      const target = workflows.find((w) => w.name === record.name);
      if (target) target.isFavorite = !record.isFavorite;
      setWorkflows([...workflows]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '收藏操作失败';
      feedback.message.error(msg);
    }
  };

  const columns: ProColumns<WorkflowV4Item>[] = [
    {
      title: '',
      key: 'favorite',
      width: 44,
      render: (_, record) => (
        <StarFilled
          style={{
            color: record.isFavorite ? '#faad14' : '#d9d9d9',
            fontSize: 16,
            cursor: 'pointer',
          }}
          onClick={() => toggleFavorite(record)}
        />
      ),
    },
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <BranchesOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.display_name || record.name}</Text>
        </Space>
      ),
    },
    {
      title: '最近任务',
      key: 'recent_task',
      width: 140,
      render: (_, record) => {
        const recent = record.recentTasks?.[0];
        if (!recent) return <Text type="secondary">从未运行</Text>;
        const map: Record<string, { color: string; text: string }> = {
          passed: { color: 'success', text: '成功' },
          running: { color: 'processing', text: '执行中' },
          failed: { color: 'error', text: '失败' },
          waiting: { color: 'warning', text: '等待审批' },
          cancelled: { color: 'default', text: '已取消' },
          timeout: { color: 'error', text: '超时' },
        };
        const m = map[String(recent.status)] || { color: 'default', text: String(recent.status) };
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate(`/v1/pipelines/${record.name}/task/${recent.task_id}`)}
          >
            <Tag color={m.color} style={{ margin: 0 }}>
              #{recent.task_id} {m.text}
            </Tag>
          </Button>
        );
      },
    },
    {
      title: '包含 Stage 阶段',
      dataIndex: 'stages',
      key: 'stages',
      render: (_, record) => (
        <Space orientation="horizontal" size={4} wrap>
          {record.stages?.map((s) => (
            <Tag key={s.name} color="geekblue">
              {s.name} ({s.jobs?.length || 0} jobs)
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Button
          key="run"
          type="link"
          icon={<PlayCircleOutlined />}
          onClick={() => handleOpenTrigger(record.name)}
        >
          执行
        </Button>,
        <Button
          key="dag"
          type="link"
          icon={<EditOutlined />}
          onClick={() => handleOpenDAG(record)}
        >
          编排画布
        </Button>,
        <Popconfirm
          key="delete"
          title="确定删除该工作流？"
          onConfirm={() => handleDelete(record.name)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <BranchesOutlined style={{ fontSize: 20, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  工作流 V4 编排与调度
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  所属项目: <Tag color="blue">{activeProject || '全局工作区'}</Tag>
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (activeProject && !isGlobalRoute) {
                    navigate(`/v1/projects/detail/${activeProject}/pipelines/custom/create`);
                  } else {
                    setCreateModalVisible(true);
                  }
                }}
              >
                新建工作流
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'list' | 'tasks' | 'dag')}
        items={[
          {
            key: 'list',
            label: (
              <span>
                <AppstoreOutlined /> 工作流列表
              </span>
            ),
            children: (
              <div>
                {isGlobalRoute && (
                  <div style={{ marginBottom: 12 }}>
                    <Tabs
                      activeKey={selectedProjectFilter}
                      onChange={(k) => setSelectedProjectFilter(k)}
                      items={[
                        { key: 'all', label: '所有' },
                        ...projects.map((p) => {
                          const pName = p.name || p.product_name || '';
                          return { key: pName, label: p.alias || pName };
                        }),
                      ]}
                    />
                  </div>
                )}
                <ProTable<WorkflowV4Item>
                  rowKey="name"
                  search={false}
                  options={{ density: false, fullScreen: true, reload: true, setting: false }}
                  loading={loading}
                  toolBarRender={() => [
                    <Button
                      key="fav-filter"
                      size="small"
                      type={favoriteOnly ? 'primary' : 'default'}
                      icon={<StarFilled style={{ color: favoriteOnly ? '#faad14' : undefined }} />}
                      onClick={() => setFavoriteOnly(!favoriteOnly)}
                    >
                      仅看收藏
                    </Button>,
                  ]}
                  dataSource={
                    favoriteOnly
                      ? workflows.filter((w) => w.isFavorite)
                      : isGlobalRoute && selectedProjectFilter !== 'all'
                        ? workflows.filter((w) => (w.project || (w as any).project_name) === selectedProjectFilter)
                        : workflows
                  }
                  columns={columns}
                  cardBordered={false}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
          {
            key: 'tasks',
            label: (
              <span>
                <HistoryOutlined /> 任务历史
              </span>
            ),
            children: (
              <ProTable<WorkflowTaskPreview>
                rowKey={(r) => `${r.workflow_name}-${r.task_id}`}
                search={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                loading={tasksLoading}
                dataSource={tasks}
                toolBarRender={() => [
                  <Button key="refresh" icon={<SyncOutlined />} onClick={loadTasks}>
                    刷新
                  </Button>,
                ]}
                columns={[
                  {
                    title: '工作流',
                    dataIndex: 'workflow_display_name',
                    key: 'workflow_name',
                    render: (_, record) => (
                      <Space orientation="horizontal">
                        <BranchesOutlined style={{ color: '#0066ff' }} />
                        <Button
                          type="link"
                          style={{ padding: 0, fontWeight: 600 }}
                          onClick={() =>
                            navigate(
                              `/v1/pipelines/${record.workflow_name}/task/${record.task_id}`
                            )
                          }
                        >
                          {record.workflow_display_name || record.workflow_name} #{record.task_id}
                        </Button>
                      </Space>
                    ),
                  },
                  {
                    title: '所属项目',
                    dataIndex: 'project_name',
                    key: 'project_name',
                    render: (p) => <Tag color="blue">{String(p || '-')}</Tag>,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (s) => {
                      const map: Record<string, { color: string; text: string }> = {
                        passed: { color: 'success', text: '成功' },
                        running: { color: 'processing', text: '执行中' },
                        failed: { color: 'error', text: '失败' },
                        waiting: { color: 'warning', text: '等待审批' },
                        cancelled: { color: 'default', text: '已取消' },
                        timeout: { color: 'error', text: '超时' },
                      };
                      const m = map[String(s)] || { color: 'default', text: String(s || '未知') };
                      return <Tag color={m.color}>{m.text}</Tag>;
                    },
                  },
                  {
                    title: '触发人',
                    dataIndex: 'task_creator',
                    key: 'task_creator',
                    render: (c) => <Text type="secondary">{String(c || '-')}</Text>,
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'create_time',
                    key: 'create_time',
                    render: (t) => (t ? new Date(Number(t) * 1000).toLocaleString() : '-'),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Button
                        type="link"
                        size="small"
                        onClick={() =>
                          navigate(`/v1/pipelines/${record.workflow_name}/task/${record.task_id}`)
                        }
                      >
                        查看详情
                      </Button>
                    ),
                  },
                ]}
                cardBordered={false}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'dag',
            label: (
              <span>
                <BranchesOutlined /> DAG 画布设计器
              </span>
            ),
            children: activeWorkflow ? (
              <WorkflowCanvas
                workflow={activeWorkflow}
                projectName={activeProject || 'default'}
                onSave={async (updated) => {
                  try {
                    const isNew = !workflows.some((w) => w.name === updated.name);
                    if (isNew) {
                      await workflowApi.createWorkflow(updated);
                      feedback.message.success(`工作流 [${updated.name}] 创建成功！`);
                      setWorkflows((prev) => [...prev, updated]);
                    } else {
                      await workflowApi.updateWorkflow(updated.name, updated);
                      feedback.message.success(`工作流 [${updated.name}] 编排配置已成功保存！`);
                      setWorkflows((prev) => prev.map((w) => (w.name === updated.name ? updated : w)));
                    }
                    setActiveWorkflow(updated);
                    if (isCreateRoute && activeProject) {
                      navigate(`/v1/projects/detail/${activeProject}/pipelines`);
                    }
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '保存失败，请检查配置参数';
                    feedback.message.error(`保存工作流失败: ${msg}`);
                    throw err;
                  }
                }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="请先在工作流列表中选择一个工作流"
                style={{ padding: '60px 0' }}
              />
            ),
          },
        ]}
      />

      {/* Trigger Modal */}
      <WorkflowTriggerModal
        visible={triggerModalVisible}
        workflowName={triggerWorkflowName}
        projectName={currentProject || 'default'}
        onClose={() => setTriggerModalVisible(false)}
      />

      {/* Create Workflow Modal */}
      <Modal
        title="新建 Workflow V4 工作流"
        open={createModalVisible}
        onOk={handleCreateWorkflow}
        onCancel={() => setCreateModalVisible(false)}
        okText="创建并编排"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <Text style={{ display: 'block', marginBottom: 6 }}>工作流标识名称:</Text>
          <Input
            placeholder="例如: service-deploy-pipeline"
            value={newWorkflowName}
            onChange={(e) => setNewWorkflowName(e.target.value)}
            style={{ marginBottom: 16 }}
            autoFocus
          />

          <Text style={{ display: 'block', marginBottom: 6 }}>描述说明:</Text>
          <Input.TextArea
            placeholder="工作流用途、触发频率或所属流水线说明"
            value={newWorkflowDesc}
            onChange={(e) => setNewWorkflowDesc(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};

export default PipelinesPage;
