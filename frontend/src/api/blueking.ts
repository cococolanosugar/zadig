import { http } from './client';

export interface BlueKingBusiness {
  bk_biz_id: number | string;
  bk_biz_name: string;
  bk_biz_maintainer?: string;
  default?: number;
}

export interface BlueKingExecutionPlan {
  id: number | string;
  name: string;
  creator?: string;
  create_time?: number;
  last_modify_user?: string;
  last_modify_time?: number;
}

export interface BlueKingTopologyNode {
  bk_inst_id: number | string;
  bk_inst_name: string;
  bk_obj_id: string;
  bk_obj_name: string;
  child?: BlueKingTopologyNode[];
}

export interface BlueKingHost {
  bk_host_id: number | string;
  bk_host_innerip: string;
  bk_os_name?: string;
  bk_cloud_id?: number;
}

export const bluekingApi = {
  /**
   * 获取蓝鲸业务列表
   * GET /api/aslan/system/blueking/business?id=&page=&per_page=
   */
  async listBusiness(toolId: string, page = 1, perPage = 2000): Promise<BlueKingBusiness[]> {
    const q = new URLSearchParams({
      id: toolId,
      page: String(page),
      per_page: String(perPage),
    });
    const res = await http.get<BlueKingBusiness[] | { data: BlueKingBusiness[] }>(
      `/api/aslan/system/blueking/business?${q.toString()}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },

  /**
   * 获取指定蓝鲸业务下的执行方案列表
   * GET /api/aslan/system/blueking/executionPlan?id=&business_id=&name=&page=&per_page=
   */
  async listExecutionPlans(params: {
    toolId: string;
    businessId: number | string;
    name?: string;
    page?: number;
    perPage?: number;
  }): Promise<BlueKingExecutionPlan[]> {
    const q = new URLSearchParams({
      id: params.toolId,
      business_id: String(params.businessId),
      page: String(params.page || 1),
      per_page: String(params.perPage || 1000),
    });
    if (params.name) q.set('name', params.name);

    const res = await http.get<BlueKingExecutionPlan[] | { data: BlueKingExecutionPlan[] }>(
      `/api/aslan/system/blueking/executionPlan?${q.toString()}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },

  /**
   * 获取蓝鲸执行方案详情
   * GET /api/aslan/system/blueking/executionPlan/:id?id=&business_id=
   */
  async getExecutionPlanDetail(toolId: string, businessId: number | string, planId: number | string): Promise<unknown> {
    const q = new URLSearchParams({
      id: toolId,
      business_id: String(businessId),
    });
    return http.get(`/api/aslan/system/blueking/executionPlan/${planId}?${q.toString()}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * 获取蓝鲸拓扑架构
   * GET /api/aslan/system/blueking/topology?id=&business_id=
   */
  async getTopology(toolId: string, businessId: number | string): Promise<unknown> {
    const q = new URLSearchParams({
      id: toolId,
      business_id: String(businessId),
    });
    return http.get(`/api/aslan/system/blueking/topology?${q.toString()}`, { skipErrorHandler: true });
  },

  /**
   * 获取蓝鲸业务拓扑树 (CMDB)
   * GET /api/aslan/system/blueking/hosts/business?id=&business_id=
   */
  async getBusinessTopology(toolId: string, businessId: number | string): Promise<BlueKingTopologyNode[]> {
    const q = new URLSearchParams({
      id: toolId,
      business_id: String(businessId),
    });
    const res = await http.get<{ topology?: BlueKingTopologyNode[] } | BlueKingTopologyNode[]>(
      `/api/aslan/system/blueking/hosts/business?${q.toString()}`,
      { skipErrorHandler: true }
    );
    if (res && 'topology' in res && Array.isArray(res.topology)) {
      return res.topology;
    }
    return Array.isArray(res) ? res : [];
  },

  /**
   * 根据蓝鲸拓扑节点获取主机列表
   * GET /api/aslan/system/blueking/hosts/topologyNode?id=&business_id=&instance_id=&object_id=&page=&per_page=
   */
  async listHostsByTopologyNode(params: {
    toolId: string;
    businessId: number | string;
    instanceId: number | string;
    objectId: string;
    page?: number;
    perPage?: number;
  }): Promise<BlueKingHost[]> {
    const q = new URLSearchParams({
      id: params.toolId,
      business_id: String(params.businessId),
      instance_id: String(params.instanceId),
      object_id: params.objectId,
      page: String(params.page || 1),
      per_page: String(params.perPage || 100),
    });
    const res = await http.get<BlueKingHost[] | { data: BlueKingHost[] }>(
      `/api/aslan/system/blueking/hosts/topologyNode?${q.toString()}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },
};

export default bluekingApi;
