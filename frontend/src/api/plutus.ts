import { http } from './client';

export interface PlutusProduct {
  id?: string;
  product_name: string;
  create_time?: number;
  update_time?: number;
}

export interface PlutusCustomerGroup {
  id?: string;
  group_id?: string;
  group_name: string;
  product_name: string;
  customer_count?: number;
  description?: string;
  customers?: string[];
  create_time?: number;
}

export interface PlutusCustomer {
  id?: string;
  customer_name: string;
  alias?: string;
  product_name: string;
  group_name?: string;
  cluster_id?: string;
  namespace?: string;
  current_version?: string;
  status?: string;
  description?: string;
  create_time?: number;
  update_time?: number;
}

export interface PlutusVersion {
  id?: string;
  version_id?: string;
  version_name: string;
  product_name: string;
  desc?: string;
  creator?: string;
  create_time?: number;
  labels?: string[];
  services?: Array<{
    service_name: string;
    type: string;
  }>;
}

export interface PlutusOperationLog {
  id?: string;
  username: string;
  product_name: string;
  customer_name?: string;
  action: string;
  target?: string;
  time?: number;
  status?: string;
}

export const plutusApi = {
  // ---------- 产品管理 ----------
  async listProducts(): Promise<PlutusProduct[]> {
    const res = await http.get<PlutusProduct[] | { data: PlutusProduct[] }>('/api/plutus/products', {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },

  async createProduct(data: { product_name: string }): Promise<unknown> {
    return http.post('/api/plutus/products', data, { skipErrorHandler: true });
  },

  async deleteProduct(productName: string): Promise<unknown> {
    return http.delete(`/api/plutus/products?productName=${encodeURIComponent(productName)}`, {
      skipErrorHandler: true,
    });
  },

  async getProductResources(productName: string): Promise<unknown> {
    return http.get(`/api/plutus/products/resources?productName=${encodeURIComponent(productName)}`, {
      skipErrorHandler: true,
    });
  },

  // ---------- 客户分组 ----------
  async listCustomerGroups(productName: string): Promise<PlutusCustomerGroup[]> {
    const res = await http.get<PlutusCustomerGroup[]>(
      `/api/plutus/customerGroup?productName=${encodeURIComponent(productName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async createCustomerGroup(data: Partial<PlutusCustomerGroup>): Promise<unknown> {
    return http.post('/api/plutus/customerGroup', data, { skipErrorHandler: true });
  },

  async updateCustomerGroup(data: Partial<PlutusCustomerGroup>): Promise<unknown> {
    return http.put('/api/plutus/customerGroup', data, { skipErrorHandler: true });
  },

  async deleteCustomerGroup(groupId: string): Promise<unknown> {
    return http.delete(`/api/plutus/customerGroup/${encodeURIComponent(groupId)}`, {
      skipErrorHandler: true,
    });
  },

  async getCustomerGroupNames(productName: string): Promise<string[]> {
    const res = await http.get<string[]>(
      `/api/plutus/customerGroup/names?productName=${encodeURIComponent(productName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async getPushList(productName: string, versionId: string, versionName: string): Promise<unknown> {
    return http.get(
      `/api/plutus/customerGroup/pushList?productName=${encodeURIComponent(productName)}&versionID=${encodeURIComponent(versionId)}&versionName=${encodeURIComponent(versionName)}`,
      { skipErrorHandler: true }
    );
  },

  async previewGroupVersions(groupId: string): Promise<unknown> {
    return http.get(`/api/plutus/customerGroup/versions/preview?groupID=${encodeURIComponent(groupId)}`, {
      skipErrorHandler: true,
    });
  },

  // ---------- 客户管理 ----------
  async listCustomers(productName: string): Promise<PlutusCustomer[]> {
    const res = await http.get<PlutusCustomer[]>(
      `/api/plutus/customer?productName=${encodeURIComponent(productName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async getCustomerDetail(productName: string, customerName: string): Promise<PlutusCustomer> {
    return http.get<PlutusCustomer>(
      `/api/plutus/customer/${encodeURIComponent(productName)}/${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  async createCustomer(data: Partial<PlutusCustomer>): Promise<unknown> {
    return http.post('/api/plutus/customer', data, { skipErrorHandler: true });
  },

  async updateCustomer(data: Partial<PlutusCustomer>): Promise<unknown> {
    return http.put('/api/plutus/customer', data, { skipErrorHandler: true });
  },

  async deleteCustomer(productName: string, customerName: string): Promise<unknown> {
    return http.delete(
      `/api/plutus/customer?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  async getCustomerConfig(productName: string, customerName: string): Promise<unknown> {
    return http.get(
      `/api/plutus/customer/config/${encodeURIComponent(productName)}/${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  // ---------- 版本发布与部署 ----------
  async listVersions(productName: string): Promise<PlutusVersion[]> {
    const res = await http.get<PlutusVersion[]>(
      `/api/plutus/version?productName=${encodeURIComponent(productName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async createVersion(data: Partial<PlutusVersion>): Promise<unknown> {
    return http.post('/api/plutus/version', data, { skipErrorHandler: true });
  },

  async deleteVersion(data: { productName: string; versionName: string; versionID: string }): Promise<unknown> {
    return http.delete('/api/plutus/version', { data, skipErrorHandler: true });
  },

  async getSingleVersion(productName: string, versionName: string, versionId: string): Promise<PlutusVersion> {
    return http.get<PlutusVersion>(
      `/api/plutus/version/single?productName=${encodeURIComponent(productName)}&versionName=${encodeURIComponent(versionName)}&versionID=${encodeURIComponent(versionId)}`,
      { skipErrorHandler: true }
    );
  },

  async pushVersion(data: unknown): Promise<unknown> {
    return http.post('/api/plutus/version/push', data, { skipErrorHandler: true });
  },

  async getCurrentCustomerVersion(productName: string, customerName: string): Promise<unknown> {
    return http.get(
      `/api/plutus/version/current?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  async getDeployHistory(productName: string, customerName: string): Promise<unknown[]> {
    const res = await http.get<unknown[]>(
      `/api/plutus/version/deployHistory?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async deployByHistory(params: {
    productName: string;
    customerName: string;
    versionName: string;
    versionID: string;
    payload?: unknown;
  }): Promise<unknown> {
    const q = new URLSearchParams({
      productName: params.productName,
      customerName: params.customerName,
      versionName: params.versionName,
      versionID: params.versionID,
    });
    return http.post(`/api/plutus/version/deploy/byHistory?${q.toString()}`, params.payload || {}, {
      skipErrorHandler: true,
    });
  },

  async deployByRenderSet(productName: string, customerName: string, payload: unknown): Promise<unknown> {
    return http.post(
      `/api/plutus/version/deploy/byRenderSet?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      payload,
      { skipErrorHandler: true }
    );
  },

  async checkVersion(productName: string, customerName: string): Promise<unknown> {
    return http.get(
      `/api/plutus/version/check?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  // ---------- RenderSet & 环境变量 ----------
  async getRenderSetKeys(payload: unknown): Promise<unknown> {
    return http.post('/api/plutus/renderSet/keys', payload, { skipErrorHandler: true });
  },

  async getCurrentRenderSet(productName: string, customerName: string): Promise<unknown> {
    return http.get(
      `/api/plutus/renderSet/current?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  // ---------- 客户环境与工作负载 ----------
  async listCustomerNamespaces(productName: string, customerName: string): Promise<string[]> {
    const res = await http.get<string[]>(
      `/api/plutus/env/namespaces?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async listCustomerWorkloads(productName: string, customerName: string, isCustomer = false): Promise<unknown[]> {
    const res = await http.get<unknown[]>(
      `/api/plutus/env/workloads?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}&customer=${isCustomer}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  async restartCustomerWorkload(
    workloadName: string,
    productName: string,
    customerName: string,
    workloadType: string,
    isCustomer = false
  ): Promise<unknown> {
    return http.post(
      `/api/plutus/env/workloads/${encodeURIComponent(workloadName)}/restart?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}&workloadType=${encodeURIComponent(workloadType)}&customer=${isCustomer}`,
      {},
      { skipErrorHandler: true }
    );
  },

  // ---------- 操作日志 ----------
  async listOperations(params: Record<string, unknown> = {}): Promise<PlutusOperationLog[]> {
    const res = await http.get<PlutusOperationLog[]>('/api/plutus/operation', {
      params,
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  },

  // ---------- 客户环境检查、容器与日志 ----------
  /**
   * 检查客户环境连通性
   * GET /api/plutus/env/check?productName=&customerName=
   */
  async checkCustomerEnv(productName: string, customerName: string): Promise<{ status: string }> {
    return http.get<{ status: string }>(
      `/api/plutus/env/check?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
  },

  /**
   * 获取客户 Pod 列表
   * GET /api/plutus/env/pods?productName=&customerName=
   */
  async listCustomerPods(productName: string, customerName: string): Promise<unknown[]> {
    const res = await http.get<unknown[]>(
      `/api/plutus/env/pods?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },

  /**
   * 客户 Pod 终端 WebSocket URL
   * ws(s)://<host>/api/plutus/env/podexec/:podName/:containerName?productName=&customerName=&token=&customer=
   */
  getCustomerPodExecWsUrl(
    podName: string,
    containerName: string,
    params: { productName: string; customerName: string; token: string; customer?: boolean }
  ): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({
      productName: params.productName,
      customerName: params.customerName,
      token: params.token,
      customer: String(!!params.customer),
    });
    return `${proto}//${window.location.host}/api/plutus/env/podexec/${encodeURIComponent(podName)}/${encodeURIComponent(containerName)}?${q.toString()}`;
  },

  /**
   * 客户 Pod 容器日志流 URL
   * /api/plutus/env/sse/logs/pods/:podName/containers/:containerName?tails=5000&productName=&customerName=&customer=
   */
  getCustomerPodLogUrl(
    podName: string,
    containerName: string,
    params: { productName: string; customerName: string; tails?: number; customer?: boolean }
  ): string {
    const q = new URLSearchParams({
      tails: String(params.tails || 5000),
      productName: params.productName,
      customerName: params.customerName,
      customer: String(!!params.customer),
    });
    return `/api/plutus/env/sse/logs/pods/${encodeURIComponent(podName)}/containers/${encodeURIComponent(containerName)}?${q.toString()}`;
  },

  /**
   * 客户许可证离线文件下载
   * GET /api/plutus/license/download?customerId=
   */
  async downloadCustomerLicense(customerId: string): Promise<Blob> {
    return http.get<Blob>(`/api/plutus/license/download?customerId=${encodeURIComponent(customerId)}`, {
      responseType: 'blob',
      skipErrorHandler: true,
    });
  },

  /**
   * 获取客户交付 Helm 服务列表
   * GET /api/plutus/services/getHelmServices?productName=&customerName=
   */
  async getCustomerHelmServices(productName: string, customerName: string): Promise<unknown[]> {
    const res = await http.get<unknown[]>(
      `/api/plutus/services/getHelmServices?productName=${encodeURIComponent(productName)}&customerName=${encodeURIComponent(customerName)}`,
      { skipErrorHandler: true }
    );
    return Array.isArray(res) ? res : [];
  },
};

export default plutusApi;
