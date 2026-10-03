import http from './client';
import type { ProjectItem } from '../stores/project';

export interface ProjectListResponse {
  projects: ProjectItem[];
  total: number;
}

export const projectApi = {
  /**
   * Get list of projects
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
    } catch {
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
      } catch {
        // Return empty
      }
    }
    return [];
  },

  /**
   * Get project groups
   */
  async getProjectGroups(): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await http.get<unknown>('/api/aslan/project/group');
      if (Array.isArray(res)) {
        return res.map((item) =>
          typeof item === 'string' ? { id: item, name: item } : (item as { id: string; name: string })
        );
      }
      return [];
    } catch {
      return [];
    }
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
   */
  async createProject(payload: { project_name: string; alias?: string; desc?: string }): Promise<unknown> {
    return http.post('/api/aslan/project/products', payload);
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
};

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
