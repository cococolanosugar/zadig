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

// types.ResourceAction — GET /api/v1/policy/resource-actions
export interface ResourceAction {
  resource: string;
  verbs: string[];
}

// user/core/service/permission/role_binding.go — GET /api/v1/policy/role-bindings?namespace=
export interface RoleBindingResp {
  binding_type: string;
  user_info?: { identity_type: string; uid: string; account: string; username: string };
  group_info?: { group_id: string; name: string; user_infos: Array<{ uid: string; account: string; username: string }> };
  roles: string[];
}

// types.RoleTemplate — GET /api/v1/policy/role-templates
export interface RoleTemplate {
  id: number;
  name: string;
  desc: string;
  type: number;
}

// ---------- API ----------

const nsQuery = (projectName: string) => `namespace=${encodeURIComponent(projectName)}`;

export const rbacApi = {
  /** 项目角色列表 */
  async listRoles(projectName: string): Promise<PolicyRole[]> {
    try {
      const res = await http.get<PolicyRole[]>(`/api/v1/policy/roles?${nsQuery(projectName)}`, {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
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

  /** 项目角色绑定列表（binding_type: user | group） */
  async listRoleBindings(projectName: string): Promise<RoleBindingResp[]> {
    try {
      const res = await http.get<RoleBindingResp[]>(`/api/v1/policy/role-bindings?${nsQuery(projectName)}`, {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
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

  /** 更新用户绑定（替换该用户全部角色）：POST /api/v1/policy/role-bindings/user/:uid?namespace=，body {roles} */
  async updateRoleBindingForUser(
    projectName: string,
    uid: string,
    roles: string[]
  ): Promise<unknown> {
    return http.post(
      `/api/v1/policy/role-bindings/user/${encodeURIComponent(uid)}?${nsQuery(projectName)}`,
      { roles },
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

  /** 全局角色模板（新建角色可基于模板选择动作） */
  async listRoleTemplates(): Promise<RoleTemplate[]> {
    try {
      const res = await http.get<RoleTemplate[]>('/api/v1/policy/role-templates', {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /** 权限动作定义（resource → verbs），用于新建角色的动作选择器 */
  async getResourceActions(): Promise<ResourceAction[]> {
    try {
      const res = await http.get<ResourceAction[]>('/api/v1/policy/resource-actions', {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /** 当前用户在项目内的权限规则。GET /api/v1/policy/permission/project/:name */
  async getMyProjectRules(projectName: string): Promise<Record<string, unknown>> {
    return http.get<Record<string, unknown>>(
      `/api/v1/policy/permission/project/${encodeURIComponent(projectName)}`,
      { skipErrorHandler: true }
    );
  },
};

export default rbacApi;