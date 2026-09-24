import http from './client';

export interface WorkflowTemplateItem {
  id: string;
  template_name: string;
  create_by?: string;
  create_time?: number;
  update_by?: string;
  update_time?: number;
  stages?: string[];
  stage_details?: Array<{
    name: string;
    jobs: Array<{ name: string; job_type: string }>;
  }>;
  description?: string;
  category?: string;
  build_in?: boolean;
}

export interface WorkflowTemplateI18n {
  name_key: string;
  name_zh: string;
  name_en: string;
  description_zh: string;
  description_en: string;
}

export interface WorkflowTemplateResponse {
  workflow_templates: WorkflowTemplateItem[];
  build_in_workflow_template_i18ns?: WorkflowTemplateI18n[];
}

export interface YamlTemplateItem {
  id?: string;
  name: string;
  content: string;
  variables?: Array<{ key: string; value?: string }>;
}

export interface DockerfileTemplateItem {
  id?: string;
  name: string;
  content?: string;
  update_time?: number;
}

export interface ChartTemplateItem {
  name?: string;
  repo_name?: string;
  chart_name?: string;
  version?: string;
  description?: string;
}

export interface BuildTemplateItem {
  id?: string;
  name: string;
  build_name?: string;
  scripts?: string;
  update_time?: number;
}

export interface ScannerTemplateItem {
  id?: string;
  name: string;
  description?: string;
  enable?: boolean;
  update_time?: number;
}

export const templateApi = {
  /**
   * Get workflow templates (contains 20+ enterprise built-in templates)
   */
  async getWorkflowTemplates(): Promise<WorkflowTemplateResponse> {
    try {
      const res = await http.get<WorkflowTemplateResponse>('/api/aslan/template/workflow');
      return res || { workflow_templates: [] };
    } catch {
      return { workflow_templates: [] };
    }
  },

  /**
   * Get Kubernetes YAML templates
   */
  async getYamlTemplates(): Promise<{ system_variables?: unknown[]; yaml_template?: YamlTemplateItem[]; total?: number }> {
    try {
      const res = await http.get<{ system_variables?: unknown[]; yaml_template?: YamlTemplateItem[]; total?: number }>('/api/aslan/template/yaml');
      return res || { yaml_template: [], total: 0 };
    } catch {
      return { yaml_template: [], total: 0 };
    }
  },

  /**
   * Get Dockerfile templates
   */
  async getDockerfileTemplates(): Promise<{ dockerfile_template?: DockerfileTemplateItem[]; total?: number }> {
    try {
      const res = await http.get<{ dockerfile_template?: DockerfileTemplateItem[]; total?: number }>('/api/aslan/template/dockerfile');
      return res || { dockerfile_template: [], total: 0 };
    } catch {
      return { dockerfile_template: [], total: 0 };
    }
  },

  /**
   * Get Helm Chart templates
   */
  async getChartTemplates(): Promise<{ chartTemplates?: ChartTemplateItem[] }> {
    try {
      const res = await http.get<{ chartTemplates?: ChartTemplateItem[] }>('/api/aslan/template/charts');
      return res || { chartTemplates: [] };
    } catch {
      return { chartTemplates: [] };
    }
  },

  /**
   * Get Build templates
   */
  async getBuildTemplates(): Promise<{ build_templates?: BuildTemplateItem[] }> {
    try {
      const res = await http.get<{ build_templates?: BuildTemplateItem[] }>('/api/aslan/template/build');
      return res || { build_templates: [] };
    } catch {
      return { build_templates: [] };
    }
  },

  /**
   * Get Scanner templates
   */
  async getScannerTemplates(): Promise<{ scanning_templates?: ScannerTemplateItem[] }> {
    try {
      const res = await http.get<{ scanning_templates?: ScannerTemplateItem[] }>('/api/aslan/template/scanning');
      return res || { scanning_templates: [] };
    } catch {
      return { scanning_templates: [] };
    }
  },

  /**
   * Get Release Plan templates
   */
  async getReleasePlanTemplates(): Promise<Array<{ id: string; name: string; description?: string; update_time?: number }>> {
    try {
      const res = await http.get<Array<{ id: string; name: string; description?: string; update_time?: number }>>('/api/aslan/template/release_plan');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },
};

export default templateApi;
