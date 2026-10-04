import http from './client';

export type WorkloadType =
  | 'deployments'
  | 'statefulsets'
  | 'daemonsets'
  | 'jobs'
  | 'cronjobs';

export type ResourceType =
  | 'services'
  | 'ingresses'
  | 'pvcs'
  | 'configmaps'
  | 'secrets';

export interface WorkloadImage {
  name: string;
  image: string;
}

export interface K8sResourceCommon {
  name: string;
  type: string;
  images?: WorkloadImage[];
  creation_time?: string;
  [key: string]: unknown;
}

export interface K8sResourceListResponse {
  count: number;
  workloads?: K8sResourceCommon[];
  resources?: K8sResourceCommon[];
}

export interface K8sNodeItem {
  ip: string;
  ready: boolean;
  labels: string[];
}

export interface K8sNodeListResponse {
  data: K8sNodeItem[];
  labels: string[];
}

export interface K8sEventItem {
  reason: string;
  message: string;
  first_seen: number;
  last_seen: number;
  count: number;
  type: string; // 'Normal' | 'Warning'
}

export const environmentApi = {
  /**
   * List K8s workloads by type (deployments, statefulsets, daemonsets, jobs, cronjobs).
   * GET /api/aslan/environment/kube/workloads/:workloadType?projectName=&envName=&page=&pageSize=&production=
   */
  async getK8sWorkloads(
    projectName: string,
    envName: string,
    workloadType: WorkloadType,
    page = 1,
    pageSize = 50,
    production = false
  ): Promise<K8sResourceListResponse> {
    const prodParam = production ? '&production=true' : '';
    return http.get<K8sResourceListResponse>(
      `/api/aslan/environment/kube/workloads/${workloadType}?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}&page=${page}&pageSize=${pageSize}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * List K8s resources by type (services, ingresses, pvcs, configmaps, secrets).
   * GET /api/aslan/environment/kube/resources/:resourceType?projectName=&envName=&page=&pageSize=&production=
   */
  async getK8sResources(
    projectName: string,
    envName: string,
    resourceType: ResourceType,
    page = 1,
    pageSize = 50,
    production = false
  ): Promise<K8sResourceListResponse> {
    const prodParam = production ? '&production=true' : '';
    return http.get<K8sResourceListResponse>(
      `/api/aslan/environment/kube/resources/${resourceType}?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}&page=${page}&pageSize=${pageSize}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get live K8s resource YAML directly from cluster.
   * GET /api/aslan/environment/kube/yaml?projectName=&envName=&type=&name=&production=
   */
  async getK8sResourceYaml(
    projectName: string,
    envName: string,
    type: string,
    name: string,
    production = false
  ): Promise<string> {
    const prodParam = production ? '&production=true' : '';
    return http.get<string>(
      `/api/aslan/environment/kube/yaml?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}&type=${encodeURIComponent(type.toLowerCase())}&name=${encodeURIComponent(name)}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * List cluster nodes.
   * GET /api/aslan/environment/kube/nodes?clusterId=
   */
  async getK8sNodes(clusterId = ''): Promise<K8sNodeListResponse> {
    const q = clusterId ? `?clusterId=${encodeURIComponent(clusterId)}` : '';
    return http.get<K8sNodeListResponse>(`/api/aslan/environment/kube/nodes${q}`, {
      skipErrorHandler: true,
    });
  },

  /**
   * List K8s events in environment namespace or for a specific resource.
   * GET /api/aslan/environment/kube/events?projectName=&envName=&name=&type=&production=
   */
  async getK8sEvents(
    projectName: string,
    envName: string,
    name = '',
    type = '',
    production = false
  ): Promise<K8sEventItem[]> {
    const prodParam = production ? '&production=true' : '';
    const nameParam = name ? `&name=${encodeURIComponent(name)}` : '';
    const typeParam = type ? `&type=${encodeURIComponent(type)}` : '';
    return http.get<K8sEventItem[]>(
      `/api/aslan/environment/kube/events?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${nameParam}${typeParam}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * List environment service version history.
   * GET /api/aslan/environment/environments/:name/version/:serviceName?projectName=&isHelmChart=&production=
   */
  async listServiceVersions(
    projectName: string,
    envName: string,
    serviceName: string,
    isHelmChart = false,
    production = false
  ): Promise<EnvServiceVersionItem[]> {
    const prodParam = production ? '&production=true' : '';
    return http.get<EnvServiceVersionItem[]>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/version/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}&isHelmChart=${isHelmChart}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get environment service version YAML.
   * GET /api/aslan/environment/environments/:name/version/:serviceName/revision/:revision?projectName=&isHelmChart=&production=
   */
  async getServiceVersionYaml(
    projectName: string,
    envName: string,
    serviceName: string,
    revision: number,
    isHelmChart = false,
    production = false
  ): Promise<EnvServiceVersionYaml> {
    const prodParam = production ? '&production=true' : '';
    return http.get<EnvServiceVersionYaml>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/version/${encodeURIComponent(serviceName)}/revision/${revision}?projectName=${encodeURIComponent(projectName)}&isHelmChart=${isHelmChart}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Diff two service versions.
   * GET /api/aslan/environment/environments/:name/version/:serviceName/diff?projectName=&revisionA=&revisionB=&isHelmChart=&production=
   */
  async diffServiceVersions(
    projectName: string,
    envName: string,
    serviceName: string,
    revisionA: number,
    revisionB: number,
    isHelmChart = false,
    production = false
  ): Promise<EnvServiceVersionDiff> {
    const prodParam = production ? '&production=true' : '';
    return http.get<EnvServiceVersionDiff>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/version/${encodeURIComponent(serviceName)}/diff?projectName=${encodeURIComponent(projectName)}&revisionA=${revisionA}&revisionB=${revisionB}&isHelmChart=${isHelmChart}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Check images availability before rollback.
   * GET /api/aslan/environment/environments/:name/version/:serviceName/rollback/check?projectName=&revision=&isHelmChart=&production=&workflowName=
   */
  async checkServiceVersionRollback(
    projectName: string,
    envName: string,
    serviceName: string,
    revision: number,
    isHelmChart = false,
    production = false,
    workflowName = ''
  ): Promise<CheckRollbackResponse> {
    const prodParam = production ? '&production=true' : '';
    const wfParam = workflowName ? `&workflowName=${encodeURIComponent(workflowName)}` : '';
    return http.get<CheckRollbackResponse>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/version/${encodeURIComponent(serviceName)}/rollback/check?projectName=${encodeURIComponent(projectName)}&revision=${revision}&isHelmChart=${isHelmChart}${prodParam}${wfParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Rollback environment service version.
   * POST /api/aslan/environment/environments/:name/version/:serviceName/rollback?projectName=&revision=&isHelmChart=&production=&overrideResource=
   */
  async rollbackServiceVersion(
    projectName: string,
    envName: string,
    serviceName: string,
    revision: number,
    detail = '',
    isHelmChart = false,
    production = false,
    overrideResource = false
  ): Promise<void> {
    const prodParam = production ? '&production=true' : '';
    const orParam = overrideResource ? '&overrideResource=true' : '';
    return http.post<void>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/version/${encodeURIComponent(serviceName)}/rollback?projectName=${encodeURIComponent(projectName)}&revision=${revision}&isHelmChart=${isHelmChart}${prodParam}${orParam}`,
      { detail },
      { skipErrorHandler: true }
    );
  },

  /**
   * Helm rendersets: Get render charts.
   * POST /api/aslan/environment/rendersets/renderchart?projectName=&envName=&production=
   */
  async getRenderCharts(
    projectName: string,
    envName: string,
    args: unknown[] = [],
    production = false
  ): Promise<HelmRenderChartArg[]> {
    const prodParam = production ? '&production=true' : '';
    return http.post<HelmRenderChartArg[]>(
      `/api/aslan/environment/rendersets/renderchart?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`,
      { get_svc_render_args: args },
      { skipErrorHandler: true }
    );
  },

  /**
   * Helm rendersets: Get environment default values.
   * GET /api/aslan/environment/rendersets/default-values?projectName=&envName=&production=
   */
  async getProductDefaultValues(
    projectName: string,
    envName: string,
    production = false
  ): Promise<{ default_variable: string }> {
    const prodParam = production ? '&production=true' : '';
    return http.get<{ default_variable: string }>(
      `/api/aslan/environment/rendersets/default-values?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Helm/K8s rendersets: Get environment global variables.
   * GET /api/aslan/environment/rendersets/globalVariables?projectName=&envName=&production=
   */
  async getGlobalVariables(
    projectName: string,
    envName: string,
    production = false
  ): Promise<{ global_variables: Array<{ key: string; value: string; type?: string; desc?: string }>; revision: number }> {
    const prodParam = production ? '&production=true' : '';
    return http.get<{ global_variables: Array<{ key: string; value: string; type?: string; desc?: string }>; revision: number }>(
      `/api/aslan/environment/rendersets/globalVariables?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Rendersets: Get service variables (compatible with GET on live server and fallback POST).
   */
  async getServiceVariables(
    projectName: string,
    envName: string,
    serviceName: string,
    production = false
  ): Promise<K8sServiceVariableItem[]> {
    const prodParam = production ? '&production=true' : '';
    try {
      // Live server uses GET
      return await http.get<K8sServiceVariableItem[]>(
        `/api/aslan/environment/rendersets/variables?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}&serviceName=${encodeURIComponent(serviceName)}${prodParam}`,
        { skipErrorHandler: true }
      );
    } catch {
      // Fallback to POST for repo HEAD compatibility
      return await http.post<K8sServiceVariableItem[]>(
        `/api/aslan/environment/rendersets/variables?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`,
        { serviceName },
        { skipErrorHandler: true }
      );
    }
  },

  /**
   * Service Diff: Compare environment rendered YAML vs template latest rendered YAML.
   * GET /api/aslan/environment/diff/products/:productName/service/:serviceName?envName=&production=
   */
  async getServiceDiff(
    projectName: string,
    envName: string,
    serviceName: string,
    production = false
  ): Promise<SvcDiffResult> {
    const prodParam = production ? '&production=true' : '';
    return http.get<SvcDiffResult>(
      `/api/aslan/environment/diff/products/${encodeURIComponent(projectName)}/service/${encodeURIComponent(serviceName)}?envName=${encodeURIComponent(envName)}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Update container image for workload (Deployment, DaemonSet, StatefulSet, Job, CronJob).
   * POST /api/aslan/environment/image/{deployment,daemonset,statefulset,job,cronjob}/:envName?production=
   */
  async updateContainerImage(
    workloadType: string,
    envName: string,
    payload: UpdateContainerImagePayload,
    production = false
  ): Promise<void> {
    const prodParam = production ? '?production=true' : '';
    const cleanType = workloadType.toLowerCase();
    return http.post<void>(
      `/api/aslan/environment/image/${cleanType}/${encodeURIComponent(envName)}${prodParam}`,
      payload,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get common env config (ConfigMap/Secret/Ingress/PVC) history revisions.
   * GET /api/aslan/environment/envcfgs/:name/cfg/:objectName?projectName=&commonEnvCfgType=&production=
   */
  async getCommonEnvCfgHistory(
    projectName: string,
    envName: string,
    objectName: string,
    commonEnvCfgType: string,
    production = false
  ): Promise<CommonEnvCfgHistoryItem[]> {
    const prodParam = production ? '&production=true' : '';
    return http.get<CommonEnvCfgHistoryItem[]>(
      `/api/aslan/environment/envcfgs/${encodeURIComponent(envName)}/cfg/${encodeURIComponent(objectName)}?projectName=${encodeURIComponent(projectName)}&commonEnvCfgType=${encodeURIComponent(commonEnvCfgType)}${prodParam}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Rollback common env config (ConfigMap/Secret/Ingress/PVC) to historical revision.
   * PUT /api/aslan/environment/envcfgs/:name?projectName=&production=&rollback=true
   */
  async rollbackCommonEnvCfg(
    projectName: string,
    envName: string,
    payload: RollbackCommonEnvCfgArgs,
    production = false
  ): Promise<void> {
    const prodParam = production ? '&production=true' : '';
    return http.put<void>(
      `/api/aslan/environment/envcfgs/${encodeURIComponent(envName)}?projectName=${encodeURIComponent(projectName)}&rollback=true${prodParam}`,
      payload,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get available cluster namespaces (for hosting / binding existing namespaces).
   * GET /api/aslan/environment/kube/available_namespaces?clusterId=&type=
   */
  async getAvailableNamespaces(
    clusterId: string,
    type = 'create'
  ): Promise<AvailableNamespace[]> {
    return http.get<AvailableNamespace[]>(
      `/api/aslan/environment/kube/available_namespaces?clusterId=${encodeURIComponent(clusterId)}&type=${encodeURIComponent(type)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Check if target cluster supports ephemeral debug containers (pods/ephemeralcontainers).
   * GET /api/aslan/cluster/check/ephemeralcontainers?projectName=&envName=
   * 后端: pkg/microservice/aslan/core/multicluster/handler/router.go:67
   */
  async checkEphemeralContainers(projectName: string, envName: string): Promise<boolean> {
    try {
      const res = await http.get<boolean>(
        `/api/aslan/cluster/check/ephemeralcontainers?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}`,
        { skipErrorHandler: true }
      );
      return Boolean(res);
    } catch {
      return false;
    }
  },
};

export interface AvailableNamespace {
  name: string;
  status?: string;
  age?: string;
  labels?: Record<string, string>;
  current?: boolean;
  used_by_other_env?: boolean;
}

export interface CommonEnvCfgHistoryItem {
  id?: string;
  product_name: string;
  create_time: number;
  update_user_name: string;
  env_name: string;
  name: string;
  yaml_data: string;
  source_detail?: Record<string, unknown>;
}

export interface RollbackCommonEnvCfgArgs {
  env_name: string;
  product_name: string;
  name: string;
  common_env_cfg_type: string; // 'ConfigMap' | 'Secret' | 'Ingress' | 'PVC'
  yaml_data: string;
  auto_sync?: boolean;
  restart_associated_svc?: boolean;
  production?: boolean;
}

export interface UpdateContainerImagePayload {
  type: string; // e.g. 'Deployment', 'DaemonSet', 'StatefulSet', 'Job', 'CronJob'
  product_name: string;
  env_name: string;
  service_name: string;
  name: string; // workload name
  container_name: string;
  image: string;
  production?: boolean;
}

export interface EnvServiceVersionItem {
  service_name: string;
  revision: number;
  containers: Array<{ name: string; type?: string; image: string; image_name?: string }>;
  operation: string;
  deploy_type: string;
  deploy_strategy: string;
  detail: string;
  create_time: number;
  create_by: string;
}

export interface EnvServiceVersionYaml {
  type: string;
  yaml: string;
  variable_yaml: string;
  override_kvs?: string;
  containers?: Array<{ name: string; type?: string; image: string }>;
  detail?: string;
  create_time?: number;
  create_by?: string;
  chart_repo?: string;
  chart_name?: string;
  chart_version?: string;
}

export interface EnvServiceVersionDiff {
  type: string;
  create_time_a: number;
  create_time_b: number;
  create_by_a: string;
  create_by_b: string;
  yaml_a: string;
  yaml_b: string;
  variable_yaml_a: string;
  variable_yaml_b: string;
  containers_a?: Array<{ name: string; image: string }>;
  containers_b?: Array<{ name: string; image: string }>;
}

export interface CheckRollbackResponse {
  available: boolean;
  unavailable_images: string[];
}

export interface HelmRenderChartArg {
  envName: string;
  serviceName: string;
  is_chart_deploy?: boolean;
  release_name?: string;
  chart_repo?: string;
  chart_name?: string;
  chartVersion?: string;
  overrideValues?: Array<{ key: string; value: string }>;
  overrideYaml?: string;
  variable_yaml?: string;
  deploy_strategy?: string;
  yaml_data?: {
    yaml_content?: string;
    source?: string;
  };
}

export interface K8sServiceVariableItem {
  service_name: string;
  variable_yaml: string;
  variable_kvs: Array<{ key: string; value: string }>;
  latest_variable_yaml: string;
  latest_variable_kvs: Array<{ key: string; value: string }>;
}

export interface SvcDiffResult {
  release_name?: string;
  service_name: string;
  chart_name?: string;
  deployed_from_chart?: boolean;
  current: {
    yaml: string;
    update_by: string;
    revision: number;
  };
  latest: {
    yaml: string;
    update_by: string;
    revision: number;
  };
  error?: string;
}

export default environmentApi;
