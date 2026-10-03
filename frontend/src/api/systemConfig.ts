import http from './client';

// 1. 缓存清理
export interface DindCleanInfo {
  pod_name: string;
  start_time?: number;
  end_time?: number;
  clean_info?: string;
  error_message?: string;
}

export interface CleanCacheState {
  id?: string;
  status: 'unStart' | 'success' | 'cleaning' | 'failed' | 'timeout' | string;
  update_time?: number;
  cron?: string;
  cron_enabled?: boolean;
  dind_clean_infos?: DindCleanInfo[];
}

export interface SetCleanCronArgs {
  cron: string;
  cron_enabled: boolean;
}

// 2. 系统安全
export interface SecurityAndPrivacySettings {
  token_expiration_time: number; // 默认 24，最大 8640 小时
  mfa_enabled: boolean;          // 需要企业版/专业版 License
  improvement_plan: boolean;     // 参与 Zadig 改进计划
}

// 3. 系统地址
export interface SystemServerURL {
  server_url: string;
}

// 4. 外部链接
export interface ExternalLinkItem {
  id?: string;
  name: string;
  url: string;
  update_by?: string;
  update_time?: number;
  create_time?: number;
}

// 5. 工作流 Hook
export type WorkflowHookEvent = 'start_execute' | 'complete_execute';

export interface WorkflowHookSettings {
  enable: boolean;
  hook_address: string;
  hook_secret?: string;
  hook_events: WorkflowHookEvent[];
}

export const systemConfigApi = {
  // --- 1. 缓存清理 ---
  async getCleanCacheState(): Promise<CleanCacheState> {
    return http.get<CleanCacheState>('/api/aslan/system/cleanCache/state');
  },
  async cleanImageCacheOneClick(): Promise<void> {
    return http.post('/api/aslan/system/cleanCache/oneClick');
  },
  async setCleanCacheCron(payload: SetCleanCronArgs): Promise<void> {
    return http.post('/api/aslan/system/cleanCache/cron', payload);
  },
  async cleanSharedStorage(): Promise<void> {
    return http.post('/api/aslan/system/cleanCache/sharedStorage');
  },

  // --- 2. 系统安全与隐私 ---
  async getSecuritySettings(): Promise<SecurityAndPrivacySettings> {
    return http.get<SecurityAndPrivacySettings>('/api/aslan/system/security');
  },
  async updateSecuritySettings(payload: SecurityAndPrivacySettings): Promise<void> {
    return http.post('/api/aslan/system/security', payload);
  },

  // --- 3. 系统服务地址 ---
  async getServerURL(): Promise<SystemServerURL> {
    return http.get<SystemServerURL>('/api/aslan/system/server/url');
  },
  async updateServerURL(payload: SystemServerURL): Promise<void> {
    return http.put('/api/aslan/system/server/url', payload);
  },

  // --- 4. 外部快捷链接 ---
  async listExternalLinks(): Promise<ExternalLinkItem[]> {
    const res = await http.get<ExternalLinkItem[]>('/api/aslan/system/externalLink');
    return Array.isArray(res) ? res : [];
  },
  async createExternalLink(payload: { name: string; url: string }): Promise<void> {
    return http.post('/api/aslan/system/externalLink', payload);
  },
  async updateExternalLink(id: string, payload: { name: string; url: string }): Promise<void> {
    return http.put(`/api/aslan/system/externalLink/${id}`, payload);
  },
  async deleteExternalLink(id: string): Promise<void> {
    return http.delete(`/api/aslan/system/externalLink/${id}`);
  },

  // --- 5. 全局工作流 Hook ---
  async getWorkflowHook(): Promise<WorkflowHookSettings> {
    return http.get<WorkflowHookSettings>('/api/aslan/system/workflowHook');
  },
  async updateWorkflowHook(payload: WorkflowHookSettings): Promise<void> {
    return http.put('/api/aslan/system/workflowHook', payload);
  },
};

export default systemConfigApi;
