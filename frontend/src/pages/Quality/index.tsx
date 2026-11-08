import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
  Space,
  Input,
  Tag,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  Modal,
  Form,
  Select,
  Drawer,
  Descriptions,
  Radio,
  Timeline,
  Segmented,
  Tooltip,
  Badge,
  InputNumber,
  Switch,
  Tabs,
  Popconfirm,
} from 'antd';
import { Line } from '@ant-design/plots';
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  PlusOutlined,
  FieldTimeOutlined,
  BarChartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RocketOutlined,
  RollbackOutlined,
  RiseOutlined,
  TrophyOutlined,
  CodeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  FullscreenOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import http from '../../api/client';
import statApi, {
  type DailyAverageDurationItem,
  type BuildTenDurationItem,
  type BuildTrendResp,
  type TestHealthResp,
  type RollbackStatItem,
} from '../../api/stat';
import { feedback } from '../../utils/feedback';
import { normalizeJobName } from '../../utils/jobname';
import { useProjectStore } from '../../stores/project';
import { subscribeSSE } from '../../utils/sse';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

const { Title, Text } = Typography;

export interface TestRepo {
  codehost_id?: number;
  repo_owner?: string;
  repo_name?: string;
  branch?: string;
  checkout_path?: string;
}

export interface TestEnv {
  key: string;
  value: string;
  is_credential?: boolean;
}

export interface TestItem {
  id?: string;
  name: string;
  desc?: string;
  product_name?: string;
  test_type?: string;
  timeout?: number;
  updated_by?: string;
  update_time?: number;
  pre_test?: {
    envs?: TestEnv[];
    build_os?: string;
    image_id?: string;
    res_req?: string;
  };
  script_type?: string;
  scripts?: string;
  test_result_path?: string;
  /** LOOP5-B2: 测试通过率门禁阈值 */
  threshold?: number;
  junit_test_result_pass_rate?: number;
  test_report_path?: string;
  coverage_report_path?: string;
  artifact_paths?: string[];
  repos?: TestRepo[];
  hook_ctl?: {
    enabled?: boolean;
    items?: unknown[];
  };
}

export const QualityCenterPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject;

  // Extract test name and task id from routes
  const match = location.pathname.match(/\/test\/(?:detail\/)?(?:function\/)?([^/]+)(?:\/([^/]+))?/);
  // 深链承接：
  //  - /test/add/function → 打开「新建测试」弹窗（旧版语义），'add' 不是测试名
  //  - /test/testcase/function/:workflow/:task_id/:test_name → 重定向到工作流任务执行视图
  const isAddDeepLink = /\/test\/add(\/|$)/.test(location.pathname);
  const isTestcaseDeepLink = location.pathname.includes('/test/testcase/function/');
  const routeTestName =
    match?.[1] && !['add', 'testcase'].includes(match[1]) ? match[1] : undefined;
  const routeTaskId = match?.[2];

  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [stats, setStats] = useState<{ total?: number; success?: number; pass_rate?: number; avg_duration?: number }>({
    total: 0,
    success: 0,
    pass_rate: undefined,
    avg_duration: undefined,
  });

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);
  const [form] = Form.useForm();

  // 构建质量效能（对齐旧版质量监控 /api/aslan/stat/quality/*）
  const [buildRange, setBuildRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildHealth, setBuildHealth] = useState<{ totalSuccess: number; totalFailure: number }>({ totalSuccess: 0, totalFailure: 0 });
  const [buildDaily, setBuildDaily] = useState<Array<{ date: string; averageDuration: number }>>([]);
  const [latestTen, setLatestTen] = useState<Array<{ name?: string; productName?: string; duration: number; status: string; taskCreator?: string; createTime?: number }>>([]);
  const [buildAverageList, setBuildAverageList] = useState<DailyAverageDurationItem[]>([]);
  const [topTenDuration, setTopTenDuration] = useState<BuildTenDurationItem[]>([]);
  const [, setBuildTrendData] = useState<BuildTrendResp | null>(null);
  const [activeBuildChartTab, setActiveBuildChartTab] = useState<'average' | 'daily'>('average');
  const [activeBuildTableTab, setActiveBuildTableTab] = useState<'latest' | 'topDuration'>('latest');

  // 测试质量度量 (testHealthMeasure & testAverageMeasure & dailyHealthTrend)
  const [testAverageList, setTestAverageList] = useState<DailyAverageDurationItem[]>([]);
  const [testHealth, setTestHealth] = useState<TestHealthResp>({ totalSuccess: 0, totalFailure: 0 });
  const [testTrend, setTestTrend] = useState<Array<{ date: string; totalSuccess: number; totalFailure: number; successRate: number }>>([]);
  const [activeTestChartTab, setActiveTestChartTab] = useState<'passRate' | 'averageDuration'>('passRate');

  // 部署与回滚质量（stat/v2/quality/deploy|rollback，GET 查询形式）
  const [deployHealth, setDeployHealth] = useState<{ success: number; failure: number }>({ success: 0, failure: 0 });
  const [topDeployed, setTopDeployed] = useState<Array<{ service_name: string; env_name: string; count: number; success: number; failed: number }>>([]);
  const [rollbackTotal, setRollbackTotal] = useState<number>(0);
  const [deployMonthly, setDeployMonthly] = useState<Array<{ date: string; success: number; rollback: number; failed: number; timeout: number }>>([]);
  const [rollbackRecords, setRollbackRecords] = useState<RollbackStatItem[]>([]);

  const fetchBuildQuality = useCallback(async () => {
    setBuildLoading(true);
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    const body = { startDate: start, endDate: end, productNames: activeProject ? [activeProject] : [] };
    try {
      const [healthRes, dailyRes, tenRes, avgRes, topDurationRes, trendRes] = await Promise.allSettled([
        statApi.getBuildHealthMeasure(body),
        http.post<Array<{ date: string; averageDuration: number }>>('/api/aslan/stat/quality/buildDailyMeasure', body, { skipErrorHandler: true }),
        http.post<Array<{ name?: string; productName?: string; duration: number; status: string; taskCreator?: string; createTime?: number }>>('/api/aslan/stat/quality/buildLatestTenMeasure', body, { skipErrorHandler: true }),
        statApi.getBuildAverageMeasure(body),
        statApi.getBuildTenDurationMeasure(body),
        statApi.getBuildTrendMeasure(body),
      ]);
      setBuildHealth(healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : { totalSuccess: 0, totalFailure: 0 });
      setBuildDaily(dailyRes.status === 'fulfilled' && Array.isArray(dailyRes.value) ? dailyRes.value : []);
      setLatestTen(tenRes.status === 'fulfilled' && Array.isArray(tenRes.value) ? tenRes.value : []);
      setBuildAverageList(avgRes.status === 'fulfilled' && Array.isArray(avgRes.value) ? avgRes.value : []);
      setTopTenDuration(topDurationRes.status === 'fulfilled' && Array.isArray(topDurationRes.value) ? topDurationRes.value : []);
      setBuildTrendData(trendRes.status === 'fulfilled' && trendRes.value ? trendRes.value : null);
    } finally {
      setBuildLoading(false);
    }
  }, [activeProject, buildRange]);

  const fetchDeployRollbackQuality = useCallback(async () => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    const rangeQ = `startDate=${start}&endDate=${end}`;
    try {
      const [healthRes, topRes, rbRes, mtRes, rbStatRes] = await Promise.allSettled([
        http.get<{ success: number; failure: number }>(
          `/api/aslan/stat/v2/quality/deploy/health?${rangeQ}`, { skipErrorHandler: true }
        ),
        http.get<Array<{ service_name: string; env_name: string; count: number; success: number; failed: number }>>(
          `/api/aslan/stat/v2/quality/deploy/service/top?${rangeQ}&top=5`, { skipErrorHandler: true }
        ),
        http.get<{ total: number }>(`/api/aslan/stat/v2/quality/rollback/total?${rangeQ}`, { skipErrorHandler: true }),
        http.get<Array<{ date: string; success: number; rollback: number; failed: number; timeout: number }>>(
          `/api/aslan/stat/v2/quality/deploy/trend/monthly?${rangeQ}`, { skipErrorHandler: true }
        ),
        statApi.getRollbackStat({
          startDate: start,
          endDate: end,
          projects: activeProject ? [activeProject] : [],
          type: 'both',
        }),
      ]);
      setDeployHealth(healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : { success: 0, failure: 0 });
      setTopDeployed(topRes.status === 'fulfilled' && Array.isArray(topRes.value) ? topRes.value : []);
      setRollbackTotal(rbRes.status === 'fulfilled' && rbRes.value ? Number(rbRes.value.total) || 0 : 0);
      setDeployMonthly(mtRes.status === 'fulfilled' && Array.isArray(mtRes.value) ? mtRes.value : []);
      setRollbackRecords(rbStatRes.status === 'fulfilled' && rbStatRes.value?.data ? rbStatRes.value.data : []);
    } catch {
      setDeployHealth({ success: 0, failure: 0 });
      setTopDeployed([]);
      setRollbackTotal(0);
      setDeployMonthly([]);
      setRollbackRecords([]);
    }
  }, [activeProject, buildRange]);

  const fetchTestTrend = useCallback(async () => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    const body = { startDate: start, endDate: end, productNames: activeProject ? [activeProject] : [] };
    try {
      const [trendRes, avgRes, healthRes] = await Promise.allSettled([
        http.post<Array<{ date: string; totalSuccess: number; totalFailure: number; successRate: number }>>(
          '/api/aslan/stat/v2/quality/test/dailyHealthTrend',
          { start_time: start, end_time: end, projects: activeProject ? [activeProject] : [] },
          { skipErrorHandler: true }
        ),
        statApi.getTestAverageMeasure(body),
        statApi.getTestHealthMeasure(body),
      ]);
      setTestTrend(trendRes.status === 'fulfilled' && Array.isArray(trendRes.value) ? trendRes.value : []);
      setTestAverageList(avgRes.status === 'fulfilled' && Array.isArray(avgRes.value) ? avgRes.value : []);
      setTestHealth(healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : { totalSuccess: 0, totalFailure: 0 });
    } catch {
      setTestTrend([]);
      setTestAverageList([]);
      setTestHealth({ totalSuccess: 0, totalFailure: 0 });
    }
  }, [activeProject, buildRange]);

  // 测试详情抽屉（配置 + 任务历史）
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTest, setDetailTest] = useState<TestItem | null>(null);
  const [testTasks, setTestTasks] = useState<Array<Record<string, unknown>>>([]);

  const openTestDetail = useCallback(async (test: TestItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTest(test);
    setTestTasks([]);
    try {
      const res = await http.get<TestItem>(`/api/aslan/testing/test/${encodeURIComponent(test.name)}`, {
        skipErrorHandler: true,
      });
      if (res) setDetailTest({ ...test, ...res });
    } catch {
      // 保留列表数据
    }
    try {
      // 后端 ListTestTask 返回 {total, tasks:[TaskPreview]}（TestTaskList）
      const res = await http.get<{ total?: number; tasks?: Array<Record<string, unknown>> }>(
        `/api/aslan/testing/testtask?projectName=${encodeURIComponent(test.product_name || '')}&testName=${encodeURIComponent(test.name)}&pageSize=10&pageNum=1`,
        { skipErrorHandler: true }
      );
      setTestTasks(Array.isArray(res?.tasks) ? res.tasks : []);
    } catch (err: unknown) {
      setTestTasks([]);
      // 任务6轮: 任务历史加载失败不再静默，透出真实错误
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '测试任务列表加载失败';
      feedback.message.error(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ---------- 测试任务详情 / 事件 / JUnit 报告 / 重启 ----------
  // 契约：GET /testing/testtask/{detail,events,report}?projectName=&testName=&taskID=
  //      POST /testing/testtask/restart?projectName=&testName=&taskID=
  //      HTML 报告: GET /testing/report/html/testing/:project/:test/:taskID/*path（workflowv4: /testing/report/html/workflowv4/:project/:workflow/:job/:taskID/*path）
  interface JUnitCase {
    tc_name: string;
    classname?: string;
    time?: number;
    failure?: { message?: string; _content?: string } | null;
    skipped?: { message?: string } | null;
    error?: { message?: string; _content?: string } | null;
    system_out?: string;
  }
  interface JUnitSuite {
    name: string;
    tests: number;
    failures: number;
    successes?: number;
    skips?: number;
    errors?: number;
    time: number;
    testcase?: JUnitCase[];
  }
  const [taskDetail, setTaskDetail] = useState<Record<string, unknown> | null>(null);
  const [taskEvents, setTaskEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [junitSuites, setJunitSuites] = useState<JUnitSuite[]>([]);
  const [reportTask, setReportTask] = useState<{ taskId: number | string; name: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [htmlReportModalOpen, setHtmlReportModalOpen] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'overview' | 'junit' | 'html'>('overview');

  const getHtmlReportUrl = useCallback(() => {
    if (!reportTask || !detailTest) return '';
    const proj = detailTest.product_name || projectName || '';
    return `/api/aslan/testing/report/html/testing/${encodeURIComponent(proj)}/${encodeURIComponent(reportTask.name)}/${reportTask.taskId}/`;
  }, [reportTask, detailTest, projectName]);

  const handleCopyHtmlShareLink = useCallback(() => {
    const relUrl = getHtmlReportUrl();
    if (!relUrl) return;
    const fullUrl = `${window.location.origin}${relUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        feedback.message.success('已复制 HTML 报告分享链接');
      }).catch(() => {
        feedback.message.info(`HTML 报告地址: ${fullUrl}`);
      });
    } else {
      feedback.message.info(`HTML 报告地址: ${fullUrl}`);
    }
  }, [getHtmlReportUrl]);

  // 独立测试任务实时状态与日志 SSE 订阅 (GET /api/aslan/testing/sse/:testName/tasks/:taskID)
  useEffect(() => {
    if (!reportTask || !detailTest) {
      setTaskLogs([]);
      setSseConnected(false);
      return;
    }

    const projectNameForTask = detailTest.product_name || projectName || '';
    const sseUrl = `/api/aslan/testing/sse/${encodeURIComponent(reportTask.name)}/tasks/${reportTask.taskId}?projectName=${encodeURIComponent(projectNameForTask)}`;

    setTaskLogs([`[${new Date().toLocaleTimeString()}] 正在建立测试任务实时数据流连接...`]);
    setSseConnected(true);

    const unsubscribe = subscribeSSE<Record<string, unknown>>(sseUrl, {
      onMessage: (data) => {
        if (!data) return;
        if (typeof data === 'string') {
          setTaskLogs((prev) => [...prev, data]);
          return;
        }

        // 同步任务详情最新状态
        if (data.status) {
          setTaskDetail((prev) => ({ ...(prev || {}), ...data }));
          const timeStr = new Date().toLocaleTimeString();
          const logLine = `[${timeStr}] 任务执行状态: ${String(data.status)} ${data.error ? `(异常原因: ${data.error})` : ''}`;
          setTaskLogs((prev) => {
            if (prev[prev.length - 1] === logLine) return prev;
            return [...prev, logLine];
          });
        }

        // 提取阶段与子任务日志
        const stages = (data.stages || []) as Array<{
          name?: string;
          status?: string;
          sub_tasks?: Record<string, unknown>;
          jobs?: Array<{ name?: string; status?: string; spec?: { log?: string } }>;
        }>;

        if (Array.isArray(stages)) {
          stages.forEach((st) => {
            if (st.jobs && Array.isArray(st.jobs)) {
              st.jobs.forEach((j) => {
                if (j.spec?.log) {
                  const lines = j.spec.log.split('\n').filter(Boolean);
                  setTaskLogs((prev) => {
                    const existingSet = new Set(prev);
                    const newLines = lines.filter((l) => !existingSet.has(l));
                    return newLines.length > 0 ? [...prev, ...newLines] : prev;
                  });
                }
              });
            }
          });
        }
      },
      onError: () => {
        setSseConnected(false);
        setTaskLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 任务日志流已断开或任务已完成`]);
      },
    });

    return () => {
      unsubscribe();
      setSseConnected(false);
    };
  }, [reportTask, detailTest, projectName]);

  const openTaskReport = useCallback(
    async (task: Record<string, unknown>) => {
      const taskId = String(task.task_id ?? task.id ?? '');
      if (!detailTest || !taskId) return;
      const projectNameForTask = detailTest.product_name || projectName || '';
      setReportTask({ taskId, name: detailTest.name });
      setReportLoading(true);
      setTaskDetail(null);
      setTaskEvents([]);
      setJunitSuites([]);
      const base = `/api/aslan/testing/testtask`;
      const qs = `projectName=${encodeURIComponent(projectNameForTask)}&testName=${encodeURIComponent(detailTest.name)}&taskID=${taskId}`;
      const [detail, events, report] = await Promise.all([
        http.get<Record<string, unknown>>(`${base}/detail?${qs}`, { skipErrorHandler: true }).catch(() => null),
        http.get<Array<{ event_type: string; time: string; message: string }>>(`${base}/events?${qs}`, { skipErrorHandler: true }).catch(() => []),
        http.get<JUnitSuite[]>(`${base}/report?${qs}`, { skipErrorHandler: true }).catch(() => []),
      ]);
      setTaskDetail(detail && typeof detail === 'object' ? detail : null);
      setTaskEvents(Array.isArray(events) ? events : []);
      setJunitSuites(Array.isArray(report) ? report : []);
      setReportLoading(false);
    },
    [detailTest, projectName]
  );

  const handleRestartTask = useCallback(
    async (task: Record<string, unknown>) => {
      if (!detailTest) return;
      const taskId = String(task.task_id ?? task.id ?? '');
      try {
        await http.post(
          `/api/aslan/testing/testtask/restart?projectName=${encodeURIComponent(detailTest.product_name || projectName || '')}&testName=${encodeURIComponent(detailTest.name)}&taskID=${taskId}`,
          {},
          { skipErrorHandler: true }
        );
        feedback.message.success(`测试任务 #${taskId} 已重新入队`);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.message || '重启失败';
        feedback.message.error(msg);
      }
    },
    [detailTest, projectName]
  );

  // 任务1: 取消测试任务 (CancelTestTaskV3, test_task.go:157)
  // 契约: DELETE /api/aslan/testing/testtask?projectName=&testName=&taskID=
  const [cancellingTask, setCancellingTask] = useState<string | null>(null);
  const handleCancelTask = useCallback(
    async (task: Record<string, unknown>) => {
      const taskId = String(task.task_id ?? task.id ?? '');
      const projName = String(
        task.projectName ?? task.product_name ?? detailTest?.product_name ?? projectName ?? ''
      );
      const testName = String(task.testName ?? detailTest?.name ?? '');
      if (!taskId || !projName || !testName) {
        feedback.message.warning('缺少任务标识，无法取消该测试任务');
        return;
      }
      setCancellingTask(taskId);
      try {
        await http.delete(
          `/api/aslan/testing/testtask?projectName=${encodeURIComponent(projName)}&testName=${encodeURIComponent(testName)}&taskID=${taskId}`,
          { skipErrorHandler: true }
        );
        feedback.message.success('已取消测试任务');
        if (detailTest) {
          openTestDetail(detailTest);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.message
          || (err instanceof Error ? err.message : '')
          || '取消测试任务失败';
        feedback.message.error(msg);
      } finally {
        setCancellingTask(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detailTest, projectName]
  );

  // 测试工作流 job.Name = GenerateExecutionModuleJobName(testName)（test_task.go:442）
  // 归一规则（小写→码点截32→去尾'-'）见 utils/jobname.ts
  const handleDownloadTestArtifact = useCallback(
    async (task: Record<string, unknown>) => {
      if (!detailTest) return;
      const taskId = String(task.task_id ?? task.id ?? '');
      try {
        const res = await http.get(
          `/api/aslan/testing/testtask/artifact?projectName=${encodeURIComponent(detailTest.product_name || projectName || '')}&testName=${encodeURIComponent(detailTest.name)}&jobName=${encodeURIComponent(normalizeJobName(detailTest.name))}&taskID=${taskId}`,
          { skipErrorHandler: true, responseType: 'blob' }
        );
        const blob = res instanceof Blob ? res : new Blob([res as BlobPart], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-${detailTest.name}-${taskId}.tar.gz`;
        a.click();
        URL.revokeObjectURL(url);
        feedback.message.success('产物已下载');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description || '产物下载失败（任务可能未配置归档步骤）';
        feedback.message.error(msg);
      }
    },
    [detailTest, projectName]
  );

  // FULL-A-03: 测试列表优先走 picket RBAC/OPA 鉴权代理，失败时降级至 aslan 原生接口
  const fetchTestList = useCallback(async (): Promise<TestItem[]> => {
    const query = activeProject ? `?projectName=${encodeURIComponent(activeProject)}` : '';
    try {
      const res = await http.get<TestItem[]>(`/api/v1/picket/testing${query}`, {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      // picket 代理不可用（如 404 / 租户策略未注入）时回退 aslan 接口
      const res = await http.get<TestItem[]>(`/api/aslan/testing/test${query}`, {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    }
  }, [activeProject]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [testsRes, statRes] = await Promise.all([
        fetchTestList(),
        http.get<{ total?: number; success?: number; pass_rate?: number; avg_duration?: number }>(
          '/api/aslan/stat/v2/quality/test/count',
          { skipErrorHandler: true }
        ),
      ]);
      const list = Array.isArray(testsRes) ? testsRes : [];
      setTests(list);
      if (statRes && typeof statRes === 'object') {
        setStats(statRes);
      }
    } catch (err: unknown) {
      setTests([]);
      const msg = err instanceof Error ? err.message : '获取测试用例列表失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchTestList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchBuildQuality();
    fetchDeployRollbackQuality();
    fetchTestTrend();
  }, [fetchBuildQuality, fetchDeployRollbackQuality, fetchTestTrend]);

  useEffect(() => {
    if (routeTestName && tests.length > 0) {
      const found = tests.find((t) => t.name === routeTestName);
      if (found) {
        openTestDetail(found);
      } else {
        openTestDetail({ name: routeTestName, product_name: projectName });
      }
    }
  }, [routeTestName, tests, openTestDetail, projectName]);

  const handleOpenCreateTest = useCallback(() => {
    setEditingTest(null);
    form.resetFields();
    form.setFieldsValue({
      product_name: activeProject || '',
      test_type: 'function',
      timeout: 30,
      script_type: 'shell',
      scripts: '#!/bin/bash\necho "Running tests..."\npytest tests/',
      envs: [],
      repos: [{ repo_name: '', branch: 'main', checkout_path: '' }],
      test_result_path: 'report.xml',
      threshold: 100,
      junit_test_result_pass_rate: 100,
      test_report_path: 'report.html',
      artifact_paths: [{ path: 'test-results/' }],
    });
    setCreateModalVisible(true);
  }, [form, activeProject]);

  // 深链：/test/add/function → 自动打开新建测试弹窗
  useEffect(() => {
    if (isAddDeepLink) {
      handleOpenCreateTest();
    }
  }, [isAddDeepLink, handleOpenCreateTest]);

  // 深链：/test/testcase/function/:workflow_name/:task_id/:test_name → 工作流任务执行视图
  useEffect(() => {
    if (!isTestcaseDeepLink) return;
    const parts = location.pathname.split('/test/testcase/function/')[1]?.split('/') || [];
    if (parts.length >= 2) {
      navigate(`/v1/pipelines/${parts[0]}/task/${parts[1]}`, { replace: true });
    } else if (projectName) {
      navigate(projectName ? `/v1/projects/detail/${projectName}/test` : '/v1/tests', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTestcaseDeepLink]);

  const handleRunTest = async (record: TestItem) => {
    feedback.message.loading(`正在对 [${record.name}] 触发自动化测试任务...`, 1);
    try {
      await http.post('/api/aslan/testing/testtask', {
        product_name: record.product_name,
        test_name: record.name,
      });
      feedback.message.success(`自动化测试任务 [${record.name}] 已成功触发！`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '触发测试任务失败，请检查测试配置';
      feedback.message.error(msg);
    }
  };

  const handleEditTest = async (record: TestItem) => {
    setEditingTest(record);
    let fullRecord: TestItem = record;
    try {
      const q = record.product_name ? `?projectName=${encodeURIComponent(record.product_name)}` : '';
      const res = await http.get<TestItem>(`/api/aslan/testing/test/${encodeURIComponent(record.name)}${q}`, {
        skipErrorHandler: true,
      });
      if (res) fullRecord = res;
    } catch {
      // fallback
    }
    form.setFieldsValue({
      name: fullRecord.name,
      product_name: fullRecord.product_name || activeProject || '',
      test_type: fullRecord.test_type || 'function',
      desc: fullRecord.desc || '',
      timeout: fullRecord.timeout || 30,
      scripts: fullRecord.scripts || '',
      script_type: fullRecord.script_type || 'shell',
      envs: fullRecord.pre_test?.envs || [],
      repos:
        Array.isArray(fullRecord.repos) && fullRecord.repos.length > 0
          ? fullRecord.repos
          : [{ repo_name: '', branch: 'main', checkout_path: '' }],
      test_result_path: fullRecord.test_result_path || '',
      // LOOP5-B2: 回填门禁阈值（threshold 优先，兼容旧字段）
      threshold: fullRecord.threshold ?? fullRecord.junit_test_result_pass_rate ?? 100,
      junit_test_result_pass_rate: fullRecord.threshold ?? fullRecord.junit_test_result_pass_rate ?? 100,
      test_report_path: fullRecord.test_report_path || '',
      coverage_report_path: fullRecord.coverage_report_path || '',
      artifact_paths:
        Array.isArray(fullRecord.artifact_paths) && fullRecord.artifact_paths.length > 0
          ? fullRecord.artifact_paths.map((p) => ({ path: p }))
          : [],
    });
    setCreateModalVisible(true);
  };

  const handleDeleteTest = async (record: TestItem) => {
    try {
      const q = record.product_name ? `?projectName=${encodeURIComponent(record.product_name)}` : '';
      await http.delete(`/api/aslan/testing/test/${encodeURIComponent(record.name)}${q}`);
      feedback.message.success(`测试套件 [${record.name}] 已成功删除`);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除测试套件失败';
      feedback.message.error(msg);
    }
  };

  const handleSaveTest = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const envList = Array.isArray(values.envs)
        ? values.envs
            .filter((e: any) => e && e.key)
            .map((e: any) => ({
              key: String(e.key).trim(),
              value: String(e.value ?? ''),
              is_credential: !!e.is_credential,
            }))
        : [];

      const repoList = Array.isArray(values.repos)
        ? values.repos
            .filter((r: any) => r && r.repo_name)
            .map((r: any) => ({
              repo_name: String(r.repo_name).trim(),
              branch: String(r.branch || 'main').trim(),
              checkout_path: String(r.checkout_path || '').trim(),
              codehost_id: Number(r.codehost_id) || 1,
            }))
        : [];

      const artifactList = Array.isArray(values.artifact_paths)
        ? values.artifact_paths
            .filter((a: any) => a && (a.path || typeof a === 'string'))
            .map((a: any) => String(a.path || a).trim())
            .filter(Boolean)
        : [];

      // LOOP5-B2: threshold 与 junit_test_result_pass_rate 统一注入
      const passRate =
        values.threshold != null
          ? Number(values.threshold)
          : values.junit_test_result_pass_rate != null
            ? Number(values.junit_test_result_pass_rate)
            : 100;

      const payload: Record<string, unknown> = {
        name: values.name,
        desc: values.desc || '',
        product_name: values.product_name,
        test_type: values.test_type || 'function',
        timeout: Number(values.timeout) || 30,
        hook_ctl: { enabled: false, items: [] },
        pre_test: {
          res_req: 'low',
          build_os: 'focal',
          envs: envList,
        },
        script_type: values.script_type || 'shell',
        scripts: values.scripts || '',
        test_result_path: values.test_result_path || '',
        threshold: passRate,
        junit_test_result_pass_rate: passRate,
        test_report_path: values.test_report_path || '',
        coverage_report_path: values.coverage_report_path || '',
        artifact_paths: artifactList,
        repos: repoList,
      };

      if (editingTest) {
        await http.put('/api/aslan/testing/test', payload);
        feedback.message.success(`测试套件 [${values.name}] 更新成功！`);
      } else {
        await http.post('/api/aslan/testing/test', payload);
        feedback.message.success(`测试套件 [${values.name}] 创建成功！`);
      }

      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存测试套件失败，请检查配置参数';
      feedback.message.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const filteredTests = tests.filter((t) => {
    if (!searchText) return true;
    return (
      (t.name && t.name.toLowerCase().includes(searchText.toLowerCase())) ||
      (t.product_name && t.product_name.toLowerCase().includes(searchText.toLowerCase()))
    );
  });

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
            质量中心
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            集成服务级别单元测试、端到端自动化功能测试及全量回归质检看板
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索测试名称 / 所属项目"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={handleOpenCreateTest}
          >
            新建测试
          </Button>
        </Space>
      </div>

      {/* Quality Statistics Metric Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="测试用例与任务总数"
              value={stats.total || tests.length}
              prefix={<BarChartOutlined style={{ color: '#0066ff' }} />}
              styles={{ content: { fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="最近执行成功率"
              value={tests.length > 0 && stats.pass_rate !== undefined && stats.pass_rate !== null ? `${stats.pass_rate}%` : '-'}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="平均质检耗时"
              value={tests.length > 0 && stats.avg_duration ? `${stats.avg_duration} 秒` : '-'}
              prefix={<FieldTimeOutlined style={{ color: '#faad14' }} />}
              styles={{ content: { fontWeight: 600 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Build Quality Charts (对齐旧版质量监控 /api/aslan/stat/quality/*) */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#1677ff' }} />
            <span>构建质量效能</span>
          </Space>
        }
        extra={
          <Space size={8}>
            <Segmented
              size="small"
              value={activeBuildChartTab}
              onChange={(v) => setActiveBuildChartTab(v as 'average' | 'daily')}
              options={[
                { label: '平均构建耗时 (秒)', value: 'average', icon: <FieldTimeOutlined /> },
                { label: '日构建频次', value: 'daily', icon: <RiseOutlined /> },
              ]}
            />
            <Radio.Group value={buildRange} onChange={(e) => setBuildRange(e.target.value)} size="small">
              <Radio.Button value="7d">近 7 天</Radio.Button>
              <Radio.Button value="30d">近 30 天</Radio.Button>
              <Radio.Button value="90d">近 90 天</Radio.Button>
            </Radio.Group>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchBuildQuality} loading={buildLoading} />
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic title="构建成功次数" value={buildHealth.totalSuccess} styles={{ content: { color: '#52c41a' } }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="构建失败次数" value={buildHealth.totalFailure} styles={{ content: { color: '#ff4d4f' } }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="构建健康度"
              value={
                buildHealth.totalSuccess + buildHealth.totalFailure > 0
                  ? `${Math.round(
                      (buildHealth.totalSuccess / (buildHealth.totalSuccess + buildHealth.totalFailure)) * 100
                    )}%`
                  : '-'
              }
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Col>
        </Row>

        {activeBuildChartTab === 'average' ? (
          buildAverageList.length > 0 ? (
            <Line
              data={buildAverageList.map((d) => ({
                date: (d.date || '').slice(5),
                duration: d.averageDuration,
              }))}
              xField="date"
              yField="duration"
              style={{ lineWidth: 2 }}
              point={{ shapeField: 'circle', sizeField: 3 }}
              height={260}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无平均构建时长数据`}
            />
          )
        ) : buildDaily.length > 0 ? (
          <Line
            data={buildDaily.map((d) => ({
              date: (d.date || '').slice(5),
              duration: d.averageDuration,
            }))}
            xField="date"
            yField="duration"
            style={{ lineWidth: 2 }}
            point={{ shapeField: 'circle', sizeField: 3 }}
            height={260}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无构建频次数据`}
          />
        )}
      </Card>

      {/* Build Tasks Table: Latest 10 vs Top 10 Duration */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title={
          <Space>
            <TrophyOutlined style={{ color: '#faad14' }} />
            <span>构建任务记录与耗时排行</span>
          </Space>
        }
        extra={
          <Segmented
            size="small"
            value={activeBuildTableTab}
            onChange={(v) => setActiveBuildTableTab(v as 'latest' | 'topDuration')}
            options={[
              { label: '最近 10 次构建', value: 'latest' },
              { label: 'Top 10 耗时构建', value: 'topDuration' },
            ]}
          />
        }
      >
        {activeBuildTableTab === 'latest' ? (
          latestTen.length > 0 ? (
            <Table
              dataSource={latestTen}
              rowKey={(r, i) => `${r.productName}-${r.createTime}-${i}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '所属项目',
                  dataIndex: 'productName',
                  key: 'productName',
                  render: (p) => <Tag color="blue">{String(p || '-')}</Tag>,
                },
                {
                  title: '耗时',
                  dataIndex: 'duration',
                  key: 'duration',
                  render: (d) => <Text type="secondary">{d ? `${d} 秒` : '-'}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => {
                    const map: Record<string, { color: string; text: string }> = {
                      passed: { color: 'success', text: '成功' },
                      failed: { color: 'error', text: '失败' },
                      running: { color: 'processing', text: '执行中' },
                    };
                    const m = map[String(s)] || { color: 'default', text: String(s || '未知') };
                    return <Tag color={m.color}>{m.text}</Tag>;
                  },
                },
                {
                  title: '触发人',
                  dataIndex: 'taskCreator',
                  key: 'taskCreator',
                  render: (c) => <Text type="secondary">{String(c || '-')}</Text>,
                },
                {
                  title: '创建时间',
                  dataIndex: 'createTime',
                  key: 'createTime',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
                },
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无最近构建记录" />
          )
        ) : topTenDuration.length > 0 ? (
          <Table<BuildTenDurationItem>
            dataSource={topTenDuration}
            rowKey={(r, i) => `${r.pipelineName}-${r.taskID}-${r.createTime}-${i}`}
            pagination={false}
            size="small"
            columns={[
              {
                title: '排名',
                key: 'rank',
                width: 70,
                render: (_, __, index) => (
                  <Tag color={index === 0 ? 'volcano' : index === 1 ? 'orange' : index === 2 ? 'gold' : 'default'}>
                    No.{index + 1}
                  </Tag>
                ),
              },
              {
                title: '工作流 / 任务',
                key: 'pipeline',
                render: (_, r) => (
                  <Space>
                    <Text strong>{r.displayName || r.pipelineName || '-'}</Text>
                    {r.taskID && <Text code>#{r.taskID}</Text>}
                  </Space>
                ),
              },
              {
                title: '所属项目',
                dataIndex: 'productName',
                key: 'productName',
                render: (p) => <Tag color="blue">{String(p || '-')}</Tag>,
              },
              {
                title: '构建耗时',
                dataIndex: 'duration',
                key: 'duration',
                render: (d: number) => (
                  <Space size={4}>
                    <FieldTimeOutlined style={{ color: '#faad14' }} />
                    <Text strong>{d ? `${d} 秒` : '-'}</Text>
                  </Space>
                ),
              },
              {
                title: '任务状态',
                dataIndex: 'status',
                key: 'status',
                render: (s: string) => {
                  const map: Record<string, { color: string; text: string }> = {
                    passed: { color: 'success', text: '成功' },
                    failed: { color: 'error', text: '失败' },
                    running: { color: 'processing', text: '执行中' },
                  };
                  const m = map[String(s)] || { color: 'default', text: String(s || '未知') };
                  return <Tag color={m.color}>{m.text}</Tag>;
                },
              },
              {
                title: '触发人',
                dataIndex: 'taskCreator',
                key: 'taskCreator',
                render: (c: string) => <Text type="secondary">{String(c || '-')}</Text>,
              },
              {
                title: '执行时间',
                dataIndex: 'createTime',
                key: 'createTime',
                render: (t: number) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Top 10 耗时构建记录" />
        )}
      </Card>

      {/* Automated Testing Quality & Health */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title={
          <Space>
            <ExperimentOutlined style={{ color: '#52c41a' }} />
            <span>自动化测试质量与健康度</span>
          </Space>
        }
        extra={
          <Segmented
            size="small"
            value={activeTestChartTab}
            onChange={(v) => setActiveTestChartTab(v as 'passRate' | 'averageDuration')}
            options={[
              { label: '测试健康趋势 (%)', value: 'passRate' },
              { label: '测试平均耗时 (秒)', value: 'averageDuration' },
            ]}
          />
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={6}>
            <Statistic
              title="测试执行总数"
              value={testHealth.totalSuccess + testHealth.totalFailure}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title="测试成功次数"
              value={testHealth.totalSuccess}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title="测试失败次数"
              value={testHealth.totalFailure}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title="测试健康度 (通过率)"
              value={
                testHealth.totalSuccess + testHealth.totalFailure > 0
                  ? `${Math.round(
                      (testHealth.totalSuccess / (testHealth.totalSuccess + testHealth.totalFailure)) * 100
                    )}%`
                  : '-'
              }
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Col>
        </Row>

        {activeTestChartTab === 'passRate' ? (
          testTrend.length > 0 ? (
            <Line
              data={testTrend.map((d) => ({
                date: (d.date || '').slice(5),
                successRate: d.successRate,
              }))}
              xField="date"
              yField="successRate"
              yAxis={{ min: 0, max: 100 }}
              style={{ lineWidth: 2 }}
              point={{ shapeField: 'circle', sizeField: 3 }}
              height={240}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无测试趋势数据`}
            />
          )
        ) : testAverageList.length > 0 ? (
          <Line
            data={testAverageList.map((d) => ({
              date: (d.date || '').slice(5),
              averageDuration: d.averageDuration,
            }))}
            xField="date"
            yField="averageDuration"
            style={{ lineWidth: 2 }}
            point={{ shapeField: 'circle', sizeField: 3 }}
            height={240}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无测试平均耗时数据`}
          />
        )}
      </Card>

      {/* Deploy & Rollback Quality (stat/v2/quality/deploy|rollback) */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title={
          <Space>
            <RocketOutlined style={{ color: '#722ed1' }} />
            <span>部署与回滚效能</span>
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchDeployRollbackQuality}>
            刷新
          </Button>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic title="部署成功次数" value={deployHealth.success} styles={{ content: { color: '#52c41a' } }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="部署失败次数" value={deployHealth.failure} styles={{ content: { color: '#ff4d4f' } }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="回滚总次数"
              value={rollbackTotal}
              prefix={<RollbackOutlined style={{ color: rollbackTotal > 0 ? '#ff7a45' : '#8c8c8c' }} />}
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 8, fontWeight: 600 }}>高频部署服务 Top 5</div>
        <Table
          dataSource={topDeployed}
          rowKey={(r) => `${r.service_name}-${r.env_name}`}
          pagination={false}
          size="small"
          columns={[
            { title: '服务', dataIndex: 'service_name', key: 'service_name', render: (n) => <Text strong>{String(n)}</Text> },
            { title: '环境', dataIndex: 'env_name', key: 'env_name', render: (e) => <Tag color="geekblue">{String(e || '-')}</Tag> },
            { title: '部署次数', dataIndex: 'count', key: 'count', render: (c) => <Tag color="blue">{String(c ?? 0)}</Tag> },
            { title: '成功', dataIndex: 'success', key: 'success', render: (s) => <Text type="secondary">{String(s ?? 0)}</Text> },
            { title: '失败', dataIndex: 'failed', key: 'failed', render: (f) => <Text type="secondary">{String(f ?? 0)}</Text> },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该时间范围暂无部署记录" /> }}
        />

        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>部署月度趋势</Text>
        </div>
        {topDeployed.length > 0 || deployMonthly.length > 0 ? (
          <Table
            dataSource={deployMonthly}
            rowKey={(r, i) => `${r.date}-${i}`}
            pagination={false}
            size="small"
            columns={[
              { title: '月份', dataIndex: 'date', key: 'date', render: (d) => <Text strong>{String(d || '-')}</Text> },
              { title: '成功', dataIndex: 'success', key: 'success', render: (s) => <Tag color="success">{String(s ?? 0)}</Tag> },
              { title: '失败', dataIndex: 'failed', key: 'failed', render: (f) => <Tag color={Number(f) > 0 ? 'error' : 'default'}>{String(f ?? 0)}</Tag> },
              { title: '回滚', dataIndex: 'rollback', key: 'rollback', render: (r) => <Tag color={Number(r) > 0 ? 'volcano' : 'default'}>{String(r ?? 0)}</Tag> },
              { title: '超时', dataIndex: 'timeout', key: 'timeout', render: (t) => <Text type="secondary">{String(t ?? 0)}</Text> },
            ]}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度部署数据" /> }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度部署趋势数据" />
        )}

        {/* 回滚统计记录明细 (GET /stat/v2/quality/rollback/stat) */}
        <div style={{ marginTop: 24, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RollbackOutlined style={{ color: '#ff7a45' }} />
          <Text strong style={{ fontSize: 14 }}>环境服务回滚统计明细 ({rollbackRecords.length})</Text>
        </div>
        <Table<RollbackStatItem>
          dataSource={rollbackRecords}
          rowKey={(r, i) => `${r.project_name}-${r.service_name}-${r.rollback_time}-${i}`}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          size="small"
          columns={[
            {
              title: '回滚时间',
              dataIndex: 'rollback_time',
              key: 'rollback_time',
              width: 170,
              render: (t: number) => (t ? new Date(t * 1000).toLocaleString() : '-'),
            },
            {
              title: '所属项目',
              dataIndex: 'project_name',
              key: 'project_name',
              width: 130,
              render: (p: string) => <Tag color="blue">{p || '-'}</Tag>,
            },
            {
              title: '服务名称',
              dataIndex: 'service_name',
              key: 'service_name',
              render: (s: string) => <Text strong>{s || '-'}</Text>,
            },
            {
              title: '目标环境',
              dataIndex: 'env_name',
              key: 'env_name',
              width: 110,
              render: (e: string) => <Tag color="geekblue">{e || '-'}</Tag>,
            },
            {
              title: '操作人',
              dataIndex: 'rollback_by',
              key: 'rollback_by',
              width: 110,
              render: (by: string) => <Text type="secondary">{by || '-'}</Text>,
            },
            {
              title: '镜像变更 (回滚前 → 回滚后)',
              key: 'image_change',
              render: (_, r) => {
                const before = r.rollback_before_image_tag?.map((img) => `${img.name}:${img.tag}`).join(', ');
                const after = r.rollback_after_image_tag?.map((img) => `${img.name}:${img.tag}`).join(', ');
                return (
                  <div style={{ fontSize: 11 }}>
                    <div>
                      <Text type="secondary">前: </Text>
                      <Text code>{before || '-'}</Text>
                    </div>
                    <div>
                      <Text type="secondary">后: </Text>
                      <Text code style={{ color: '#d4380d' }}>{after || '-'}</Text>
                    </div>
                  </div>
                );
              },
            },
            {
              title: '回滚详情 / 原因',
              dataIndex: 'rollback_detail',
              key: 'rollback_detail',
              ellipsis: true,
              render: (d: string) => (
                <Tooltip title={d || '服务配置/版本回滚'}>
                  <span>{d || '服务配置/版本回滚'}</span>
                </Tooltip>
              ),
            },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前时间范围无服务回滚记录" /> }}
        />
      </Card>

      {/* Main Table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 15, color: '#1f2d3d' }}>
          自动化测试套件列表 ({filteredTests.length})
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={filteredTests}
            columns={[
              {
                title: '测试名称',
                dataIndex: 'name',
                key: 'name',
                render: (name, record) => (
                  <Button
                    type="link"
                    style={{ padding: 0, fontWeight: 600 }}
                    onClick={() => openTestDetail(record)}
                  >
                    {name}
                  </Button>
                ),
              },
              {
                title: '归属项目',
                dataIndex: 'product_name',
                key: 'product_name',
                render: (p) => (p ? <Tag color="blue">{p}</Tag> : '-'),
              },
              {
                title: '测试类型',
                dataIndex: 'test_type',
                key: 'test_type',
                render: (t) => <Tag color="geekblue">{t || '功能测试'}</Tag>,
              },
              {
                title: '描述',
                dataIndex: 'desc',
                key: 'desc',
                render: (d) => d || '无描述',
              },
              {
                title: '最近修改人',
                dataIndex: 'updated_by',
                key: 'updated_by',
                render: (u) => u || '-',
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Space orientation="horizontal" size={8}>
                    <Button
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleRunTest(record)}
                    >
                      执行测试
                    </Button>
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEditTest(record)}
                    >
                      配置
                    </Button>
                    <Popconfirm
                      title="确认删除该测试套件？"
                      description="删除后依赖此测试套件的工作流任务可能无法正常执行。"
                      onConfirm={() => handleDeleteTest(record)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: (
                <Empty description="暂无自动化测试配置，请点击右上角新建测试" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenCreateTest}
                  >
                    新建测试
                  </Button>
                </Empty>
              ),
            }}
          />
        )}
      </Card>

      {/* Create / Edit Test Modal */}
      <Modal
        title={editingTest ? `配置自动化测试套件: ${editingTest.name}` : '新建自动化测试套件'}
        open={createModalVisible}
        destroyOnHidden
        confirmLoading={creating}
        onOk={handleSaveTest}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingTest(null);
        }}
        width={780}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            test_type: 'function',
            timeout: 30,
            script_type: 'shell',
            repos: [{ repo_name: '', branch: 'main', checkout_path: '' }],
            test_result_path: 'report.xml',
            threshold: 100,
            junit_test_result_pass_rate: 100,
            test_report_path: 'report.html',
            artifact_paths: [{ path: 'test-results/' }],
          }}
          style={{ marginTop: 12 }}
        >
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={14}>
                        <Form.Item
                          name="name"
                          label="测试用例名称"
                          rules={[
                            { required: true, message: '请输入测试名称' },
                            { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符(-)' },
                          ]}
                        >
                          <Input placeholder="例如: api-regression-test" disabled={!!editingTest} />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item
                          name="timeout"
                          label="超时时间 (分钟)"
                          rules={[{ required: true, message: '请输入超时时间' }]}
                        >
                          <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="product_name"
                          label="归属项目名称"
                          rules={[{ required: true, message: '请输入归属项目' }]}
                        >
                          <Input placeholder="例如: default 或项目英文标识" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="test_type" label="测试类型">
                          <Select
                            options={[
                              { label: '功能自动化测试 (function)', value: 'function' },
                              { label: '集成接口测试 (integration)', value: 'integration' },
                              { label: '性能基准测试 (performance)', value: 'performance' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="desc" label="用例描述">
                      <Input.TextArea rows={3} placeholder="测试范围、用例套件说明" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'repos',
                label: '代码库配置',
                children: (
                  <div>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
                      支持配置运行自动化测试所需的一个或多个代码仓库及分支。
                    </Typography.Paragraph>
                    <Form.List name="repos">
                      {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {fields.map(({ key, name, ...restField }) => (
                            <Card key={key} size="small" variant="borderless" style={{ background: '#fafafa' }}>
                              <Row gutter={12} align="middle">
                                <Col span={8}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'repo_name']}
                                    label="代码库名称"
                                    rules={[{ required: true, message: '请输入代码库名称' }]}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input placeholder="例如: test-automation-suite" />
                                  </Form.Item>
                                </Col>
                                <Col span={7}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'branch']}
                                    label="默认分支"
                                    rules={[{ required: true, message: '请输入分支' }]}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input placeholder="例如: main / master" />
                                  </Form.Item>
                                </Col>
                                <Col span={7}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'checkout_path']}
                                    label="检出目录 (可选)"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input placeholder="相对工作区路径" />
                                  </Form.Item>
                                </Col>
                                <Col span={2} style={{ textAlign: 'center', paddingTop: 28 }}>
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(name)}
                                  />
                                </Col>
                              </Row>
                            </Card>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add({ repo_name: '', branch: 'main', checkout_path: '' })}
                            icon={<PlusOutlined />}
                            block
                          >
                            添加代码库
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </div>
                ),
              },
              {
                key: 'envs',
                label: '测试变量',
                children: (
                  <div>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
                      注入自定义环境变量供测试脚本使用，支持标记敏感变量。
                    </Typography.Paragraph>
                    <Form.List name="envs">
                      {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {fields.map(({ key, name, ...restField }) => (
                            <Row key={key} gutter={12} align="middle">
                              <Col span={9}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'key']}
                                  label="变量键名"
                                  rules={[{ required: true, message: '请输入变量名' }]}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Input placeholder="例如: API_BASE_URL" />
                                </Form.Item>
                              </Col>
                              <Col span={9}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'value']}
                                  label="变量取值"
                                  style={{ marginBottom: 0 }}
                                >
                                  <Input placeholder="变量值" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'is_credential']}
                                  label="敏感变量"
                                  valuePropName="checked"
                                  style={{ marginBottom: 0 }}
                                >
                                  <Switch checkedChildren="是" unCheckedChildren="否" />
                                </Form.Item>
                              </Col>
                              <Col span={2} style={{ textAlign: 'center', paddingTop: 28 }}>
                                <Button
                                  type="text"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(name)}
                                />
                              </Col>
                            </Row>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add({ key: '', value: '', is_credential: false })}
                            icon={<PlusOutlined />}
                            block
                          >
                            添加测试环境变量
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </div>
                ),
              },
              {
                key: 'script',
                label: '测试脚本',
                children: (
                  <Form.Item
                    name="scripts"
                    label="测试执行脚本 (Shell)"
                    rules={[{ required: true, message: '请输入测试脚本' }]}
                    extra="支持运行测试命令并导出报告文件，例如 pytest、go test、mvn test 等"
                  >
                    <Input.TextArea
                      rows={10}
                      style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}
                      placeholder="#!/bin/bash&#10;pytest -v --junitxml=report.xml tests/"
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'report',
                label: '测试报告配置',
                children: (
                  <>
                    <Card size="small" title="JUnit 测试报告" variant="borderless" style={{ background: '#fafafa', marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col span={14}>
                          <Form.Item
                            name="test_result_path"
                            label="JUnit 报告所在文件 / 目录"
                            tooltip="支持填入相对于工作区的 XML 文件路径或目录，例如 report.xml 或 target/surefire-reports"
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="例如: report.xml" />
                          </Form.Item>
                        </Col>
                        <Col span={10}>
                          {/* LOOP5-B2: 测试通过率门禁阈值 */}
                          <Form.Item
                            name="threshold"
                            label="测试通过率门禁阈值 (%)"
                            tooltip="执行自动化测试时，若测试用例通过率低于该阈值，测试任务将被判定为失败并阻断工作流"
                            initialValue={100}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={0} max={100} suffix="%" style={{ width: 160 }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>

                    <Card size="small" title="HTML 测试报告" variant="borderless" style={{ background: '#fafafa', marginBottom: 16 }}>
                      <Form.Item
                        name="test_report_path"
                        label="HTML 测试报告文件 / 目录"
                        tooltip="填入生成的 HTML 报告主入口路径，测试完成后可在报告选项卡中在线查看"
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="例如: report.html 或 html-report/index.html" />
                      </Form.Item>
                    </Card>

                    <Card size="small" title="代码覆盖率报告 (Code Coverage)" variant="borderless" style={{ background: '#fafafa', marginBottom: 16 }}>
                      <Form.Item
                        name="coverage_report_path"
                        label="代码覆盖率报告文件 / 目录"
                        tooltip="填入单测或集成测试生成的代码覆盖率报告路径，例如 coverage/lcov-report/ 或 target/site/jacoco/index.html"
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="例如: coverage/lcov-report/index.html 或 target/site/jacoco/index.html" />
                      </Form.Item>
                    </Card>

                    <Card size="small" title="测试产物导出目录 (Artifact Paths)" variant="borderless" style={{ background: '#fafafa' }}>
                      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                        配置测试执行完毕后需上传归档的报告所在目录或日志产物路径。
                      </Typography.Paragraph>
                      <Form.List name="artifact_paths">
                        {(fields, { add, remove }) => (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {fields.map(({ key, name, ...restField }) => (
                              <Row key={key} gutter={12} align="middle">
                                <Col span={22}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'path']}
                                    label="产物所在目录 / 文件路径"
                                    rules={[{ required: true, message: '请输入产物路径' }]}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input placeholder="例如: test-results/ 或 allure-report/" />
                                  </Form.Item>
                                </Col>
                                <Col span={2} style={{ textAlign: 'center', paddingTop: 28 }}>
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(name)}
                                  />
                                </Col>
                              </Row>
                            ))}
                            <Button
                              type="dashed"
                              onClick={() => add({ path: '' })}
                              icon={<PlusOutlined />}
                              block
                            >
                              添加报告 / 产物导出路径
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </Card>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* Test Detail Drawer: 配置 + 任务历史 (test/function/:test_name 对齐) */}
      <Drawer
        title={`测试详情: ${detailTest?.name || ''}`}
        placement="right"
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTest(null);
          if (routeTestName) {
            navigate(projectName ? `/v1/projects/detail/${projectName}/test` : '/v1/tests');
          }
        }}
        size="large"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailTest ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="测试类型">
                <Tag color="geekblue">{detailTest.test_type || '功能测试'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{detailTest.product_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{detailTest.desc || '-'}</Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {detailTest.update_time
                  ? `${new Date(detailTest.update_time * 1000).toLocaleString()} · ${detailTest.updated_by || '-'}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              测试任务历史
            </Title>
            <Table
              dataSource={testTasks}
              rowKey={(r, index) => String(r.task_id || r.id || `${r.test_name || 'test'}-${r.create_time || index}`)}
              rowClassName={(record) => (routeTaskId && String(record.task_id ?? record.id) === routeTaskId ? 'ant-table-row-selected' : '')}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              columns={[
                {
                  title: '任务 ID',
                  key: 'task_id',
                  render: (_, r) => <Text code>{String(r.task_id ?? r.id ?? '-')}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => {
                    const map: Record<string, 'success' | 'processing' | 'error' | 'default'> = {
                      passed: 'success',
                      failed: 'error',
                      running: 'processing',
                      timeout: 'error',
                    };
                    return <Tag color={map[String(s)] === 'success' ? 'success' : map[String(s)] === 'error' ? 'error' : map[String(s)] === 'processing' ? 'processing' : 'default'}>{String(s || '未知')}</Tag>;
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
                  render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
                },
                {
                  title: '耗时',
                  dataIndex: 'duration',
                  key: 'duration',
                  render: (_, r) => {
                    const start = r.start_time as number | undefined;
                    const end = r.end_time as number | undefined;
                    if (start && end) return `${end - start}s`;
                    const d = r.duration as number | undefined;
                    return d ? `${d}s` : '-';
                  },
                },
              {
                  title: '操作',
                  key: 'actions',
                  render: (_, r) => (
                    <Space size={0}>
                      <Button type="link" size="small" onClick={() => openTaskReport(r)}>
                        详情/报告
                      </Button>
                      <Button type="link" size="small" onClick={() => handleRestartTask(r)}>
                        重启
                      </Button>
                      <Button type="link" size="small" onClick={() => handleDownloadTestArtifact(r)}>
                        产物
                      </Button>
                      {r.status === 'running' && (
                        <Popconfirm
                          title="确定取消该测试任务吗？"
                          description="取消后任务将终止执行，已产出结果保留。"
                          onConfirm={() => handleCancelTask(r)}
                          okText="取消任务"
                          cancelText="返回"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="link" size="small" danger loading={cancellingTask === String(r.task_id ?? r.id ?? '')}>
                            取消
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测试任务记录" />,
              }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到测试详情" />
        )}
      </Drawer>

      {/* 测试任务详情 / JUnit 报告 / HTML 报告在线预览 (深度对齐旧版测试中心) */}
      <Drawer
        title={`任务详情: ${reportTask?.name || ''} #${reportTask?.taskId ?? ''}`}
        placement="right"
        open={!!reportTask}
        onClose={() => setReportTask(null)}
        size={860}
        extra={
          reportTask && detailTest ? (
            <Space size={8}>
              <Tooltip title="复制测试报告分享链接">
                <Button size="small" icon={<ShareAltOutlined />} onClick={handleCopyHtmlShareLink}>
                  分享链接
                </Button>
              </Tooltip>
              <Tooltip title="全屏沉浸式预览 HTML 报告">
                <Button size="small" icon={<FullscreenOutlined />} onClick={() => setHtmlReportModalOpen(true)}>
                  全屏预览
                </Button>
              </Tooltip>
              <Tooltip title="在新标签页中打开原始报告">
                <Button
                  size="small"
                  icon={<ExportOutlined />}
                  onClick={() => window.open(getHtmlReportUrl(), '_blank')}
                >
                  新窗口打开
                </Button>
              </Tooltip>
            </Space>
          ) : null
        }
      >
        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            activeKey={activeReportTab}
            onChange={(k) => setActiveReportTab(k as 'overview' | 'junit' | 'html')}
            items={[
              {
                key: 'overview',
                label: (
                  <Space size={4}>
                    <CodeOutlined />
                    <span>概览与执行日志</span>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 任务概览 */}
                    {taskDetail && (
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="状态">
                          <Tag color={String(taskDetail.status) === 'passed' ? 'success' : String(taskDetail.status) === 'failed' ? 'error' : 'processing'}>
                            {String(taskDetail.status || '-')}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="触发人">{String(taskDetail.task_creator || '-')}</Descriptions.Item>
                        <Descriptions.Item label="开始时间">
                          {taskDetail.start_time ? new Date(Number(taskDetail.start_time) * 1000).toLocaleString() : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="结束时间">
                          {taskDetail.end_time ? new Date(Number(taskDetail.end_time) * 1000).toLocaleString() : '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    )}

                    {/* 实时执行日志 */}
                    <Card
                      size="small"
                      title={
                        <Space>
                          <CodeOutlined style={{ color: '#0066ff' }} />
                          <span>实时执行日志流</span>
                          <Badge
                            status={sseConnected ? 'processing' : 'default'}
                            text={sseConnected ? '实时监听中' : '日志流已结束'}
                          />
                        </Space>
                      }
                      extra={
                        <Button size="small" onClick={() => setTaskLogs([])}>
                          清空日志
                        </Button>
                      }
                    >
                      <div
                        style={{
                          background: '#1e1e1e',
                          color: '#d4d4d4',
                          padding: 12,
                          borderRadius: 6,
                          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                          fontSize: 12,
                          lineHeight: 1.5,
                          maxHeight: 300,
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {taskLogs.length > 0 ? (
                          taskLogs.map((log, index) => {
                            const isError = log.includes('error') || log.includes('异常') || log.includes('failed');
                            const isSuccess = log.includes('passed') || log.includes('成功');
                            return (
                              <div
                                key={index}
                                style={{
                                  color: isError ? '#f87171' : isSuccess ? '#4ade80' : '#d4d4d4',
                                }}
                              >
                                {log}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: '#94a3b8' }}>暂无日志输出，等待实时数据流推送...</div>
                        )}
                      </div>
                    </Card>

                    {/* 任务事件 */}
                    <Card size="small" title="任务生命周期事件">
                      {taskEvents.length > 0 ? (
                        <Timeline
                          items={taskEvents.map((e, i) => ({
                            key: i,
                            color: e.event_type === 'error' ? 'red' : e.event_type === 'warning' ? 'orange' : 'blue',
                            children: (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>{e.time}</Text>
                                <div style={{ fontSize: 13 }}>{e.message}</div>
                              </div>
                            ),
                          }))}
                        />
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务事件" />
                      )}
                    </Card>
                  </div>
                ),
              },
              {
                key: 'junit',
                label: (
                  <Space size={4}>
                    <CheckCircleOutlined />
                    <span>JUnit 测试用例</span>
                  </Space>
                ),
                children: (
                  <Card size="small" title="JUnit 测试报告套件">
                    {junitSuites.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {junitSuites.map((suite, i) => {
                          const total = suite.tests || 0;
                          const failed = (suite.failures || 0) + (suite.errors || 0);
                          return (
                            <div key={suite.name || i} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
                              <Space wrap style={{ marginBottom: 8 }}>
                                <Text strong>{suite.name || '默认套件'}</Text>
                                <Tag color="blue">总数 {total}</Tag>
                                <Tag color="success">成功 {suite.successes ?? total - failed - (suite.skips || 0)}</Tag>
                                <Tag color="error">失败 {suite.failures || 0}</Tag>
                                <Tag color="warning">错误 {suite.errors || 0}</Tag>
                                <Tag color="default">跳过 {suite.skips || 0}</Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>耗时 {suite.time ?? 0}s</Text>
                              </Space>
                              <Table
                                rowKey={(c) => c.tc_name}
                                dataSource={suite.testcase || []}
                                pagination={false}
                                size="small"
                                columns={[
                                  {
                                    title: '用例',
                                    dataIndex: 'tc_name',
                                    render: (n: string) => <Text code>{n}</Text>,
                                  },
                                  {
                                    title: '结果',
                                    key: 'result',
                                    width: 80,
                                    render: (_, c: JUnitCase) =>
                                      c.failure ? (
                                        <Tag color="error">失败</Tag>
                                      ) : c.error ? (
                                        <Tag color="error">错误</Tag>
                                      ) : c.skipped ? (
                                        <Tag color="default">跳过</Tag>
                                      ) : (
                                        <Tag color="success">通过</Tag>
                                      ),
                                  },
                                  {
                                    title: '耗时 (s)',
                                    dataIndex: 'time',
                                    width: 90,
                                    render: (t: number) => Number(t ?? 0).toFixed(2),
                                  },
                                  {
                                    title: '失败信息',
                                    key: 'failure',
                                    render: (_, c: JUnitCase) =>
                                      c.failure?.message || c.error?.message ? (
                                        <Text type="danger" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                                          {c.failure?.message || c.error?.message}
                                        </Text>
                                      ) : c.system_out ? (
                                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{c.system_out}</Text>
                                      ) : (
                                        '-'
                                      ),
                                  },
                                ]}
                                locale={{
                                  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该套件无用例数据" />,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 JUnit 报告数据（任务可能未完成或未产出报告）" />
                    )}
                  </Card>
                ),
              },
              {
                key: 'html',
                label: (
                  <Space size={4}>
                    <FileTextOutlined />
                    <span>HTML 测试报告</span>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        在线渲染第三方测试报告引擎产出的静态 HTML（如 Allure、Mochawesome、Newman 等）。
                      </Text>
                      <Space>
                        <Button size="small" icon={<FullscreenOutlined />} onClick={() => setHtmlReportModalOpen(true)}>
                          放大全屏
                        </Button>
                        <Button size="small" icon={<ExportOutlined />} onClick={() => window.open(getHtmlReportUrl(), '_blank')}>
                          新窗口打开
                        </Button>
                      </Space>
                    </div>
                    {getHtmlReportUrl() ? (
                      <div
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: '#fff',
                          minHeight: 520,
                        }}
                      >
                        <iframe
                          title="HTML Test Report"
                          src={getHtmlReportUrl()}
                          style={{
                            width: '100%',
                            height: 600,
                            border: 'none',
                            display: 'block',
                          }}
                          sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未生成 HTML 报告" />
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* HTML 测试报告全屏沉浸式预览弹窗 */}
      <Modal
        open={htmlReportModalOpen}
        onCancel={() => setHtmlReportModalOpen(false)}
        width="94vw"
        style={{ top: 20 }}
        footer={null}
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0066ff' }} />
            <span>HTML 测试报告全屏预览: {reportTask?.name || ''} #{reportTask?.taskId ?? ''}</span>
          </Space>
        }
        styles={{ body: { height: '82vh', padding: 0 } }}
      >
        {getHtmlReportUrl() && (
          <iframe
            title="Fullscreen HTML Test Report"
            src={getHtmlReportUrl()}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 6,
            }}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        )}
      </Modal>
    </div>
  );
};

export default QualityCenterPage;
