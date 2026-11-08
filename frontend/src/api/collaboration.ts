import http from './client';

/** CC-Loop03 P0-2: 协作成员身份 */
export interface Identity {
  identity_type: 'user' | 'group';
  uid?: string;
  gid?: string;
}

export interface CollaborationProductItem {
  name: string;
  /** CC-Loop03 P1-1: 官方枚举为 share | new */
  collaboration_type: 'share' | 'new' | string;
  recycle_day?: number;
  verbs?: string[];
}

export interface CollaborationWorkflowItem {
  name: string;
  display_name?: string;
  workflow_type?: string;
  /** CC-Loop03 P1-1: 官方枚举为 share | new */
  collaboration_type: 'share' | 'new' | string;
  verbs?: string[];
}

export interface CollaborationModeItem {
  id?: string;
  name: string;
  project_name?: string;
  create_time?: number;
  update_time?: number;
  create_by?: string;
  update_by?: string;
  members: string[];
  /** CC-Loop03 P0-2: 与 members 等长且集合一致 */
  member_info?: Identity[];
  deploy_type?: string;
  recycle_day?: number;
  revision?: number;
  products?: CollaborationProductItem[];
  workflows?: CollaborationWorkflowItem[];
}

export interface CollaborationNewResp {
  code: number;
  ifSync: boolean;
  product?: Array<{
    name: string;
    collaboration_type: string;
    base_name?: string;
    deploy_type?: string;
  }>;
  workflow?: Array<{
    name: string;
    collaboration_type: string;
    base_name?: string;
  }>;
}

/** 常用协作权限 verbs 备选（供 UI 选择） */
export const COLLABORATION_POLICY_VERBS = [
  'get_environment',
  'create_environment',
  'edit_environment',
  'delete_environment',
  'get_workflow',
  'edit_workflow',
  'run_workflow',
] as const;

export function getCollaborationPolicies(): Array<{ label: string; value: string }> {
  return COLLABORATION_POLICY_VERBS.map((v) => ({ label: v, value: v }));
}

export const collaborationApi = {
  /**
   * 获取项目的协同模式列表
   * GET /api/aslan/collaboration/collaborations?projectName=
   * CC-Loop03 P0-1: 解包 { collaborations: [...] }
   */
  async getCollaborationModes(projectName: string): Promise<CollaborationModeItem[]> {
    const res = await http.get<{ collaborations?: CollaborationModeItem[] } | CollaborationModeItem[]>(
      `/api/aslan/collaboration/collaborations?projectName=${encodeURIComponent(projectName)}`
    );
    if (res && 'collaborations' in res && Array.isArray(res.collaborations)) {
      return res.collaborations;
    }
    if (Array.isArray(res)) return res;
    return [];
  },

  /**
   * 创建协同模式
   * POST /api/aslan/collaboration/collaborations?projectName=
   */
  async createCollaborationMode(
    projectName: string,
    payload: Partial<CollaborationModeItem>
  ): Promise<void> {
    const members = payload.members || [];
    const member_info =
      payload.member_info ||
      members.map((uid) => ({ identity_type: 'user' as const, uid }));
    return http.post<void>(
      `/api/aslan/collaboration/collaborations?projectName=${encodeURIComponent(projectName)}`,
      {
        ...payload,
        project_name: projectName,
        name: payload.name,
        members,
        member_info,
        products: payload.products || [],
        workflows: payload.workflows || [],
        deploy_type: payload.deploy_type || 'k8s',
      }
    );
  },

  /**
   * 更新协同模式
   * PUT /api/aslan/collaboration/collaborations/:name?projectName=
   * CC-Loop03 P0-3: body 必须包含 project_name / name / member_info / members / products / workflows / deploy_type
   */
  async updateCollaborationMode(
    projectName: string,
    name: string,
    payload: Partial<CollaborationModeItem>
  ): Promise<void> {
    const members = payload.members || [];
    const member_info =
      payload.member_info ||
      members.map((uid) => ({ identity_type: 'user' as const, uid }));
    return http.put<void>(
      `/api/aslan/collaboration/collaborations/${encodeURIComponent(name)}?projectName=${encodeURIComponent(projectName)}`,
      {
        ...payload,
        project_name: projectName,
        name,
        members,
        member_info,
        products: payload.products || [],
        workflows: payload.workflows || [],
        deploy_type: payload.deploy_type || 'k8s',
      }
    );
  },

  /**
   * 删除协同模式
   * DELETE /api/aslan/collaboration/collaborations/:name?projectName=
   */
  async deleteCollaborationMode(projectName: string, name: string): Promise<void> {
    return http.delete<void>(
      `/api/aslan/collaboration/collaborations/${encodeURIComponent(name)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * 检查协同实例是否有更新或需要同步
   * GET /api/aslan/collaboration/collaborations/new?projectName=
   */
  async getCollaborationNew(projectName: string): Promise<CollaborationNewResp> {
    return http.get<CollaborationNewResp>(
      `/api/aslan/collaboration/collaborations/new?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * 同步协同实例
   * POST /api/aslan/collaboration/collaborations/sync?projectName=
   */
  async syncCollaborationInstance(
    projectName: string,
    products: unknown[] = []
  ): Promise<void> {
    return http.post<void>(
      `/api/aslan/collaboration/collaborations/sync?projectName=${encodeURIComponent(projectName)}`,
      { products }
    );
  },
};

export default collaborationApi;
