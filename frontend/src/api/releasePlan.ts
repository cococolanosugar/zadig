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

export const releasePlanApi = {
  async getPlans(): Promise<ReleasePlanItem[]> {
    try {
      const res = await http.get<ReleasePlanItem[] | { list: ReleasePlanItem[] }>(
        '/api/aslan/release_plan/v1',
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : (res as any)?.list || [];
    } catch {
      try {
        const fallbackRes = await http.get<ReleasePlanItem[] | { list: ReleasePlanItem[] }>(
          '/api/release_plan/v1',
          { skipErrorHandler: true }
        );
        return Array.isArray(fallbackRes) ? fallbackRes : (fallbackRes as any)?.list || [];
      } catch {
        return [];
      }
    }
  },

  async createPlan(data: Partial<ReleasePlanItem>): Promise<void> {
    try {
      await http.post('/api/aslan/release_plan/v1', data);
    } catch {
      await http.post('/api/release_plan/v1', data);
    }
  },

  async deletePlan(id: string): Promise<void> {
    try {
      await http.delete(`/api/aslan/release_plan/v1/${id}`);
    } catch {
      await http.delete(`/api/release_plan/v1/${id}`);
    }
  },
};

export default releasePlanApi;
