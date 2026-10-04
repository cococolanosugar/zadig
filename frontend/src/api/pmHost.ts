import http from './client';
import { authApi } from './auth';
import { generateAesKey, rsaEncrypt } from '../utils/crypto';

export interface VMAgentInfo {
  token?: string;
  workspace?: string;
  task_concurrency?: number;
  cache_type?: string;
  cache_path?: string;
  object_id?: string;
  need_update?: boolean;
  agent_version?: string;
  zadig_version?: string;
  last_heartbeat_time?: number;
}

export interface VMSystemInfo {
  ip?: string;
  platform?: string;
  architecture?: string;
  memery_total?: number;
  used_memery?: number;
  cpu_num?: number;
  disk_space?: number;
  free_disk_space?: number;
  host_name?: string;
}

export interface PMHost {
  id: string;
  name: string;
  description?: string;
  user_name: string;
  ip: string;
  port: number;
  status: 'normal' | 'abnormal' | 'offline' | 'disconnected' | string;
  label?: string;
  is_prod?: boolean;
  provider?: number;
  schedule_workflow?: boolean;
  create_time?: number;
  update_time?: number;
  update_by?: string;
  error?: string;
  project_name?: string;
  agent?: VMAgentInfo;
  vm_info?: VMSystemInfo;
}

export interface AgentAccessCmd {
  amd64?: Record<string, string>;
  arm64?: Record<string, string>;
}

export interface AgentAccessCmds {
  linux_platform?: AgentAccessCmd;
  macos_platform?: AgentAccessCmd;
  windows_platform?: AgentAccessCmd;
}

export interface CreatePMHostPayload {
  name: string;
  ip: string;
  port: number;
  user_name: string;
  private_key?: string;
  label?: string;
  is_prod?: boolean;
  schedule_workflow?: boolean;
  description?: string;
  provider?: number;
}

// Helper to generate dynamic encryptedKey for query params
async function getEncryptedKeyParam(): Promise<string> {
  const publicKey = await authApi.getRSAPublicKey();
  const aesKey = generateAesKey(32);
  return rsaEncrypt(aesKey, publicKey);
}

// GET /api/aslan/project/pms?encryptedKey=&projectName=&keyword=
export async function listPMHosts(projectName: string, keyword?: string): Promise<PMHost[]> {
  try {
    const encryptedKey = await getEncryptedKeyParam();
    const query = new URLSearchParams({
      encryptedKey,
      projectName,
    });
    if (keyword) {
      query.append('keyword', keyword);
    }
    const res = await http.get<PMHost[]>(`/api/aslan/project/pms?${query.toString()}`);
    return Array.isArray(res) ? res : [];
  } catch (err: unknown) {
    console.error('Failed to list PM hosts:', err);
    throw err;
  }
}

// GET /api/aslan/project/pms/:id
export async function getPMHost(id: string): Promise<PMHost> {
  return http.get<PMHost>(`/api/aslan/project/pms/${id}`);
}

// GET /api/aslan/project/pms/labels
export async function listPMLabels(): Promise<string[]> {
  try {
    const res = await http.get<string[]>('/api/aslan/project/pms/labels', {
      skipErrorHandler: true,
    });
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

// POST /api/aslan/project/pms?projectName=
export async function createPMHost(projectName: string, payload: CreatePMHostPayload): Promise<PMHost> {
  return http.post<PMHost>(
    `/api/aslan/project/pms?projectName=${encodeURIComponent(projectName)}`,
    payload
  );
}

// PUT /api/aslan/project/pms/:id?projectName=
export async function updatePMHost(
  projectName: string,
  id: string,
  payload: Partial<CreatePMHostPayload>
): Promise<PMHost> {
  return http.put<PMHost>(
    `/api/aslan/project/pms/${id}?projectName=${encodeURIComponent(projectName)}`,
    payload
  );
}

// DELETE /api/aslan/project/pms/:id?projectName=
export async function deletePMHost(projectName: string, id: string): Promise<void> {
  return http.delete<void>(
    `/api/aslan/project/pms/${id}?projectName=${encodeURIComponent(projectName)}`
  );
}

// GET /api/aslan/project/pms/:id/agent/access?projectName=
export async function getAgentAccessCmd(projectName: string, id: string): Promise<AgentAccessCmds> {
  return http.get<AgentAccessCmds>(
    `/api/aslan/project/pms/${id}/agent/access?projectName=${encodeURIComponent(projectName)}`
  );
}

// PUT /api/aslan/project/pms/:id/agent/offline?projectName=
export async function offlineVM(projectName: string, id: string): Promise<void> {
  return http.put<void>(
    `/api/aslan/project/pms/${id}/agent/offline?projectName=${encodeURIComponent(projectName)}`,
    {}
  );
}

// PUT /api/aslan/project/pms/:id/agent/recovery?projectName=
export async function recoveryVM(projectName: string, id: string): Promise<void> {
  return http.put<void>(
    `/api/aslan/project/pms/${id}/agent/recovery?projectName=${encodeURIComponent(projectName)}`,
    {}
  );
}

// PUT /api/aslan/project/pms/:id/agent/upgrade?projectName=
export async function upgradeAgent(projectName: string, id: string): Promise<void> {
  return http.put<void>(
    `/api/aslan/project/pms/${id}/agent/upgrade?projectName=${encodeURIComponent(projectName)}`,
    {}
  );
}

export interface BatchCreatePMHostItem {
  name: string;
  ip: string;
  port: number;
  user_name: string;
  private_key?: string;
  label?: string;
  is_prod?: boolean;
  schedule_workflow?: boolean;
  description?: string;
  provider?: number;
}

export interface BatchCreatePMHostPayload {
  option: 'increment' | 'patch';
  data: BatchCreatePMHostItem[];
}

// POST /api/aslan/project/pms/batch?projectName=
export async function batchCreatePMHosts(
  projectName: string,
  payload: BatchCreatePMHostPayload
): Promise<void> {
  return http.post<void>(
    `/api/aslan/project/pms/batch?projectName=${encodeURIComponent(projectName)}`,
    payload
  );
}
