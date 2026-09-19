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
  async getProjects(params?: { ungrouped?: boolean; page_num?: number; page_size?: number; filter?: string }): Promise<ProjectItem[]> {
    const ungrouped = params?.ungrouped !== undefined ? params.ungrouped : true;
    const res = await http.get<ProjectListResponse | ProjectItem[]>('/api/aslan/project/projects', {
      params: {
        ungrouped,
        page_num: params?.page_num || 1,
        page_size: params?.page_size || 50,
        filter: params?.filter || '',
      },
    });

    if (res && 'projects' in res && Array.isArray(res.projects)) {
      return res.projects;
    }
    if (Array.isArray(res)) {
      return res;
    }
    return [];
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
