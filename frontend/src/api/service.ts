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

export interface HelmFileInfo {
  parent: string;
  name: string;
  size: number;
  is_dir: boolean;
}

export interface HelmServiceListResp {
  service_infos: ServiceDetail[];
  file_infos: HelmFileInfo[];
  services: string[][];
}

export interface HelmServiceModuleResp {
  service_modules: Array<{
    name: string;
    image: string;
  }>;
  service?: ServiceDetail;
}

export interface HelmChartEditInfo {
  file_path: string;
  file_content: string;
  production?: boolean;
}

export interface HelmReleaseNamingRule {
  service_name: string;
  naming: string;
}

export interface HelmServiceCreationArgs {
  source: 'repo' | 'gerrit' | 'publicRepo' | 'chartTemplate' | 'chartRepo' | string;
  name: string;
  createdBy?: string;
  auto_sync?: boolean;
  createFrom: Record<string, unknown>;
  valuesData?: {
    yamlSource?: string;
    autoSync?: boolean;
    customYaml?: string;
  };
  production?: boolean;
}

export interface BulkHelmServiceCreationArgs {
  source: 'repo' | 'gerrit' | 'publicRepo' | 'chartTemplate' | 'chartRepo' | string;
  createFrom: Record<string, unknown>;
  createdBy?: string;
  valuesData?: {
    yamlSource?: string;
    autoSync?: boolean;
    customYaml?: string;
  };
  auto_sync?: boolean;
  production?: boolean;
}

export interface BulkHelmServiceCreationResp {
  successServices: string[];
  failedServices: Array<{ path: string; error: string }>;
}

export interface PmHealthCheck {
  protocol: 'http' | 'tcp';
  port: number;
  path?: string;
  time_out: number; // 2-60
  interval?: number; // 2-60
  healthy_threshold?: number; // 2-10
  unhealthy_threshold?: number; // 2-10
  current_healthy_num?: number;
  current_unhealthy_num?: number;
}

export interface PmServiceTemplate {
  product_name: string;
  service_name: string;
  visibility?: string;
  revision?: number;
  type: 'pm' | string;
  username?: string;
  health_checks?: PmHealthCheck[];
  start_cmd?: string;
  stop_cmd?: string;
  restart_cmd?: string;
  env_name?: string;
  variable_yaml?: string;
  service_variable_kvs?: ServiceVariableKV[];
}

export interface PmServiceBuildObject {
  pm_service_tmpl: PmServiceTemplate;
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

  /**
   * 删除服务模板（R1-A1 P0 闭环）
   * DELETE /api/aslan/service/services/:name/:type?projectName=&production=
   * 后端: pkg/microservice/aslan/core/service/handler/router.go:56 (k8s.DELETE("/:name/:type", DeleteServiceTemplate))
   */
  async deleteService(serviceName: string, type = 'k8s', projectName = '', production = false): Promise<unknown> {
    const q = new URLSearchParams();
    if (projectName) q.set('projectName', projectName);
    if (production) q.set('production', 'true');
    return http.delete(
      `/api/aslan/service/services/${encodeURIComponent(serviceName)}/${encodeURIComponent(type)}?${q.toString()}`,
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
  // R1-A4: HTTP 故障异常上抛（由调用方呈现错误提示），仅对成功响应做防御性解析
  async getCodehostNamespaces(id: number, key = ''): Promise<Array<{ name: string; path: string; kind?: string }>> {
    const res = await http.get<Array<{ name: string; path: string; kind?: string }>>(
      `/api/aslan/code/codehost/${id}/namespaces?key=${encodeURIComponent(key)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  // R1-A4: HTTP 故障异常上抛
  async getCodehostRepos(
    id: number,
    repoOwner: string,
    type = 'gitlab',
    key = ''
  ): Promise<Array<{ name: string; namespace?: string }>> {
    const res = await http.get<Array<{ name: string; namespace?: string }>>(
      `/api/aslan/code/codehost/${id}/repos?repoOwner=${encodeURIComponent(repoOwner)}&type=${encodeURIComponent(type)}&page=1&per_page=200&key=${encodeURIComponent(key)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  // R1-A4: HTTP 故障异常上抛
  async getCodehostBranches(
    id: number,
    repoOwner: string,
    repoName: string
  ): Promise<Array<{ name: string }>> {
    const res = await http.get<Array<{ name: string }>>(
      `/api/aslan/code/codehost/${id}/branches?repoOwner=${encodeURIComponent(repoOwner)}&repoName=${encodeURIComponent(repoName)}&page=1&per_page=200`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
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
  // R1-A4: HTTP 故障异常上抛（由调用方呈现错误提示），仅对成功响应做防御性解析
  async getYamlTemplates(projectName = ''): Promise<Array<{ id: string; name: string }>> {
    const res = await http.get<{ yaml_template?: Array<{ id: string; name: string }>; total?: number }>(
      `/api/aslan/template/yaml?projectName=${encodeURIComponent(projectName)}`,
      { skipErrorHandler: true }
    );
    if (res && Array.isArray(res.yaml_template)) {
      return res.yaml_template;
    }
    return [];
  },

  // R1-A4: HTTP 故障异常上抛
  async getYamlTemplateDetail(id: string): Promise<YamlTemplateDetail | null> {
    const res = await http.get<YamlTemplateDetail>(
      `/api/aslan/template/yaml/${encodeURIComponent(id)}`,
      { skipErrorHandler: true }
    );
    return res || null;
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

  // --- 5. Helm Services (Helm 服务管理) ---
  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:33
  async listHelmServices(
    productName: string,
    production = false,
    removeApplicationLinked = false
  ): Promise<HelmServiceListResp> {
    return http.get<HelmServiceListResp>(
      `/api/aslan/service/helm/${encodeURIComponent(productName)}?projectName=${encodeURIComponent(productName)}&production=${production}&removeApplicationLinked=${removeApplicationLinked}`
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:80
  async getHelmServiceModule(
    productName: string,
    serviceName: string,
    revision = 0,
    production = false
  ): Promise<HelmServiceModuleResp> {
    return http.get<HelmServiceModuleResp>(
      `/api/aslan/service/helm/${encodeURIComponent(productName)}/${encodeURIComponent(serviceName)}/serviceModule?projectName=${encodeURIComponent(productName)}&revision=${revision}&production=${production}`
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:132
  async getHelmFilePath(
    productName: string,
    serviceName: string,
    dir = '',
    revision = 0,
    production = false
  ): Promise<HelmFileInfo[]> {
    const res = await http.get<HelmFileInfo[]>(
      `/api/aslan/service/helm/${encodeURIComponent(productName)}/${encodeURIComponent(serviceName)}/filePath?projectName=${encodeURIComponent(productName)}&dir=${encodeURIComponent(dir)}&revision=${revision}&production=${production}`
    );
    return Array.isArray(res) ? res : [];
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:187
  async getHelmFileContent(
    productName: string,
    serviceName: string,
    filePath: string,
    fileName: string,
    revision = 0,
    deliveryVersion = false,
    production = false
  ): Promise<string> {
    const res = await http.get<string | { data?: string }>(
      `/api/aslan/service/helm/${encodeURIComponent(productName)}/${encodeURIComponent(serviceName)}/fileContent?projectName=${encodeURIComponent(productName)}&filePath=${encodeURIComponent(filePath)}&fileName=${encodeURIComponent(fileName)}&revision=${revision}&deliveryVersion=${deliveryVersion}&production=${production}`
    );
    if (typeof res === 'string') return res;
    if (res && typeof (res as { data?: string }).data === 'string') return (res as { data: string }).data;
    return String(res || '');
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:241
  async updateHelmFileContent(
    serviceName: string,
    projectName: string,
    payload: HelmChartEditInfo,
    production = false
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/helm/${encodeURIComponent(serviceName)}/file?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:298
  async createHelmService(
    projectName: string,
    payload: HelmServiceCreationArgs,
    production = false
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/service/helm/services?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:366
  async updateHelmService(
    projectName: string,
    payload: HelmServiceCreationArgs,
    production = false
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/helm/services?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/helm.go:435
  async createBulkHelmServices(
    projectName: string,
    payload: BulkHelmServiceCreationArgs,
    production = false
  ): Promise<BulkHelmServiceCreationResp> {
    return http.post<BulkHelmServiceCreationResp>(
      `/api/aslan/service/helm/services/bulk?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/service.go:568
  async updateHelmReleaseNaming(
    projectName: string,
    payload: HelmReleaseNamingRule,
    production = false
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/helm/services/releaseNaming?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // --- 6. PM (Host) Services (主机服务) ---
  // 后端: pkg/microservice/aslan/core/service/handler/service.go:873
  async createPmService(
    projectName: string,
    payload: PmServiceBuildObject
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/service/pm/${encodeURIComponent(projectName)}?projectName=${encodeURIComponent(projectName)}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/service.go:945
  async updatePmService(
    projectName: string,
    payload: PmServiceBuildObject
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/pm/${encodeURIComponent(projectName)}?projectName=${encodeURIComponent(projectName)}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/service.go:507
  async updatePmHealthCheckStatus(
    projectName: string,
    payload: PmServiceTemplate
  ): Promise<unknown> {
    return http.put(
      `/api/aslan/service/pm/healthCheckUpdate?projectName=${encodeURIComponent(projectName)}`,
      payload
    );
  },

  // --- 7. Kube Workloads Import (从 K8s 集群工作负载载入服务) ---
  // 后端: pkg/microservice/aslan/core/service/handler/environment.go:60
  async getKubeWorkloads(
    projectName: string,
    clusterId: string,
    namespace: string
  ): Promise<{ workloads_map?: Record<string, string[]> }> {
    return http.get<{ workloads_map?: Record<string, string[]> }>(
      `/api/aslan/service/services/kube/workloads?projectName=${encodeURIComponent(projectName)}&cluster_id=${encodeURIComponent(clusterId)}&namespace=${encodeURIComponent(namespace)}`
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/environment.go:67
  async loadKubeWorkloadsYaml(
    projectName: string,
    payload: {
      product_name: string;
      visibility?: string;
      type?: string;
      namespace: string;
      cluster_id: string;
      services: Array<{
        name: string;
        workloads_map: Record<string, string[]>;
      }>;
    },
    production = false
  ): Promise<unknown> {
    return http.post(
      `/api/aslan/service/services/yaml?projectName=${encodeURIComponent(projectName)}&production=${production}`,
      payload
    );
  },

  // 后端: pkg/microservice/aslan/core/service/handler/service.go:551 (k8s.PUT("/yaml/validator", YamlValidator))
  async validateServiceYaml(payload: {
    service_name: string;
    variable_yaml?: string;
    yaml: string;
  }): Promise<Array<string | { message?: string }>> {
    const res = await http.put<Array<string | { message?: string }>>(
      '/api/aslan/service/services/yaml/validator',
      payload,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * 服务级标签元数据：GET /api/aslan/service/labels
   * 后端: pkg/microservice/aslan/core/service/handler/service.go:1317 (ListServiceLabels)
   */
  async getServiceLabels(serviceName: string, projectKey: string, production = false): Promise<Array<{ id: string; key: string; value: string }>> {
    const res = await http.get<{ labels?: Array<{ id: string; key: string; value: string }> } | Array<{ id: string; key: string; value: string }>>(
      `/api/aslan/service/labels?project_key=${encodeURIComponent(projectKey)}&service_name=${encodeURIComponent(serviceName)}&production=${production}`
    );
    if (Array.isArray(res)) return res;
    if (res && 'labels' in res && Array.isArray(res.labels)) return res.labels;
    return [];
  },

  /**
   * 系统标签键注册表（服务标签快捷添加的可选键来源）：GET /api/aslan/system/labels
   * 后端: pkg/microservice/aslan/core/system/handler/router.go:558-560 (ListServiceLabelSettings)
   * 返回 models.Label: {id, key, description}
   */
  async getLabelSettings(): Promise<Array<{ id: string; key: string; description?: string }>> {
    const res = await http.get<Array<{ id: string; key: string; description?: string }>>('/api/aslan/system/labels');
    return Array.isArray(res) ? res : [];
  },

  /**
   * 服务级标签元数据创建：POST /api/aslan/service/labels
   * 后端: pkg/microservice/aslan/core/service/handler/service.go:1037 (addServiceLabelReq)
   */
  createServiceLabel(payload: {
    label_id: string;
    project_key: string;
    service_name: string;
    value: string;
    production?: string | boolean;
    key?: string;
  }) {
    const body = {
      label_id: payload.label_id,
      project_key: payload.project_key,
      service_name: payload.service_name,
      value: payload.value,
      production: String(payload.production ?? false),
    };
    return http.post<{ id?: string; message?: string }>('/api/aslan/service/labels', body);
  },

  /**
   * 服务级标签修改：PUT /api/aslan/service/labels/:id
   * 后端: pkg/microservice/aslan/core/service/handler/service.go:1120 (updateServiceLabelReq)
   */
  updateServiceLabel(id: string, payload: { value: string; key?: string }) {
    const body = {
      value: payload.value,
    };
    return http.put<{ message?: string }>(`/api/aslan/service/labels/${encodeURIComponent(id)}`, body);
  },

  /**
   * 服务级标签删除：DELETE /api/aslan/service/labels/:id
   */
  deleteServiceLabel(id: string) {
    return http.delete<{ message?: string }>(`/api/aslan/service/labels/${encodeURIComponent(id)}`);
  },

  /**
   * 主机服务/物理机部署配置获取
   * GET /api/aslan/build/deploy/:serviceName?projectName=
   */
  getVmServiceDeploy(serviceName: string, projectName: string) {
    return http.get<any>(
      `/api/aslan/build/deploy/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * 主机服务/物理机部署配置保存与更新
   * POST / PUT /api/aslan/build/deploy?projectName=
   */
  saveVmServiceDeploy(projectName: string, payload: any, isUpdate = false) {
    if (isUpdate) {
      return http.put<any>(`/api/aslan/build/deploy?projectName=${encodeURIComponent(projectName)}`, payload);
    }
    return http.post<any>(`/api/aslan/build/deploy?projectName=${encodeURIComponent(projectName)}`, payload);
  },

  /**
   * 主机服务部署组件模块信息查询
   * GET /api/aslan/build/deploy/serviceModule?projectName=&serviceName=
   */
  getServiceModuleDeploy(serviceName: string, projectName: string) {
    return http.get<any>(
      `/api/aslan/build/deploy/serviceModule?projectName=${encodeURIComponent(projectName)}&serviceName=${encodeURIComponent(serviceName)}`
    );
  },
};

export default serviceApi;
