import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Steps,
  Typography,
  Badge,
  Empty,
  Alert,
  Input,
  Popconfirm,
  Drawer,
  Timeline,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { workflowApi, type WorkflowTaskExecution } from '../../api/workflow';
import { useProjectStore } from '../../stores/project';
import { feedback } from '../../utils/feedback';
import LogViewer from '../../components/Terminal/LogViewer';

const { Title, Text } = Typography;

// 从任务中找到等待审批的 approval job
const findPendingApproval = (task: WorkflowTaskExecution | null) => {
  if (!task?.stages) return null;
  for (const stage of task.stages) {
    for (const job of stage.jobs || []) {
      if (job.type === 'approval' && (job.status === 'wait_for_approval' || job.status === 'waiting')) {
        return { jobName: job.name, stageName: stage.name };
      }
    }
  }
  return null;
};

export const PipelineExecutionPage: React.FC = () => {
  const { name: workflowName, taskId, projectName } = useParams<{ name: string; taskId: string; projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject || 'default';
  const navigate = useNavigate();

  const [task, setTask] = useState<WorkflowTaskExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [approveComment, setApproveComment] = useState('');
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cloning, setCloning] = useState(false);

  const pendingApproval = findPendingApproval(task);

  const handleApprove = async (approve: boolean) => {
    if (!pendingApproval || !task) return;
    setApproving(true);
    try {
      await workflowApi.approveStage({
        workflow_name: task.workflow_name,
        job_name: pendingApproval.jobName,
        task_id: task.task_id,
        approve,
        comment: approveComment,
        project_name: activeProject,
      });
      feedback.message.success(approve ? '已同意，任务继续执行' : '已驳回，任务将终止');
      setApproveComment('');
      await loadTask();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '审批操作失败');
      feedback.message.error(msg);
    } finally {
      setApproving(false);
    }
  };

  const loadTask = useCallback(async () => {
    if (!workflowName || !taskId) return;
    setLoading(true);
    try {
      const res = await workflowApi.getWorkflowTask(
        workflowName,
        taskId,
        activeProject
      );
      if (res && res.task_id) {
        setTask(res);
        // Automatically select the first available job if none selected
        if (res.stages && res.stages.length > 0) {
          const allJobs = res.stages.flatMap((s) => s.jobs || []);
          if (allJobs.length > 0) {
            setSelectedJob((prev) => {
              if (prev && allJobs.some((j) => j.name === prev)) return prev;
              return allJobs[0].name;
            });
          }
        }
      } else {
        setTask(null);
        feedback.message.warning('任务不存在或已被清理');
      }
    } catch {
      setTask(null);
      feedback.message.error('获取任务详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [workflowName, taskId, activeProject]);

  const sseStreamUrl = useMemo(() => {
    if (!workflowName || !taskId || !selectedJob) return undefined;
    return `/api/logs/sse/v4/workflow/${encodeURIComponent(workflowName)}/${taskId}/${encodeURIComponent(selectedJob)}/1000`;
  }, [workflowName, taskId, selectedJob]);

  // Job 级 K8s 事件查看（对齐旧版执行详情）
  const [eventsOpen, setEventsOpen] = useState(false);
  const [jobEvents, setJobEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadJobEvents = useCallback(async () => {
    if (!workflowName || !taskId || !selectedJob) return;
    setEventsOpen(true);
    setEventsLoading(true);
    setJobEvents([]);
    try {
      const list = await workflowApi.getJobEvents(workflowName, taskId, selectedJob, activeProject);
      setJobEvents(list);
    } finally {
      setEventsLoading(false);
    }
  }, [workflowName, taskId, selectedJob, activeProject]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const renderStatusTag = (status?: string) => {
    switch (status) {
      case 'passed':
      case 'success':
        return <Tag icon={<CheckCircleOutlined />} color="success">构建成功</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">正在执行</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">执行失败</Tag>;
      case 'wait_for_approval':
      case 'waiting':
        return <Tag icon={<SafetyOutlined />} color="warning">等待审批</Tag>;
      default:
        return <Tag color="default">排队中</Tag>;
    }
  };

  const stepsItems =
    task?.stages?.map((stage) => {
      let stepStatus: 'finish' | 'process' | 'error' | 'wait' = 'finish';
      if (stage.status === 'running') stepStatus = 'process';
      else if (stage.status === 'failed') stepStatus = 'error';
      else if (stage.status === 'waiting') stepStatus = 'wait';

      return {
        title: stage.name,
        description: (
          <div style={{ marginTop: 4 }}>
            {stage.jobs.map((j) => (
              <Tag
                key={j.name}
                color={selectedJob === j.name ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedJob(j.name)}
              >
                {j.name} ({j.status})
              </Tag>
            ))}
          </div>
        ),
        status: stepStatus,
      };
    }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top action header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/v1/pipelines')}
              >
                返回工作流
              </Button>
              <BranchesOutlined style={{ fontSize: 20, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {workflowName} #{taskId} 任务详情
                </Title>
                <Space orientation="horizontal" style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    所属项目: <Tag color="blue">{activeProject}</Tag>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    状态: {renderStatusTag(task?.status)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <UserOutlined /> 触发人: {task?.creator || '-'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <ClockCircleOutlined /> 开始时间: {task?.create_time ? new Date(task.create_time * 1000).toLocaleString() : '-'}
                  </Text>
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal" size={8}>
              {task?.status === 'running' && (
                <Popconfirm
                  title="确定取消正在运行的任务？"
                  onConfirm={async () => {
                    if (!workflowName || !taskId) return;
                    setCancelling(true);
                    try {
                      await workflowApi.cancelWorkflowTask(workflowName, taskId, activeProject);
                      feedback.message.success('任务已取消');
                      await loadTask();
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '取消任务失败';
                      feedback.message.error(msg);
                    } finally {
                      setCancelling(false);
                    }
                  }}
                  okText="取消任务"
                  cancelText="返回"
                >
                  <Button danger icon={<CloseCircleOutlined />} loading={cancelling}>
                    取消任务
                  </Button>
                </Popconfirm>
              )}
              {task?.status === 'failed' && (
                <Button
                  icon={<SyncOutlined />}
                  loading={retrying}
                  onClick={async () => {
                    if (!workflowName || !taskId) return;
                    setRetrying(true);
                    try {
                      await workflowApi.retryWorkflowTask(workflowName, taskId, activeProject);
                      feedback.message.success('任务已重新入队执行');
                      await loadTask();
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '重试失败';
                      feedback.message.error(msg);
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  重试失败任务
                </Button>
              )}
              {(task?.status === 'passed' || task?.status === 'failed') && (
                <Popconfirm
                  title="以本次参数重新触发任务？"
                  onConfirm={async () => {
                    if (!workflowName || !taskId) return;
                    setCloning(true);
                    try {
                      const body = await workflowApi.cloneWorkflowTask(workflowName, taskId, activeProject);
                      const res = await workflowApi.triggerWorkflow(body);
                      feedback.message.success(`已按原参数重新触发 (新任务 #${res.task_id || 1})`);
                      navigate(`/v1/pipelines/${workflowName}/task/${res.task_id || 1}`);
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '克隆触发失败';
                      feedback.message.error(msg);
                    } finally {
                      setCloning(false);
                    }
                  }}
                  okText="重新触发"
                  cancelText="取消"
                >
                  <Button icon={<ClockCircleOutlined />} loading={cloning}>
                    克隆重跑
                  </Button>
                </Popconfirm>
              )}
              <Button
                icon={<SyncOutlined />}
                loading={loading}
                onClick={loadTask}
              >
                刷新进度
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Approval Required Action */}
      {pendingApproval && task?.status === 'waiting' && (
        <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #faad14' }}>
          <Alert
            title="该任务包含等待审批的节点"
            description={`Job [${pendingApproval.jobName}] (Stage: ${pendingApproval.stageName}) 正在等待人工审批。`}
            type="warning"
            showIcon
            icon={<SafetyOutlined />}
            style={{ marginBottom: 16, borderRadius: 6 }}
          />
          <Input.TextArea
            rows={2}
            placeholder="审批意见 (可选)"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={approving} onClick={() => handleApprove(true)}>
              同意，继续执行
            </Button>
            <Button danger icon={<CloseCircleOutlined />} loading={approving} onClick={() => handleApprove(false)}>
              驳回，终止任务
            </Button>
          </Space>
        </Card>
      )}

      {/* Pipeline Stage Progress Steps */}
      <Card
        variant="borderless"
        title="工作流 Stage 阶段执行流"
        style={{ borderRadius: 8 }}
      >
        {task ? (
          <Steps items={stepsItems} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading ? '加载中...' : '未找到任务执行详情'}
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* Step Console Logs Terminal */}
      <Card
        variant="borderless"
        title={
          <Space orientation="horizontal">
            <Text strong>执行控制台日志 (Job: {selectedJob || '默认'})</Text>
            {task?.status === 'running' ? (
              <Badge status="processing" text="SSE 实时日志流传输中" />
            ) : task?.status === 'passed' ? (
              <Badge status="success" text="任务已完成 (已归档日志)" />
            ) : task?.status === 'failed' ? (
              <Badge status="error" text="任务执行失败" />
            ) : (
              <Badge status="default" text="日志流就绪" />
            )}
            <Button size="small" onClick={loadJobEvents} disabled={!selectedJob}>
              查看事件
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <LogViewer height={480} streamUrl={sseStreamUrl} />
      </Card>

      {/* Job K8s Events Drawer */}
      <Drawer
        title={`K8s 事件: ${selectedJob || ''}`}
        placement="right"
        open={eventsOpen}
        onClose={() => setEventsOpen(false)}
        size="large"
        extra={
          <Button icon={<SyncOutlined />} size="small" onClick={loadJobEvents}>
            刷新
          </Button>
        }
      >
        {eventsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : jobEvents.length > 0 ? (
          <Timeline
            style={{ padding: '16px 24px' }}
            items={jobEvents.map((e) => ({
              color: e.event_type === 'error' ? 'red' : e.event_type === 'warning' ? 'orange' : 'blue',
              children: (
                <div style={{ marginBottom: 4 }}>
                  <Tag color={e.event_type === 'error' ? 'error' : e.event_type === 'warning' ? 'warning' : 'geekblue'}>
                    {e.event_type || 'info'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{e.time}</Text>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{e.message}</div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该 Job 暂无 K8s 事件" style={{ padding: '60px 0' }} />
        )}
      </Drawer>
    </div>
  );
};

export default PipelineExecutionPage;
