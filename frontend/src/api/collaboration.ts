import http from './client';

export interface CollaborationProductItem {
  name: string;
  collaboration_type: 'share' | 'exclusive' | string;
  recycle_day?: number;
  verbs?: string[];
}

export interface CollaborationWorkflowItem {
  name: string;
  display_name?: string;
  workflow_type?: string;
  collaboration_type: 'share' | 'exclusive' | string;
  verbs?: string[];
}

export interface CollaborationModeItem {
  id?: string;
  name: string;
  project_name: string;
  create_time?: number;
  update_time?: number;
  create_by?: string;
  update_by?: string;
  members: string[];
  deploy_type?: string;
  recycle_day?: number;
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

export const collaborationApi = {
  /**
   * 获取项目的协同模式列表
   * GET /api/aslan/collaboration/collaborations?projectName=
   */
  async getCollaborationModes(projectName: string): Promise<CollaborationModeItem[]> {
    const res = await http.get<CollaborationModeItem[]>(
      `/api/aslan/collaboration/collaborations?projectName=${encodeURIComponent(projectName)}`
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * 创建协同模式
   * POST /api/aslan/collaboration/collaborations?projectName=
   */
  async createCollaborationMode(
    projectName: string,
    payload: Partial<CollaborationModeItem>
  ): Promise<void> {
    return http.post<void>(
      `/api/aslan/collaboration/collaborations?projectName=${encodeURIComponent(projectName)}`,
      { ...payload, project_name: projectName }
    );
  },

  /**
   * 更新协同模式
   * PUT /api/aslan/collaboration/collaborations/:name?projectName=
   */
  async updateCollaborationMode(
    projectName: string,
    name: string,
    payload: Partial<CollaborationModeItem>
  ): Promise<void> {
    return http.put<void>(
      `/api/aslan/collaboration/collaborations/${encodeURIComponent(name)}?projectName=${encodeURIComponent(projectName)}`,
      payload
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
