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
};

export default environmentApi;
