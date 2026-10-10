import http from './client';
import { generateAesKey, rsaEncrypt, aesDecrypt } from '../utils/crypto';
import authApi from './auth';

export interface ClusterScheduleStrategy {
  strategy_id?: string;
  strategy_name: string;
  strategy: 'normal' | 'required' | 'preferred' | string;
  node_labels?: string[];
  tolerations?: string;
  default?: boolean;
}

export interface ClusterStrategyReference {
  has_references: boolean;
  strategy_id: string;
  strategy_name: string;
}

export interface ClusterCacheConfig {
  medium_type: 'object' | 'nfs' | string;
  object_properties?: {
    id: string;
  };
  nfs_properties?: {
    provision_type?: 'dynamic' | 'static' | string;
    storage_class?: string;
    storage_size_in_gib?: number;
    pvc?: string;
    access_mode?: string;
    subpath?: string;
    mount_path?: string;
    is_temporary?: boolean;
  };
}

export interface ClusterShareStorageConfig {
  medium_type: 'nfs' | 'object' | '' | string;
  nfs_properties?: {
    provision_type?: 'dynamic' | 'static' | string;
    storage_class?: string;
    storage_size_in_gib?: number;
    pvc?: string;
    access_mode?: string;
    subpath?: string;
    mount_path?: string;
    is_temporary?: boolean;
  };
}

export interface ClusterItem {
  id: string;
  name: string;
  description?: string;
  status?: string;
  type?: string;
  production?: boolean;
  local?: boolean;
  kube_config?: string;
  created_at?: number;
  advanced_config?: {
    strategy?: string;
    project_names?: string[];
    cluster_access_type?: string;
    schedule_workflow?: boolean;
    schedule_strategy?: ClusterScheduleStrategy[];
    tolerations?: string;
  };
  cache?: ClusterCacheConfig;
  share_storage?: ClusterShareStorageConfig;
}

export interface CodeHostItem {
  id: number;
  type: string; // github, gitlab, gitee, gerrit
  name?: string;
  address: string;
  auth_type?: string;
  access_token?: string;
  application_id?: string;
  client_secret?: string;
  alias?: string;
  namespace?: string;
  region?: string;
  created_at?: number;
}

export interface RegistryItem {
  id: string;
  reg_addr: string;
  reg_provider?: string;
  reg_type?: string;
  is_default?: boolean;
  namespace?: string;
  access_key?: string;
  secret_key?: string;
  decrypted_secret_key?: string;
}

export interface StorageItem {
  id: string;
  name?: string;
  endpoint: string;
  bucket: string;
  ak?: string;
  sk?: string;
  decrypted_sk?: string;
  insecure?: boolean;
  is_default?: boolean;
}

export interface UserManagementItem {
  uid: string;
  account: string;
  name: string;
  email: string;
  phone?: string;
  identity_type?: string;
  role?: string;
  created_at?: number;
}

export interface UserGroupItem {
  id: string;
  group_id?: string;
  name: string;
  description?: string;
  type?: 'system' | 'custom' | string;
  system_role_names?: string[];
  user_total?: number;
  uids?: string[];
}

export interface RoleItem {
  name: string;
  desc?: string;
  type?: string;
}

export interface AgentAccessCmdPlatform {
  amd64?: Record<string, string>;
  arm64?: Record<string, string>;
}

export interface AgentAccessCmds {
  linux_platform?: AgentAccessCmdPlatform;
  macos_platform?: AgentAccessCmdPlatform;
  windows_platform?: AgentAccessCmdPlatform;
}

// GET /api/aslan/vm/vms — aslan core/vm AgentBriefListResp
export interface VMItem {
  id?: string;
  name: string;
  label?: string;
  status: string;
  error?: string;
  platform?: string;
  architecture?: string;
  ip?: string;
}

// GET/POST /api/aslan/system/helm — models.HelmRepo
export interface HelmRepoItem {
  id: string;
  repo_name?: string;
  url: string;
  username?: string;
  projects?: string[];
  enable_proxy?: boolean;
  update_by?: string;
  created_at?: number;
  updated_at?: number;
}

// GET/POST/PUT/DELETE /api/aslan/system/proxyManage — models.Proxy
export interface ProxyConfig {
  id?: string;
  type: string; // 'http'
  address: string;
  port: number;
  need_password?: boolean;
  username?: string;
  password?: string;
}

// GET/POST /api/aslan/system/dbinstance — models.DBInstance
export interface DBInstanceItem {
  id: string;
  type?: string;
  name: string;
  projects?: string[];
  host: string;
  port?: string;
  username?: string;
  update_by?: string;
  created_at?: number;
  updated_at?: number;
}

export const settingsApi = {
  // --- Clusters ---
  async getClusters(projectName = ''): Promise<ClusterItem[]> {
    const res = await http.get<ClusterItem[]>(`/api/aslan/cluster/clusters?projectName=${projectName}`);
    return Array.isArray(res) ? res : [];
  },

  async createCluster(payload: Partial<ClusterItem>): Promise<unknown> {
    return http.post('/api/aslan/cluster/clusters', payload);
  },

  async deleteCluster(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/cluster/clusters/${id}`);
  },

  async addOrUpdateClusterStrategy(clusterId: string, strategy: ClusterScheduleStrategy): Promise<ClusterItem> {
    return http.put(`/api/aslan/cluster/clusters/${clusterId}/strategy`, strategy);
  },

  async deleteClusterStrategy(clusterId: string, strategyId: string): Promise<ClusterItem> {
    return http.delete(`/api/aslan/cluster/clusters/${clusterId}/strategy?strategyID=${strategyId}`);
  },

  async getClusterStrategyReferences(clusterId: string): Promise<ClusterStrategyReference[]> {
    const res = await http.get<ClusterStrategyReference[]>(`/api/aslan/cluster/clusters/${clusterId}/strategy/references`);
    return Array.isArray(res) ? res : [];
  },

  async updateClusterCache(clusterId: string, cache: ClusterCacheConfig): Promise<ClusterItem> {
    return http.put(`/api/aslan/cluster/clusters/${clusterId}/cache`, cache);
  },

  async updateClusterShareStorage(clusterId: string, shareStorage: ClusterShareStorageConfig): Promise<ClusterItem> {
    return http.put(`/api/aslan/cluster/clusters/${clusterId}/storage`, shareStorage);
  },

  async checkClusterShareStorageEnabled(clusterId: string): Promise<boolean> {
    const res = await http.get<boolean>(`/api/aslan/workflow/v4/sharestorage?id=${clusterId}`);
    return Boolean(res);
  },

  // --- Code Hosts ---
  // 代码源实际挂载在 systemconfig 服务 /api/v1/codehosts（需 encryptedKey）
  async getCodeHosts(): Promise<CodeHostItem[]> {
    try {
      const publicKey = await authApi.getRSAPublicKey();
      const aesKey = generateAesKey(32);
      const encryptedKey = rsaEncrypt(aesKey, publicKey);
      const res = await http.get<CodeHostItem[]>(
        `/api/v1/codehosts?encryptedKey=${encodeURIComponent(encryptedKey)}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createCodeHost(payload: Partial<CodeHostItem>): Promise<unknown> {
    return http.post('/api/v1/codehosts', payload);
  },

  async deleteCodeHost(id: number | string): Promise<unknown> {
    return http.delete(`/api/v1/codehosts/${id}`);
  },

  // --- Registries ---
  async getRegistries(projectName = ''): Promise<RegistryItem[]> {
    try {
      const publicKey = await authApi.getRSAPublicKey();
      const aesKey = generateAesKey(32);
      const encryptedKey = rsaEncrypt(aesKey, publicKey);

      const res = await http.get<RegistryItem[]>(
        `/api/aslan/system/registry/namespaces?encryptedKey=${encryptedKey}`,
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) {
        return res.map((reg) => {
          let decryptedSecret = reg.secret_key;
          if (reg.secret_key) {
            try {
              decryptedSecret = aesDecrypt(reg.secret_key, aesKey);
            } catch {
              // Keep original
            }
          }
          return { ...reg, decrypted_secret_key: decryptedSecret };
        });
      }
    } catch {
      // Fallback to project registry endpoint
      try {
        const fallbackRes = await http.get<RegistryItem[]>(
          `/api/aslan/system/registry/project?projectName=${projectName}`,
          { skipErrorHandler: true }
        );
        if (Array.isArray(fallbackRes)) return fallbackRes;
      } catch {
        // Return empty
      }
    }
    return [];
  },

  async createRegistry(payload: Partial<RegistryItem>): Promise<unknown> {
    return http.post('/api/aslan/system/registry/namespaces', payload);
  },

  async deleteRegistry(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/registry/namespaces/${id}`);
  },

  // --- Storage (S3 / OSS) ---
  async getStorages(projectName = 'demo-k8s'): Promise<StorageItem[]> {
    try {
      const publicKey = await authApi.getRSAPublicKey();
      const aesKey = generateAesKey(32);
      const encryptedKey = rsaEncrypt(aesKey, publicKey);

      const res = await http.get<StorageItem[]>(
        `/api/aslan/system/s3storage?encryptedKey=${encryptedKey}`,
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) {
        return res.map((st) => {
          let decryptedSk = st.sk;
          if (st.sk) {
            try {
              decryptedSk = aesDecrypt(st.sk, aesKey);
            } catch {
              // fallback
            }
          }
          return { ...st, decrypted_sk: decryptedSk };
        });
      }
    } catch {
      // Fallback to project s3storage endpoint
      try {
        const fallbackRes = await http.get<StorageItem[]>(
          `/api/aslan/system/s3storage/project?projectName=${projectName || 'demo-k8s'}`,
          { skipErrorHandler: true }
        );
        if (Array.isArray(fallbackRes)) return fallbackRes;
      } catch {
        // Return empty
      }
    }
    return [];
  },

  async createStorage(payload: Partial<StorageItem>): Promise<unknown> {
    return http.post('/api/aslan/system/s3storage', payload);
  },

  async deleteStorage(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/s3storage/${id}`);
  },

  // --- Users & RBAC ---
  async getUsers(): Promise<UserManagementItem[]> {
    try {
      const res = await http.post<{ users?: UserManagementItem[] } | UserManagementItem[]>('/api/v1/users/search', {
        page: 1,
        per_page: 200,
      }, { skipErrorHandler: true });
      if (Array.isArray(res)) return res;
      if (res && 'users' in res && Array.isArray(res.users)) return res.users;
      return [];
    } catch {
      return [];
    }
  },

  async createUser(payload: Partial<UserManagementItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/v1/users', payload);
  },

  async deleteUser(uid: string): Promise<unknown> {
    return http.delete(`/api/v1/users/${uid}`);
  },

  async getUserGroups(name?: string, pageNum = 1, pageSize = 200): Promise<UserGroupItem[]> {
    try {
      const query = name ? `&name=${encodeURIComponent(name)}` : '';
      const res = await http.get<{ group_list?: UserGroupItem[]; total?: number } | UserGroupItem[]>(
        `/api/v1/user-group?page_num=${pageNum}&page_size=${pageSize}${query}`,
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.group_list) ? res.group_list : [];
    } catch {
      return [];
    }
  },

  async createUserGroup(payload: { name: string; description?: string; uids?: string[] }): Promise<UserGroupItem> {
    return http.post('/api/v1/user-group', payload);
  },

  async updateUserGroup(id: string, payload: { name: string; description?: string }): Promise<unknown> {
    return http.put(`/api/v1/user-group/${id}`, payload);
  },

  async deleteUserGroup(id: string): Promise<unknown> {
    return http.delete(`/api/v1/user-group/${id}`);
  },

  async getUserGroupDetail(id: string): Promise<UserGroupItem> {
    return http.get(`/api/v1/user-group/${id}`);
  },

  async bulkAddUsersToGroup(id: string, uids: string[]): Promise<unknown> {
    return http.post(`/api/v1/user-group/${id}/bulk-create-users`, { uids });
  },

  async bulkRemoveUsersFromGroup(id: string, uids: string[]): Promise<unknown> {
    return http.post(`/api/v1/user-group/${id}/bulk-delete-users`, { uids });
  },

  /** 用户简表：POST /api/v1/users/brief 无管理员限制（区别于 /users/search 仅系统管理员） */
  async getUsersBrief(): Promise<UserManagementItem[]> {
    try {
      const res = await http.post<{ users?: Array<{ uid?: string; name?: string; account?: string; email?: string; identity_type?: string }> }>(
        '/api/v1/users/brief',
        { page: 1, per_page: 200 },
        { skipErrorHandler: true }
      );
      const users = Array.isArray(res?.users) ? res.users : [];
      return users.map((u) => ({
        uid: u.uid || '',
        account: u.account || '',
        name: u.name || '',
        email: u.email || '',
        identity_type: u.identity_type,
      }));
    } catch {
      return [];
    }
  },

  async getRoles(): Promise<RoleItem[]> {
    try {
      const res = await http.get<RoleItem[]>('/api/v1/policy/roles', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  // --- VM Hosts (mounted at /api/aslan/vm and /api/vm) ---
  async getVMs(label?: string): Promise<VMItem[]> {
    try {
      const query = label ? `?label=${encodeURIComponent(label)}` : '';
      const res = await http.get<VMItem[]>(`/api/aslan/vm/vms${query}`, { skipErrorHandler: true });
      const vmList = Array.isArray(res) ? res : [];
      try {
        const pks = await http.get<Array<{ id: string; name: string }>>('/api/aslan/system/privateKey/internal', {
          skipErrorHandler: true,
        });
        if (Array.isArray(pks)) {
          const pkMap = new Map<string, string>();
          pks.forEach((pk) => {
            if (pk.name && pk.id) pkMap.set(pk.name, pk.id);
          });
          return vmList.map((vm) => ({
            ...vm,
            id: vm.id || pkMap.get(vm.name),
          }));
        }
      } catch {
        // fallback to raw vms
      }
      return vmList;
    } catch {
      return [];
    }
  },

  async getVMLabels(projectName = ''): Promise<string[]> {
    try {
      const res = await http.get<string[]>(`/api/aslan/vm/labels?projectName=${projectName}`, { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createAgentHost(payload: { name: string; label?: string; ip?: string }): Promise<{ vm_id: string }> {
    return http.post('/api/aslan/system/privateKey', {
      name: payload.name,
      label: payload.label || '',
      ip: payload.ip || '',
      type: 'agent',
      agent: {},
      schedule_workflow: true,
    });
  },

  async deleteHost(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/privateKey/${id}`);
  },

  async getVMAccessCmd(vmId: string): Promise<AgentAccessCmds> {
    return http.get(`/api/aslan/vm/${vmId}/agent/access`);
  },

  async offlineVM(vmId: string): Promise<unknown> {
    return http.put(`/api/aslan/vm/${vmId}/agent/offline`);
  },

  async recoveryVM(vmId: string): Promise<unknown> {
    return http.put(`/api/aslan/vm/${vmId}/agent/recovery`);
  },

  async upgradeVMAgent(vmId: string): Promise<{ upgrade_cmd?: Record<string, string>; upgrade?: boolean }> {
    return http.put(`/api/aslan/vm/${vmId}/agent/upgrade`);
  },

  // --- Helm Chart Repos ---
  async getHelmRepos(): Promise<HelmRepoItem[]> {
    try {
      const res = await http.get<HelmRepoItem[]>('/api/aslan/system/helm', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createHelmRepo(payload: Partial<HelmRepoItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/aslan/system/helm', payload);
  },

  async validateHelmRepo(payload: Partial<HelmRepoItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/aslan/system/helm/validate', payload);
  },

  async deleteHelmRepo(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/helm/${id}`);
  },

  // --- DB Instances ---
  async getDBInstances(): Promise<DBInstanceItem[]> {
    try {
      const res = await http.get<DBInstanceItem[]>('/api/aslan/system/dbinstance', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createDBInstance(
    payload: Partial<DBInstanceItem> & { password?: string }
  ): Promise<unknown> {
    return http.post('/api/aslan/system/dbinstance', payload);
  },

  async deleteDBInstance(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/dbinstance/${id}`);
  },

  // --- System Proxy ---
  async getProxies(): Promise<ProxyConfig[]> {
    try {
      const res = await http.get<ProxyConfig[]>('/api/aslan/system/proxyManage', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createProxy(payload: ProxyConfig): Promise<unknown> {
    return http.post('/api/aslan/system/proxyManage', payload);
  },

  async updateProxy(id: string, payload: ProxyConfig): Promise<unknown> {
    return http.put(`/api/aslan/system/proxyManage/${id}`, payload);
  },

  async deleteProxy(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/proxyManage/${id}`);
  },

  async testProxyConnection(payload: ProxyConfig): Promise<unknown> {
    return http.post('/api/aslan/system/proxyManage/connectionTest', payload);
  },

  // --- Capacity Strategy & Cleanup (pkg/microservice/aslan/core/system/handler/capacity.go) ---
  async getCapacityStrategy(target = 'WorkflowTaskRetention'): Promise<CapacityStrategy> {
    return http.get<CapacityStrategy>(`/api/aslan/system/capacity/target/${encodeURIComponent(target)}`);
  },

  async updateCapacityStrategy(payload: CapacityStrategy): Promise<unknown> {
    return http.post('/api/aslan/system/capacity', payload);
  },

  async runSystemGC(dryRun = false): Promise<unknown> {
    return http.post('/api/aslan/system/capacity/gc', { dryrun: dryRun });
  },

  async cleanSystemCache(): Promise<unknown> {
    return http.post('/api/aslan/system/capacity/clean');
  },

  // --- System Language Persistence (pkg/microservice/aslan/core/system/handler/language.go) ---
  async getSystemLanguage(): Promise<string> {
    const res = await http.get<{ language: string }>('/api/aslan/system/language');
    return res.language;
  },

  async setSystemLanguage(language: string): Promise<unknown> {
    return http.put('/api/aslan/system/language', { language });
  },

  // --- Project Management (Jira, Meego, PingCode, Tapd) ---
  async getProjectManagements(): Promise<ProjectManagementItem[]> {
    try {
      const res = await http.get<ProjectManagementItem[]>('/api/aslan/system/project_management', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createProjectManagement(payload: Partial<ProjectManagementItem>): Promise<unknown> {
    return http.post('/api/aslan/system/project_management', payload);
  },

  async updateProjectManagement(id: string, payload: Partial<ProjectManagementItem>): Promise<unknown> {
    return http.put(`/api/aslan/system/project_management/${id}`, payload);
  },

  async deleteProjectManagement(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/project_management/${id}`);
  },

  async validateProjectManagement(payload: Partial<ProjectManagementItem>): Promise<unknown> {
    return http.post('/api/aslan/system/project_management/validate', payload);
  },

  // --- Configuration Management (Apollo, Nacos) ---
  async getConfigurations(): Promise<ConfigurationManagementItem[]> {
    try {
      const res = await http.get<ConfigurationManagementItem[]>('/api/aslan/system/configuration', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async createConfiguration(payload: Partial<ConfigurationManagementItem>): Promise<unknown> {
    return http.post('/api/aslan/system/configuration', payload);
  },

  async updateConfiguration(id: string, payload: Partial<ConfigurationManagementItem>): Promise<unknown> {
    return http.put(`/api/aslan/system/configuration/${id}`, payload);
  },

  async deleteConfiguration(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/configuration/${id}`);
  },

  async validateConfiguration(payload: Partial<ConfigurationManagementItem>): Promise<unknown> {
    return http.post('/api/aslan/system/configuration/validate', payload);
  },

  async getNacosNamespaces(nacosId: string): Promise<Array<{ namespaced_name?: string; namespace_id?: string }>> {
    try {
      const res = await http.get<Array<{ namespaced_name?: string; namespace_id?: string }>>(`/api/aslan/system/nacos/${nacosId}`, { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  // --- Jenkins Dynamic Job and Args ---
  async getJenkinsJobNames(jenkinsId: string): Promise<string[]> {
    try {
      const res = await http.get<string[]>(`/api/aslan/system/jenkins/jobNames/${jenkinsId}`, { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async getJenkinsBuildArgs(jenkinsId: string, jobName: string): Promise<Array<{ name: string; default_value?: unknown; description?: string; type?: string }>> {
    try {
      const res = await http.get<Array<{ name: string; default_value?: unknown; description?: string; type?: string }>>(
        `/api/aslan/system/jenkins/buildArgs/${jenkinsId}/${encodeURIComponent(jobName)}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },
};

export interface ProjectManagementItem {
  id?: string;
  name?: string;
  type: 'jira' | 'meego' | 'pingcode' | 'tapd';
  jira_host?: string;
  jira_user?: string;
  jira_token?: string;
  jira_auth_type?: string;
  meego_plugin_id?: string;
  meego_plugin_secret?: string;
  meego_user_key?: string;
  pingcode_client_id?: string;
  pingcode_client_secret?: string;
  tapd_client_id?: string;
  tapd_client_secret?: string;
  updated_at?: number;
  update_by?: string;
}

export interface ConfigurationManagementItem {
  id?: string;
  name?: string;
  type: 'apollo' | 'nacos' | 'nacos3' | 'nacos-ee-mse';
  server_address: string;
  auth_type?: string;
  nacos_auth_config?: {
    username?: string;
    password?: string;
    access_key?: string;
    secret_key?: string;
    namespace?: string;
    group?: string;
  };
  apollo_auth_config?: {
    server_address?: string;
    token?: string;
  };
  updated_at?: number;
  updated_by?: string;
}

export interface CapacityRetention {
  max_days: number;
  max_items: number;
}

export interface CapacityStrategy {
  id?: string;
  target: string;
  retention?: CapacityRetention;
}

export default settingsApi;
