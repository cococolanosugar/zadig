import http from './client';

export interface ServiceVariableKV {
  key: string;
  value: unknown;
  type: 'string' | 'enum' | 'bool' | 'yaml' | string;
  options?: string[];
  desc?: string;
}

export interface ServiceDetail {
  service_name: string;
  type: string;
  product_name: string;
  source?: string;
  yaml?: string;
  variable_yaml?: string;
  service_variable_kvs?: ServiceVariableKV[];
  visibility?: string;
  template_id?: string;
  auto_sync?: boolean;
  codehost_id?: number;
  repo_name?: string;
  repo_owner?: string;
  repo_namespace?: string;
  branch_name?: string;
  load_path?: string;
  is_dir?: boolean;
  containers?: Array<{
    name: string;
    image: string;
    image_name?: string;
  }>;
}

export interface PreLoadServicePath {
  path: string;
  is_dir: boolean;
}

export interface LoadServicePath {
  service_name: string;
  path: string;
  is_dir: boolean;
}

export interface PreloadServiceTemplateReq {
  repo_name: string;
  repo_uuid?: string;
  branch_name: string;
  remote_name?: string;
  repo_owner: string;
  paths: PreLoadServicePath[];
}

export interface LoadServiceReq {
  type: string;
  product_name: string;
  service_paths: LoadServicePath[];
}

export interface LoadServiceFromYamlTemplateReq {
  service_name: string;
  project_name: string;
  template_id: string;
  auto_sync: boolean;
  variable_yaml?: string;
  service_variable_kvs?: ServiceVariableKV[];
}

export interface YamlTemplateDetail {
  id: string;
  name: string;
  content: string;
  variable_yaml: string;
  service_variable_kvs: ServiceVariableKV[];
  source?: string;
}

export interface ServiceModule {
  id?: string;
  project_name?: string;
  service_name?: string;
  is_manual?: boolean;
  revision_bound?: number;
  name: string;
  image: string;
  image_name?: string;
  ignored?: boolean;
  create_time?: number;
  update_time?: number;
}

export interface ManualModuleCreateReq {
  service_name: string;
  name: string;
  image: string;
  image_name?: string;
}

export interface ManualModuleUpdateReq {
  image: string;
  image_name?: string;
}

export interface ConvertVariableKVAndYamlArgs {
  action: 'toYaml' | 'toKV';
  kvs?: ServiceVariableKV[];
  yaml?: string;
}

export const serviceApi = {
  // --- Service Detail & Base ---
  async getServiceDetail(
    name: string,
    projectName: string,
    isProduction = false,
    type = 'k8s'
  ): Promise<ServiceDetail> {
    return http.get<ServiceDetail>(
      `/api/aslan/service/services/${encodeURIComponent(name)}/${type}?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      { skipErrorHandler: true }
    );
  },

  async updateServiceVariable(
    serviceName: string,
    projectName: string,
    isProduction = false,
    payload: {
      variable_yaml?: string;
      service_variable_kvs?: ServiceVariableKV[];
    }
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/services/${encodeURIComponent(serviceName)}/variable?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      payload
    );
  },

  // --- 1. Loader (从代码库加载/同步) ---
  // 后端: pkg/microservice/aslan/core/service/handler/loader.go:51
  async preloadServiceTemplate(
    codehostId: number,
    payload: PreloadServiceTemplateReq
  ): Promise<LoadServicePath[]> {
    const res = await http.post<LoadServicePath[]>(
      `/api/aslan/service/loader/preload/${codehostId}`,
      payload
    );
    return Array.isArray(res) ? res : [];
  },

  // 后端: loader.go:92
  async loadServiceFromRepo(
    codehostId: number,
    params: {
      projectName: string;
      repoName: string;
      branchName: string;
      repoOwner: string;
      remoteName?: string;
      namespace?: string;
      repoUUID?: string;
      production?: boolean;
    },
    payload: LoadServiceReq
  ): Promise<unknown> {
    const query = new URLSearchParams({
      projectName: params.projectName,
      repoName: params.repoName,
      branchName: params.branchName,
      repoOwner: params.repoOwner,
      remoteName: params.remoteName || '',
      namespace: params.namespace || params.repoOwner,
      repoUUID: params.repoUUID || '',
      production: String(params.production || false),
    });
    return http.post(
      `/api/aslan/service/loader/load/${codehostId}?${query.toString()}`,
      payload
    );
  },

  // 后端: loader.go:190 (SyncServiceTemplate)
  async syncServiceFromRepo(
    codehostId: number,
    params: {
      projectName: string;
      repoName: string;
      branchName: string;
      repoOwner: string;
      remoteName?: string;
      namespace?: string;
      repoUUID?: string;
      production?: boolean;
    },
    payload: LoadServiceReq
  ): Promise<unknown> {
    const query = new URLSearchParams({
      projectName: params.projectName,
      repoName: params.repoName,
      branchName: params.branchName,
      repoOwner: params.repoOwner,
      remoteName: params.remoteName || '',
      namespace: params.namespace || params.repoOwner,
      repoUUID: params.repoUUID || '',
      production: String(params.production || false),
    });
    return http.put(
      `/api/aslan/service/loader/load/${codehostId}?${query.toString()}`,
      payload
    );
  },

  // 代码源辅助接口
  async getCodehostNamespaces(id: number, key = ''): Promise<Array<{ name: string; path: string; kind?: string }>> {
    try {
      const res = await http.get<Array<{ name: string; path: string; kind?: string }>>(
        `/api/aslan/code/codehost/${id}/namespaces?key=${encodeURIComponent(key)}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async getCodehostRepos(
    id: number,
    repoOwner: string,
    type = 'gitlab',
    key = ''
  ): Promise<Array<{ name: string; namespace?: string }>> {
    try {
      const res = await http.get<Array<{ name: string; namespace?: string }>>(
        `/api/aslan/code/codehost/${id}/repos?repoOwner=${encodeURIComponent(repoOwner)}&type=${encodeURIComponent(type)}&page=1&per_page=200&key=${encodeURIComponent(key)}`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  async getCodehostBranches(
    id: number,
    repoOwner: string,
    repoName: string
  ): Promise<Array<{ name: string }>> {
    try {
      const res = await http.get<Array<{ name: string }>>(
        `/api/aslan/code/codehost/${id}/branches?repoOwner=${encodeURIComponent(repoOwner)}&repoName=${encodeURIComponent(repoName)}&page=1&per_page=200`,
        { skipErrorHandler: true }
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  // --- 2. Template (从模板加载/同步) ---
  // 后端: pkg/microservice/aslan/core/service/handler/yaml_template.go:39
  async loadServiceFromTemplate(
    projectName: string,
    isProduction: boolean,
    payload: LoadServiceFromYamlTemplateReq
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/service/template/load?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      payload
    );
  },

  // 后端: yaml_template.go:107
  async reloadServiceFromTemplate(
    projectName: string,
    isProduction: boolean,
    payload: LoadServiceFromYamlTemplateReq
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/service/template/reload?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      payload
    );
  },

  // 后端: yaml_template.go:166
  async previewServiceTemplate(
    projectName: string,
    payload: LoadServiceFromYamlTemplateReq
  ): Promise<string> {
    const res = await http.post<string>(
      `/api/aslan/service/template/preview?projectName=${encodeURIComponent(projectName)}`,
      payload
    );
    return typeof res === 'string' ? res : (res as { data?: string })?.data || '';
  },

  // 获取 YAML 模板列表与详情
  async getYamlTemplates(projectName = ''): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await http.get<{ yaml_template?: Array<{ id: string; name: string }>; total?: number }>(
        `/api/aslan/template/yaml?projectName=${encodeURIComponent(projectName)}`,
        { skipErrorHandler: true }
      );
      if (res && Array.isArray(res.yaml_template)) {
        return res.yaml_template;
      }
      return [];
    } catch {
      return [];
    }
  },

  async getYamlTemplateDetail(id: string): Promise<YamlTemplateDetail | null> {
    try {
      const res = await http.get<YamlTemplateDetail>(
        `/api/aslan/template/yaml/${encodeURIComponent(id)}`,
        { skipErrorHandler: true }
      );
      return res || null;
    } catch {
      return null;
    }
  },

  // --- 3. Modules (手工与自动服务模块) ---
  // 后端: pkg/microservice/aslan/core/service/handler/manual_module.go:33
  async listManualModules(
    serviceName: string,
    projectName: string,
    isProduction = false
  ): Promise<ServiceModule[]> {
    const res = await http.get<ServiceModule[]>(
      `/api/aslan/service/services/${encodeURIComponent(serviceName)}/manual-modules?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  // 后端: manual_module.go:65
  async listAutoModules(
    serviceName: string,
    projectName: string,
    isProduction = false
  ): Promise<ServiceModule[]> {
    const res = await http.get<ServiceModule[]>(
      `/api/aslan/service/services/${encodeURIComponent(serviceName)}/auto-modules?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  // 后端: manual_module.go:251
  async recognizeAutoModules(
    serviceName: string,
    projectName: string,
    isProduction = false
  ): Promise<ServiceModule[]> {
    const res = await http.post<ServiceModule[]>(
      `/api/aslan/service/services/${encodeURIComponent(serviceName)}/auto-modules/recognize?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      {}
    );
    return Array.isArray(res) ? res : [];
  },

  // 后端: manual_module.go:94
  async createManualModule(
    projectName: string,
    isProduction: boolean,
    payload: ManualModuleCreateReq
  ): Promise<ServiceModule> {
    return http.post<ServiceModule>(
      `/api/aslan/service/services/manual-modules?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      payload
    );
  },

  // 后端: manual_module.go:135
  async updateManualModule(
    id: string,
    projectName: string,
    isProduction: boolean,
    payload: ManualModuleUpdateReq
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/services/manual-modules/${encodeURIComponent(id)}?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`,
      payload
    );
  },

  // 后端: manual_module.go:177
  async deleteManualModule(
    id: string,
    projectName: string,
    isProduction = false
  ): Promise<unknown> {
    return http.delete(
      `/api/aslan/service/services/manual-modules/${encodeURIComponent(id)}?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`
    );
  },

  // 后端: manual_module.go:213
  async deleteAutoModule(
    id: string,
    projectName: string,
    isProduction = false
  ): Promise<unknown> {
    return http.delete(
      `/api/aslan/service/services/auto-modules/${encodeURIComponent(id)}?projectName=${encodeURIComponent(projectName)}&production=${isProduction}`
    );
  },

  // --- 4. Variable Convert (变量转换) ---
  // 后端: pkg/microservice/aslan/core/service/handler/service.go:1018
  async convertVariableKVAndYaml(
    payload: ConvertVariableKVAndYamlArgs
  ): Promise<ConvertVariableKVAndYamlArgs> {
    return http.post<ConvertVariableKVAndYamlArgs>(
      '/api/aslan/service/services/variable/convert',
      payload
    );
  },
};

export default serviceApi;
