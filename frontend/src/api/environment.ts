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
   * Check whether workloads have K8s Services.
   * GET /api/aslan/environment/environments/:name/check/workloads/k8services?projectName=&production=
   * pkg/microservice/aslan/core/environment/handler/router.go:190
   */
  async checkWorkloadsK8sServices(
    projectName: string,
    envName: string,
    production = false
  ): Promise<string[]> {
    const prodParam = production ? '&production=true' : '';
    const res = await http.get<string[]>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/check/workloads/k8services?projectName=${encodeURIComponent(projectName)}${prodParam}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * Enable share env (self-test mode).
   * POST /api/aslan/environment/environments/:name/share/enable?projectName=
   * pkg/microservice/aslan/core/environment/handler/router.go:191
   */
  async enableShareEnv(projectName: string, envName: string): Promise<void> {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/share/enable?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * Disable share env (self-test mode).
   * DELETE /api/aslan/environment/environments/:name/share/enable?projectName=
   * pkg/microservice/aslan/core/environment/handler/router.go:192
   */
  async disableShareEnv(projectName: string, envName: string): Promise<void> {
    return http.delete(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/share/enable?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * Check share env ready status (op: 'enable' | 'disable').
   * GET /api/aslan/environment/environments/:name/check/sharenv/:op/ready?projectName=
   * pkg/microservice/aslan/core/environment/handler/router.go:193
   */
  async checkShareEnvReady(
    projectName: string,
    envName: string,
    op: 'enable' | 'disable'
  ): Promise<ShareEnvReadyResponse> {
    return http.get<ShareEnvReadyResponse>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/check/sharenv/${op}/ready?projectName=${encodeURIComponent(projectName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get portal service configuration for share env.
   * GET /api/aslan/environment/environments/:name/share/portal/:serviceName?projectName=
   * pkg/microservice/aslan/core/environment/handler/router.go:194
   */
  async getPortalService(
    projectName: string,
    envName: string,
    serviceName: string
  ): Promise<PortalServiceResponse> {
    return http.get<PortalServiceResponse>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/share/portal/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  /**
   * Setup portal service configuration for share env.
   * POST /api/aslan/environment/environments/:name/share/portal/:serviceName?projectName=
   * pkg/microservice/aslan/core/environment/handler/router.go:195
   */
  async setupPortalService(
    projectName: string,
    envName: string,
    serviceName: string,
    servers: PortalServerConfig[]
  ): Promise<void> {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/share/portal/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}`,
      servers
    );
  },

  /**
   * Enable Istio grayscale release for production environment.
   * POST /api/aslan/environment/environments/:name/istioGrayscale/enable?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:197
   */
  async enableIstioGrayscale(projectName: string, envName: string): Promise<void> {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/enable?projectName=${encodeURIComponent(projectName)}&production=true`
    );
  },

  /**
   * Disable Istio grayscale release for production environment.
   * DELETE /api/aslan/environment/environments/:name/istioGrayscale/enable?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:198
   */
  async disableIstioGrayscale(projectName: string, envName: string): Promise<void> {
    return http.delete(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/enable?projectName=${encodeURIComponent(projectName)}&production=true`
    );
  },

  /**
   * Check Istio grayscale ready status (op: 'enable' | 'disable').
   * GET /api/aslan/environment/environments/:name/check/istioGrayscale/:op/ready?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:199
   */
  async checkIstioGrayscaleReady(
    projectName: string,
    envName: string,
    op: 'enable' | 'disable'
  ): Promise<IstioGrayscaleReadyResponse> {
    return http.get<IstioGrayscaleReadyResponse>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/check/istioGrayscale/${op}/ready?projectName=${encodeURIComponent(projectName)}&production=true`,
      { skipErrorHandler: true }
    );
  },

  /**
   * Get Istio grayscale configuration.
   * GET /api/aslan/environment/environments/:name/istioGrayscale/config?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:200
   */
  async getIstioGrayscaleConfig(
    projectName: string,
    envName: string
  ): Promise<IstioGrayscaleConfig> {
    return http.get<IstioGrayscaleConfig>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/config?projectName=${encodeURIComponent(projectName)}&production=true`
    );
  },

  /**
   * Set Istio grayscale configuration.
   * POST /api/aslan/environment/environments/:name/istioGrayscale/config?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:201
   */
  async setIstioGrayscaleConfig(
    projectName: string,
    envName: string,
    data: SetIstioGrayscaleConfigPayload
  ): Promise<void> {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/config?projectName=${encodeURIComponent(projectName)}&production=true`,
      data
    );
  },

  /**
   * Get portal service for Istio grayscale.
   * GET /api/aslan/environment/environments/:name/istioGrayscale/portal/:serviceName?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:202
   */
  async getIstioGrayscalePortalService(
    projectName: string,
    envName: string,
    serviceName: string
  ): Promise<PortalServiceResponse> {
    return http.get<PortalServiceResponse>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/portal/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}&production=true`
    );
  },

  /**
   * Setup portal service for Istio grayscale.
   * POST /api/aslan/environment/environments/:name/istioGrayscale/portal/:serviceName?projectName=&production=true
   * pkg/microservice/aslan/core/environment/handler/router.go:203
   */
  async setupIstioGrayscalePortalService(
    projectName: string,
    envName: string,
    serviceName: string,
    servers: PortalServerConfig[]
  ): Promise<void> {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/istioGrayscale/portal/${encodeURIComponent(serviceName)}?projectName=${encodeURIComponent(projectName)}&production=true`,
      servers
    );
  },

  /**
   * Check if Istio is installed on the cluster.
   * GET /api/aslan/cluster/istio/check/:id
   * pkg/microservice/aslan/core/multicluster/handler/router.go:59
   */
  async checkClusterIstio(clusterId?: string): Promise<boolean> {
    try {
      let targetClusterId = clusterId;
      if (!targetClusterId) {
        const clusters = await http.get<Array<{ id?: string; _id?: string; local?: boolean }>>(
          '/api/aslan/cluster/clusters',
          { skipErrorHandler: true }
        );
        const localCluster = (Array.isArray(clusters) ? clusters : []).find((c) => c.local) || clusters?.[0];
        targetClusterId = localCluster?.id || localCluster?._id;
      }
      if (!targetClusterId) return false;
      const res = await http.get<boolean>(
        `/api/aslan/cluster/istio/check/${encodeURIComponent(targetClusterId)}`,
        { skipErrorHandler: true }
      );
      return Boolean(res);
    } catch {
      return false;
    }
  },

  /**
   * List canary deployment service info in cluster/namespace.
   * GET /api/aslan/environment/kube/canary_service/cluster/:clusterID/namespace/:namespace
   * pkg/microservice/aslan/core/environment/handler/router.go:123
   */
  async getCanaryServices(
    clusterId: string,
    namespace: string
  ): Promise<CanaryDeploymentServiceInfo[]> {
    let targetClusterId = clusterId;
    if (!targetClusterId) {
      try {
        const clusters = await http.get<Array<{ id?: string; _id?: string; local?: boolean }>>(
          '/api/aslan/cluster/clusters',
          { skipErrorHandler: true }
        );
        const localCluster = (Array.isArray(clusters) ? clusters : []).find((c) => c.local) || clusters?.[0];
        targetClusterId = localCluster?.id || localCluster?._id || '';
      } catch {
        // ignore
      }
    }
    const res = await http.get<CanaryDeploymentServiceInfo[]>(
      `/api/aslan/environment/kube/canary_service/cluster/${encodeURIComponent(targetClusterId)}/namespace/${encodeURIComponent(namespace)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * Get environment sleep and wake cron settings.
   * GET /api/aslan/environment/environments/:name/sleep/cron?projectName=&production=
   */
  async getEnvSleepCron(
    projectName: string,
    envName: string,
    production = false
  ): Promise<EnvSleepCronArg> {
    const prodParam = production ? '&production=true' : '';
    return http.get<EnvSleepCronArg>(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/sleep/cron?projectName=${encodeURIComponent(projectName)}${prodParam}`
    );
  },

  /**
   * Update or insert environment sleep and wake cron settings.
   * PUT /api/aslan/environment/environments/:name/sleep/cron?projectName=&production=
   */
  async upsertEnvSleepCron(
    projectName: string,
    envName: string,
    payload: EnvSleepCronArg,
    production = false
  ): Promise<unknown> {
    const prodParam = production ? '&production=true' : '';
    return http.put(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/sleep/cron?projectName=${encodeURIComponent(projectName)}${prodParam}`,
      payload
    );
  },

  /**
   * List environment product revisions.
   * GET /api/aslan/environment/revision/products?projectName=&envName=&production=
   */
  async getProductsRevision(
    projectName: string,
    envName: string,
    production = false
  ): Promise<EnvProductRevision[]> {
    const prodParam = production ? '&production=true' : '';
    const res = await http.get<EnvProductRevision[]>(
      `/api/aslan/environment/revision/products?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * List environment product revision snapshots.
   * GET /api/aslan/environment/revision/productsnaps?projectName=&envName=&production=
   */
  async getProductsRevisionSnaps(
    projectName: string,
    envName: string,
    production = false
  ): Promise<EnvProductRevision[]> {
    const prodParam = production ? '&production=true' : '';
    const res = await http.get<EnvProductRevision[]>(
      `/api/aslan/environment/revision/productsnaps?projectName=${encodeURIComponent(projectName)}&envName=${encodeURIComponent(envName)}${prodParam}`
    );
    return Array.isArray(res) ? res : [];
  },
  /**
   * 启动临时调试容器 (Ephemeral Debug Container)
   * POST /api/aslan/environment/kube/:env/pods/:podName/debugcontainer
   * (pkg/microservice/aslan/core/environment/handler/debug.go:31)
   */
  async patchDebugContainer(args: {
    envName: string;
    podName: string;
    projectName: string;
    production?: boolean;
    debugImage?: string;
    targetContainer?: string;
  }): Promise<void> {
    const { envName, podName, projectName, production, debugImage, targetContainer } = args;
    const params = new URLSearchParams({
      projectName,
      production: String(!!production),
    });
    if (debugImage) params.append('debugImage', debugImage);
    if (targetContainer) params.append('targetContainer', targetContainer);

    return http.post<void>(
      `/api/aslan/environment/kube/${encodeURIComponent(envName)}/pods/${encodeURIComponent(podName)}/debugcontainer?${params.toString()}`,
      {}
    );
  },
  /**
   * 重启/删除指定 Pod 实例（Kubernetes 将销毁该 Pod 并拉起新实例）
   * DELETE /api/aslan/environment/kube/:env/pods/:podName
   * (pkg/microservice/aslan/core/environment/handler/kube.go:97)
   */
  async restartPod(args: {
    envName: string;
    podName: string;
    projectName: string;
    production?: boolean;
  }): Promise<void> {
    const { envName, podName, projectName, production } = args;
    const params = new URLSearchParams({
      envName,
      projectName,
      production: String(!!production),
    });
    return http.delete<void>(
      `/api/aslan/environment/kube/${encodeURIComponent(envName)}/pods/${encodeURIComponent(podName)}?${params.toString()}`
    );
  },

  // ---------- 环境运维闭环（R3 第 03 轮） ----------

  /**
   * 更新环境自动回收天数
   * PUT /api/aslan/environment/environments/:name/envRecycle?projectName=&recycleDay=
   * (pkg/microservice/aslan/core/environment/handler/router.go:149)
   */
  async updateProductRecycleDay(projectName: string, envName: string, recycleDay: number) {
    return http.put(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/envRecycle?projectName=${encodeURIComponent(projectName)}&recycleDay=${recycleDay}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * 同步环境资源配置到集群
   * PUT /api/aslan/environment/envcfgs/:name/:type/:objectName/sync?projectName=&production=
   * (pkg/microservice/aslan/core/environment/handler/router.go:51)
   */
  async syncEnvResource(projectName: string, envName: string, type: string, objectName: string, production?: boolean) {
    const prodParam = production ? '&production=true' : '';
    return http.put(
      `/api/aslan/environment/envcfgs/${encodeURIComponent(envName)}/${encodeURIComponent(type)}/${encodeURIComponent(objectName)}/sync?projectName=${encodeURIComponent(projectName)}${prodParam}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * 更新 Helm 环境基准默认配置 (Default Values)
   * PUT /api/aslan/environment/environments/:name/helm/default-values?projectName=&production=
   * (pkg/microservice/aslan/core/environment/handler/router.go:154)
   */
  async updateHelmProductDefaultValues(projectName: string, envName: string, defaultValues: string, production?: boolean) {
    const prodParam = production ? '&production=true' : '';
    return http.put(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/helm/default-values?projectName=${encodeURIComponent(projectName)}${prodParam}`,
      { defaultValues },
      { skipErrorHandler: true }
    );
  },

  /**
   * 调整服务工作负载副本数
   * POST /api/aslan/environment/environments/:name/services/:serviceName/scaleNew?projectName=&type=&name=&number=
   * (pkg/microservice/aslan/core/environment/handler/router.go:186)
   */
  async scaleNewService(projectName: string, envName: string, serviceName: string, workloadType: string, workloadName: string, replicas: number) {
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/services/${encodeURIComponent(serviceName)}/scaleNew?projectName=${encodeURIComponent(projectName)}&type=${encodeURIComponent(workloadType)}&name=${encodeURIComponent(workloadName)}&number=${replicas}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * 重启指定工作负载
   * POST /api/aslan/environment/environments/:name/services/:serviceName/restartNew?projectName=&type=&name=&production=
   * (pkg/microservice/aslan/core/environment/handler/router.go:185)
   */
  async restartWorkload(projectName: string, envName: string, serviceName: string, workloadType?: string, workloadName?: string, production?: boolean) {
    const wType = workloadType || 'Deployment';
    const wName = workloadName || serviceName;
    const prodParam = production ? '&production=true' : '';
    return http.post(
      `/api/aslan/environment/environments/${encodeURIComponent(envName)}/services/${encodeURIComponent(serviceName)}/restartNew?projectName=${encodeURIComponent(projectName)}&type=${encodeURIComponent(wType)}&name=${encodeURIComponent(wName)}${prodParam}`,
      {},
      { skipErrorHandler: true }
    );
  },

  // ---------- SAE 变更单（P0-02 专属交互；后端 handler/environment.go:3585-3830，需 SAE License 特性） ----------

  /**
   * SAE 环境列表（变更单抽屉选择环境）
   * GET /api/aslan/environment/environments/sae?projectName=
   */
  async listSAEEnvs(projectName: string): Promise<EnvironmentItem[]> {
    const res = await http.get<EnvironmentItem[]>(
      `/api/aslan/environment/environments/sae?projectName=${encodeURIComponent(projectName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * SAE 环境下的应用列表（用于变更单抽屉选择 appID）
   * GET /api/aslan/environment/environments/sae/app
   */
  async listSAEApps(opts: { projectName: string; envName?: string; production?: boolean; appName?: string; currentPage?: number; pageSize?: number }): Promise<SAEAppItem[]> {
    const q = new URLSearchParams();
    q.set('projectName', opts.projectName);
    if (opts.envName) q.set('envName', opts.envName);
    if (opts.production !== undefined) q.set('production', String(opts.production));
    if (opts.appName) q.set('appName', opts.appName);
    q.set('currentPage', String(opts.currentPage ?? 1));
    q.set('pageSize', String(opts.pageSize ?? 50));
    const res = await http.get<SAEAppItem[] | { apps?: SAEAppItem[] } | { change_order_list?: SAEAppItem[] } | { applications?: SAEAppItem[] }>(
      `/api/aslan/environment/environments/sae/app?${q.toString()}`,
      { skipErrorHandler: true }
    );
    // 阿里云透传结构防御性归一
    if (Array.isArray(res)) return res;
    const rec = (res || {}) as Record<string, unknown>;
    for (const key of ['apps', 'application_list', 'applications', 'data']) {
      const val = rec[key];
      if (Array.isArray(val)) return val as SAEAppItem[];
    }
    return [];
  },

  /**
   * SAE 变更单列表
   * GET /api/aslan/environment/environments/sae/:envName/app/:appID/changeOrder
   */
  async listSAEChangeOrders(envName: string, appID: string, opts: SAEChangeOrderOptions = {}): Promise<SAEChangeOrderListResponse> {
    const q = new URLSearchParams();
    if (opts.projectName) q.set('projectName', opts.projectName);
    if (opts.production !== undefined) q.set('production', String(opts.production));
    q.set('page', String(opts.page ?? 1));
    q.set('per_page', String(opts.per_page ?? 20));
    const res = await http.get<SAEChangeOrderListResponse>(
      `/api/aslan/environment/environments/sae/${encodeURIComponent(envName)}/app/${encodeURIComponent(appID)}/changeOrder?${q.toString()}`,
      { skipErrorHandler: true }
    );
    return res || {};
  },

  /**
   * SAE 变更单详情
   * GET /api/aslan/environment/environments/sae/:envName/app/:appID/changeOrder/:orderID
   */
  async getSAEChangeOrderDetail(envName: string, appID: string, orderID: string, opts: SAEChangeOrderOptions = {}): Promise<SAEChangeOrderItem> {
    const q = new URLSearchParams();
    if (opts.projectName) q.set('projectName', opts.projectName);
    if (opts.production !== undefined) q.set('production', String(opts.production));
    const res = await http.get<SAEChangeOrderItem>(
      `/api/aslan/environment/environments/sae/${encodeURIComponent(envName)}/app/${encodeURIComponent(appID)}/changeOrder/${encodeURIComponent(orderID)}?${q.toString()}`,
      { skipErrorHandler: true }
    );
    return res || {};
  },

  /**
   * 中止 SAE 变更单
   * POST /api/aslan/environment/environments/sae/:envName/app/:appID/changeOrder/:orderID/abort
   */
  async abortSAEChangeOrder(envName: string, appID: string, orderID: string, opts: SAEChangeOrderOptions = {}): Promise<unknown> {
    const q = new URLSearchParams();
    if (opts.projectName) q.set('projectName', opts.projectName);
    if (opts.production !== undefined) q.set('production', String(opts.production));
    return http.post(
      `/api/aslan/environment/environments/sae/${encodeURIComponent(envName)}/app/${encodeURIComponent(appID)}/changeOrder/${encodeURIComponent(orderID)}/abort?${q.toString()}`,
      {},
      { skipErrorHandler: true }
    );
  },

  /**
   * 回滚 SAE 变更单
   * POST /api/aslan/environment/environments/sae/:envName/app/:appID/changeOrder/:orderID/rollback
   */
  async rollbackSAEChangeOrder(envName: string, appID: string, orderID: string, opts: SAEChangeOrderOptions = {}): Promise<unknown> {
    const q = new URLSearchParams();
    if (opts.projectName) q.set('projectName', opts.projectName);
    if (opts.production !== undefined) q.set('production', String(opts.production));
    return http.post(
      `/api/aslan/environment/environments/sae/${encodeURIComponent(envName)}/app/${encodeURIComponent(appID)}/changeOrder/${encodeURIComponent(orderID)}/rollback?${q.toString()}`,
      {},
      { skipErrorHandler: true }
    );
  },
};

export interface EnvSvcRevision {
  service_name: string;
  type: string;
  current_revision: number;
  next_revision: number;
  updatable: boolean;
  deploy_strategy?: string;
  error?: string;
  deleted?: boolean;
  new?: boolean;
  containers?: Array<{ name: string; image: string }>;
  update_service_tmpl?: boolean;
  variable_yaml?: string;
  variable_kvs?: Array<{ key: string; value: string }>;
}

export interface EnvProductRevision {
  id?: string;
  env_name: string;
  product_name: string;
  current_revision: number;
  next_revision: number;
  updatable: boolean;
  services: EnvSvcRevision[];
  isPublic?: boolean;
}

export interface EnvSleepCronArg {
  sleep_cron_enable: boolean;
  sleep_cron: string;
  awake_cron_enable: boolean;
  awake_cron: string;
}

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

export interface ShareEnvReadyChecks {
  namespace_has_istio_label: boolean;
  virtualservice_deployed: boolean;
  pods_have_istio_proxy: boolean;
  workloads_ready: boolean;
  workloads_have_k8s_service: boolean;
}

export interface ShareEnvReadyResponse {
  is_ready: boolean;
  checks?: ShareEnvReadyChecks;
}

export interface IstioGrayscaleChecks {
  namespace_has_istio_label: boolean;
  pods_have_istio_proxy: boolean;
  workloads_ready: boolean;
  workloads_have_k8s_service: boolean;
}

export interface IstioGrayscaleReadyResponse {
  is_ready: boolean;
  checks?: IstioGrayscaleChecks;
}

export interface PortalServerConfig {
  host: string;
  port_number: number;
  port_protocol: string; // 'HTTP' | 'HTTPS' | 'GRPC'
}

export interface PortalServiceResponse {
  default_gateway_address: string;
  servers: PortalServerConfig[];
}

export interface IstioWeightConfig {
  env: string;
  weight: number;
}

export interface IstioHeaderMatch {
  key: string;
  match: 'exact' | 'prefix' | 'regex';
  value: string;
}

export interface IstioHeaderMatchConfig {
  env: string;
  header_match: IstioHeaderMatch[];
}

export interface IstioGrayscaleConfig {
  enable: boolean;
  is_base: boolean;
  base_env: string;
  grayscale_strategy: 'weight' | 'header_match';
  weight_configs: IstioWeightConfig[];
  header_match_configs: IstioHeaderMatchConfig[];
}

export interface SetIstioGrayscaleConfigPayload {
  grayscale_strategy: 'weight' | 'header_match';
  weight_configs?: IstioWeightConfig[];
  header_match_configs?: IstioHeaderMatchConfig[];
}

export interface CanaryDeploymentServiceInfo {
  service_name: string;
  deployment?: {
    deployment_name: string;
    container_names: string[];
  };
}

// ---------- SAE（阿里云 Serverless AppEngine）变更单契约 ----------
// 后端路由：pkg/microservice/aslan/core/environment/handler/router.go:232,237-245
//   GET  /environments/sae/app?projectName=&envName=&production=          → ListSAEApps
//   GET  /environments/sae/:name/app/:appID/changeOrder?projectName=&production=&page=&per_page=  → ListSAEChangeOrder
//   GET  /environments/sae/:name/app/:appID/changeOrder/:orderID?projectName=                     → GetSAEChangeOrder
//   POST /environments/sae/:name/app/:appID/changeOrder/:orderID/abort?projectName=&production=  → AbortSAEChangeOrder
//   POST /environments/sae/:name/app/:appID/changeOrder/:orderID/rollback?projectName=&production= → RollbackSAEChangeOrder
// 响应为阿里云 SAE OpenAPI 原样透传（converter.ConvertToSnakeCase），字段做防御性消费

export interface SAEChangeOrderItem {
  change_order_id?: string;
  change_order_name?: string;
  co_type?: string;
  // 阿里云状态: 0 准备 / 1 执行中 / 2 成功 / 3 失败（其余按原值展示）
  status?: number | string;
  create_user_id?: string;
  create_time?: number | string;
  desc?: string;
  [key: string]: unknown;
}

export interface SAEChangeOrderListResponse {
  change_order_list?: SAEChangeOrderItem[];
  total_count?: number;
  [key: string]: unknown;
}

export interface SAEAppItem {
  app_id?: string;
  app_name?: string;
  [key: string]: unknown;
}

export interface SAEChangeOrderOptions {
  projectName?: string;
  production?: boolean;
  page?: number;
  per_page?: number;
}

export interface EnvironmentItem {
  name: string;
  alias?: string;
  cluster_id?: string;
  cluster_name?: string;
  namespace?: string;
  status?: string;
  production?: boolean;
  update_time?: number;
  source?: string;
  // 自动回收天数（models.Product.RecycleDay，0 = 永不回收）
  recycle_day?: number;
  // ShareEnv (自测模式 / 基准环境)
  share_env_enable?: boolean;
  share_env_is_base?: boolean;
  share_env_base_env?: string;
  // IstioGrayscale (灰度发布)
  istio_grayscale_enable?: boolean;
  istio_grayscale_is_base?: boolean;
  istio_grayscale_base_env?: string;
}

export default environmentApi;


