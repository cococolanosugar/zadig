import { http } from './client';
import { subscribeSSE } from '../utils/sse';

export interface LogStreamOptions {
  lines?: number;
  onData?: (data: string) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
}

export const logApi = {
  /**
   * 获取测试任务归档容器日志
   * GET /api/aslan/logs/log/testing/:testName/tasks/:taskId?projectName=
   */
  async getTestingLogs(testName: string, taskId: number | string, projectName: string): Promise<string> {
    const res = await http.get<string | { data: string; message?: string }>(
      `/api/aslan/logs/log/testing/${encodeURIComponent(testName)}/tasks/${taskId}?projectName=${encodeURIComponent(projectName)}&lines=99999999`
    );
    if (typeof res === 'string') return res;
    if (res && typeof res.data === 'string') return res.data;
    return JSON.stringify(res, null, 2);
  },

  /**
   * 订阅测试任务实时容器日志流 (SSE)
   * GET /api/aslan/logs/sse/testing/:testName/tasks/:taskId?lines=
   */
  subscribeTestingLogs(
    testName: string,
    taskId: number | string,
    opts: LogStreamOptions = {}
  ): () => void {
    const lines = opts.lines || 1000;
    const url = `/api/aslan/logs/sse/testing/${encodeURIComponent(testName)}/tasks/${taskId}?lines=${lines}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 获取代码扫描任务归档日志
   * GET /api/aslan/logs/log/scanning/:scanId/task/:taskId?projectName=
   */
  async getScanningLogs(scanId: string, taskId: number | string, projectName = ''): Promise<string> {
    const projParam = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    const res = await http.get<string | { data: string; message?: string }>(
      `/api/aslan/logs/log/scanning/${encodeURIComponent(scanId)}/task/${taskId}${projParam}`
    );
    if (typeof res === 'string') return res;
    if (res && typeof res.data === 'string') return res.data;
    return JSON.stringify(res, null, 2);
  },

  /**
   * 订阅代码扫描任务实时日志流 (SSE)
   * GET /api/aslan/logs/sse/scanning/:scanId/task/:taskId?lines=
   */
  subscribeScanningLogs(
    scanId: string,
    taskId: number | string,
    opts: LogStreamOptions = {}
  ): () => void {
    const lines = opts.lines || 1000;
    const url = `/api/aslan/logs/sse/scanning/${encodeURIComponent(scanId)}/task/${taskId}?lines=${lines}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 获取版本发布交付日志
   * GET /api/aslan/logs/log/delivery?projectName=&version=&serviceName=&serviceModule=
   */
  async getDeliveryLogs(params: {
    projectName: string;
    version: string;
    serviceName: string;
    serviceModule: string;
  }): Promise<string> {
    const q = new URLSearchParams({
      projectName: params.projectName,
      version: params.version,
      serviceName: params.serviceName,
      serviceModule: params.serviceModule,
    });
    const res = await http.get<string | { data: string }>(`/api/aslan/logs/log/delivery?${q.toString()}`);
    if (typeof res === 'string') return res;
    if (res && typeof res.data === 'string') return res.data;
    return JSON.stringify(res, null, 2);
  },

  /**
   * 订阅版本发布交付实时日志流 (SSE)
   * GET /api/aslan/logs/sse/delivery/:lines?projectName=&version=&serviceName=&serviceModule=
   */
  subscribeDeliveryLogs(
    params: {
      projectName: string;
      version: string;
      serviceName: string;
      serviceModule: string;
      lines?: number;
    },
    opts: LogStreamOptions = {}
  ): () => void {
    const lines = params.lines || 999999;
    const q = new URLSearchParams({
      projectName: params.projectName,
      version: params.version,
      serviceName: params.serviceName,
      serviceModule: params.serviceModule,
    });
    const url = `/api/aslan/logs/sse/delivery/${lines}?${q.toString()}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 获取工作流 V4 Job 容器日志
   * GET /api/aslan/logs/log/v4/workflow/:workflowName/tasks/:taskId/jobs/:jobName
   */
  async getWorkflowJobLogs(
    workflowName: string,
    taskId: number | string,
    jobName: string
  ): Promise<string> {
    const res = await http.get<string | { data: string }>(
      `/api/aslan/logs/log/v4/workflow/${encodeURIComponent(workflowName)}/tasks/${taskId}/jobs/${encodeURIComponent(jobName)}`
    );
    if (typeof res === 'string') return res;
    if (res && typeof res.data === 'string') return res.data;
    return JSON.stringify(res, null, 2);
  },

  /**
   * 获取工作流 V4 Job 容器实时 SSE URL
   */
  getWorkflowJobSSEUrl(
    workflowName: string,
    taskId: number | string,
    jobName: string,
    lines = 1000
  ): string {
    return `/api/aslan/logs/sse/v4/workflow/${encodeURIComponent(workflowName)}/${taskId}/${encodeURIComponent(jobName)}/${lines}`;
  },

  /**
   * 服务最新集成测试报告
   * GET /api/aslan/testing/itreport/latest/service/:serviceName?projectName=
   */
  async getTestingItReport(serviceName: string, projectName: string): Promise<unknown> {
    return http.get(`/api/aslan/testing/itreport/latest/service/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 测试工作区文件列表与目录
   * GET /api/aslan/testing/workspace/testing/:testName/taskId/:taskId?projectName=&jobName=
   */
  async getTestingWorkspace(testName: string, taskId: number | string, projectName: string, jobName: string): Promise<unknown> {
    return http.get(`/api/aslan/testing/workspace/testing/${encodeURIComponent(testName)}/taskId/${taskId}?projectName=${encodeURIComponent(projectName)}&jobName=${encodeURIComponent(jobName)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 订阅测试任务执行实时事件流 (SSE)
   * GET /api/aslan/testing/sse/:testName/tasks/:taskId?projectName=
   */
  subscribeTestingEvents(testName: string, taskId: number | string, projectName: string, opts: LogStreamOptions = {}): () => void {
    const url = `/api/aslan/testing/sse/${encodeURIComponent(testName)}/tasks/${taskId}?projectName=${encodeURIComponent(projectName)}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 订阅 Jenkins 任务构建实时日志流 (SSE)
   * GET /api/aslan/logs/sse/jenkins/:taskName
   */
  subscribeJenkinsLogs(taskName: string, opts: LogStreamOptions = {}): () => void {
    const url = `/api/aslan/logs/sse/jenkins/${encodeURIComponent(taskName)}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 订阅 Pod 容器实时日志流 (SSE)
   * GET /api/aslan/logs/sse/pods/:podName
   */
  subscribePodLogs(podName: string, opts: LogStreamOptions = {}): () => void {
    const url = `/api/aslan/logs/sse/pods/${encodeURIComponent(podName)}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },

  /**
   * 订阅全量交付日志流 (SSE 999999)
   * GET /api/aslan/logs/sse/delivery/999999
   */
  subscribeDeliveryFullLogs(params: Record<string, string>, opts: LogStreamOptions = {}): () => void {
    const q = new URLSearchParams(params);
    const url = `/api/aslan/logs/sse/delivery/999999?${q.toString()}`;
    return subscribeSSE<string>(url, {
      onMessage: (data: string) => {
        if (opts.onData) opts.onData(data);
      },
      onError: (err: unknown) => {
        if (opts.onError) opts.onError(err);
      },
      onComplete: () => {
        if (opts.onComplete) opts.onComplete();
      },
    });
  },
};

export default logApi;
