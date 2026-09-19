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
      const res = await http.get<Array<{ id: string; name: string }>>('/api/aslan/project/group');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
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
};

export default projectApi;
