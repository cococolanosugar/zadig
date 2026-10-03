import http from './client';
import { subscribeSSE } from '../utils/sse';

// 与后端 pkg/microservice/aslan/config/consts.go JobType 常量对齐（常用子集）
export type JobType =
  | 'zadig-build'
  | 'zadig-deploy'
  | 'zadig-test'
  | 'zadig-scanning'
  | 'zadig-distribute-image'
  | 'zadig-restart'
  | 'approval'
  | 'custom-deploy'
  | 'freestyle'
  | 'plugin'
  | (string & {});

export interface WorkflowJobSpec {
  service_name?: string;
  service_module?: string;
  env?: string;
  source?: string;
  branch?: string;
  image?: string;
  script?: string;
  dockerfile?: string;
  [key: string]: unknown;
}

export interface WorkflowJob {
  name: string;
  type: JobType;
  spec: WorkflowJobSpec;
  run_policy?: string;
  error_policy?: string;
}

export interface WorkflowStage {
  name: string;
  parallel?: boolean;
  approval?: {
    enabled: boolean;
    type?: string;
    description?: string;
  };
  jobs: WorkflowJob[];
}

export interface WorkflowV4Item {
  name: string;
  project: string;
  display_name?: string;
  description?: string;
  category?: string;
  stages: WorkflowStage[];
  params?: WorkflowParam[];
  created_by?: string;
  created_at?: number;
  updated_at?: number;
  // 列表接口附带字段（/workflow/v4?projectName=）
  isFavorite?: boolean;
  recentTasks?: Array<{
    task_id: number;
    status: string;
    task_creator?: string;
    create_time?: number;
  }>;
  recentSuccessfulTask?: { task_id: number; create_time?: number } | null;
  recentFailedTask?: { task_id: number; create_time?: number } | null;
  successRate?: number;
  averageExecutionTime?: number;
}

// models.Param — 工作流自定义运行时参数（string/text/choice/repo/file）
export interface WorkflowParam {
  name: string;
  description?: string;
  type?: string;
  value?: string;
  choice_option?: string[];
  default?: string;
}

export interface WorkflowTaskExecution {
  id: string;
  task_id: number;
  workflow_name: string;
  workflow_display_name?: string;
  project_name: string;
  status: 'passed' | 'running' | 'failed' | 'waiting' | 'cancelled';
  creator: string;
  create_time: number;
  start_time?: number;
  end_time?: number;
  stages: {
    name: string;
    status: string;
    start_time?: number;
    end_time?: number;
    jobs: {
      name: string;
      type: string;
      status: string;
      error?: string;
      error_policy?: { policy?: string } | null;
      breakpoint_before?: boolean;
      breakpoint_after?: boolean;
    }[];
  }[];
}

export interface WorkflowTaskPreview {
  task_id: number;
  task_creator: string;
  project_name: string;
  workflow_name: string;
  workflow_display_name?: string;
  remark?: string;
  status: 'passed' | 'running' | 'failed' | 'waiting' | 'cancelled' | string;
  create_time: number;
  start_time?: number;
  end_time?: number;
}

export interface ListWorkflowTaskResponse {
  workflow_list: WorkflowTaskPreview[];
  total: number;
}

export const workflowApi = {
  /**
   * List workflows by project (or global if project omitted)
   */
  async getWorkflows(projectName?: string): Promise<WorkflowV4Item[]> {
    try {
      const url = projectName
        ? `/api/aslan/workflow/v4?projectName=${projectName}`
        : '/api/aslan/workflow/v4';
      const res = await http.get<{ workflow_list?: WorkflowV4Item[] } | WorkflowV4Item[]>(
        url,
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) return res;
      if (res && 'workflow_list' in res && Array.isArray(res.workflow_list)) return res.workflow_list;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * List workflow tasks (GET /api/aslan/workflow/v4/workflowtask)
   * Aligned with zadig-ee-portal getCustomWorkflowTaskListAPI (page_num, page_size)
   */
  async getWorkflowTasks(params?: {
    pageNum?: number;
    pageSize?: number;
    projectName?: string;
    workflow_name?: string;
  }): Promise<ListWorkflowTaskResponse> {
    try {
      const queryParams: Record<string, unknown> = {};
      if (params?.pageNum !== undefined) queryParams.page_num = params.pageNum;
      if (params?.pageSize !== undefined) queryParams.page_size = params.pageSize;
      if (params?.projectName) queryParams.projectName = params.projectName;
      if (params?.workflow_name) queryParams.workflow_name = params.workflow_name;
      const res = await http.get<ListWorkflowTaskResponse>('/api/aslan/workflow/v4/workflowtask', {
        params: queryParams,
        skipErrorHandler: true,
      });
      return {
        workflow_list: res?.workflow_list || [],
        total: res?.total || 0,
      };
    } catch {
      return { workflow_list: [], total: 0 };
    }
  },

  /**
   * Get single workflow detail
   */
  async getWorkflow(name: string, projectName: string): Promise<WorkflowV4Item> {
    return http.get<WorkflowV4Item>(`/api/aslan/workflow/v4/name/${name}?projectName=${projectName}`);
  },

  /**
   * Create Workflow V4
   */
  async createWorkflow(payload: Partial<WorkflowV4Item>): Promise<unknown> {
    return http.post('/api/aslan/workflow/v4', payload);
  },

  /**
   * Update Workflow V4
   */
  async updateWorkflow(name: string, payload: Partial<WorkflowV4Item>): Promise<unknown> {
    return http.put(`/api/aslan/workflow/v4/${name}`, payload);
  },

  /**
   * Delete Workflow V4
   */
  async deleteWorkflow(name: string, projectName: string): Promise<unknown> {
    return http.delete(`/api/aslan/workflow/v4/${name}?projectName=${projectName}`);
  },

  /**
   * Get the rendered workflow preset (params + stages) for manual execution.
   * GET /api/aslan/workflow/v4/preset/:name — the returned body (with modified
   * param values) is what POST /workflowtask expects.
   */
  async getWorkflowPreset(name: string): Promise<WorkflowV4Item & { task_id?: number }> {
    return http.get<WorkflowV4Item & { task_id?: number }>(
      `/api/aslan/workflow/v4/preset/${encodeURIComponent(name)}`
    );
  },

  /**
   * Trigger a workflow task. The payload must be the workflow preset body
   * (name/project/params/stages) with user-modified param values.
   * POST /api/aslan/workflow/v4/workflowtask
   */
  async triggerWorkflow(payload: Record<string, unknown>): Promise<{ task_id: number }> {
    return http.post<{ task_id: number }>('/api/aslan/workflow/v4/workflowtask', payload);
  },

  /**
   * Get task execution status and progress
   */
  async getWorkflowTask(
    workflowName: string,
    taskId: number | string,
    projectName: string
  ): Promise<WorkflowTaskExecution> {
    return http.get<WorkflowTaskExecution>(
      `/api/aslan/workflow/v4/workflowtask/workflow/${workflowName}/task/${taskId}?projectName=${projectName}`
    );
  },

  /**
   * Approve / reject a waiting approval stage of a workflow task.
   * POST /api/aslan/workflow/v4/workflowtask/approve?projectName=
   */
  async approveStage(args: {
    workflow_name: string;
    job_name: string;
    task_id: number | string;
    approve: boolean;
    comment?: string;
    project_name?: string;
  }): Promise<unknown> {
    const query = args.project_name ? `?projectName=${encodeURIComponent(args.project_name)}` : '';
    return http.post(
      `/api/aslan/workflow/v4/workflowtask/approve${query}`,
      { ...args, task_id: Number(args.task_id) },
      { skipErrorHandler: true }
    );
  },

  /**
   * Cancel a running workflow task.
   * DELETE /api/aslan/workflow/v4/workflowtask/workflow/:name/task/:taskID?projectName=
   */
  async cancelWorkflowTask(
    workflowName: string,
    taskId: number | string,
    projectName?: string
  ): Promise<unknown> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return http.delete(
      `/api/aslan/workflow/v4/workflowtask/workflow/${encodeURIComponent(workflowName)}/task/${taskId}${query}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Retry a failed workflow task.
   * POST /api/aslan/workflow/v4/workflowtask/retry/workflow/:name/task/:taskID?projectName=
   */
  async retryWorkflowTask(
    workflowName: string,
    taskId: number | string,
    projectName?: string
  ): Promise<unknown> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return http.post(
      `/api/aslan/workflow/v4/workflowtask/retry/workflow/${encodeURIComponent(workflowName)}/task/${taskId}${query}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * Clone a task: returns a workflow body (with original param values) that
   * can be POSTed back to /workflowtask to re-run with the same config.
   * GET /api/aslan/workflow/v4/workflowtask/clone/workflow/:name/task/:taskID?projectName=
   */
  async cloneWorkflowTask(
    workflowName: string,
    taskId: number | string,
    projectName?: string
  ): Promise<Record<string, unknown>> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return http.get<Record<string, unknown>>(
      `/api/aslan/workflow/v4/workflowtask/clone/workflow/${encodeURIComponent(workflowName)}/task/${taskId}${query}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Favorite a workflow. POST /api/aslan/workflow/favorite
   */
  async addFavorite(productName: string, workflowName: string): Promise<unknown> {
    return http.post(
      '/api/aslan/workflow/favorite',
      { product_name: productName, name: workflowName, type: 'workflow_v4' },
      { skipErrorHandler: true }
    );
  },

  /**
   * Unfavorite a workflow. DELETE /api/aslan/workflow/favorite/:productName/:name/:type
   */
  async deleteFavorite(productName: string, workflowName: string): Promise<unknown> {
    return http.delete(
      `/api/aslan/workflow/favorite/${encodeURIComponent(productName)}/${encodeURIComponent(workflowName)}/workflow_v4?projectName=${encodeURIComponent(productName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * List custom general-webhook triggers of a workflow.
   * GET /api/aslan/workflow/v4/generalhook/:workflowName
   */
  async listGeneralHooks(workflowName: string): Promise<Array<{ name: string; enabled: boolean; description?: string }>> {
    try {
      const res = await http.get<Array<{ name: string; enabled: boolean; description?: string }>>(
        `/api/aslan/workflow/v4/generalhook/${encodeURIComponent(workflowName)}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /**
   * Get the preset (rendered workflow args) for creating a general-webhook trigger.
   * GET /api/aslan/workflow/v4/generalhook/preset
   */
  async getGeneralHookPreset(
    workflowName: string
  ): Promise<{ name?: string; workflow_arg?: unknown }> {
    return http.get<{ name?: string; workflow_arg?: unknown }>(
      `/api/aslan/workflow/v4/generalhook/preset?workflowName=${encodeURIComponent(workflowName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Create a custom general-webhook trigger.
   * POST /api/aslan/workflow/v4/generalhook/:workflowName
   */
  async createGeneralHook(
    workflowName: string,
    payload: { name: string; enabled: boolean; description?: string; workflow_arg?: unknown }
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/workflow/v4/generalhook/${encodeURIComponent(workflowName)}`,
      payload,
      { skipErrorHandler: true }
    );
  },

  /**
   * Delete a custom general-webhook trigger.
   * DELETE /api/aslan/workflow/v4/generalhook/:workflowName/:hookName
   */
  async deleteGeneralHook(workflowName: string, hookName: string): Promise<unknown> {
    return http.delete(
      `/api/aslan/workflow/v4/generalhook/${encodeURIComponent(workflowName)}/${encodeURIComponent(hookName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Job-level K8s events of a workflow task.
   * GET /api/aslan/workflow/v4/workflowtask/workflow/:workflowName/task/:taskID/job/:jobName/events?projectName=
   * Aligned with zadig-ee-portal getCustomWorkflowTaskJobEventsAPI
   */
  async getJobEvents(
    workflowName: string,
    taskId: number | string,
    jobName: string,
    projectName?: string
  ): Promise<Array<{ event_type: string; time: string; message: string }>> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    try {
      const res = await http.get<Array<{ event_type: string; time: string; message: string }>>(
        `/api/aslan/workflow/v4/workflowtask/workflow/${encodeURIComponent(workflowName)}/task/${taskId}/job/${encodeURIComponent(jobName)}/events${query}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /**
   * Manual error handling for a failed job (decision: reject=终止 | ignore=忽略继续).
   * POST /api/aslan/workflow/v4/workflowtask/handle/error
   */
  async handleJobError(args: {
    workflow_name: string;
    job_name: string;
    task_id: number | string;
    decision: 'reject' | 'ignore';
  }): Promise<unknown> {
    return http.post(
      '/api/aslan/workflow/v4/workflowtask/handle/error',
      { ...args, task_id: Number(args.task_id) },
      { skipErrorHandler: true }
    );
  },

  /**
   * Re-run a single failed job. POST /api/aslan/workflow/v4/workflowtask/revert/:workflowName/:jobName/task/:taskID
   */
  async revertJob(workflowName: string, jobName: string, taskId: number | string): Promise<unknown> {
    return http.post(
      `/api/aslan/workflow/v4/workflowtask/revert/${encodeURIComponent(workflowName)}/${encodeURIComponent(jobName)}/task/${taskId}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * Enable debug mode for a running workflow task.
   * POST /api/aslan/workflow/v4/workflowtask/debug/:workflowName/task/:taskID?projectName=
   */
  async enableWorkflowTaskDebug(workflowName: string, taskId: number | string, projectName?: string): Promise<unknown> {
    const q = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return http.post(
      `/api/aslan/workflow/v4/workflowtask/debug/${encodeURIComponent(workflowName)}/task/${taskId}${q}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * Finish / stop debug shell for a workflow job task.
   * DELETE /api/aslan/workflow/v4/workflowtask/debug/:workflowName/:jobName/task/:taskID/:position?projectName=
   */
  async stopWorkflowTaskJobDebug(
    workflowName: string,
    jobName: string,
    taskId: number | string,
    position = 'before',
    projectName?: string
  ): Promise<unknown> {
    const q = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    return http.delete(
      `/api/aslan/workflow/v4/workflowtask/debug/${encodeURIComponent(workflowName)}/${encodeURIComponent(jobName)}/task/${taskId}/${encodeURIComponent(position)}${q}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Set or unset breakpoint for a workflow task job.
   * POST /api/aslan/workflow/v4/workflowtask/breakpoint/:workflowName/:jobName/task/:taskID/:position?operation=&projectName=
   */
  async setWorkflowTaskBreakpoint(
    workflowName: string,
    jobName: string,
    taskId: number | string,
    position: 'before' | 'after',
    operation: 'set' | 'unset',
    projectName?: string
  ): Promise<unknown> {
    const params: Record<string, string> = { operation };
    if (projectName) params.projectName = projectName;
    return http.post(
      `/api/aslan/workflow/v4/workflowtask/breakpoint/${encodeURIComponent(workflowName)}/${encodeURIComponent(jobName)}/task/${taskId}/${encodeURIComponent(position)}`,
      {},
      { params, skipErrorHandler: true }
    );
  },

  /**
   * Subscribe to running workflow tasks SSE stream.
   * GET /api/aslan/workflow/sse/workflowTasks/running
   */
  subscribeRunningWorkflowTasksSSE(
    onMessage: (tasks: WorkflowTaskPreview[]) => void,
    onError?: (err: unknown) => void
  ): () => void {
    return subscribeSSE<WorkflowTaskPreview[]>('/api/aslan/workflow/sse/workflowTasks/running', {
      onMessage,
      onError,
    });
  },

  /**
   * Subscribe to pending workflow tasks SSE stream.
   * GET /api/aslan/workflow/sse/workflowTasks/pending
   */
  subscribePendingWorkflowTasksSSE(
    onMessage: (tasks: WorkflowTaskPreview[]) => void,
    onError?: (err: unknown) => void
  ): () => void {
    return subscribeSSE<WorkflowTaskPreview[]>('/api/aslan/workflow/sse/workflowTasks/pending', {
      onMessage,
      onError,
    });
  },

  /**
   * List custom workflow view names for a project.
   * GET /api/aslan/workflow/view?projectName=
   */
  async getWorkflowViews(projectName: string): Promise<string[]> {
    return http.get<string[]>(`/api/aslan/workflow/view`, {
      params: { projectName },
      skipErrorHandler: true,
    });
  },

  /**
   * Get workflow view preset (including all project workflows with enabled states).
   * GET /api/aslan/workflow/view/preset?projectName=&viewName=
   */
  async getWorkflowViewPreset(projectName: string, viewName = ''): Promise<WorkflowViewItem> {
    return http.get<WorkflowViewItem>(`/api/aslan/workflow/view/preset`, {
      params: { projectName, viewName },
      skipErrorHandler: true,
    });
  },

  /**
   * Create a new custom workflow view.
   * POST /api/aslan/workflow/view
   */
  async createWorkflowView(view: {
    name: string;
    project_name: string;
    workflows: WorkflowViewDetail[];
  }): Promise<void> {
    return http.post(`/api/aslan/workflow/view`, view);
  },

  /**
   * Update an existing custom workflow view.
   * PUT /api/aslan/workflow/view
   */
  async updateWorkflowView(view: {
    id?: string;
    name: string;
    project_name: string;
    workflows: WorkflowViewDetail[];
  }): Promise<void> {
    return http.put(`/api/aslan/workflow/view`, view);
  },

  /**
   * Delete a custom workflow view.
   * DELETE /api/aslan/workflow/view?projectName=&viewName=
   */
  async deleteWorkflowView(projectName: string, viewName: string): Promise<void> {
    return http.delete(`/api/aslan/workflow/view`, {
      params: { projectName, viewName },
    });
  },
};

export interface WorkflowViewDetail {
  workflow_name: string;
  workflow_type: string;
  workflow_display_name?: string;
  enabled?: boolean;
}

export interface WorkflowViewItem {
  id?: string;
  name: string;
  project_name: string;
  workflows: WorkflowViewDetail[];
  update_by?: string;
  update_time?: number;
}

export default workflowApi;
