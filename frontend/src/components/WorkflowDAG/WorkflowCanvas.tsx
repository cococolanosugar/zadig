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
import { PlusOutlined, PlayCircleOutlined, SaveOutlined, ClockCircleOutlined } from '@ant-design/icons';
import JobNode, { type JobNodeData } from './JobNode';
import JobConfigDrawer from './JobConfigDrawer';
import WorkflowTriggerModal from './WorkflowTriggerModal';
import type { WorkflowV4Item, WorkflowJob, JobType } from '../../api/workflow';
import TriggerPanel from './TriggerPanel';
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
  const [triggerPanelVisible, setTriggerPanelVisible] = useState(false);

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
    if (!currentWorkflow.name.trim()) {
      feedback.message.warning('请输入工作流标识名称');
      return;
    }
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
        <Space orientation="horizontal" size={12} align="center">
          {currentWorkflow.name && !currentWorkflow.name.startsWith('new-') ? (
            <Title level={5} style={{ margin: 0 }}>
              {currentWorkflow.name}
            </Title>
          ) : (
            <Input
              placeholder="请输入工作流标识名称"
              style={{ width: 260 }}
              value={currentWorkflow.name}
              onChange={(e) => setCurrentWorkflow({ ...currentWorkflow, name: e.target.value })}
            />
          )}
          <Input
            placeholder="描述信息(选填)"
            style={{ width: 200 }}
            value={currentWorkflow.description || ''}
            onChange={(e) => setCurrentWorkflow({ ...currentWorkflow, description: e.target.value })}
          />
        </Space>
      }
      extra={
        <Space orientation="horizontal">
          <Button icon={<ClockCircleOutlined />} onClick={() => setTriggerPanelVisible(true)}>
            触发器
          </Button>
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

      {/* Trigger Panel (cron / git webhook) */}
      <TriggerPanel
        open={triggerPanelVisible}
        onClose={() => setTriggerPanelVisible(false)}
        workflowName={workflow.name}
        readOnly={readOnly}
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
              { label: 'K8s 部署任务 (zadig-deploy)', value: 'zadig-deploy' },
              { label: 'Helm Chart 部署 (zadig-helm-chart-deploy)', value: 'zadig-helm-chart-deploy' },
              { label: '主机部署 (zadig-vm-deploy)', value: 'zadig-vm-deploy' },
              { label: '自定义部署 (custom-deploy)', value: 'custom-deploy' },
              { label: 'K8s 资源 Patch (k8s-resource-patch)', value: 'k8s-resource-patch' },
              { label: '下线服务 (offline-service)', value: 'offline-service' },
              { label: '通知 (notification)', value: 'notification' },
              { label: '触发工作流 (workflow-trigger)', value: 'workflow-trigger' },
              { label: '测试任务 (zadig-test)', value: 'zadig-test' },
              { label: '代码扫描 (zadig-scanning)', value: 'zadig-scanning' },
              { label: '镜像分发 (zadig-distribute-image)', value: 'zadig-distribute-image' },
              { label: '人工审批 (approval)', value: 'approval' },
              { label: '服务重启 (zadig-restart)', value: 'zadig-restart' },
              { label: '通用脚本任务 (freestyle)', value: 'freestyle' },
              { label: 'SQL 变更任务 (sql)', value: 'sql' },
              { label: '插件任务 (plugin)', value: 'plugin' },
            ]}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default WorkflowCanvas;
