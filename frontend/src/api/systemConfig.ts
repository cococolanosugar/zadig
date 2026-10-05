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

  // --- 6. 工作流参数与密钥库 (KeyVault) ---
  async listKeyVaultItems(projectName?: string, isSystem = true): Promise<KeyVaultListResponse> {
    const params: Record<string, string> = {};
    if (isSystem) {
      params.isSystem = 'true';
    } else if (projectName) {
      params.projectName = projectName;
    }
    const res = await http.get<KeyVaultListResponse>('/api/aslan/system/keyvault/items', { params });
    return res || { groups: [] };
  },
  async getKeyVaultItem(id: string): Promise<KeyVaultKVItem> {
    return http.get<KeyVaultKVItem>(`/api/aslan/system/keyvault/items/${id}`);
  },
  async createKeyVaultItem(payload: CreateKeyVaultArgs): Promise<void> {
    return http.post('/api/aslan/system/keyvault/items', payload);
  },
  async updateKeyVaultItem(id: string, payload: Partial<CreateKeyVaultArgs>): Promise<void> {
    return http.put(`/api/aslan/system/keyvault/items/${id}`, payload);
  },
  async deleteKeyVaultItem(id: string): Promise<void> {
    return http.delete(`/api/aslan/system/keyvault/items/${id}`);
  },
  async deleteKeyVaultGroup(group: string): Promise<void> {
    return http.delete(`/api/aslan/system/keyvault/groups/${encodeURIComponent(group)}`);
  },
  async listWorkflowParameters(
    scope: 'system' | 'project' = 'system',
    projectName?: string
  ): Promise<WorkflowParameterItem[]> {
    const params: Record<string, string> = { scope };
    if (projectName) params.projectName = projectName;
    const res = await http.get<WorkflowParameterItem[]>('/api/aslan/system/workflow_parameter', { params });
    return Array.isArray(res) ? res : [];
  },

  // --- 7. 系统自定义导航 ---
  async getSystemNavigation(): Promise<CustomNavigationConfig> {
    const res = await http.get<CustomNavigationConfig>('/api/aslan/system/navigation');
    return res || { items: [] };
  },
  async updateSystemNavigation(items: NavigationItem[]): Promise<void> {
    await http.put('/api/aslan/system/navigation', { items });
  },

  // --- 8. Git Webhook 配置 ---
  async getGitWebhookConfig(): Promise<GitWebhookConfig> {
    return http.get<GitWebhookConfig>('/api/aslan/system/webhook/config');
  },
};

export interface GitWebhookConfig {
  url: string;
  secret: string;
}

export interface NavigationItem {
  name: string;
  en_name?: string;
  key: string;
  type: 'folder' | 'item' | string;
  icon_type?: string;
  icon?: string;
  page_type?: string;
  url?: string;
  disabled?: boolean;
  children?: NavigationItem[];
}

export interface CustomNavigationConfig {
  id?: string;
  items: NavigationItem[];
  create_time?: number;
  update_time?: number;
  update_by?: string;
}

export interface KeyVaultKVItem {
  id: string;
  group: string;
  key: string;
  value?: string;
  sensitive?: boolean;
  description?: string;
  project_name?: string;
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
}

export interface KeyVaultGroupItem {
  group: string;
  kvs: KeyVaultKVItem[];
}

export interface KeyVaultListResponse {
  groups: KeyVaultGroupItem[];
}

export interface CreateKeyVaultArgs {
  group: string;
  key: string;
  value: string;
  sensitive?: boolean;
  description?: string;
  project_name?: string;
}

export interface WorkflowParameterItem {
  key: string;
  description: string;
}

export default systemConfigApi;
