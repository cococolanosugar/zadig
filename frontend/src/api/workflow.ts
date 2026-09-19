import http from './client';

export type JobType = 'zadig-build' | 'zadig-deploy' | 'custom-deploy' | 'freestyle' | 'plugin';

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
  description?: string;
  category?: string;
  stages: WorkflowStage[];
  created_by?: string;
  created_at?: number;
  updated_at?: number;
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
   * List workflows by project
   */
  async getWorkflows(projectName: string): Promise<WorkflowV4Item[]> {
    try {
      const res = await http.get<{ workflow_list?: WorkflowV4Item[] } | WorkflowV4Item[]>(
        `/api/aslan/workflow/v4?projectName=${projectName}`,
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
   * List workflow tasks
   */
  async getWorkflowTasks(params?: {
    pageNum?: number;
    pageSize?: number;
    projectName?: string;
  }): Promise<ListWorkflowTaskResponse> {
    try {
      const res = await http.get<ListWorkflowTaskResponse>('/api/aslan/workflow/v4/workflowtask', {
        params,
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
   * Trigger workflow execution
   */
  async triggerWorkflow(payload: {
    workflow_name: string;
    project_name: string;
    inputs?: Record<string, unknown>;
  }): Promise<{ task_id: number }> {
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
};

export default workflowApi;
