import http from './client';
import { generateAesKey, rsaEncrypt, aesDecrypt } from '../utils/crypto';
import authApi from './auth';

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
  };
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
  type?: string;
}

export interface RoleItem {
  name: string;
  desc?: string;
  type?: string;
}

// GET /api/vm/vms — aslan core/vm AgentBriefListResp
export interface VMItem {
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

  async getUserGroups(): Promise<UserGroupItem[]> {
    try {
      // 后端 listUserGroupResp {group_list, total}（user_group.go:93-96）；该接口无管理员限制
      const res = await http.get<{ group_list?: UserGroupItem[]; total?: number } | UserGroupItem[]>(
        '/api/v1/user-group',
        { skipErrorHandler: true }
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.group_list) ? res.group_list : [];
    } catch {
      return [];
    }
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

  // --- VM Hosts (mounted at /api/vm, not /api/aslan/vm) ---
  async getVMs(): Promise<VMItem[]> {
    try {
      const res = await http.get<VMItem[]>('/api/vm/vms', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
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
};

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
