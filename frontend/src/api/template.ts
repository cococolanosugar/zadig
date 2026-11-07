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
   * 注意：列表接口不再吞错 — 异常向上抛出，由调用方展示错误态与重试（对齐 P1-05 错误通道修复）
   */
  async getWorkflowTemplates(): Promise<WorkflowTemplateResponse> {
    const res = await http.get<WorkflowTemplateResponse>('/api/aslan/template/workflow');
    return res || { workflow_templates: [] };
  },

  /**
   * Get Kubernetes YAML templates
   */
  async getYamlTemplates(): Promise<{ system_variables?: unknown[]; yaml_template?: YamlTemplateItem[]; total?: number }> {
    const res = await http.get<{ system_variables?: unknown[]; yaml_template?: YamlTemplateItem[]; total?: number }>('/api/aslan/template/yaml');
    return res || { yaml_template: [], total: 0 };
  },

  /**
   * Get Dockerfile templates
   */
  async getDockerfileTemplates(): Promise<{ dockerfile_template?: DockerfileTemplateItem[]; total?: number }> {
    const res = await http.get<{ dockerfile_template?: DockerfileTemplateItem[]; total?: number }>('/api/aslan/template/dockerfile');
    return res || { dockerfile_template: [], total: 0 };
  },

  /**
   * Get Helm Chart templates
   */
  async getChartTemplates(): Promise<{ chartTemplates?: ChartTemplateItem[] }> {
    const res = await http.get<{ chartTemplates?: ChartTemplateItem[] }>('/api/aslan/template/charts');
    return res || { chartTemplates: [] };
  },

  /**
   * Get Build templates
   */
  async getBuildTemplates(): Promise<{ build_templates?: BuildTemplateItem[] }> {
    const res = await http.get<{ build_templates?: BuildTemplateItem[] }>('/api/aslan/template/build');
    return res || { build_templates: [] };
  },

  /**
   * Get Scanner templates
   */
  async getScannerTemplates(): Promise<{ scanning_templates?: ScannerTemplateItem[] }> {
    const res = await http.get<{ scanning_templates?: ScannerTemplateItem[] }>('/api/aslan/template/scanning');
    return res || { scanning_templates: [] };
  },

  /**
   * Get Release Plan templates
   */
  async getReleasePlanTemplates(): Promise<Array<{ id: string; name: string; description?: string; update_time?: number }>> {
    const res = await http.get<Array<{ id: string; name: string; description?: string; update_time?: number }>>('/api/aslan/template/release_plan');
    return Array.isArray(res) ? res : [];
  },

  /**
   * K8s YAML 模板变量提取
   * POST /api/aslan/template/yaml/extractVariable
   */
  async extractYamlVariables(payload: { content: string }): Promise<Array<{ key: string; value: string }>> {
    const res = await http.post<any>('/api/aslan/template/yaml/extractVariable', payload);
    return Array.isArray(res) ? res : [];
  },

  /**
   * K8s YAML 模板变量合法性校验
   * POST /api/aslan/template/yaml/validateVariable
   */
  async validateYamlVariable(payload: { variable_yaml: string }): Promise<{ message?: string }> {
    return http.post('/api/aslan/template/yaml/validateVariable', payload);
  },

  /**
   * Dockerfile 模板语法校验
   * POST /api/aslan/template/dockerfile/validation
   */
  async validateDockerfile(payload: { content: string }): Promise<{ message?: string; status?: string }> {
    return http.post('/api/aslan/template/dockerfile/validation', payload);
  },

  /**
   * Helm Chart 模板文件内容获取
   * GET /api/aslan/template/charts/:name/files?fileName=&filePath=
   */
  async getChartTemplateFiles(chartName: string, fileName: string, filePath: string): Promise<{ content?: string }> {
    return http.get(`/api/aslan/template/charts/${encodeURIComponent(chartName)}/files?fileName=${encodeURIComponent(fileName)}&filePath=${encodeURIComponent(filePath)}`);
  },

  /**
   * Helm Chart 模板变量获取与更新
   * GET / PUT /api/aslan/template/charts/:name/variables
   */
  async getChartTemplateVariables(chartName: string): Promise<any> {
    return http.get(`/api/aslan/template/charts/${encodeURIComponent(chartName)}/variables`);
  },

  async saveChartTemplateVariables(chartName: string, payload: any): Promise<any> {
    return http.put(`/api/aslan/template/charts/${encodeURIComponent(chartName)}/variables`, payload);
  },

  /**
   * Helm Chart 模板服务引用列表获取
   * GET /api/aslan/template/charts/:name/reference
   */
  async getChartTemplateReference(chartName: string): Promise<Array<{ service_name: string; project_name: string }>> {
    const res = await http.get<any>(`/api/aslan/template/charts/${encodeURIComponent(chartName)}/reference`);
    return Array.isArray(res) ? res : [];
  },
};

export default templateApi;

// ---------- 模板 CRUD（对齐 templatestore 路由契约） ----------
// YAML 模板：POST/PUT /template/yaml body {name, content, variable_yaml?}; DELETE /template/yaml/:id
// Dockerfile 模板：POST/PUT /template/dockerfile body {name, content}; DELETE /template/dockerfile/:id
// Chart 模板：POST/PUT /template/charts body {name, codeHostID, owner, namespace?, repo, path, branch}; DELETE /template/charts/:name
//   （pkg/microservice/aslan/core/templatestore/handler/router.go:44-49, chart.go addChartArgs + fs.DownloadFromSourceArgs）
// Build 模板：POST/PUT /template/build body = BuildTemplate{name, scripts, timeout, pre_build}; DELETE /template/build/:id
//   （router.go:81-86；后端 AddBuildTemplate 解引用 PreBuild，payload 必须携带 pre_build）
// Scanning 模板：POST/PUT /template/scanning body = ScanningTemplate{name, scanner_type, enable_scanner, ...}; DELETE /template/scanning/:id
//   （router.go:102-106）
export interface ChartTemplatePayload {
  name: string;
  codeHostID: number;
  owner: string;
  namespace?: string;
  repo: string;
  path: string;
  branch: string;
  repoLink?: string;
}

export interface BuildTemplatePayload {
  name: string;
  scripts: string;
  timeout: number;
  script_type?: string;
  // 后端 AddBuildTemplate 无判空直接解引用 PreBuild（service/build.go:47），必须携带资源请求
  pre_build: {
    res_req: string;
    res_req_spec?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ScanningTemplatePayload {
  name: string;
  scanner_type: string;
  enable_scanner: boolean;
  parameter?: string;
  scripts?: string;
  sonar_id?: string;
  image_id?: string;
  [key: string]: unknown;
}

export const templateCrudApi = {
  async createYamlTemplate(payload: { name: string; content: string; variable_yaml?: string }): Promise<unknown> {
    return http.post('/api/aslan/template/yaml', payload, { skipErrorHandler: true });
  },
  async updateYamlTemplate(id: string, payload: { name: string; content: string; variable_yaml?: string }): Promise<unknown> {
    return http.put(`/api/aslan/template/yaml/${id}`, payload, { skipErrorHandler: true });
  },
  async deleteYamlTemplate(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/template/yaml/${id}`, { skipErrorHandler: true });
  },
  async createDockerfileTemplate(payload: { name: string; content: string }): Promise<unknown> {
    return http.post('/api/aslan/template/dockerfile', payload, { skipErrorHandler: true });
  },
  async updateDockerfileTemplate(id: string, payload: { name: string; content: string }): Promise<unknown> {
    return http.put(`/api/aslan/template/dockerfile/${id}`, payload, { skipErrorHandler: true });
  },
  async deleteDockerfileTemplate(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/template/dockerfile/${id}`, { skipErrorHandler: true });
  },

  // ---------- Helm Chart 模板（router.go:40-49） ----------
  async getChartTemplate(name: string): Promise<ChartTemplatePayload & { id?: string }> {
    return http.get(`/api/aslan/template/charts/${encodeURIComponent(name)}`, { skipErrorHandler: true });
  },
  async createChartTemplate(payload: ChartTemplatePayload): Promise<unknown> {
    return http.post('/api/aslan/template/charts', payload, { skipErrorHandler: true });
  },
  async updateChartTemplate(name: string, payload: ChartTemplatePayload): Promise<unknown> {
    return http.put(`/api/aslan/template/charts/${encodeURIComponent(name)}`, payload, { skipErrorHandler: true });
  },
  async deleteChartTemplate(name: string): Promise<unknown> {
    return http.delete(`/api/aslan/template/charts/${encodeURIComponent(name)}`, { skipErrorHandler: true });
  },

  // ---------- 构建模板（router.go:81-87） ----------
  async getBuildTemplate(id: string): Promise<BuildTemplatePayload & { id?: string }> {
    return http.get(`/api/aslan/template/build/${id}`, { skipErrorHandler: true });
  },
  async createBuildTemplate(payload: BuildTemplatePayload): Promise<unknown> {
    return http.post('/api/aslan/template/build', payload, { skipErrorHandler: true });
  },
  async updateBuildTemplate(id: string, payload: BuildTemplatePayload): Promise<unknown> {
    return http.put(`/api/aslan/template/build/${id}`, payload, { skipErrorHandler: true });
  },
  async deleteBuildTemplate(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/template/build/${id}`, { skipErrorHandler: true });
  },

  // ---------- 代码扫描模板（router.go:100-106） ----------
  async getScanningTemplate(id: string): Promise<ScanningTemplatePayload & { id?: string }> {
    return http.get(`/api/aslan/template/scanning/${id}`, { skipErrorHandler: true });
  },
  async createScanningTemplate(payload: ScanningTemplatePayload): Promise<unknown> {
    return http.post('/api/aslan/template/scanning', payload, { skipErrorHandler: true });
  },
  async updateScanningTemplate(id: string, payload: ScanningTemplatePayload): Promise<unknown> {
    return http.put(`/api/aslan/template/scanning/${id}`, payload, { skipErrorHandler: true });
  },
  async deleteScanningTemplate(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/template/scanning/${id}`, { skipErrorHandler: true });
  },
};
