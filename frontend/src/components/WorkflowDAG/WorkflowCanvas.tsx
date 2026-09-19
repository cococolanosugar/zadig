import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Space, Card, Typography, Modal, Input, Select } from 'antd';
import { PlusOutlined, PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import JobNode, { type JobNodeData } from './JobNode';
import JobConfigDrawer from './JobConfigDrawer';
import WorkflowTriggerModal from './WorkflowTriggerModal';
import type { WorkflowV4Item, WorkflowJob, JobType } from '../../api/workflow';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export interface WorkflowCanvasProps {
  workflow: WorkflowV4Item;
  projectName: string;
  onSave?: (updated: WorkflowV4Item) => Promise<void> | void;
  readOnly?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  projectName,
  onSave,
  readOnly = false,
}) => {
  const nodeTypes = useMemo(() => ({ jobNode: JobNode }), []);

  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowV4Item>(workflow);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentWorkflow(workflow);
  }, [workflow]);

  // Compute initial React Flow nodes and edges from workflow stages
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let currentX = 50;

    currentWorkflow.stages.forEach((stage, stageIndex) => {
      let currentY = 50;

      stage.jobs.forEach((job, jobIndex) => {
        const nodeId = `job-${stageIndex}-${jobIndex}-${job.name}`;
        nodes.push({
          id: nodeId,
          type: 'jobNode',
          position: { x: currentX, y: currentY },
          data: {
            jobName: job.name,
            jobType: job.type,
            stageName: stage.name,
          } as JobNodeData,
        });

        currentY += 110;
      });

      // Connect all jobs in previous stage to this stage's jobs
      if (stageIndex > 0) {
        const prevStage = currentWorkflow.stages[stageIndex - 1];
        prevStage.jobs.forEach((_, pIndex) => {
          stage.jobs.forEach((_, cIndex) => {
            edges.push({
              id: `edge-${stageIndex - 1}-${pIndex}-to-${stageIndex}-${cIndex}`,
              source: `job-${stageIndex - 1}-${pIndex}-${prevStage.jobs[pIndex].name}`,
              target: `job-${stageIndex}-${cIndex}-${stage.jobs[cIndex].name}`,
              animated: true,
              style: { stroke: '#0066ff', strokeWidth: 2 },
            });
          });
        });
      }

      currentX += 280;
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [currentWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const [selectedJob, setSelectedJob] = useState<WorkflowJob | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);

  // Add Job Modal state
  const [addJobModalVisible, setAddJobModalVisible] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobType, setNewJobType] = useState<JobType>('zadig-build');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#0066ff', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const jobData = node.data as unknown as JobNodeData;
      // Find job in workflow
      for (const stage of currentWorkflow.stages) {
        const found = stage.jobs.find((j) => j.name === jobData.jobName);
        if (found) {
          setSelectedJob(found);
          setDrawerVisible(true);
          return;
        }
      }
    },
    [currentWorkflow]
  );

  const handleSaveJob = (updatedJob: WorkflowJob) => {
    const updatedStages = currentWorkflow.stages.map((stage) => ({
      ...stage,
      jobs: stage.jobs.map((j) => (j.name === updatedJob.name ? updatedJob : j)),
    }));

    setCurrentWorkflow((prev) => ({
      ...prev,
      stages: updatedStages,
    }));
    feedback.message.success(`任务 ${updatedJob.name} 配置已更新（点击“保存编排”可持久化）`);
  };

  const handleAddJobConfirm = () => {
    if (!newJobName.trim()) {
      feedback.message.warning('请输入任务名称');
      return;
    }

    const newJob: WorkflowJob = {
      name: newJobName.trim(),
      type: newJobType,
      spec: {},
    };

    // Append to latest stage or create stage
    const updatedStages = [...currentWorkflow.stages];
    if (updatedStages.length === 0) {
      updatedStages.push({ name: 'Stage-1', jobs: [newJob] });
    } else {
      updatedStages[updatedStages.length - 1].jobs.push(newJob);
    }

    setCurrentWorkflow((prev) => ({ ...prev, stages: updatedStages }));
    setAddJobModalVisible(false);
    setNewJobName('');
    feedback.message.success(`任务 ${newJob.name} 已添加至画布（点击“保存编排”可持久化）`);
  };

  const handleSaveWorkflow = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(currentWorkflow);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      variant="borderless"
      styles={{ body: { padding: 0 } }}
      style={{ borderRadius: 8, height: 620, overflow: 'hidden' }}
      title={
        <Space orientation="horizontal">
          <Title level={5} style={{ margin: 0 }}>
            工作流编排画布: {currentWorkflow.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (点击任务节点可进入配置抽屉)
          </Text>
        </Space>
      }
      extra={
        <Space orientation="horizontal">
          {!readOnly && (
            <>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setAddJobModalVisible(true)}
              >
                添加任务
              </Button>
              <Button
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveWorkflow}
              >
                保存编排
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setTriggerModalVisible(true)}
          >
            运行工作流
          </Button>
        </Space>
      }
    >
      <div style={{ width: '100%', height: 560, background: '#fafafa' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
          <MiniMap style={{ borderRadius: 8 }} />
        </ReactFlow>
      </div>

      {/* Job Configuration Drawer */}
      <JobConfigDrawer
        visible={drawerVisible}
        job={selectedJob}
        onClose={() => setDrawerVisible(false)}
        onSave={handleSaveJob}
      />

      {/* Trigger Modal */}
      <WorkflowTriggerModal
        visible={triggerModalVisible}
        workflowName={workflow.name}
        projectName={projectName}
        onClose={() => setTriggerModalVisible(false)}
      />

      {/* Add Job Modal */}
      <Modal
        title="添加任务节点"
        open={addJobModalVisible}
        onOk={handleAddJobConfirm}
        onCancel={() => setAddJobModalVisible(false)}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <Text style={{ display: 'block', marginBottom: 6 }}>任务节点名称:</Text>
          <Input
            placeholder="例如: build-app 或 deploy-staging"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            style={{ marginBottom: 16 }}
            autoFocus
          />

          <Text style={{ display: 'block', marginBottom: 6 }}>任务类型:</Text>
          <Select
            value={newJobType}
            onChange={(val) => setNewJobType(val)}
            style={{ width: '100%' }}
            options={[
              { label: '构建任务 (zadig-build)', value: 'zadig-build' },
              { label: '部署任务 (zadig-deploy)', value: 'zadig-deploy' },
              { label: '通用脚本任务 (freestyle)', value: 'freestyle' },
              { label: '插件测试任务 (plugin)', value: 'plugin' },
            ]}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default WorkflowCanvas;
