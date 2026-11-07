import http from './client';
import type { ProjectItem } from '../stores/project';

export interface ProjectListResponse {
  projects: ProjectItem[];
  total: number;
}

export const projectApi = {
  /**
   * Get list of projects
   * P1-E1: 保留 picket → aslan 降级链，但两级均失败时异常上抛，不再吞为空数组
   */
  async getProjects(params?: {
    ungrouped?: boolean;
    page_num?: number;
    page_size?: number;
    filter?: string;
    group_name?: string;
  }): Promise<ProjectItem[]> {
    try {
      const res = await http.get<ProjectListResponse>('/api/v1/picket/projects', {
        params: {
          verbosity: 'detailed',
          page_num: params?.page_num || 1,
          page_size: params?.page_size || 50,
          filter: params?.filter || '',
          group_name: params?.group_name || '',
          ungrouped: params?.ungrouped !== undefined ? params.ungrouped : false,
        },
      });

      if (res && res.projects && Array.isArray(res.projects)) {
        return res.projects;
      }
      return [];
    } catch (picketErr) {
      try {
        const fallbackRes = await http.get<ProjectListResponse | ProjectItem[]>('/api/aslan/project/projects', {
          params: {
            ungrouped: params?.ungrouped !== undefined ? params.ungrouped : true,
            page_num: params?.page_num || 1,
            page_size: params?.page_size || 50,
            filter: params?.filter || '',
          },
        });

        if (fallbackRes && 'projects' in fallbackRes && Array.isArray(fallbackRes.projects)) {
          return fallbackRes.projects;
        }
        if (Array.isArray(fallbackRes)) {
          return fallbackRes;
        }
        return [];
      } catch {
        // picket 与 aslan 双通道均故障：上抛首个异常，由调用方呈现错误态
        throw picketErr;
      }
    }
  },

  /**
   * Get project groups
   * P1-E1: HTTP 故障异常上抛，仅对成功响应做防御性解析
   */
  async getProjectGroups(): Promise<Array<{ id: string; name: string }>> {
    const res = await http.get<unknown>('/api/aslan/project/group');
    if (Array.isArray(res)) {
      return res.map((item) =>
        typeof item === 'string' ? { id: item, name: item } : (item as { id: string; name: string })
      );
    }
    return [];
  },

  /**
   * Create a project group
   */
  async createProjectGroup(payload: { group_name: string; project_keys?: string[] }): Promise<unknown> {
    return http.post('/api/aslan/project/group', {
      group_name: payload.group_name,
      project_keys: payload.project_keys || [],
    });
  },

  /**
   * Update a project group
   */
  async updateProjectGroup(payload: { group_name: string; project_keys?: string[] }): Promise<unknown> {
    return http.put('/api/aslan/project/group', {
      group_name: payload.group_name,
      project_keys: payload.project_keys || [],
    });
  },

  /**
   * Delete a project group
   */
  async deleteProjectGroup(groupName: string): Promise<unknown> {
    return http.delete('/api/aslan/project/group', {
      params: { groupName },
    });
  },

  /**
   * Get preset project relations for a group
   */
  async getProjectGroupPreset(groupName?: string): Promise<{
    group_id?: string;
    group_name?: string;
    projects?: Array<{ project_name: string; project_key: string; enabled: boolean }>;
  }> {
    return http.get('/api/aslan/project/group/preset', {
      params: { groupName: groupName || '' },
    });
  },

  /**
   * Create a new project
   * R12 任务一: 后端强制 product_name 与 product_feature 必填，payload 始终完整组装
   */
  async createProject(data: {
    project_name: string;
    product_name?: string;
    alias?: string;
    desc?: string;
    product_feature?: {
      basic_facility?: string;
      deploy_type?: string;
      create_env_type?: string;
    };
  }): Promise<ProjectItem> {
    const payload = {
      product_name: data.product_name || data.project_name,
      project_name: data.alias || data.project_name,
      desc: data.desc || '',
      product_feature: data.product_feature || {
        basic_facility: 'kubernetes',
        deploy_type: 'k8s',
        create_env_type: 'system',
      },
    };
    return http.post<ProjectItem>('/api/aslan/project/products', payload);
  },

  /**
   * Delete a project
   */
  async deleteProject(projectName: string): Promise<unknown> {
    return http.delete(`/api/aslan/project/products/${projectName}`);
  },

  /**
   * Get project template hierarchy (projects -> services -> container modules)
   * GET /api/aslan/project/templates/info
   */
  async getTemplatesHierarchyInfo(): Promise<ProjectTemplateHierarchyInfo[]> {
    const res = await http.get<ProjectTemplateHierarchyInfo[]>('/api/aslan/project/templates/info');
    return Array.isArray(res) ? res : [];
  },

  /**
   * Get project template / product detail
   * GET /api/aslan/project/products/:name
   */
  async getProjectDetail(projectName: string): Promise<ProjectProductDetail> {
    return http.get(`/api/aslan/project/products/${projectName}`);
  },

  /**
   * Update project settings (strategy, artifact naming rules, release max history, auto deploy)
   * PUT /api/aslan/project/products?projectName=:name
   */
  async updateProjectProduct(projectName: string, payload: Partial<ProjectProductDetail>): Promise<unknown> {
    return http.put('/api/aslan/project/products', payload, {
      params: { projectName },
    });
  },

  /**
   * 项目专属代码源集成配置获取与管理
   * GET /api/aslan/project/integration/:projectName/codehosts
   */
  async getProjectCodeProviders(projectName: string, encryptedKey?: string): Promise<any[]> {
    const query = encryptedKey ? `?encryptedKey=${encodeURIComponent(encryptedKey)}` : '';
    const res = await http.get<any>(`/api/aslan/project/integration/${encodeURIComponent(projectName)}/codehosts${query}`);
    return Array.isArray(res) ? res : [];
  },

  async createProjectCodeProvider(projectName: string, payload: any): Promise<any> {
    return http.post(`/api/aslan/project/integration/${encodeURIComponent(projectName)}/codehosts`, payload);
  },

  async updateProjectCodeProvider(projectName: string, id: string | number, payload: any): Promise<any> {
    return http.patch(`/api/aslan/project/integration/${encodeURIComponent(projectName)}/codehosts/${id}`, payload);
  },

  async deleteProjectCodeProvider(projectName: string, id: string | number): Promise<any> {
    return http.delete(`/api/aslan/project/integration/${encodeURIComponent(projectName)}/codehosts/${id}`);
  },
};

export interface CustomRule {
  pr_rule?: string;
  branch_rule?: string;
  pr_and_branch_rule?: string;
  tag_rule?: string;
  jenkins_rule?: string;
  commit_rule?: string;
}

export interface AutoDeployPolicy {
  enable: boolean;
}

export interface ImageSearchingRule {
  repo?: string;
  namespace?: string;
  image?: string;
  tag?: string;
  in_use?: boolean;
  preset_id?: number;
}

export interface ProjectProductDetail {
  product_name: string;
  project_name?: string;
  desc?: string;
  revision?: number;
  enabled?: boolean;
  release_max_history?: number;
  auto_deploy?: AutoDeployPolicy | null;
  custom_image_rule?: CustomRule;
  custom_tar_rule?: CustomRule;
  image_searching_rules?: ImageSearchingRule[];
  services?: string[][];
  production_services?: string[][];
  public?: boolean;
  [key: string]: unknown;
}

export interface ProjectTemplateContainerInfo {
  value: string;
  label: string;
}

export interface ProjectTemplateServiceInfo {
  value: string;
  label: string;
  container_info?: ProjectTemplateContainerInfo[];
}

export interface ProjectTemplateHierarchyInfo {
  value: string;
  label: string;
  service_info?: ProjectTemplateServiceInfo[];
}

export default projectApi;

