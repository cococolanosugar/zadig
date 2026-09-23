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
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import { workflowApi, type WorkflowV4Item } from '../../api/workflow';
import WorkflowCanvas from '../../components/WorkflowDAG/WorkflowCanvas';
import WorkflowTriggerModal from '../../components/WorkflowDAG/WorkflowTriggerModal';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const PipelinesPage: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject;

  const [workflows, setWorkflows] = useState<WorkflowV4Item[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowV4Item | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'dag'>('list');
  const [loading, setLoading] = useState(false);

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
      setActiveWorkflow(list.length > 0 ? list[0] : null);
    } catch {
      setWorkflows([]);
      setActiveWorkflow(null);
      feedback.message.error('获取工作流列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

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

  const columns: ProColumns<WorkflowV4Item>[] = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <BranchesOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
        </Space>
      ),
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
                onClick={() => setCreateModalVisible(true)}
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
        onChange={(k) => setActiveTab(k as 'list' | 'dag')}
        items={[
          {
            key: 'list',
            label: (
              <span>
                <AppstoreOutlined /> 工作流列表
              </span>
            ),
            children: (
              <ProTable<WorkflowV4Item>
                rowKey="name"
                search={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                loading={loading}
                dataSource={workflows}
                columns={columns}
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
                    await workflowApi.updateWorkflow(updated.name, updated);
                    setActiveWorkflow(updated);
                    setWorkflows((prev) => prev.map((w) => (w.name === updated.name ? updated : w)));
                    feedback.message.success(`工作流 [${updated.name}] 编排配置已成功保存！`);
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
