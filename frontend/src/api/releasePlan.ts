import http from './client';

export interface ReleaseJobItem {
  id: string;
  name: string;
  type?: string;
  status?: string;
  manager?: string;
  executed_by?: string;
  executed_time?: number | string;
  spec?: any;
}

export interface ReleasePlanItem {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  manager?: string;
  status?: 'planning' | 'executing' | 'success' | 'failed' | 'wait_for_approval' | string;
  start_time?: number | string;
  end_time?: number | string;
  release_time?: string;
  created_at?: number | string;
  updated_at?: number | string;
  created_by?: string;
  // 编排任务与审批（R4-A1/A2 真实执行编排接线）
  jobs?: ReleaseJobItem[];
  approval?: any;
}

// 后端 ListReleasePlanOption: pageNum/pageSize 必填，type ∈ name|manager|success_time|update_time|status
export const releasePlanApi = {
  // R4-A1: 移除模式性 catch→[]，HTTP 故障异常上抛由调用方呈现错误态；成功响应保留防御性解析
  async getPlans(): Promise<ReleasePlanItem[]> {
    const res = await http.get<{ list?: ReleasePlanItem[] } | ReleasePlanItem[]>(
      '/api/aslan/release_plan/v1?pageNum=1&pageSize=50&type=name&keyword=&startTime=0&endTime=0',
      { skipErrorHandler: true }
    );
    if (Array.isArray(res)) return res;
    return (res as { list?: ReleasePlanItem[] })?.list || [];
  },

  async createPlan(data: Partial<ReleasePlanItem>): Promise<void> {
    await http.post('/api/aslan/release_plan/v1', data);
  },

  async deletePlan(id: string): Promise<void> {
    await http.delete(`/api/aslan/release_plan/v1/${id}`);
  },

  /** 获取单个发布计划详情 */
  async getPlan(id: string): Promise<ReleasePlanItem> {
    return http.get<ReleasePlanItem>(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}`);
  },

  /** 复制发布计划 */
  async copyPlan(id: string, name: string): Promise<void> {
    await http.post(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/copy`, { name });
  },

  /** 执行发布计划 Job */
  async executeJob(id: string, jobArgs: { id: string; name?: string; type?: string }): Promise<void> {
    await http.post(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/execute`, jobArgs);
  },

  /** 重试发布计划 Job */
  async retryJob(id: string, jobArgs: { id: string }): Promise<void> {
    await http.post(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/retry`, jobArgs);
  },

  /** 跳过发布计划 Job */
  async skipJob(id: string, jobArgs: { id: string }): Promise<void> {
    await http.post(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/skip`, jobArgs);
  },

  /** 审批发布计划 */
  async approvePlan(id: string, comment?: string): Promise<void> {
    await http.post(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/approve`, { comment: comment || '' });
  },

  /** 获取发布计划操作日志 */
  async getPlanLogs(id: string): Promise<any[]> {
    const res = await http.get<any[]>(`/api/aslan/release_plan/v1/${encodeURIComponent(id)}/logs`);
    return Array.isArray(res) ? res : [];
  },

  // --- Release Plan Hook Setting (pkg/microservice/aslan/core/release_plan/handler/router.go:46-47) ---
  async getHookSettings(): Promise<ReleasePlanHookSettings> {
    return http.get<ReleasePlanHookSettings>('/api/aslan/release_plan/v1/hook/setting');
  },

  async updateHookSettings(payload: ReleasePlanHookSettings): Promise<void> {
    await http.put('/api/aslan/release_plan/v1/hook/setting', payload);
  },
};

export interface ReleasePlanHookSettings {
  enable: boolean;
  enable_call_back: boolean;
  hook_address: string;
  hook_secret: string;
  hook_events: string[];
}

export default releasePlanApi;
