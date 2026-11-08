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
  Popover,
  Checkbox,
  Tooltip,
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
  PauseCircleOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  ExportOutlined,
  BarChartOutlined,
  FolderOpenOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { workflowApi, type WorkflowTaskExecution, type TaskJobApproverItem } from '../../api/workflow';
import { useProjectStore } from '../../stores/project';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';
import LogViewer from '../../components/Terminal/LogViewer';
import { PodTerminal } from '../../components/Terminal/PodTerminal';
import { ManualExecModal } from './ManualExecModal';

const { Title, Text } = Typography;

// 从任务中找到等待审批的 approval job（含 wait_for_approval / waiting / pause）
const findPendingApproval = (task: WorkflowTaskExecution | null) => {
  if (!task?.stages) return null;
  const pendingStatuses = new Set(['wait_for_approval', 'waiting', 'pause']);
  for (const stage of task.stages) {
    for (const job of stage.jobs || []) {
      if (job.type === 'approval' && pendingStatuses.has(String(job.status || ''))) {
        return { jobName: job.name, stageName: stage.name, spec: job.spec };
      }
    }
  }
  return null;
};

const formatDuration = (start?: number, end?: number) => {
  if (!start) return '-';
  const endTs = end || Math.floor(Date.now() / 1000);
  const sec = Math.max(0, endTs - start);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const shortCommit = (sha?: string) => {
  if (!sha) return '-';
  return sha.length > 8 ? sha.slice(0, 8) : sha;
};

// 从任务中找到等待手动执行的阶段（status === 'pause'）
const findPendingManualExecStage = (task: WorkflowTaskExecution | null) => {
  if (!task?.stages) return null;
  for (const stage of task.stages) {
    if (stage.status === 'pause') {
      return stage;
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
  const [manualExecStageName, setManualExecStageName] = useState<string | null>(null);

  const pendingApproval = findPendingApproval(task);
  const pendingManualExec = useMemo(() => findPendingManualExecStage(task), [task]);

  // REA-S6-2: 当前登录用户 + 待审批 Job 的审批人名单
  const { userInfo: user } = useAuthStore();
  const approvalApprovers = useMemo<TaskJobApproverItem[]>(() => {
    const spec = pendingApproval?.spec;
    if (!spec) return [];
    if (Array.isArray(spec.approve_users) && spec.approve_users.length > 0) {
      return spec.approve_users;
    }
    return Array.isArray(spec.native_approval?.approve_users)
      ? spec.native_approval.approve_users
      : [];
  }, [pendingApproval]);

  // 名单非空且不含用户组时，仅名单内授权人可操作；用户组审批无法在前端解析成员，交由后端鉴权
  const approvalRestricted = useMemo(() => {
    if (approvalApprovers.length === 0) return false;
    if (approvalApprovers.some((a) => a.group_id || a.type === 'group')) return false;
    if (!user) return true;
    return !approvalApprovers.some(
      (a) =>
        (!!a.user_id && a.user_id === user.uid) ||
        (!!a.user_name && (a.user_name === user.name || a.user_name === user.account))
    );
  }, [approvalApprovers, user]);

  // REA-S7-1: 提取已成功部署 Job 的目标环境 / 集群 / 命名空间
  const deployedTarget = useMemo(() => {
    const deployJobTypes = new Set([
      'zadig-deploy',
      'custom-deploy',
      'zadig-helm-deploy',
      'zadig-helm-chart-deploy',
    ]);
    for (const stage of task?.stages || []) {
      for (const job of stage.jobs || []) {
        if (!deployJobTypes.has(job.type) || job.status !== 'passed') continue;
        const env = String(job.spec?.env || job.spec?.env_name || '');
        if (!env && !job.spec?.namespace) continue;
        return {
          env,
          envAlias: String(job.spec?.env_alias || ''),
          clusterId: String(job.spec?.cluster_id || ''),
          clusterName: String(job.spec?.cluster_name || job.spec?.cluster_id || ''),
          namespace: String(job.spec?.namespace || ''),
          production: !!job.spec?.production,
          jobName: job.name,
        };
      }
    }
    return null;
  }, [task]);

  const deployedTargetEnv = deployedTarget?.env || '';

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
      feedback.message.success(approve ? '已批准，下游阶段将继续执行' : '已拒绝，任务将终止');
      setApproveComment('');
      // 审批后即时刷新，恢复下游构建/部署状态流转
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

  // 运行中/待审批/暂停/等待状态 3s 自动轮询，终态自动停止
  useEffect(() => {
    const activeStatuses = ['running', 'wait_for_approval', 'waiting', 'pause'];
    if (!task || !activeStatuses.includes(task.status)) return;
    const timer = setInterval(() => {
      loadTask();
    }, 3000);
    return () => clearInterval(timer);
  }, [task, loadTask]);

  const sseStreamUrl = useMemo(() => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return undefined;
    return `/api/logs/sse/v4/workflow/${encodeURIComponent(effWorkflowName)}/${effTaskId}/${encodeURIComponent(selectedJob)}/1000`;
  }, [effWorkflowName, effTaskId, selectedJob]);

  // LOOP4-B2: 全量归档日志下载（非 tails 窗口）
  const handleDownloadArchiveLogs = useCallback(async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) {
      throw new Error('缺少工作流 / 任务 / Job 信息，无法下载归档日志');
    }
    const content = await workflowApi.getWorkflowJobArchiveLogs(
      effWorkflowName,
      effTaskId,
      selectedJob
    );
    return typeof content === 'string' ? content : String(content ?? '');
  }, [effWorkflowName, effTaskId, selectedJob]);

  // Job 级 K8s 事件查看（对齐旧版执行详情）
  const [eventsOpen, setEventsOpen] = useState(false);
  const [jobEvents, setJobEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // 容器调试相关状态与处理器（对齐后端 EnableDebugWorkflowTaskV4 / StopDebugWorkflowTaskJobV4 与 podexec WS）
  const [enablingDebug, setEnablingDebug] = useState(false);
  const [stoppingDebug, setStoppingDebug] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [htmlReportVisible, setHtmlReportVisible] = useState(false);
  const [junitReportVisible, setJunitReportVisible] = useState(false);
  const [junitData, setJunitData] = useState<any>(null);
  const [loadingJunit, setLoadingJunit] = useState(false);

  const [workspaceFilesVisible, setWorkspaceFilesVisible] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const loadJunitReport = async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    setJunitReportVisible(true);
    setLoadingJunit(true);
    try {
      const data = await workflowApi.getTestJunitReport(effWorkflowName, effTaskId, selectedJob, activeProject);
      setJunitData(data);
    } catch (err: unknown) {
      setJunitData(null);
      feedback.message.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err instanceof Error ? err.message : '') || '加载测试报告失败');
    } finally {
      setLoadingJunit(false);
    }
  };

  const loadWorkspaceFiles = async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    setWorkspaceFilesVisible(true);
    setLoadingFiles(true);
    try {
      const res = await workflowApi.getTestWorkspaceFiles(effWorkflowName, effTaskId, selectedJob, activeProject);
      setWorkspaceFiles(res.file_names || []);
    } catch (err: unknown) {
      setWorkspaceFiles([]);
      feedback.message.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err instanceof Error ? err.message : '') || '加载产物文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  // 当前选中 job 的执行状态与错误策略（用于 job 级操作判定）
  const selectedJobInfo = useMemo(() => {
    for (const stage of task?.stages || []) {
      const job = (stage.jobs || []).find((j) => j.name === selectedJob);
      if (job) return { ...job, stageName: stage.name };
    }
    return null;
  }, [task, selectedJob]);

  // 当前选中构建 Job 的制品与代码简报
  const selectedBuildArtifacts = useMemo(() => {
    if (!selectedJobInfo) return [];
    const isBuild =
      selectedJobInfo.type === 'zadig-build' || String(selectedJobInfo.type || '').includes('build');
    if (!isBuild) return [];
    const modules = selectedJobInfo.service_modules || [];
    if (modules.length > 0) {
      return modules.map((m) => {
        const primaryRepo = m.code_info?.[0];
        return {
          service: m.service_name || '-',
          module: m.service_module || '-',
          image: m.image || m.image_name || '-',
          commit: primaryRepo?.commit_id || '',
          commitMsg: primaryRepo?.commit_message || '',
          branch: primaryRepo?.branch || primaryRepo?.tag || '',
          artifacts: m.artifacts || [],
        };
      });
    }
    const builds = selectedJobInfo.spec?.service_and_builds || [];
    return builds.map((b) => {
      const primaryRepo = b.repos?.[0];
      return {
        service: b.service_name || '-',
        module: b.service_module || '-',
        image: b.image || b.image_name || '-',
        commit: primaryRepo?.commit_id || '',
        commitMsg: primaryRepo?.commit_message || '',
        branch: primaryRepo?.branch || primaryRepo?.tag || '',
        artifacts: [] as string[],
      };
    });
  }, [selectedJobInfo]);

  // R2-A2/A3：产物下载（Blob -> ObjectURL -> 浏览器下载）
  const triggerBlobDownload = (res: unknown, fileName: string) => {
    const blob = new Blob([res as BlobPart], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadArtifact = async (fileName?: string) => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    try {
      const res = await workflowApi.downloadArtifactFile(effWorkflowName, effTaskId, selectedJob);
      triggerBlobDownload(res, fileName || `${selectedJob}-artifact.tar.gz`);
      feedback.message.success('产物下载已开始');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '产物下载失败';
      feedback.message.error(msg);
    }
  };

  const handleDownloadBuildArtifact = async () => {
    if (!effWorkflowName || !effTaskId || !selectedJob) return;
    try {
      const res = await workflowApi.downloadBuildJobArtifactFile(effWorkflowName, effTaskId, selectedJob);
      triggerBlobDownload(res, `${selectedJob}-build-artifact.tar.gz`);
      feedback.message.success('构建产物下载已开始');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '构建产物下载失败';
      feedback.message.error(msg);
    }
  };

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

  // 断点触发逻辑（对齐后端 SetWorkflowTaskV4Breakpoint: POST /breakpoint/:workflowName/:jobName/task/:taskID/:position?operation=）
  const [settingBreakpointJob, setSettingBreakpointJob] = useState<string | null>(null);

  const handleTriggerBreakpoint = async (
    jobName: string,
    position: 'before' | 'after',
    currentValue: boolean | undefined
  ) => {
    if (!effWorkflowName || !effTaskId) return;
    const operation = currentValue ? 'unset' : 'set';
    setSettingBreakpointJob(`${jobName}-${position}`);
    try {
      await workflowApi.setWorkflowTaskBreakpoint(
        effWorkflowName,
        jobName,
        effTaskId,
        position,
        operation,
        activeProject
      );
      feedback.message.success(
        `修改断点成功！已${operation === 'set' ? '设置' : '取消'} [${jobName}] ${position === 'before' ? '执行前' : '执行后'}断点`
      );
      // 乐观更新本地 task 状态
      setTask((prev) => {
        if (!prev?.stages) return prev;
        return {
          ...prev,
          stages: prev.stages.map((stage) => ({
            ...stage,
            jobs: (stage.jobs || []).map((j) => {
              if (j.name === jobName) {
                return {
                  ...j,
                  [position === 'before' ? 'breakpoint_before' : 'breakpoint_after']: !currentValue,
                };
              }
              return j;
            }),
          })),
        };
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '修改断点失败';
      feedback.message.error(msg);
    } finally {
      setSettingBreakpointJob(null);
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
    } catch (err: unknown) {
      setJobEvents([]);
      feedback.message.error(err instanceof Error ? err.message : '任务事件获取失败');
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
      case 'pause':
        return <Tag icon={<PauseCircleOutlined />} color="warning">等待手动执行</Tag>;
      default:
        return <Tag color="default">排队中</Tag>;
    }
  };

  const stepsItems =
    task?.stages?.map((stage) => {
      let stepStatus: 'finish' | 'process' | 'error' | 'wait' = 'finish';
      if (stage.status === 'running' || stage.status === 'pause') stepStatus = 'process';
      else if (stage.status === 'failed' || stage.status === 'timeout') stepStatus = 'error';
      else if (
        stage.status === 'waiting' ||
        stage.status === 'wait_for_approval' ||
        stage.status === 'pending' ||
        stage.status === 'created' ||
        !stage.status
      ) {
        stepStatus = 'wait';
      } else if (stage.status === 'passed' || stage.status === 'skipped') {
        stepStatus = 'finish';
      }

      return {
        title: (
          <Space size={8}>
            <span>{stage.name}</span>
            {stage.status === 'pause' && (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setManualExecStageName(stage.name);
                }}
              >
                手动执行
              </Button>
            )}
          </Space>
        ),
        description: (
          <div style={{ marginTop: 4 }}>
            {stage.jobs.map((j) => {
              const isDebug = j.status === 'debug_before' || j.status === 'debug_after';
              const hasBreakpoint = Boolean(j.breakpoint_before || j.breakpoint_after);
              const isJobFinished = ['cancelled', 'timeout', 'passed', 'failed'].includes(j.status);

              return (
                <Popover
                  key={j.name}
                  trigger="hover"
                  title={<Text strong>断点调试设置: {j.name}</Text>}
                  content={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180, padding: '4px 0' }}>
                      <Checkbox
                        checked={j.breakpoint_before}
                        disabled={isJobFinished || settingBreakpointJob === `${j.name}-before`}
                        onChange={() => handleTriggerBreakpoint(j.name, 'before', j.breakpoint_before)}
                      >
                        执行前断点 (before)
                      </Checkbox>
                      <Checkbox
                        checked={j.breakpoint_after}
                        disabled={isJobFinished || settingBreakpointJob === `${j.name}-after`}
                        onChange={() => handleTriggerBreakpoint(j.name, 'after', j.breakpoint_after)}
                      >
                        执行后断点 (after)
                      </Checkbox>
                      {hasBreakpoint && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          🔴 已设断点，执行到该阶段将自动暂停并等待调试
                        </Text>
                      )}
                    </div>
                  }
                >
                  <Tag
                    color={
                      selectedJob === j.name
                        ? 'blue'
                        : isDebug
                        ? 'gold'
                        : hasBreakpoint
                        ? 'volcano'
                        : j.status === 'passed'
                        ? 'success'
                        : j.status === 'failed' || j.status === 'timeout'
                        ? 'error'
                        : j.status === 'running'
                        ? 'processing'
                        : j.status === 'wait_for_approval' || j.status === 'pause'
                        ? 'warning'
                        : j.status === 'pending' || j.status === 'waiting' || j.status === 'created'
                        ? 'default'
                        : 'default'
                    }
                    icon={isDebug ? <BugOutlined /> : hasBreakpoint ? <PauseCircleOutlined /> : undefined}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setSelectedJob(j.name)}
                  >
                    {j.name} ({j.status || 'pending'})
                    {hasBreakpoint && ' [断点]'}
                  </Tag>
                </Popover>
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
                <Popconfirm
                  title="确定从失败节点重新重试该任务吗？"
                  onConfirm={async () => {
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
                  okText="确定"
                  cancelText="取消"
                >
                  <Button icon={<SyncOutlined />} loading={retrying}>
                    重试失败任务
                  </Button>
                </Popconfirm>
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
              {deployedTargetEnv && (
                <Button
                  type="link"
                  icon={<ExportOutlined />}
                  onClick={() =>
                    navigate(
                      `/v1/projects/detail/${encodeURIComponent(activeProject)}/envs/${encodeURIComponent(deployedTargetEnv)}`
                    )
                  }
                >
                  前往目标环境 ({deployedTargetEnv}) 查看部署结果
                </Button>
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

      {/* 部署完成卡片：环境 / 集群 / Namespace + 深链 */}
      {deployedTarget && task?.status === 'passed' && (
        <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #b7eb8f' }}>
          <Alert
            title={`部署完成 · Job [${deployedTarget.jobName}]`}
            type="success"
            showIcon
            style={{ marginBottom: 12, borderRadius: 6 }}
            description={
              <Space orientation="vertical" size={4}>
                <Text>
                  目标环境：
                  <Text strong>{deployedTarget.env || '-'}</Text>
                  {deployedTarget.envAlias ? ` (${deployedTarget.envAlias})` : ''}
                  {deployedTarget.production ? <Tag color="gold" style={{ marginLeft: 8 }}>生产</Tag> : null}
                </Text>
                <Text type="secondary">
                  K8s 集群：{deployedTarget.clusterName || deployedTarget.clusterId || '-'}
                  {' · '}
                  Namespace：{deployedTarget.namespace || '-'}
                </Text>
              </Space>
            }
            action={
              deployedTargetEnv ? (
                <Button
                  type="primary"
                  icon={<ExportOutlined />}
                  onClick={() =>
                    navigate(
                      `/v1/projects/detail/${encodeURIComponent(activeProject)}/envs/${encodeURIComponent(deployedTargetEnv)}`
                    )
                  }
                >
                  前往目标环境查看
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      {/* Approval Required Action */}
      {pendingApproval &&
        (task?.status === 'wait_for_approval' ||
          task?.status === 'waiting' ||
          task?.status === 'running' ||
          task?.status === 'pause') && (
        <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #faad14' }}>
          <Alert
            title="人工审批节点待处理"
            description={`Job [${pendingApproval.jobName}] (Stage: ${pendingApproval.stageName}) 正在等待人工审批。`}
            type="warning"
            showIcon
            icon={<SafetyOutlined />}
            style={{ marginBottom: 16, borderRadius: 6 }}
          />
          {approvalApprovers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                审批人名单
              </Text>
              <Space size={[6, 6]} wrap>
                {approvalApprovers.map((a, idx) => (
                  <Tag
                    key={`${a.user_id || a.group_id || a.user_name || idx}`}
                    icon={<UserOutlined />}
                    color={a.group_id || a.type === 'group' ? 'purple' : 'blue'}
                  >
                    {a.group_name || a.user_name || a.user_id || a.group_id || '未知'}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          <Input.TextArea
            rows={2}
            placeholder="审批意见 comment（可选）"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Space>
            <Tooltip
              title={approvalRestricted ? '当前登录账号不在审批人名单中，仅授权审批人可操作' : undefined}
            >
              <span>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approving}
                  disabled={approvalRestricted}
                  onClick={() => handleApprove(true)}
                >
                  批准 (Approve)
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              title={approvalRestricted ? '当前登录账号不在审批人名单中，仅授权审批人可操作' : undefined}
            >
              <span>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={approving}
                  disabled={approvalRestricted}
                  onClick={() => handleApprove(false)}
                >
                  拒绝 (Reject)
                </Button>
              </span>
            </Tooltip>
          </Space>
        </Card>
      )}

      {/* Manual Execution Required Action */}
      {pendingManualExec && (
        <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #faad14' }}>
          <Alert
            title="该任务包含等待手动执行的阶段"
            description={`阶段 [${pendingManualExec.name}] 已到达人工暂停点，正在等待手动确认恢复执行。`}
            type="warning"
            showIcon
            icon={<PauseCircleOutlined style={{ color: '#fa8c16' }} />}
            style={{ borderRadius: 6 }}
            action={
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => setManualExecStageName(pendingManualExec.name)}
              >
                手动执行
              </Button>
            }
          />
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

      {/* 构建制品元数据：镜像 / Tag / Commit / 耗时 */}
      {selectedBuildArtifacts.length > 0 && (
        <Card
          variant="borderless"
          title={
            <Space>
              <FolderOpenOutlined />
              <span>构建产物与代码简报</span>
              {selectedJobInfo && (
                <Tag
                  color={
                    selectedJobInfo.status === 'passed'
                      ? 'success'
                      : selectedJobInfo.status === 'failed'
                      ? 'error'
                      : selectedJobInfo.status === 'running'
                      ? 'processing'
                      : 'default'
                  }
                >
                  {selectedJobInfo.status || 'pending'}
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                耗时 {formatDuration(selectedJobInfo?.start_time, selectedJobInfo?.end_time)}
              </Text>
            </Space>
          }
          style={{ borderRadius: 8 }}
        >
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            {selectedBuildArtifacts.map((item, idx) => (
              <Card key={`${item.service}-${item.module}-${idx}`} size="small" variant="outlined">
                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong>
                    {item.service}
                    {item.module && item.module !== '-' ? ` / ${item.module}` : ''}
                  </Text>
                  <Text>
                    镜像：
                    <Text code copyable={item.image !== '-'}>
                      {item.image}
                    </Text>
                  </Text>
                  <Text type="secondary">
                    分支/Tag：{item.branch || '-'}
                    {' · '}
                    Commit：
                    <Text code>{shortCommit(item.commit)}</Text>
                    {item.commitMsg ? ` · ${item.commitMsg}` : ''}
                  </Text>
                  {item.artifacts.length > 0 && (
                    <Space size={4} wrap>
                      {item.artifacts.map((a) => (
                        <Tag key={a} icon={<FileOutlined />}>
                          {a}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      )}

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
            {selectedJob && (
              <>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => setHtmlReportVisible(true)}
                >
                  HTML 报告
                </Button>
                <Button
                  size="small"
                  icon={<BarChartOutlined />}
                  onClick={loadJunitReport}
                >
                  JUnit 详情
                </Button>
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={loadWorkspaceFiles}
                >
                  测试产物
                </Button>
                {/* 构建类型 Job 支持产物包下载 (router.go:151 /build) */}
                {selectedJobInfo?.type?.includes('build') && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadBuildArtifact}
                  >
                    构建产物
                  </Button>
                )}
              </>
            )}
            {selectedJobInfo && (
              <Popover
                trigger="click"
                title={<Text strong>断点调试设置: {selectedJob}</Text>}
                content={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180, padding: '4px 0' }}>
                    <Checkbox
                      checked={selectedJobInfo.breakpoint_before}
                      disabled={
                        ['cancelled', 'timeout', 'passed', 'failed'].includes(selectedJobInfo.status) ||
                        settingBreakpointJob === `${selectedJob}-before`
                      }
                      onChange={() =>
                        handleTriggerBreakpoint(
                          selectedJob,
                          'before',
                          selectedJobInfo.breakpoint_before
                        )
                      }
                    >
                      执行前断点 (before)
                    </Checkbox>
                    <Checkbox
                      checked={selectedJobInfo.breakpoint_after}
                      disabled={
                        ['cancelled', 'timeout', 'passed', 'failed'].includes(selectedJobInfo.status) ||
                        settingBreakpointJob === `${selectedJob}-after`
                      }
                      onChange={() =>
                        handleTriggerBreakpoint(
                          selectedJob,
                          'after',
                          selectedJobInfo.breakpoint_after
                        )
                      }
                    >
                      执行后断点 (after)
                    </Checkbox>
                    {(selectedJobInfo.breakpoint_before || selectedJobInfo.breakpoint_after) && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        🔴 断点已就绪，运行至对应位置将触发调试挂起
                      </Text>
                    )}
                  </div>
                }
              >
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  danger={Boolean(
                    selectedJobInfo.breakpoint_before || selectedJobInfo.breakpoint_after
                  )}
                >
                  {selectedJobInfo.breakpoint_before || selectedJobInfo.breakpoint_after
                    ? '断点已设置'
                    : '设置断点'}
                </Button>
              </Popover>
            )}
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
        <LogViewer
          height={480}
          streamUrl={sseStreamUrl}
          onDownloadArchive={handleDownloadArchiveLogs}
        />
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

      {manualExecStageName && (
        <ManualExecModal
          open={Boolean(manualExecStageName)}
          stageName={manualExecStageName}
          workflowName={effWorkflowName || ''}
          taskId={effTaskId || ''}
          projectName={activeProject}
          onClose={() => setManualExecStageName(null)}
          onSuccess={loadTask}
        />
      )}

      {/* HTML Test Report Modal */}
      <Modal
        title={
          <Space orientation="horizontal" size={8}>
            <FileTextOutlined style={{ color: '#0066ff' }} />
            <span>HTML 测试报告 - {selectedJob}</span>
            <Tag color="blue">{effWorkflowName}</Tag>
            <Tag>#{effTaskId}</Tag>
          </Space>
        }
        open={htmlReportVisible}
        onCancel={() => setHtmlReportVisible(false)}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0, height: '76vh' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              icon={<ExportOutlined />}
              onClick={() => {
                window.open(
                  `/api/aslan/testing/report/html/workflowv4/${encodeURIComponent(activeProject)}/${encodeURIComponent(effWorkflowName || '')}/${encodeURIComponent(selectedJob)}/${encodeURIComponent(effTaskId || '')}/`,
                  '_blank'
                );
              }}
            >
              新窗口全屏打开
            </Button>
            <Button type="primary" onClick={() => setHtmlReportVisible(false)}>
              关闭
            </Button>
          </div>
        }
      >
        <iframe
          src={`/api/aslan/testing/report/html/workflowv4/${encodeURIComponent(activeProject)}/${encodeURIComponent(effWorkflowName || '')}/${encodeURIComponent(selectedJob)}/${encodeURIComponent(effTaskId || '')}/`}
          title="Workflow HTML Test Report"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </Modal>

      {/* JUnit XML / JSON Test Details Modal */}
      <Modal
        title={
          <Space orientation="horizontal" size={8}>
            <BarChartOutlined style={{ color: '#52c41a' }} />
            <span>JUnit 测试详情 - {selectedJob}</span>
          </Space>
        }
        open={junitReportVisible}
        onCancel={() => setJunitReportVisible(false)}
        width={780}
        footer={[
          <Button key="close" type="primary" onClick={() => setJunitReportVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Spin spinning={loadingJunit}>
          {junitData ? (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <pre
                style={{
                  background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
                  padding: 16,
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {typeof junitData === 'string' ? junitData : JSON.stringify(junitData, null, 2)}
              </pre>
            </div>
          ) : (
            <Empty description="暂无 JUnit 测试报告数据或当前步骤未产生 XML 报告" />
          )}
        </Spin>
      </Modal>

      {/* Workspace Test Artifacts Browser Modal */}
      <Modal
        title={
          <Space orientation="horizontal" size={8}>
            <FolderOpenOutlined style={{ color: '#faad14' }} />
            <span>测试产物与工作空间文件 - {selectedJob}</span>
          </Space>
        }
        open={workspaceFilesVisible}
        onCancel={() => setWorkspaceFilesVisible(false)}
        width={720}
        footer={[
          <Button key="close" type="primary" onClick={() => setWorkspaceFilesVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Spin spinning={loadingFiles}>
          {workspaceFiles.length > 0 ? (
            <div
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              {workspaceFiles.map((fileName, idx) => (
                <div
                  key={`${fileName}-${idx}`}
                  style={{
                    padding: '8px 4px',
                    borderBottom: idx < workspaceFiles.length - 1 ? '1px solid #f5f5f5' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Space orientation="horizontal" size={10}>
                    <FileOutlined style={{ color: '#1677ff' }} />
                    <Text strong>{fileName}</Text>
                  </Space>
                  <Button
                    size="small"
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownloadArtifact(fileName)}
                  >
                    下载
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="工作空间中未检索到测试产物或文件" />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default PipelineExecutionPage;
