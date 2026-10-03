import http from './client';

export interface UserBriefInfo {
  uid?: string;
  account: string;
  name: string;
  identity_type?: string;
  phone?: string;
  email?: string;
}

export interface SprintWorkitem {
  id: string;
  title: string;
  owners?: UserBriefInfo[];
  sprint_id?: string;
  stage_id?: string;
  create_time?: number;
  update_time?: number;
}

export interface SprintStage {
  id: string;
  name: string;
  workflows?: Array<{ name: string; display_name?: string }>;
  workitems?: SprintWorkitem[];
}

export interface SprintDetail {
  id: string;
  name: string;
  created_by?: string | { name?: string; account?: string };
  create_time?: number;
  updated_by?: string | { name?: string; account?: string };
  update_time?: number;
  is_archived?: boolean;
  stages?: SprintStage[];
}

export interface SprintWorkItemActivity {
  id?: string;
  sprint_workitem_id: string;
  action: string;
  operator: string;
  create_time: number;
  content?: string;
}

export interface SprintWorkItemDetail {
  id: string;
  title: string;
  description?: string;
  owners?: UserBriefInfo[];
  stage_id: string;
  create_time?: number;
  update_time?: number;
  activities?: SprintWorkItemActivity[];
}

export interface CreateSprintWorkItemPayload {
  title: string;
  description?: string;
  sprint_id: string;
  stage_id: string;
  owners?: UserBriefInfo[];
}

// GET /api/aslan/sprint_management/v1/sprint/:id?projectName=
export async function getSprint(projectName: string, sprintId: string): Promise<SprintDetail> {
  return http.get<SprintDetail>(
    `/api/aslan/sprint_management/v1/sprint/${sprintId}?projectName=${encodeURIComponent(projectName)}`
  );
}

// GET /api/aslan/sprint_management/v1/sprint_workitem/:id?projectName=
export async function getSprintWorkItem(projectName: string, workitemId: string): Promise<SprintWorkItemDetail> {
  return http.get<SprintWorkItemDetail>(
    `/api/aslan/sprint_management/v1/sprint_workitem/${workitemId}?projectName=${encodeURIComponent(projectName)}`
  );
}

// POST /api/aslan/sprint_management/v1/sprint_workitem?projectName=
export async function createSprintWorkItem(projectName: string, payload: CreateSprintWorkItemPayload): Promise<void> {
  return http.post<void>(
    `/api/aslan/sprint_management/v1/sprint_workitem?projectName=${encodeURIComponent(projectName)}`,
    payload
  );
}

// PUT /api/aslan/sprint_management/v1/sprint_workitem/:id/move?projectName=&sprintID=&stageID=&index=&sprintUpdateTime=&workitemUpdateTime=
export async function moveSprintWorkItem(params: {
  projectName: string;
  sprintId: string;
  workitemId: string;
  stageId: string;
  index: number;
  sprintUpdateTime: number;
  workitemUpdateTime: number;
}): Promise<void> {
  const query = new URLSearchParams({
    projectName: params.projectName,
    sprintID: params.sprintId,
    stageID: params.stageId,
    index: String(params.index),
    sprintUpdateTime: String(params.sprintUpdateTime),
    workitemUpdateTime: String(params.workitemUpdateTime),
  });
  return http.put<void>(
    `/api/aslan/sprint_management/v1/sprint_workitem/${params.workitemId}/move?${query.toString()}`,
    {}
  );
}

// PUT /api/aslan/sprint_management/v1/sprint_workitem/:id/title?projectName=
export async function updateSprintWorkItemTitle(projectName: string, workitemId: string, title: string): Promise<void> {
  return http.put<void>(
    `/api/aslan/sprint_management/v1/sprint_workitem/${workitemId}/title?projectName=${encodeURIComponent(projectName)}`,
    { title }
  );
}

// PUT /api/aslan/sprint_management/v1/sprint_workitem/:id/desc?projectName=
export async function updateSprintWorkItemDesc(projectName: string, workitemId: string, desc: string): Promise<void> {
  return http.put<void>(
    `/api/aslan/sprint_management/v1/sprint_workitem/${workitemId}/desc?projectName=${encodeURIComponent(projectName)}`,
    { des: desc }
  );
}

// DELETE /api/aslan/sprint_management/v1/sprint_workitem/:id?projectName=
export async function deleteSprintWorkItem(projectName: string, workitemId: string): Promise<void> {
  return http.delete<void>(
    `/api/aslan/sprint_management/v1/sprint_workitem/${workitemId}?projectName=${encodeURIComponent(projectName)}`
  );
}
