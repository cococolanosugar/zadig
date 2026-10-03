import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Modal,
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
  BugOutlined,
} from '@ant-design/icons';
import { workflowApi, type WorkflowTaskExecution } from '../../api/workflow';
import { useProjectStore } from '../../stores/project';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';
import LogViewer from '../../components/Terminal/LogViewer';
import { PodTerminal } from '../../components/Terminal/PodTerminal';

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
  const { name: routeWorkflowName, taskId: routeTaskId, projectName } = useParams<{ name: string; taskId: string; projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject || 'default';
  const navigate = useNavigate();
  const location = useLocation();

  // 深链承接（旧版路由参数名不匹配导致空壳）：
  //  - /pipelines/custom/testcase/:workflow_name/:task_id/:test_name/:test_job_name
  //  - 语义为「查看某工作流任务的测试报告」→ 解析出 workflow_name/task_id 后按任务执行视图承接
  const testcaseSplat = location.pathname.split('/pipelines/custom/testcase/')[1];
  const testcaseParts = testcaseSplat ? testcaseSplat.split('/').filter(Boolean) : [];
  const effWorkflowName = routeWorkflowName || (testcaseParts.length >= 2 ? testcaseParts[0] : undefined);
  const effTaskId = routeTaskId || (testcaseParts.length >= 2 ? testcaseParts[1] : undefined);

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
    if (!effWorkflowName || !effTaskId) return;
    setLoading(true);
    try {
      const res = await workflowApi.getWorkflowTask(
        effWorkflowName,
        effTaskId,
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
  }, [effWorkflowName, effTaskId, activeProject]);

  const sseStreamUrl = useMemo(() => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return undefined;
    return `/api/logs/sse/v4/workflow/${encodeURIComponent(effWorkflowName)}/${effTaskId}/${encodeURIComponent(selectedJob)}/1000`;
  }, [effWorkflowName, effTaskId, selectedJob]);

  // Job 级 K8s 事件查看（对齐旧版执行详情）
  const [eventsOpen, setEventsOpen] = useState(false);
  const [jobEvents, setJobEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // 容器调试相关状态与处理器（对齐后端 EnableDebugWorkflowTaskV4 / StopDebugWorkflowTaskJobV4 与 podexec WS）
  const [enablingDebug, setEnablingDebug] = useState(false);
  const [stoppingDebug, setStoppingDebug] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  // 当前选中 job 的执行状态与错误策略（用于 job 级操作判定）
  const selectedJobInfo = useMemo(() => {
    for (const stage of task?.stages || []) {
      const job = (stage.jobs || []).find((j) => j.name === selectedJob);
      if (job) return { ...job, stageName: stage.name };
    }
    return null;
  }, [task, selectedJob]);

  const canEnableDebug = useMemo(() => {
    return ['waiting', 'running', 'wait_for_approval', 'pause'].includes(task?.status || '');
  }, [task?.status]);

  const isJobInDebug = useMemo(() => {
    return selectedJobInfo?.status === 'debug_before' || selectedJobInfo?.status === 'debug_after';
  }, [selectedJobInfo?.status]);

  const debugWsUrl = useMemo(() => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = useAuthStore.getState().token || '';
    return `${protocol}//${host}/api/podexec/debug/${encodeURIComponent(effWorkflowName)}/${encodeURIComponent(selectedJob)}/task/${effTaskId}?projectName=${encodeURIComponent(activeProject)}&token=${encodeURIComponent(token)}`;
  }, [effWorkflowName, effTaskId, selectedJob, activeProject]);

  const handleEnableDebug = async () => {
    if (!effWorkflowName || !effTaskId) return;
    setEnablingDebug(true);
    try {
      await workflowApi.enableWorkflowTaskDebug(effWorkflowName, effTaskId, activeProject);
      feedback.message.success('开启调试模式！');
      await loadTask();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '开启调试模式失败';
      feedback.message.error(msg);
    } finally {
      setEnablingDebug(false);
    }
  };

  const handleStopDebug = async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    setStoppingDebug(true);
    const position = selectedJobInfo?.status === 'debug_after' ? 'after' : 'before';
    try {
      await workflowApi.stopWorkflowTaskJobDebug(effWorkflowName, selectedJob, effTaskId, position, activeProject);
      feedback.message.success('已完成调试，工作流继续执行');
      setDebugModalOpen(false);
      await loadTask();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '停止调试失败';
      feedback.message.error(msg);
    } finally {
      setStoppingDebug(false);
    }
  };

  const handleJobErrorDecision = async (decision: 'reject' | 'ignore') => {
    if (!task || !selectedJob) return;
    setApproving(true);
    try {
      await workflowApi.handleJobError({
        workflow_name: task.workflow_name,
        job_name: selectedJob,
        task_id: task.task_id,
        decision,
      });
      feedback.message.success(decision === 'ignore' ? '已忽略错误，任务继续执行' : '已终止任务');
      await loadTask();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '错误处理失败';
      feedback.message.error(msg);
    } finally {
      setApproving(false);
    }
  };

  const handleRevertJob = async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    setRetrying(true);
    try {
      await workflowApi.revertJob(effWorkflowName, selectedJob, effTaskId);
      feedback.message.success(`Job [${selectedJob}] 已重新入队`);
      await loadTask();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Job 重试失败';
      feedback.message.error(msg);
    } finally {
      setRetrying(false);
    }
  };

  const loadJobEvents = useCallback(async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    setEventsOpen(true);
    setEventsLoading(true);
    setJobEvents([]);
    try {
      const list = await workflowApi.getJobEvents(effWorkflowName, effTaskId, selectedJob, activeProject);
      setJobEvents(list);
    } finally {
      setEventsLoading(false);
    }
  }, [effWorkflowName, effTaskId, selectedJob, activeProject]);

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
      case 'debug_before':
        return <Tag icon={<BugOutlined />} color="warning">准备前调试</Tag>;
      case 'debug_after':
        return <Tag icon={<BugOutlined />} color="warning">执行后调试</Tag>;
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
            {stage.jobs.map((j) => {
              const isDebug = j.status === 'debug_before' || j.status === 'debug_after';
              return (
                <Tag
                  key={j.name}
                  color={selectedJob === j.name ? 'blue' : isDebug ? 'gold' : 'default'}
                  icon={isDebug ? <BugOutlined /> : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedJob(j.name)}
                >
                  {j.name} ({j.status})
                </Tag>
              );
            })}
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
                  {effWorkflowName} #{effTaskId} 任务详情
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
              {canEnableDebug && (
                <Button
                  icon={<BugOutlined />}
                  loading={enablingDebug}
                  onClick={handleEnableDebug}
                >
                  开启调试模式
                </Button>
              )}
              {task?.status === 'running' && (
                <Popconfirm
                  title="确定取消正在运行的任务？"
                  onConfirm={async () => {
                    if (!effWorkflowName || !effTaskId) return;
                    setCancelling(true);
                    try {
                      await workflowApi.cancelWorkflowTask(effWorkflowName, effTaskId, activeProject);
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
                    if (!effWorkflowName || !effTaskId) return;
                    setRetrying(true);
                    try {
                      await workflowApi.retryWorkflowTask(effWorkflowName, effTaskId, activeProject);
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
                    if (!effWorkflowName || !effTaskId) return;
                    setCloning(true);
                    try {
                      const body = await workflowApi.cloneWorkflowTask(effWorkflowName, effTaskId, activeProject);
                      const res = await workflowApi.triggerWorkflow(body);
                      feedback.message.success(`已按原参数重新触发 (新任务 #${res.task_id || 1})`);
                      navigate(`/v1/pipelines/${effWorkflowName}/task/${res.task_id || 1}`);
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
          <Space orientation="horizontal" wrap>
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
            <Button
              size="small"
              icon={<BugOutlined />}
              type={isJobInDebug ? 'primary' : 'default'}
              danger={isJobInDebug}
              onClick={() => setDebugModalOpen(true)}
              disabled={!selectedJob}
            >
              {isJobInDebug ? '进入调试终端' : '调试终端'}
            </Button>
            {selectedJobInfo?.status === 'failed' && task?.status === 'running' && (
              <>
                <Button size="small" onClick={() => handleJobErrorDecision('ignore')} loading={approving}>
                  忽略错误继续
                </Button>
                <Button size="small" danger onClick={() => handleJobErrorDecision('reject')} loading={approving}>
                  终止任务
                </Button>
              </>
            )}
            {selectedJobInfo?.status === 'failed' && task?.status === 'failed' && (
              <Button size="small" onClick={handleRevertJob} loading={retrying}>
                重试该 Job
              </Button>
            )}
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

      {/* Job Debug Terminal Modal */}
      <Modal
        title={
          <Space>
            <BugOutlined style={{ color: '#fa8c16' }} />
            <span>
              工作流容器调试 - Job [{selectedJob || '-'}] (
              {selectedJobInfo?.status === 'debug_after'
                ? '执行后调试'
                : selectedJobInfo?.status === 'debug_before'
                ? '准备前调试'
                : '容器调试'}
              )
            </span>
          </Space>
        }
        open={debugModalOpen}
        onCancel={() => setDebugModalOpen(false)}
        width={960}
        destroyOnClose
        styles={{ body: { padding: '12px 16px' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              提示：调试完成后点击「完成调试并继续」以解除断点并恢复工作流执行
            </Text>
            <Space>
              <Button onClick={() => setDebugModalOpen(false)}>
                后台运行 (关闭窗口)
              </Button>
              <Popconfirm
                title="确定完成调试并继续执行工作流？"
                onConfirm={handleStopDebug}
                okText="继续执行"
                cancelText="取消"
              >
                <Button type="primary" loading={stoppingDebug}>
                  完成调试并继续
                </Button>
              </Popconfirm>
            </Space>
          </div>
        }
      >
        {debugWsUrl ? (
          <PodTerminal
            customWsUrl={debugWsUrl}
            welcomeMessage={`\x1b[34m[Zadig Debug Terminal]\x1b[0m 正在连接 Job 容器: \x1b[33m${selectedJob}\x1b[0m (任务 #${effTaskId})...\r\n`}
            height={500}
          />
        ) : (
          <Empty description="无法获取调试连接信息" style={{ padding: '60px 0' }} />
        )}
      </Modal>
    </div>
  );
};

export default PipelineExecutionPage;
