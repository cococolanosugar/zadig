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
import { useProjectStore } from '../../stores/project';
import { workflowApi, type WorkflowV4Item } from '../../api/workflow';
import WorkflowCanvas from '../../components/WorkflowDAG/WorkflowCanvas';
import WorkflowTriggerModal from '../../components/WorkflowDAG/WorkflowTriggerModal';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

const DEFAULT_SAMPLE_WORKFLOW: WorkflowV4Item = {
  name: 'standard-build-and-deploy',
  project: 'default',
  description: '全自动拉取代码、容器镜像构建与 K8s 集群发布工作流',
  stages: [
    {
      name: 'Stage-1: 代码构建',
      jobs: [
        {
          name: 'build-service',
          type: 'zadig-build',
          spec: { service_name: 'demo-service', branch: 'main' },
        },
      ],
    },
    {
      name: 'Stage-2: 环境发布',
      jobs: [
        {
          name: 'deploy-service',
          type: 'zadig-deploy',
          spec: { service_name: 'demo-service', env: 'dev' },
        },
      ],
    },
  ],
};

export const PipelinesPage: React.FC = () => {
  const { currentProject } = useProjectStore();

  const [workflows, setWorkflows] = useState<WorkflowV4Item[]>([DEFAULT_SAMPLE_WORKFLOW]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowV4Item>(DEFAULT_SAMPLE_WORKFLOW);
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
    if (!currentProject) return;
    setLoading(true);
    try {
      const list = await workflowApi.getWorkflows(currentProject);
      if (list.length > 0) {
        setWorkflows(list);
        setActiveWorkflow(list[0]);
      } else {
        setWorkflows([DEFAULT_SAMPLE_WORKFLOW]);
        setActiveWorkflow(DEFAULT_SAMPLE_WORKFLOW);
      }
    } catch {
      setWorkflows([DEFAULT_SAMPLE_WORKFLOW]);
      setActiveWorkflow(DEFAULT_SAMPLE_WORKFLOW);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

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
      if (currentProject) {
        await workflowApi.deleteWorkflow(name, currentProject);
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
      project: currentProject || 'default',
      description: newWorkflowDesc.trim() || '自定义 V4 流水线',
      stages: [
        {
          name: 'Stage-1: 构建',
          jobs: [
            {
              name: 'build-job',
              type: 'zadig-build',
              spec: { service_name: 'demo-service', branch: 'main' },
            },
          ],
        },
      ],
    };

    try {
      if (currentProject) {
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
                  所属项目: <Tag color="blue">{currentProject || '全局工作区'}</Tag>
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
            children: (
              <WorkflowCanvas
                workflow={activeWorkflow}
                projectName={currentProject || 'default'}
                onSave={(updated) => {
                  setActiveWorkflow(updated);
                  setWorkflows(workflows.map((w) => (w.name === updated.name ? updated : w)));
                }}
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
