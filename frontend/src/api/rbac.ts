import http from './client';

// ---------- 契约（与后端 pkg/types + user 服务 policy 路由对齐） ----------

// types.Role — GET /api/v1/policy/roles?namespace=
export interface PolicyRole {
  id: number;
  name: string;
  namespace: string;
  desc: string;
  type: string;
  global_read_only?: boolean;
}

// types.DetailedRole — GET /api/v1/policy/roles/:name?namespace= （rules 为兼容字段名）
export interface DetailedRole {
  id: number;
  name: string;
  namespace: string;
  desc: string;
  type: string;
  rules: Array<{ resource: string; verbs: string[] }>;
}

// permission.ResourceDefinition — GET /api/v1/policy/resource-actions?scope=
export interface ActionRule {
  action: string;
  alias: string;
}

export interface ResourceDefinition {
  resource: string;
  alias: string;
  rules: ActionRule[];
}

/** @deprecated 兼容旧命名，请使用 ResourceDefinition */
export type ResourceAction = ResourceDefinition;

// user/core/service/permission/role_binding.go — GET /api/v1/policy/role-bindings?namespace=
export interface RoleBindingResp {
  binding_type: string;
  user_info?: { identity_type: string; uid: string; account: string; username: string };
  group_info?: { group_id: string; name: string; user_infos: Array<{ uid: string; account: string; username: string }> };
  roles: string[];
}

// types.RoleTemplate — GET /api/v1/policy/role-templates (pkg/microservice/user/core/handler/router.go:111-118)
export interface RoleTemplate {
  id: number;
  name: string;
  desc: string;
  type: number; // 0: Custom, 1: Predefined (内置模板不可编辑/删除)
}

// types.DetailedRoleTemplate — GET /api/v1/policy/role-templates/:name
export interface DetailedRoleTemplate {
  id: number;
  name: string;
  namespace?: string;
  desc: string;
  rules?: Array<{ resource: string; verbs: string[] }>;
}

// ---------- API ----------

const nsQuery = (projectName: string) => `namespace=${encodeURIComponent(projectName)}`;

export const rbacApi = {
  /** 项目角色列表。P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析 */
  async listRoles(projectName: string): Promise<PolicyRole[]> {
    const res = await http.get<PolicyRole[]>(`/api/v1/policy/roles?${nsQuery(projectName)}`, {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  },

  /** 角色详情（含权限规则 rules） */
  async getRole(projectName: string, name: string): Promise<DetailedRole> {
    return http.get<DetailedRole>(
      `/api/v1/policy/roles/${encodeURIComponent(name)}?${nsQuery(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /** 创建项目角色。POST /api/v1/policy/roles?namespace=，body {name,desc,type,actions,namespace} */
  async createRole(
    projectName: string,
    payload: { name: string; desc?: string; type?: string; actions: string[] }
  ): Promise<unknown> {
    return http.post(
      `/api/v1/policy/roles?${nsQuery(projectName)}`,
      { ...payload, namespace: projectName },
      { skipErrorHandler: true }
    );
  },

  /** 删除项目角色。DELETE /api/v1/policy/roles/:name?namespace= */
  async deleteRole(projectName: string, name: string): Promise<unknown> {
    return http.delete(
      `/api/v1/policy/roles/${encodeURIComponent(name)}?${nsQuery(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /** 项目角色绑定列表（binding_type: user | group）。P1-E1: HTTP 故障异常上抛 */
  async listRoleBindings(projectName: string): Promise<RoleBindingResp[]> {
    const res = await http.get<RoleBindingResp[]>(`/api/v1/policy/role-bindings?${nsQuery(projectName)}`, {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  },

  /** 创建绑定：POST /api/v1/policy/role-bindings?namespace=，body {identities:[{identity_type,uid|gid}],role} */
  async createRoleBinding(
    projectName: string,
    payload: { identities: Array<{ identity_type: 'user' | 'group'; uid?: string; gid?: string }>; role: string }
  ): Promise<unknown> {
    return http.post(
      `/api/v1/policy/role-bindings?${nsQuery(projectName)}`,
      payload,
      { skipErrorHandler: true }
    );
  },

  /** 移除用户绑定：DELETE /api/v1/policy/role-bindings/user/:uid?namespace= */
  async deleteRoleBindingForUser(projectName: string, uid: string): Promise<unknown> {
    return http.delete(
      `/api/v1/policy/role-bindings/user/${encodeURIComponent(uid)}?${nsQuery(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /** 移除用户组绑定：DELETE /api/v1/policy/role-bindings/group/:gid?namespace= */
  async deleteRoleBindingForGroup(projectName: string, gid: string): Promise<unknown> {
    return http.delete(
      `/api/v1/policy/role-bindings/group/${encodeURIComponent(gid)}?${nsQuery(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /** 权限动作定义（ResourceDefinition[]），用于新建角色的动作选择器。P1-E1: HTTP 故障异常上抛 */
  async getResourceActions(scope: 'project' | 'system' = 'project'): Promise<ResourceDefinition[]> {
    const res = await http.get<ResourceDefinition[]>(
      `/api/v1/policy/resource-actions?scope=${encodeURIComponent(scope)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * 角色模板列表。
   * GET /api/v1/policy/role-templates (pkg/microservice/user/core/handler/router.go:115)
   * P1-E1: HTTP 故障异常上抛
   */
  async listRoleTemplates(): Promise<RoleTemplate[]> {
    const res = await http.get<RoleTemplate[]>('/api/v1/policy/role-templates', {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  },

  /**
   * 角色模板详情（含规则 actions）。
   * GET /api/v1/policy/role-templates/:name (pkg/microservice/user/core/handler/router.go:116)
   */
  async getRoleTemplate(name: string): Promise<DetailedRoleTemplate> {
    return http.get<DetailedRoleTemplate>(
      `/api/v1/policy/role-templates/${encodeURIComponent(name)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * 创建角色模板。
   * POST /api/v1/policy/role-templates (pkg/microservice/user/core/handler/router.go:113)
   */
  async createRoleTemplate(payload: { name: string; desc?: string; actions: string[] }): Promise<unknown> {
    return http.post('/api/v1/policy/role-templates', payload, { skipErrorHandler: true });
  },

  /**
   * 更新自定义角色模板。
   * PUT /api/v1/policy/role-templates/:name (pkg/microservice/user/core/handler/router.go:114)
   */
  async updateRoleTemplate(name: string, payload: { desc?: string; actions: string[] }): Promise<unknown> {
    return http.put(`/api/v1/policy/role-templates/${encodeURIComponent(name)}`, { ...payload, name }, { skipErrorHandler: true });
  },

  /**
   * 删除自定义角色模板（预定义模板不可删）。
   * DELETE /api/v1/policy/role-templates/:name (pkg/microservice/user/core/handler/router.go:117)
   */
  async deleteRoleTemplate(name: string): Promise<unknown> {
    return http.delete(`/api/v1/policy/role-templates/${encodeURIComponent(name)}`, { skipErrorHandler: true });
  },
};

export default rbacApi;