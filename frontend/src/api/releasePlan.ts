import http from './client';

export interface ReleasePlanItem {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  manager?: string;
  status?: 'planning' | 'executing' | 'success' | 'failed' | string;
  start_time?: number | string;
  end_time?: number | string;
  release_time?: string;
  created_at?: number | string;
  updated_at?: number | string;
  created_by?: string;
}

// 后端 ListReleasePlanOption: pageNum/pageSize 必填，type ∈ name|manager|success_time|update_time|status
export const releasePlanApi = {
  async getPlans(): Promise<ReleasePlanItem[]> {
    try {
      const res = await http.get<{ list?: ReleasePlanItem[] } | ReleasePlanItem[]>(
        '/api/aslan/release_plan/v1?pageNum=1&pageSize=50&type=name&keyword=&startTime=0&endTime=0',
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) return res;
      return (res as { list?: ReleasePlanItem[] })?.list || [];
    } catch {
      return [];
    }
  },

  async createPlan(data: Partial<ReleasePlanItem>): Promise<void> {
    await http.post('/api/aslan/release_plan/v1', data);
  },

  async deletePlan(id: string): Promise<void> {
    await http.delete(`/api/aslan/release_plan/v1/${id}`);
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
