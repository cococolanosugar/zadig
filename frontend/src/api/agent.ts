import http from './client';

export type AgentProtocol = 'openai' | 'anthropic';
export type AgentAuthType = 'api_key' | 'ak_sk';

export interface AgentIntegration {
  id?: string;
  project_name: string;
  name: string;
  description?: string;
  base_url: string;
  protocol: AgentProtocol;
  model?: string;
  auth_type: AgentAuthType;
  api_key?: string;
  access_key?: string;
  secret_key?: string;
  updated_by?: string;
  update_time?: number;
}

export interface AgentIntegrationPayload {
  id?: string;
  name: string;
  description?: string;
  base_url: string;
  protocol: AgentProtocol;
  model?: string;
  auth_type: AgentAuthType;
  api_key?: string;
  access_key?: string;
  secret_key?: string;
}

export const agentApi = {
  list(projectName: string) {
    return http.get<AgentIntegration[]>('/api/aslan/system/agent/integration', {
      params: { projectName },
    });
  },
  get(projectName: string, id: string) {
    return http.get<AgentIntegration>(`/api/aslan/system/agent/integration/${encodeURIComponent(id)}`, {
      params: { projectName },
    });
  },
  create(projectName: string, payload: AgentIntegrationPayload) {
    return http.post<void>('/api/aslan/system/agent/integration', payload, {
      params: { projectName },
    });
  },
  update(projectName: string, id: string, payload: AgentIntegrationPayload) {
    return http.put<void>(`/api/aslan/system/agent/integration/${encodeURIComponent(id)}`, payload, {
      params: { projectName },
    });
  },
  delete(projectName: string, id: string) {
    return http.delete<void>(`/api/aslan/system/agent/integration/${encodeURIComponent(id)}`, {
      params: { projectName },
    });
  },
  validate(projectName: string, payload: AgentIntegrationPayload) {
    return http.post<void>('/api/aslan/system/agent/integration/validate', payload, {
      params: { projectName },
    });
  },
};

export default agentApi;
