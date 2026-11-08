import http from './client';
import { subscribeSSE } from '../utils/sse';

export type JobType =
  | 'zadig-build'
  | 'zadig-deploy'
  | 'zadig-helm-chart-deploy'
  | 'zadig-vm-deploy'
  | 'custom-deploy'
  | 'k8s-resource-patch'
  | 'offline-service'
  | 'notification'
  | 'workflow-trigger'
  | 'k8s-blue-green-deploy'
  | 'k8s-blue-green-release'
  | 'k8s-canary-deploy'
  | 'k8s-canary-release'
  | 'k8s-gray-release'
  | 'k8s-gray-rollback'
  | 'istio-release'
  | 'istio-rollback'
  | 'update-env-istio-config'
  | 'zadig-test'
  | 'zadig-scanning'
  | 'zadig-distribute-image'
  | 'zadig-restart'
  | 'approval'
  | 'freestyle'
  | 'sql'
  | 'plugin'
  | 'jenkins'
  | (string & {});

export interface DeployHelmChartItem {
  release_name: string;
  chart_repo?: string;
  chart_name?: string;
  chart_version?: string;
  values_yaml?: string;
  override_kvs?: string;
}

export interface ServiceAndVMDeployItem {
  service_name: string;
  service_module: string;
  deploy_name: string;
  deploy_artifact_type?: 'file' | 'image' | string;
  artifact_url?: string;
  file_name?: string;
  image?: string;
  key_vals?: Array<{ key: string; value: string }>;
  repos?: Array<{
    codehost_id?: number;
    repo_name?: string;
    repo_owner?: string;
    branch?: string;
    commit_id?: string;
  }>;
}

export interface CustomDeployTargetItem {
  target: string;
  image?: string;
  image_name?: string;
}

export interface K8sPatchItem {
  resource_name: string;
  resource_kind: string;
  resource_group?: string;
  resource_version?: string;
  patch_content: string;
  patch_strategy?: 'strategic-merge' | 'merge' | 'json' | string;
}

export interface ServiceTriggerWorkflowInfoItem {
  service_name?: string;
  service_module?: string;
  workflow_name: string;
  project_name: string;
  params?: Array<{ name: string; value: string }>;
}

export interface BlueGreenDeployV2ServiceItem {
  service_name: string;
  blue_service_yaml?: string;
  blue_service_name?: string;
  blue_deployment_yaml?: string;
  blue_deployment_name?: string;
  green_deployment_name?: string;
  green_service_name?: string;
  service_and_image?: Array<{
    service_module: string;
    image: string;
    image_name?: string;
  }>;
}

export interface CanaryTargetItem {
  k8s_service_name: string;
  container_name: string;
  image: string;
  canary_percentage: number;
  deploy_timeout?: number;
  workload_name?: string;
  workload_type?: string;
}

export interface GrayReleaseTargetItem {
  workload_type: string;
  workload_name: string;
  replica?: number;
  container_name: string;
  image?: string;
}

export interface GrayRollbackTargetItem {
  workload_type: string;
  workload_name: string;
  origin_image?: string;
  origin_replica?: number;
}

export interface IstioJobTargetItem {
  workload_name: string;
  container_name: string;
  image?: string;
}

export interface IstioWeightConfigItem {
  env_name: string;
  weight: number;
}

export interface IstioHeaderMatchConfigItem {
  key: string;
  value: string;
}

export interface WorkflowJobSpec {
  service_name?: string;
  service_module?: string;
  env?: string;
  source?: string;
  branch?: string;
  image?: string;
  script?: string;
  sql?: string;
  type?: string;
  id?: string;
  dockerfile?: string;
  deploy_helm_charts?: DeployHelmChartItem[];
  skip_check_run_status?: boolean;
  service_and_vm_deploys?: ServiceAndVMDeployItem[];
  env_source?: string;
  ref_repos?: boolean;
  s3_storage_id?: string;
  docker_registry_id?: string;
  origin_job_name?: string;
  // 批次 19b-1 扩展
  namespace?: string;
  cluster_id?: string;
  cluster_source?: string;
  timeout?: number;
  targets?: CustomDeployTargetItem[];
  patch_items?: K8sPatchItem[];
  env_type?: string;
  env_name?: string;
  services?: string[];
  webhook_type?: string;
  content?: string;
  title?: string;
  webhook_notification_config?: { webhook: string };
  wechat_notification_config?: { webhook: string };
  dingding_notification_config?: { webhook: string; is_at_all?: boolean; at_mobiles?: string[] };
  feishu_notification_config?: { webhook: string };
  trigger_type?: string;
  is_enable_check?: boolean;
  fixed_workflow_list?: ServiceTriggerWorkflowInfoItem[];
  // 批次 19b-2 (蓝绿/金丝雀/灰度/Istio)
  version?: string;
  production?: boolean;
  from_job?: string;
  deploy_timeout?: number;
  release_timeout?: number;
  rollback_timeout?: number;
  gray_scale?: number;
  weight?: number;
  replica_percentage?: number;
  base_env?: string;
  grayscale_strategy?: string;
  bg_services?: BlueGreenDeployV2ServiceItem[];
  canary_targets?: CanaryTargetItem[];
  gray_targets?: GrayReleaseTargetItem[];
  gray_rollback_targets?: GrayRollbackTargetItem[];
  istio_targets?: IstioJobTargetItem[];
  weight_configs?: IstioWeightConfigItem[];
  header_match_configs?: IstioHeaderMatchConfigItem[];
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
  choice_value?: string[];
  script?: string;
  call_function?: string;
  default?: string;
}

export interface WorkflowTaskExecution {
  id: string;
  task_id: number;
  workflow_name: string;
  workflow_display_name?: string;
  project_name: string;
  // wait_for_approval: 后端真实审批态 (config.StatusWaitingApprove)；pause: 手动执行挂起
  status: 'passed' | 'running' | 'failed' | 'waiting' | 'cancelled' | 'wait_for_approval' | 'pause' | 'timeout';
  creator: string;
  create_time: number;
  start_time?: number;
  end_time?: number;
  stages: {
    name: string;
    status: string;
    start_time?: number;
    end_time?: number;
    manual_exec?: {
      enabled: boolean;
      modify_params?: boolean;
      excuted?: boolean;
      manual_exec_users?: Array<{ user_id?: string; user_name?: string; type?: string }>;
      manual_exector_id?: string;
      manual_exector_name?: string;
    };
    jobs: {
      name: string;
      type: string;
      status: string;
      error?: string;
      error_policy?: { policy?: string } | null;
      breakpoint_before?: boolean;
      breakpoint_after?: boolean;
      // 任务执行时后端返回的 JobTask Spec（models.TaskJob.Spec，json:"spec"）
      // 部署类 Job 通过 env 回填目标环境；审批类 Job 通过 native_approval 回填审批人。
      spec?: {
        env?: string;
        env_name?: string;
        approve_users?: TaskJobApproverItem[];
        native_approval?: { approve_users?: TaskJobApproverItem[] };
      };
    }[];
  }[];
}

// 审批人条目（models.User）：user_id/user_name 为用户，group_id/group_name 为用户组
export interface TaskJobApproverItem {
  type?: string;
  user_id?: string;
  user_name?: string;
  group_id?: string;
  group_name?: string;
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
   * P1-E1: HTTP 故障不再吞为空数组，异常上抛由调用方呈现错误态；仅对成功响应做防御性解析
   */
  async getWorkflows(projectName?: string): Promise<WorkflowV4Item[]> {
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
  },

  /**
   * List workflow tasks (GET /api/aslan/workflow/v4/workflowtask)
   * Aligned with zadig-ee-portal getCustomWorkflowTaskListAPI (page_num, page_size)
   * P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析
   */
  async getWorkflowTasks(params?: {
    pageNum?: number;
    pageSize?: number;
    projectName?: string;
    workflow_name?: string;
  }): Promise<ListWorkflowTaskResponse> {
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
   * P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析
   */
  async listGeneralHooks(workflowName: string): Promise<Array<{ name: string; enabled: boolean; description?: string }>> {
    const res = await http.get<Array<{ name: string; enabled: boolean; description?: string }>>(
      `/api/aslan/workflow/v4/generalhook/${encodeURIComponent(workflowName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
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
    const res = await http.get<Array<{ event_type: string; time: string; message: string }>>(
      `/api/aslan/workflow/v4/workflowtask/workflow/${encodeURIComponent(workflowName)}/task/${taskId}/job/${encodeURIComponent(jobName)}/events${query}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
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

  /**
   * Render dynamic variable options by evaluating script.
   * POST /api/aslan/workflow/v4/dynamicVariable/render?projectName=&jobName=&serviceName=&moduleName=&key=
   */
  async renderDynamicVariables(
    projectName: string,
    jobName: string,
    serviceName: string,
    moduleName: string,
    key: string,
    workflowPayload: unknown
  ): Promise<string[]> {
    return http.post<string[]>(
      '/api/aslan/workflow/v4/dynamicVariable/render',
      workflowPayload,
      {
        params: {
          projectName,
          jobName,
          serviceName,
          moduleName,
          key,
        },
        skipErrorHandler: true,
      }
    );
  },

  /**
   * Get available dynamic placeholder variables for workflow/job.
   * POST /api/aslan/workflow/v4/dynamicVariable/available?jobName=&projectName=&include_runtime=
   */
  async getAvailableDynamicVariables(
    projectName: string,
    jobName: string,
    workflowPayload: unknown,
    includeRuntime = false
  ): Promise<string[]> {
    return http.post<string[]>(
      '/api/aslan/workflow/v4/dynamicVariable/available',
      workflowPayload,
      {
        params: {
          projectName,
          jobName,
          include_runtime: includeRuntime,
        },
        skipErrorHandler: true,
      }
    );
  },

  /**
   * Extract patch params from patch content YAML.
   * POST /api/aslan/workflow/v4/patch
   */
  async getPatchParams(payload: {
    resource_name?: string;
    resource_kind?: string;
    resource_group?: string;
    resource_version?: string;
    patch_content: string;
    params?: Array<{ name: string; params_type?: string }>;
    patch_strategy?: string;
  }): Promise<Array<{ name: string; params_type?: string }>> {
    return http.post<Array<{ name: string; params_type?: string }>>(
      '/api/aslan/workflow/v4/patch',
      payload,
      { skipErrorHandler: true }
    );
  },

  /**
   * Merge image URI into Helm values YAML.
   * POST /api/aslan/workflow/v4/deploy/mergeImage?projectName=
   */
  async mergeHelmDeployImage(
    projectName: string,
    payload: HelmDeployJobMergeImageParams
  ): Promise<HelmDeployJobMergeImageResponse> {
    return http.post<HelmDeployJobMergeImageResponse>(
      '/api/aslan/workflow/v4/deploy/mergeImage',
      payload,
      {
        params: { projectName },
        skipErrorHandler: true,
      }
    );
  },

  /**
   * 校验 SQL 脚本语法（支持 MySQL / MariaDB）
   * POST /api/aslan/workflow/v4/sql/validate (pkg/microservice/aslan/core/workflow/handler/router.go:123)
   */
  async validateSQL(payload: {
    type: 'mysql' | 'mariadb';
    sql: string;
  }): Promise<Array<{ message: string }>> {
    try {
      const res = await http.post<Array<{ message: string }>>(
        '/api/aslan/workflow/v4/sql/validate',
        payload,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data?.description ||
        (err as { message?: string })?.message ||
        'SQL 校验失败';
      return [{ message: msg }];
    }
  },

  /**
   * 获取工作流任务阶段手动执行信息（返回 WorkflowV4 结构）
   * GET /api/aslan/workflow/v4/workflowtask/manualexec/workflow/:workflowName/task/:taskID?projectName=&stageName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:142, workflow_task_v4.go:394-432)
   */
  getManualExecTaskInfo(
    workflowName: string,
    taskId: number | string,
    projectName: string,
    stageName?: string
  ) {
    return http.get<Record<string, unknown>>(
      `/api/aslan/workflow/v4/workflowtask/manualexec/workflow/${encodeURIComponent(workflowName)}/task/${taskId}?projectName=${encodeURIComponent(projectName)}${stageName ? `&stageName=${encodeURIComponent(stageName)}` : ''}`
    );
  },

  /**
   * 触发阶段手动执行，可修改阶段内任务参数
   * POST /api/aslan/workflow/v4/workflowtask/manualexec/workflow/:workflowName/task/:taskID?projectName=&stageName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:141, workflow_task_v4.go:488-510)
   */
  manualExecWorkflowTask(
    workflowName: string,
    taskId: number | string,
    stageName: string,
    payload: { jobs: unknown[] },
    projectName: string
  ) {
    return http.post<void>(
      `/api/aslan/workflow/v4/workflowtask/manualexec/workflow/${encodeURIComponent(workflowName)}/task/${taskId}?projectName=${encodeURIComponent(projectName)}&stageName=${encodeURIComponent(stageName)}`,
      payload
    );
  },

  /**
   * 拉取蓝绿部署服务当前的 K8s Service YAML
   * GET /api/aslan/workflow/v4/bluegreen/:envName/:serviceName?projectName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:121)
   */
  getBlueGreenServiceYaml(projectName: string, envName: string, serviceName: string) {
    return http.get<string>(
      `/api/aslan/workflow/v4/bluegreen/${encodeURIComponent(envName)}/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * 工作流静态配置 Lint 语法与拓扑校验
   * POST /api/aslan/workflow/v4/lint
   * (pkg/microservice/aslan/core/workflow/handler/router.go:74)
   */
  lintWorkflow(workflowData: unknown) {
    return http.post<void>('/api/aslan/workflow/v4/lint', workflowData, { skipErrorHandler: true });
  },

  /**
   * 获取工作流任务历史列表的自定义列字段
   * GET /api/aslan/workflow/v4/workflowtask/:workflowName/field?projectName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:69)
   */
  getWorkflowTaskCustomFields(workflowName: string, projectName: string) {
    return http.get<string[]>(
      `/api/aslan/workflow/v4/workflowtask/${encodeURIComponent(workflowName)}/field?projectName=${encodeURIComponent(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * 保存工作流任务历史列表的自定义列字段
   * POST /api/aslan/workflow/v4/workflowtask/:workflowName/field?projectName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:68)
   */
  setWorkflowTaskCustomFields(workflowName: string, projectName: string, customFields: unknown) {
    return http.post<void>(
      `/api/aslan/workflow/v4/workflowtask/${encodeURIComponent(workflowName)}/field?projectName=${encodeURIComponent(projectName)}`,
      customFields
    );
  },

  /**
   * 获取可触发的工作流列表清单
   * GET /api/aslan/workflow/v4/trigger?projectName=
   * (pkg/microservice/aslan/core/workflow/handler/router.go:73, workflow_v4.go:791-796)
   */
  async getAvailableTriggerWorkflows(projectName?: string) {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    const res = await http.get<Array<{
      name?: string;
      workflow_name?: string;
      display_name?: string;
      project_name?: string;
      params?: Array<{ name: string; type?: string; value?: string; default_value?: string; desc?: string }>;
    }>>(`/api/aslan/workflow/v4/trigger${query}`);
    if (!Array.isArray(res)) return [];
    return res.map((w) => {
      const name = w.name || w.workflow_name || '';
      return {
        ...w,
        name,
        workflow_name: name,
      };
    });
  },

  /**
   * 获取指定 Jenkins 任务的动态构建参数配置
   * GET /api/aslan/workflow/v4/jenkins/:jenkinsId/*jobName
   * (pkg/microservice/aslan/core/workflow/handler/router.go:122)
   */
  getJenkinsJobParams(jenkinsId: string | number, jobName: string) {
    const cleanJob = jobName.startsWith('/') ? jobName.slice(1) : jobName;
    return http.get<Array<{
      name: string;
      type: string;
      desc?: string;
      default_value?: unknown;
      choices?: string[];
    }>>(`/api/aslan/workflow/v4/jenkins/${encodeURIComponent(jenkinsId)}/${cleanJob}`);
  },

  /**
   * 校验工作流审批发起人/审批权限
   * POST /api/aslan/workflow/v4/check/:workflowName
   * (pkg/microservice/aslan/core/workflow/handler/router.go:75, workflow_v4.go:630-635)
   */
  checkWorkflowApproval(workflowName: string) {
    return http.post<{ message?: string }>(
      `/api/aslan/workflow/v4/check/${encodeURIComponent(workflowName)}`
    );
  },

  /**
   * 获取工作流 V4 测试任务 JUnit XML 格式测试报告
   * GET /api/aslan/testing/itreport/workflowv4/:workflowName/id/:taskId/job/:jobName?projectName=
   * (pkg/microservice/aslan/core/stat/handler/router.go)
   */
  getTestJunitReport(workflowName: string, taskId: number | string, jobName: string, projectName: string) {
    return http.get<any>(
      `/api/aslan/testing/itreport/workflowv4/${encodeURIComponent(workflowName)}/id/${taskId}/job/${encodeURIComponent(jobName)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * 获取工作流 V4 测试任务工作空间产物与文件列表
   * GET /api/aslan/testing/workspace/workflowv4/:workflowName/taskId/:taskId/job/:jobName?projectName=
   * (pkg/microservice/aslan/core/workflow/testing/service/workspace.go:43-46)
   */
  async getTestWorkspaceFiles(workflowName: string, taskId: number | string, jobName: string, projectName: string) {
    const res = await http.get<any>(
      `/api/aslan/testing/workspace/workflowv4/${encodeURIComponent(workflowName)}/taskId/${taskId}/job/${encodeURIComponent(jobName)}?projectName=${encodeURIComponent(projectName)}`
    );
    if (Array.isArray(res)) {
      return { file_names: res.map((f: any) => (typeof f === 'string' ? f : f?.name || '')) };
    }
    if (res && Array.isArray(res.file_names)) {
      return res as { file_names: string[]; not_history_file_flag?: boolean };
    }
    return { file_names: [] };
  },

  /**
   * 获取全局发布工作流清单
   * GET /api/aslan/workflow/v4/global?keyword=
   */
  getGlobalReleaseWorkflows(keyword?: string) {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    return http.get<any[]>(`/api/aslan/workflow/v4/global${query}`);
  },

  /**
   * 获取工作流 Jira Webhook 触发配置列表
   * GET /api/aslan/workflow/v4/jirahook/:workflowName
   */
  getJiraHooks(workflowName: string) {
    return http.get<any[]>(`/api/aslan/workflow/v4/jirahook/${encodeURIComponent(workflowName)}`);
  },

  /**
   * 新增工作流 Jira Webhook 触发配置
   * POST /api/aslan/workflow/v4/jirahook/:workflowName
   * (pkg/microservice/aslan/core/workflow/handler/router.go:96)
   */
  addJiraHook(workflowName: string, payload: any) {
    return http.post<any>(`/api/aslan/workflow/v4/jirahook/${encodeURIComponent(workflowName)}`, payload);
  },

  /**
   * 更新工作流 Jira Webhook 触发配置
   * PUT /api/aslan/workflow/v4/jirahook/:workflowName
   */
  updateJiraHook(workflowName: string, payload: any) {
    return http.put<any>(`/api/aslan/workflow/v4/jirahook/${encodeURIComponent(workflowName)}`, payload);
  },

  /**
   * 删除工作流 Jira Webhook 触发配置
   * DELETE /api/aslan/workflow/v4/jirahook/:workflowName/:hookName
   */
  deleteJiraHook(workflowName: string, hookName: string) {
    return http.delete(`/api/aslan/workflow/v4/jirahook/${encodeURIComponent(workflowName)}/${encodeURIComponent(hookName)}`);
  },

  /**
   * 获取工作流 Jira Webhook 预设模板
   * GET /api/aslan/workflow/v4/jirahook/preset?workflowName=
   */
  getJiraHookPreset(workflowName: string) {
    return http.get<any>(`/api/aslan/workflow/v4/jirahook/preset?workflowName=${encodeURIComponent(workflowName)}`);
  },

  /**
   * 获取工作流飞书/Meego Webhook 触发配置列表
   * GET /api/aslan/workflow/v4/meegohook/:workflowName
   */
  getLarkHooks(workflowName: string) {
    return http.get<any[]>(`/api/aslan/workflow/v4/meegohook/${encodeURIComponent(workflowName)}`);
  },

  /**
   * 新增工作流飞书/Meego Webhook 触发配置
   * POST /api/aslan/workflow/v4/meegohook/:workflowName
   * (pkg/microservice/aslan/core/workflow/handler/router.go:101)
   */
  addLarkHook(workflowName: string, payload: any) {
    return http.post<any>(`/api/aslan/workflow/v4/meegohook/${encodeURIComponent(workflowName)}`, payload);
  },

  /**
   * 更新工作流飞书/Meego Webhook 触发配置
   * PUT /api/aslan/workflow/v4/meegohook/:workflowName
   */
  updateLarkHook(workflowName: string, payload: any) {
    return http.put<any>(`/api/aslan/workflow/v4/meegohook/${encodeURIComponent(workflowName)}`, payload);
  },

  /**
   * 删除工作流飞书/Meego Webhook 触发配置
   * DELETE /api/aslan/workflow/v4/meegohook/:workflowName/:hookName
   */
  deleteLarkHook(workflowName: string, hookName: string) {
    return http.delete(`/api/aslan/workflow/v4/meegohook/${encodeURIComponent(workflowName)}/${encodeURIComponent(hookName)}`);
  },

  /**
   * 获取工作流飞书/Meego Webhook 预设模板
   * GET /api/aslan/workflow/v4/meegohook/preset?workflowName=
   */
  getLarkHookPreset(workflowName: string) {
    return http.get<any>(`/api/aslan/workflow/v4/meegohook/preset?workflowName=${encodeURIComponent(workflowName)}`);
  },

  /**
   * 获取官方工作流插件模板清单
   * GET /api/aslan/workflow/plugin/template
   * (pkg/microservice/aslan/core/workflow/handler/router.go:173)
   */
  listPluginTemplates() {
    return http.get<any[]>('/api/aslan/workflow/plugin/template');
  },

  /**
   * 获取自定义工作流插件仓库列表
   * GET /api/aslan/workflow/plugin
   * (pkg/microservice/aslan/core/workflow/handler/router.go:176)
   */
  listPluginRepositories() {
    return http.get<any[]>('/api/aslan/workflow/plugin');
  },

  /**
   * 新增或更新用户自定义插件仓库
   * POST /api/aslan/workflow/plugin
   */
  upsertUserPluginRepo(payload: any) {
    return http.post<any>('/api/aslan/workflow/plugin', payload);
  },

  /**
   * 新增或更新企业级插件仓库
   * POST /api/aslan/workflow/plugin/enterprise
   */
  upsertEnterprisePluginRepo(payload: any) {
    return http.post<any>('/api/aslan/workflow/plugin/enterprise', payload);
  },

  /**
   * 删除工作流插件仓库
   * DELETE /api/aslan/workflow/plugin/:id
   */
  deletePluginRepo(id: string | number) {
    return http.delete(`/api/aslan/workflow/plugin/${encodeURIComponent(id)}`);
  },

  /**
   * 下载工作流任务产物 (通用)
   * GET /api/aslan/workflow/v4/workflowtask/workflow/:workflowName/taskId/:taskId/job/:jobName
   * (pkg/microservice/aslan/core/workflow/handler/router.go:150)
   */
  async downloadArtifactFile(workflowName: string, taskId: number | string, jobName: string) {
    return http.get(
      `/api/aslan/workflow/v4/workflowtask/workflow/${encodeURIComponent(workflowName)}/taskId/${taskId}/job/${encodeURIComponent(jobName)}`,
      { responseType: 'blob' }
    );
  },

  /**
   * 下载工作流构建 Job 产物包
   * GET /api/aslan/workflow/v4/workflowtask/workflow/:workflowName/taskId/:taskId/job/:jobName/build
   * (pkg/microservice/aslan/core/workflow/handler/router.go:151)
   */
  async downloadBuildJobArtifactFile(workflowName: string, taskId: number | string, jobName: string) {
    return http.get(
      `/api/aslan/workflow/v4/workflowtask/workflow/${encodeURIComponent(workflowName)}/taskId/${taskId}/job/${encodeURIComponent(jobName)}/build`,
      { responseType: 'blob' }
    );
  },
};

export interface HelmDeployJobMergeImageParams {
  service_name: string;
  values_yaml: string;
  env_name: string;
  production?: boolean;
  update_service_revision?: boolean;
  service_modules: Array<{
    name?: string;
    image: string;
  }>;
}

export interface HelmDeployJobMergeImageResponse {
  values: string;
}

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
