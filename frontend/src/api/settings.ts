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
  async getCodeHosts(): Promise<CodeHostItem[]> {
    const res = await http.get<CodeHostItem[]>('/api/aslan/code/codehost');
    return Array.isArray(res) ? res : [];
  },

  async createCodeHost(payload: Partial<CodeHostItem>): Promise<unknown> {
    return http.post('/api/aslan/code/codehost', payload);
  },

  async deleteCodeHost(id: number | string): Promise<unknown> {
    return http.delete(`/api/aslan/code/codehost/${id}`);
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
      const res = await http.get<UserGroupItem[]>('/api/v1/user-group', { skipErrorHandler: true });
      return Array.isArray(res) ? res : [];
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
};

export default settingsApi;
