import http from './client';

export interface DeliveryVersionImage {
  container_name: string;
  image_name?: string;
  source_image?: string;
  target_image?: string;
  status?: string;
  error?: string;
  push_image?: boolean;
}

export interface DeliveryVersionService {
  service_name: string;
  chart_name: string;
  original_chart_version?: string;
  chart_version: string;
  chart_status?: string;
  yaml_content?: string;
  images?: DeliveryVersionImage[];
  error?: string;
}

export interface DeliveryVersionItem {
  id?: string;
  version: string;
  project_name: string;
  env_name?: string;
  production?: boolean;
  type?: 'k8s' | 'helm' | string;
  source?: string;
  labels?: string[];
  desc?: string;
  image_registry_id?: string;
  original_chart_repo_name?: string;
  chart_repo_name?: string;
  services?: DeliveryVersionService[];
  status?: string;
  workflow_name?: string;
  task_id?: number;
  error?: string;
  created_by?: string;
  created_at?: number;
}

export interface CreateDeliveryVersionRequest {
  version: string;
  project_name: string;
  env_name?: string;
  production?: boolean;
  source?: string;
  labels?: string[];
  desc?: string;
  image_registry_id?: string;
  original_chart_repo_name?: string;
  chart_repo_name?: string;
  services?: DeliveryVersionService[];
  create_by?: string;
}

export interface DeliveryVariablesApplyArgs {
  globalVariables?: string;
  services: DeliveryVersionService[];
}

/** CC-Loop01 P0-2/P0-3: Chart 版本解析契约 */
export interface ChartVersionResp {
  chartName: string;
  chartVersion: string;
  nextChartVersion?: string;
}

export const deliveryApi = {
  // 后端: delivery/handler/router.go:38, version.go:323
  async listDeliveryVersions(projectName?: string): Promise<DeliveryVersionItem[]> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    const res = await http.get<DeliveryVersionItem[]>(`/api/aslan/delivery/releases${query}`);
    return Array.isArray(res) ? res : [];
  },

  // 后端: delivery/handler/router.go:37, version.go:347
  async getDeliveryVersion(id: string, projectName: string): Promise<DeliveryVersionItem> {
    return http.get<DeliveryVersionItem>(
      `/api/aslan/delivery/releases/${encodeURIComponent(id)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  // 后端: delivery/handler/router.go:39, version.go:387
  async deleteDeliveryVersion(id: string, projectName: string): Promise<unknown> {
    return http.delete(
      `/api/aslan/delivery/releases/${encodeURIComponent(id)}?projectName=${encodeURIComponent(projectName)}`
    );
  },

  // 后端: delivery/handler/router.go:40, version.go:460
  async listDeliveryLabels(projectName?: string): Promise<string[]> {
    const query = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
    const res = await http.get<string[]>(`/api/aslan/delivery/releases/labels${query}`);
    return Array.isArray(res) ? res : [];
  },

  // 后端: delivery/handler/router.go:44, version.go:584
  async checkDeliveryVersion(projectName: string, version: string): Promise<{ message?: string }> {
    return http.get<{ message?: string }>(
      `/api/aslan/delivery/releases/check?projectName=${encodeURIComponent(projectName)}&version=${encodeURIComponent(version)}`
    );
  },

  // 后端: delivery/handler/router.go:41, version.go:273
  async createK8sDeliveryVersion(payload: CreateDeliveryVersionRequest): Promise<unknown> {
    return http.post('/api/aslan/delivery/releases/k8s', payload);
  },

  // 后端: delivery/handler/router.go:42, version.go:273 (CreateHelmDeliveryVersionV2)
  async createHelmDeliveryVersion(payload: CreateDeliveryVersionRequest): Promise<unknown> {
    return http.post(
      `/api/aslan/delivery/releases/helm?projectName=${encodeURIComponent(payload.project_name)}`,
      payload
    );
  },

  // 后端: delivery/handler/router.go:45, version.go:548 (ApplyDeliveryGlobalVariables)
  async applyDeliveryGlobalVariables(
    projectName: string,
    payload: DeliveryVariablesApplyArgs
  ): Promise<DeliveryVariablesApplyArgs> {
    return http.post<DeliveryVariablesApplyArgs>(
      `/api/aslan/delivery/releases/helm/global-variables?projectName=${encodeURIComponent(projectName)}`,
      payload
    );
  },

  // 后端: delivery/handler/router.go:47, version.go:439 (GetChartVersionFromRepo)
  async getChartVersionFromRepo(
    chartName: string,
    chartRepoName: string
  ): Promise<Array<{ chartName: string; chartVersion: string; nextChartVersion?: string }>> {
    return http.get(
      `/api/aslan/delivery/releases/helm/charts/version?chartName=${encodeURIComponent(chartName)}&chartRepoName=${encodeURIComponent(chartRepoName)}`
    );
  },

  // 后端: delivery/handler/router.go:46, version.go:406 (DownloadDeliveryChart)
  async downloadDeliveryChart(projectName: string, version: string, chartName: string): Promise<void> {
    try {
      const res = await http.get<Blob>(
        `/api/aslan/delivery/releases/helm/charts?projectName=${encodeURIComponent(projectName)}&version=${encodeURIComponent(version)}&chartName=${encodeURIComponent(chartName)}`,
        { responseType: 'blob' as unknown as undefined }
      );
      const blob = new Blob([res as unknown as BlobPart], { type: 'application/octet-stream' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${chartName}-${version}.tar.gz`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      // 降级使用带 Token 直链下载
      const token = localStorage.getItem('token') || '';
      const url = `/api/aslan/delivery/releases/helm/charts?projectName=${encodeURIComponent(projectName)}&chartName=${encodeURIComponent(chartName)}&version=${encodeURIComponent(version)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
      window.open(url, '_blank');
    }
  },

  /**
   * CC-Loop01 P0-1: 重试发布版本交付 — query 传参
   * POST /api/aslan/delivery/releases/retry?id=&projectName=
   */
  async retryDeliveryVersion(id: string, projectName: string): Promise<unknown> {
    return http.post(
      `/api/aslan/delivery/releases/retry?id=${encodeURIComponent(id)}&projectName=${encodeURIComponent(projectName)}`,
      undefined,
      { skipErrorHandler: true }
    );
  },

  /** 按镜像获取制品信息
   * GET /api/aslan/delivery/artifacts/image?image=
   */
  async getArtifactByImage(image: string): Promise<any> {
    return http.get<any>(`/api/aslan/delivery/artifacts/image?image=${encodeURIComponent(image)}`);
  },

  /**
   * LOOP6-B4: 获取交付物/制品富元数据详情 (镜像 digest/架构/分层等)
   * GET /api/aslan/delivery/artifacts/:id
   */
  async getDeliveryArtifactDetail(id: string): Promise<any> {
    return http.get(`/api/aslan/delivery/artifacts/${encodeURIComponent(id)}`);
  },
};

export default deliveryApi;
