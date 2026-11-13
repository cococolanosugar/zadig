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

/** 集群 DinD 资源配置 */
export interface DindCfg {
  replicas: number;
  resources?: { limits?: { cpu?: number; memory?: number } };
  storage?: {
    type: 'rootfs' | 'dynamic';
    storage_class?: string;
    storage_size_in_gib?: number;
  };
  strategy_id?: string;
  storage_driver?: string;
}

export interface ClusterItem {
  id: string;
  name: string;
  description?: string;
  status?: string;
  type?: string;
  production?: boolean;
  local?: boolean;
  /** LOOP8-A1: 断开连接标记 */
  disconnected?: boolean;
  /** 前端表单字段；提交时需同步到后端识别的 config */
  kube_config?: string;
  /** 后端 kubeconfig 字段名 */
  config?: string;
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
  dind_cfg?: DindCfg;
}

/** LOOP8-A1: 集群删除预检 — 被引用环境 */
export interface ClusterEnvInfo {
  name: string;
  display_name?: string;
  project_name: string;
  production?: boolean;
}

export interface ClusterDeletionInfo {
  deletable: boolean;
  env_in_use?: ClusterEnvInfo[];
}

/** LOOP8-A2: Helm Chart 索引清单 */
export interface ChartVersionItem {
  chartName: string;
  version: string;
}

export interface HelmIndexFileResp {
  entries: Record<string, ChartVersionItem[]>;
}

/** LOOP8-A3: 镜像仓库引用环境预检 */
export interface RegistryReferenceEnv {
  name: string;
  alias?: string;
}

export interface RegistryReference {
  project_name: string;
  project_alias?: string;
  envs?: RegistryReferenceEnv[];
}

export interface RegistryReferencesResp {
  references: RegistryReference[];
}

/** 代码源平台枚举（7 类） */
export type CodeHostType =
  | 'gitlab'
  | 'github'
  | 'gerrit'
  | 'gitee'
  | 'gitee-enterprise'
  | 'perforce'
  | 'other';

export interface CodeHostItem {
  id: number;
  type: CodeHostType | string;
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
  /** "2" 已授权，"1" 未授权 */
  is_ready?: string;
  enable_proxy?: boolean;
  disable_ssl?: boolean;
  username?: string;
  password?: string;
  ssh_key?: string;
  private_access_token?: string;
  perforce_host?: string;
  perforce_port?: number;
  updated_at?: number;
}

/** OAuth 授权跳转 URL */
export function getCodeHostAuthUrl(id: number, redirectUrl?: string): string {
  const redirect = encodeURIComponent(redirectUrl || window.location.href);
  return `/api/v1/codehosts/${id}/auth?redirect_url=${redirect}`;
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

/** LOOP9-A1: 系统操作审计日志 */
export interface OperationLogItem {
  id: string;
  username: string;
  product_name: string;
  function: string;
  method: string;
  scene?: string;
  targets?: string[];
  name?: string;
  name_en?: string;
  request_body?: string;
  body_type?: string;
  status: number;
  created_at: number;
}

export interface OperationLogResp {
  operation_logs: OperationLogItem[];
  total: number;
  i18n?: {
    method_i18_map?: Record<string, string>;
    function_i18_map?: Record<string, string>;
  };
}

export interface GetOperationLogsParams {
  page?: number;
  per_page?: number;
  status?: number;
  username?: string;
  projectName?: string;
  function?: string;
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
  id?: number;
  name: string;
  desc?: string;
  // role-templates: 0=自定义模板 1=系统内置（后端 types.RoleTemplate）
  type?: number | string;
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
    // P0: 后端 kubeconfig 字段名为 config
    const body = {
      ...payload,
      config: payload.config || payload.kube_config || '',
    };
    return http.post('/api/aslan/cluster/clusters', body);
  },

  /**
   * 获取外置集群 Agent 一键部署命令与 Token (POST /api/aslan/cluster/agent/:id/agent.yaml/token)
   */
  async getClusterAgentCommand(
    clusterId: string
  ): Promise<{ token?: string; command?: string; expires_at?: number }> {
    return http.post(`/api/aslan/cluster/agent/${encodeURIComponent(clusterId)}/agent.yaml/token`, {});
  },

  async validateCluster(payload: Partial<ClusterItem>): Promise<unknown> {
    const body = {
      ...payload,
      config: payload.config || payload.kube_config || '',
    };
    return http.post('/api/aslan/cluster/clusters/validate', body);
  },

  /** 更新集群 DinD 资源配置 */
  async updateClusterDind(id: string, dindCfg: DindCfg): Promise<void> {
    return http.put(`/api/aslan/cluster/clusters/${encodeURIComponent(id)}/dind`, dindCfg);
  },

  /** 获取集群 StorageClass 列表 */
  async getClusterStorageClasses(id: string, type = ''): Promise<string[]> {
    const res = await http.get<string[] | { storage_classes?: string[] }>(
      `/api/aslan/cluster/${encodeURIComponent(id)}/storageclasses?type=${encodeURIComponent(type)}`
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.storage_classes)) return res.storage_classes;
    return [];
  },

  /** 获取集群 PVC 列表 */
  async getClusterPvcs(
    id: string,
    namespace = 'default'
  ): Promise<Array<{ name: string; size?: string }>> {
    const res = await http.get<Array<{ name: string; size?: string }> | { pvcs?: Array<{ name: string; size?: string }> }>(
      `/api/aslan/cluster/${encodeURIComponent(id)}/${encodeURIComponent(namespace)}/pvcs`
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.pvcs)) return res.pvcs;
    return [];
  },

  async deleteCluster(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/cluster/clusters/${id}`);
  },

  /** LOOP8-A1: 断开集群连接 (PUT /api/aslan/cluster/clusters/:id/disconnect) */
  async disconnectCluster(id: string): Promise<void> {
    return http.put(`/api/aslan/cluster/clusters/${id}/disconnect`);
  },

  /** LOOP8-A1: 重新连接集群 (PUT /api/aslan/cluster/clusters/:id/reconnect) */
  async reconnectCluster(id: string): Promise<void> {
    return http.put(`/api/aslan/cluster/clusters/${id}/reconnect`);
  },

  /** LOOP8-A1: 获取集群删除前依赖环境检查 (GET /api/aslan/cluster/clusters/:id/deletion) */
  async getClusterDeletionInfo(id: string): Promise<ClusterDeletionInfo> {
    return http.get(`/api/aslan/cluster/clusters/${id}/deletion`);
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
  // P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析
  async getCodeHosts(): Promise<CodeHostItem[]> {
    const publicKey = await authApi.getRSAPublicKey();
    const aesKey = generateAesKey(32);
    const encryptedKey = rsaEncrypt(aesKey, publicKey);
    const res = await http.get<CodeHostItem[]>(
      `/api/v1/codehosts?encryptedKey=${encodeURIComponent(encryptedKey)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async createCodeHost(payload: Partial<CodeHostItem>): Promise<CodeHostItem> {
    return http.post<CodeHostItem>('/api/v1/codehosts', payload);
  },

  // R5 任务2: 连通性校验（codehost router.go:33 POST /codehosts/validate）
  async validateCodeHost(payload: Partial<CodeHostItem>): Promise<unknown> {
    return http.post('/api/v1/codehosts/validate', payload, { skipErrorHandler: true });
  },

  // R5 任务2: 更新代码源（codehost router.go:30 PATCH /codehosts/:id）
  async updateCodeHost(id: number, payload: Partial<CodeHostItem>): Promise<CodeHostItem> {
    return http.patch<CodeHostItem>(`/api/v1/codehosts/${id}`, payload, { skipErrorHandler: true });
  },

  // R5 任务2: OAuth 授权跳转地址获取（codehost router.go:31 GET /codehosts/:id/auth）
  async authCodeHost(id: number | string): Promise<{ auth_url?: string }> {
    return http.get<{ auth_url?: string }>(`/api/v1/codehosts/${id}/auth`, { skipErrorHandler: true });
  },

  async deleteCodeHost(id: number | string): Promise<unknown> {
    return http.delete(`/api/v1/codehosts/${id}`);
  },

  // --- Registries ---
  // P1-E1: 保留主通道 → 项目级降级链，但两级均失败时异常上抛；字段解密失败保留原文（合理降级）
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
      return [];
    } catch (primaryErr) {
      try {
        const fallbackRes = await http.get<RegistryItem[]>(
          `/api/aslan/system/registry/project?projectName=${projectName}`,
          { skipErrorHandler: true }
        );
        return Array.isArray(fallbackRes) ? fallbackRes : [];
      } catch {
        throw primaryErr;
      }
    }
  },

  async createRegistry(payload: Partial<RegistryItem>): Promise<unknown> {
    return http.post('/api/aslan/system/registry/namespaces', payload);
  },

  async updateRegistry(id: string, payload: Partial<RegistryItem>): Promise<unknown> {
    return http.put(`/api/aslan/system/registry/namespaces/${id}`, payload);
  },

  async validateRegistry(payload: Partial<RegistryItem>): Promise<unknown> {
    return http.post('/api/aslan/system/registry/validate', payload);
  },

  async deleteRegistry(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/registry/namespaces/${id}`);
  },

  /** LOOP8-A3: 镜像仓库删除前引用检查 (GET /api/aslan/system/registry/namespaces/:id/reference) */
  async getRegistryReferences(id: string): Promise<RegistryReferencesResp> {
    return http.get(`/api/aslan/system/registry/namespaces/${id}/reference`);
  },

  // --- Storage (S3 / OSS) ---
  // P1-E1: 保留主通道 → 项目级降级链，但两级均失败时异常上抛；字段解密失败保留原文（合理降级）
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
      return [];
    } catch (primaryErr) {
      try {
        const fallbackRes = await http.get<StorageItem[]>(
          `/api/aslan/system/s3storage/project?projectName=${projectName || 'demo-k8s'}`,
          { skipErrorHandler: true }
        );
        return Array.isArray(fallbackRes) ? fallbackRes : [];
      } catch {
        throw primaryErr;
      }
    }
  },

  async createStorage(payload: Partial<StorageItem>): Promise<unknown> {
    return http.post('/api/aslan/system/s3storage', payload);
  },

  // R5 任务2: 连通性校验（system router.go:79 POST /s3storage/validate）
  async validateStorage(payload: Partial<StorageItem>): Promise<unknown> {
    return http.post('/api/aslan/system/s3storage/validate', payload, { skipErrorHandler: true });
  },

  // R5 任务2: 更新对象存储（system router.go:81 PUT /s3storage/:id）
  async updateStorage(id: string, payload: Partial<StorageItem>): Promise<unknown> {
    return http.put(`/api/aslan/system/s3storage/${id}`, payload, { skipErrorHandler: true });
  },

  async deleteStorage(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/s3storage/${id}`);
  },

  // --- Users & RBAC ---
  // P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析
  async getUsers(): Promise<UserManagementItem[]> {
    const res = await http.post<{ users?: UserManagementItem[] } | UserManagementItem[]>('/api/v1/users/search', {
      page: 1,
      per_page: 200,
    }, { skipErrorHandler: true });
    if (Array.isArray(res)) return res;
    if (res && 'users' in res && Array.isArray(res.users)) return res.users;
    return [];
  },

  /** LOOP9-A2: 服务端分页用户检索 */
  async getUsersPaged(
    params: { page?: number; per_page?: number; name?: string } = {}
  ): Promise<{ users: UserManagementItem[]; total: number }> {
    const res = await http.post<{ users?: UserManagementItem[]; total_count?: number } | UserManagementItem[]>(
      '/api/v1/users/search',
      {
        page: params.page || 1,
        per_page: params.per_page || 20,
        name: params.name || undefined,
      },
      { skipErrorHandler: true }
    );
    if (Array.isArray(res)) return { users: res, total: res.length };
    if (res && 'users' in res && Array.isArray(res.users)) {
      return { users: res.users, total: res.total_count ?? res.users.length };
    }
    return { users: [], total: 0 };
  },

  async createUser(
    payload: Partial<UserManagementItem> & { password?: string }
  ): Promise<{ uid: string } & Partial<UserManagementItem>> {
    return http.post<{ uid: string } & Partial<UserManagementItem>>('/api/v1/users', payload);
  },

  /** LOOP9-A2: 更新用户基本信息 */
  async updateUser(uid: string, payload: { name?: string; email?: string; phone?: string }): Promise<void> {
    return http.put(`/api/v1/users/${uid}`, payload);
  },

  // R8 任务3: 重置用户密码（PUT /users/:uid/password，后端 permission.Password 契约
  // 为 {uid, oldPassword, newPassword}；管理端代重置时 oldPassword 置空，由后端鉴权裁决）
  async resetUserPassword(uid: string, password: string): Promise<unknown> {
    return http.put(
      `/api/v1/users/${encodeURIComponent(uid)}/password`,
      { uid, oldPassword: '', newPassword: password },
      { skipErrorHandler: true }
    );
  },

  // Round3: 管理端重置用户 MFA — DELETE /users/:uid/mfa（ResetUserMFAByAdmin）
  async resetUserMFA(uid: string): Promise<unknown> {
    return http.delete(`/api/v1/users/${encodeURIComponent(uid)}/mfa`, { skipErrorHandler: true });
  },

  /** 系统级角色列表（namespace=*） */
  async getSystemRoles(): Promise<Array<{ id?: number; name: string; desc?: string; type?: string; namespace?: string }>> {
    const res = await http.get<Array<{ id?: number; name: string; desc?: string; type?: string; namespace?: string }>>(
      '/api/v1/policy/roles?namespace=*',
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /** 为用户绑定角色（覆盖式更新） */
  async updateRoleBindingForUser(uid: string, namespace: string = '*', roles: string[]): Promise<unknown> {
    return http.post(
      `/api/v1/policy/role-bindings/user/${encodeURIComponent(uid)}?namespace=${encodeURIComponent(namespace)}`,
      { roles },
      { skipErrorHandler: true }
    );
  },

  async deleteUser(uid: string): Promise<unknown> {
    return http.delete(`/api/v1/users/${uid}`);
  },

  /** LOOP9-A1: 系统操作审计日志多维检索 */
  async getOperationLogs(params: GetOperationLogsParams = {}): Promise<OperationLogResp> {
    const query = new URLSearchParams();
    query.set('status', String(params.status ?? 0));
    query.set('page', String(params.page ?? 1));
    query.set('per_page', String(params.per_page ?? 20));
    if (params.username) query.set('username', params.username);
    if (params.projectName) query.set('projectName', params.projectName);
    if (params.function) query.set('function', params.function);
    return http.get(`/api/aslan/system/operation?${query.toString()}`);
  },

  // P1-E1: HTTP 故障异常上抛
  async getUserGroups(name?: string, pageNum = 1, pageSize = 200): Promise<UserGroupItem[]> {
    const query = name ? `&name=${encodeURIComponent(name)}` : '';
    const res = await http.get<{ group_list?: UserGroupItem[]; total?: number } | UserGroupItem[]>(
      `/api/v1/user-group?page_num=${pageNum}&page_size=${pageSize}${query}`,
      { skipErrorHandler: true }
    );
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.group_list) ? res.group_list : [];
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

  /** 用户简表：POST /api/v1/users/brief 无管理员限制（区别于 /users/search 仅系统管理员）。P1-E1: 异常上抛 */
  async getUsersBrief(): Promise<UserManagementItem[]> {
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
  },

  // R8 任务2: 系统设置角色列表对齐 role-templates（后端 GET /policy/roles 强制 namespace，
  // 系统级角色清单应使用 ListRoleTemplates，无 namespace 校验；type: 0=自定义模板 1=系统内置）
  async getRoles(): Promise<RoleItem[]> {
    const res = await http.get<RoleItem[]>('/api/v1/policy/role-templates', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // --- VM Hosts (mounted at /api/aslan/vm and /api/vm) ---
  // P1-E1: 主列表异常上抛；私钥映射仅为增强信息，失败回退原始列表（合理降级）
  async getVMs(label?: string): Promise<VMItem[]> {
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
  },

  // P1-E1: HTTP 故障异常上抛
  async getVMLabels(projectName = ''): Promise<string[]> {
    const res = await http.get<string[]>(`/api/aslan/vm/labels?projectName=${projectName}`, { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
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

  // R16 任务1: 主机私钥连通性校验（system router.go:195 POST /privateKey/validate）
  async validatePrivateKey(payload: Partial<VMItem>): Promise<unknown> {
    return http.post('/api/aslan/system/privateKey/validate', payload, { skipErrorHandler: true });
  },

  // R16 任务1: 主机私钥批量创建（system router.go:193 POST /privateKey/batch）
  async batchCreatePrivateKeys(payload: { option: 'skip' | 'overwrite'; data: Partial<VMItem>[] }): Promise<unknown> {
    return http.post('/api/aslan/system/privateKey/batch', payload);
  },

  // R16 任务1: 主机私钥标签注册表（system router.go:191 GET /privateKey/labels）
  async getPrivateKeyLabels(): Promise<string[]> {
    const res = await http.get<string[]>('/api/aslan/system/privateKey/labels', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
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
  // P1-E1: HTTP 故障异常上抛
  async getHelmRepos(): Promise<HelmRepoItem[]> {
    const res = await http.get<HelmRepoItem[]>('/api/aslan/system/helm', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  async createHelmRepo(payload: Partial<HelmRepoItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/aslan/system/helm', payload);
  },

  // R5 任务2: 更新 Chart 仓库（system router.go:178 PUT /helm/:id）
  async updateHelmRepo(id: string, payload: Partial<HelmRepoItem> & { password?: string }): Promise<unknown> {
    return http.put(`/api/aslan/system/helm/${id}`, payload, { skipErrorHandler: true });
  },

  async validateHelmRepo(payload: Partial<HelmRepoItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/aslan/system/helm/validate', payload, { skipErrorHandler: true });
  },

  async deleteHelmRepo(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/helm/${id}`);
  },

  /** LOOP8-A2: 获取 Helm 仓库内 Chart 清单 (GET /api/aslan/system/helm/:name/index) */
  async getHelmCharts(repoName: string): Promise<HelmIndexFileResp> {
    return http.get(`/api/aslan/system/helm/${encodeURIComponent(repoName)}/index`);
  },

  // --- DB Instances ---
  // P1-E1: HTTP 故障异常上抛
  async getDBInstances(): Promise<DBInstanceItem[]> {
    const res = await http.get<DBInstanceItem[]>('/api/aslan/system/dbinstance', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  async createDBInstance(
    payload: Partial<DBInstanceItem> & { password?: string }
  ): Promise<unknown> {
    return http.post('/api/aslan/system/dbinstance', payload);
  },

  // R5 任务2: 连通性校验（system router.go:552 POST /dbinstance/validate）
  async validateDBInstance(payload: Partial<DBInstanceItem> & { password?: string }): Promise<unknown> {
    return http.post('/api/aslan/system/dbinstance/validate', payload, { skipErrorHandler: true });
  },

  // R5 任务2: 更新数据库实例（system router.go:550 PUT /dbinstance/:id）
  async updateDBInstance(id: string, payload: Partial<DBInstanceItem> & { password?: string }): Promise<unknown> {
    return http.put(`/api/aslan/system/dbinstance/${id}`, payload, { skipErrorHandler: true });
  },

  async deleteDBInstance(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/system/dbinstance/${id}`);
  },

  // --- System Proxy ---
  // P1-E1: HTTP 故障异常上抛
  async getProxies(): Promise<ProxyConfig[]> {
    const res = await http.get<ProxyConfig[]>('/api/aslan/system/proxyManage', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
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
  // P1-E1: HTTP 故障异常上抛
  async getProjectManagements(): Promise<ProjectManagementItem[]> {
    const res = await http.get<ProjectManagementItem[]>('/api/aslan/system/project_management', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
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

  async getMeegoProjects(id: string, projectName: string): Promise<any[]> {
    const res = await http.get<any[]>(`/api/aslan/system/meego/${encodeURIComponent(id)}/projects?projectName=${encodeURIComponent(projectName)}`);
    return Array.isArray(res) ? res : [];
  },

  async getPingCodeProjects(id: string, projectName: string): Promise<any[]> {
    const res = await http.get<any[]>(`/api/aslan/system/pingcode/${encodeURIComponent(id)}/projects?projectName=${encodeURIComponent(projectName)}`);
    return Array.isArray(res) ? res : [];
  },

  async getTapdProjects(id: string, projectName: string): Promise<any[]> {
    const res = await http.get<any[]>(`/api/aslan/system/tapd/${encodeURIComponent(id)}/projects?projectName=${encodeURIComponent(projectName)}`);
    return Array.isArray(res) ? res : [];
  },

  // --- Configuration Management (Apollo, Nacos) ---
  // P1-E1: HTTP 故障异常上抛
  async getConfigurations(): Promise<ConfigurationManagementItem[]> {
    const res = await http.get<ConfigurationManagementItem[]>('/api/aslan/system/configuration', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
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

  // P1-E1: HTTP 故障异常上抛
  async getNacosNamespaces(nacosId: string): Promise<Array<{ namespaced_name?: string; namespace_id?: string }>> {
    const res = await http.get<Array<{ namespaced_name?: string; namespace_id?: string }>>(`/api/aslan/system/nacos/${nacosId}`, { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // --- Jenkins Dynamic Job and Args ---
  // P1-E1: HTTP 故障异常上抛
  async getJenkinsJobNames(jenkinsId: string): Promise<string[]> {
    const res = await http.get<string[]>(`/api/aslan/system/jenkins/jobNames/${jenkinsId}`, { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // P1-E1: HTTP 故障异常上抛
  async getJenkinsBuildArgs(jenkinsId: string, jobName: string): Promise<Array<{ name: string; default_value?: unknown; description?: string; type?: string }>> {
    const cleanJob = jobName.startsWith('/') ? jobName.slice(1) : jobName;
    const encodedJob = cleanJob.split('/').map(encodeURIComponent).join('/');
    const res = await http.get<Array<{ name: string; default_value?: unknown; description?: string; type?: string }>>(
      `/api/aslan/system/jenkins/buildArgs/${jenkinsId}/${encodedJob}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  // 特性探测：返回语义化默认值（未配置 Jenkins），非数据列表吞错；调用方需按 exist=false 呈现
  async checkJenkinsExist(): Promise<{ exist: boolean }> {
    try {
      return await http.get<{ exist: boolean }>('/api/aslan/system/jenkins/exist', { skipErrorHandler: true });
    } catch {
      return { exist: false };
    }
  },

  // P1-E1: HTTP 故障异常上抛
  async listAgentIntegrations(): Promise<any[]> {
    const res = await http.get<any[]>('/api/aslan/system/agent/integrations', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // P1-E1: HTTP 故障异常上抛
  async listLLMIntegrations(): Promise<any[]> {
    const res = await http.get<any[]>('/api/aslan/system/llm/integration', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // P1-E1: HTTP 故障异常上抛
  async listLLMIntegrationBriefs(): Promise<any[]> {
    const res = await http.get<any[]>('/api/aslan/system/llm/integrations', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  // 特性探测：返回语义化默认值（未配置 LLM），非数据列表吞错
  async checkLLMIntegration(): Promise<{ enabled: boolean }> {
    try {
      return await http.get<{ enabled: boolean }>('/api/aslan/system/llm/integration/check', { skipErrorHandler: true });
    } catch {
      return { enabled: false };
    }
  },

  /**
   * 验证大语言模型 (LLM) 集成凭据连通性 (POST /api/aslan/system/llm/integration/validate)
   */
  async validateLLMIntegration(payload: {
    name?: string;
    provider_name?: string;
    protocol?: string;
    token?: string;
    base_url?: string;
    model?: string;
    enable_proxy?: boolean;
    is_default?: boolean;
    id?: string;
    [key: string]: unknown;
  }): Promise<unknown> {
    return http.post('/api/aslan/system/llm/integration/validate', payload, { skipErrorHandler: true });
  },

  // P1-E1: HTTP 故障异常上抛（当前无调用方；登录页接入时需自带 try/catch 呈现"未配置默认账号"态）
  async getDefaultLogin(): Promise<any> {
    return http.get('/api/aslan/system/login/default', { skipErrorHandler: true });
  },

  // P1-E1: HTTP 故障异常上抛
  async getCICDTools(): Promise<CICDToolItem[]> {
    const res = await http.get<CICDToolItem[]>('/api/aslan/system/cicdTools', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  /**
   * 钉钉部门获取
   * GET /api/aslan/system/dingtalk/:id/department/:departmentId?projectName=
   */
  async getDingtalkDepartment(id: string, departmentId: string, projectName: string): Promise<unknown> {
    return http.get(`/api/aslan/system/dingtalk/${encodeURIComponent(id)}/department/${encodeURIComponent(departmentId)}?projectName=${encodeURIComponent(projectName)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 飞书部门获取
   * GET /api/aslan/system/lark/:id/department/:departmentId?projectName=&user_id_type=
   */
  async getLarkDepartment(id: string, departmentId: string, projectName: string, userIdType = 'open_id'): Promise<unknown> {
    return http.get(`/api/aslan/system/lark/${encodeURIComponent(id)}/department/${encodeURIComponent(departmentId)}?projectName=${encodeURIComponent(projectName)}&user_id_type=${encodeURIComponent(userIdType)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * DMS 工单列表
   * GET /api/aslan/system/dms/:id/orders?keyword=
   */
  async getDMSOrders(id: string, keyword = ''): Promise<unknown[]> {
    const res = await http.get<unknown[]>(`/api/aslan/system/dms/${encodeURIComponent(id)}/orders?keyword=${encodeURIComponent(keyword)}`, {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  },

  /**
   * Grafana 告警列表
   * GET /api/aslan/system/grafana/:id/alert
   */
  async getGrafanaAlerts(id: string): Promise<unknown> {
    return http.get(`/api/aslan/system/grafana/${encodeURIComponent(id)}/alert`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 检查集群是否支持临时容器调试 (ephemeral containers)
   * GET /api/aslan/cluster/check/ephemeralcontainers?clusterId=
   */
  async checkEphemeralContainers(clusterId: string): Promise<{ enabled: boolean }> {
    return http.get<{ enabled: boolean }>(`/api/aslan/cluster/check/ephemeralcontainers?clusterId=${encodeURIComponent(clusterId)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 获取代码源信息列表
   * GET /api/aslan/code/codehost/infos
   */
  async getCodeHostInfos(): Promise<unknown[]> {
    const res = await http.get<unknown[]>('/api/aslan/code/codehost/infos', { skipErrorHandler: true });
    return Array.isArray(res) ? res : [];
  },

  /**
   * 代码源 OAuth 回调通知
   * GET /api/directory/codehosts/callback
   */
  async notifyCodeHostCallback(params: Record<string, string>): Promise<unknown> {
    const q = new URLSearchParams(params);
    return http.get(`/api/directory/codehosts/callback?${q.toString()}`, { skipErrorHandler: true });
  },

  /**
   * 企业微信部门查询
   * GET /api/aslan/system/workwx/:id/department?projectName=
   */
  async getWorkwxDepartment(id: string, projectName: string): Promise<unknown> {
    return http.get(`/api/aslan/system/workwx/${encodeURIComponent(id)}/department?projectName=${encodeURIComponent(projectName)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 企业微信部门下属成员查询
   * GET /api/aslan/system/workwx/:id/user?department_id=&projectName=
   */
  async getWorkwxUsers(id: string, departmentId: string | number, projectName: string): Promise<unknown> {
    return http.get(`/api/aslan/system/workwx/${encodeURIComponent(id)}/user?department_id=${encodeURIComponent(String(departmentId))}&projectName=${encodeURIComponent(projectName)}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 按镜像名批量获取镜像仓镜像
   * POST /api/aslan/system/registry/images?projectName=&registryId=
   */
  async getRegistryImages(projectName: string, registryId: string, imageNames: string[]): Promise<unknown> {
    return http.post(`/api/aslan/system/registry/images?projectName=${encodeURIComponent(projectName)}&registryId=${encodeURIComponent(registryId)}`, { names: imageNames }, {
      skipErrorHandler: true,
    });
  },
};

export interface CICDToolItem {
  id: string;
  name: string;
  type: string;
  url: string;
  username?: string;
  password?: string;
}

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
