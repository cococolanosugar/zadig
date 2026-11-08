import http from './client';

export type ApplicationCustomFieldType =
  | 'text'
  | 'number'
  | 'bool'
  | 'datetime'
  | 'single_select'
  | 'multi_select'
  | 'link'
  | 'user'
  | 'user_group'
  | 'project'
  | 'repository'
  | 'service_config';

export interface ApplicationFieldDefinition {
  id?: string;
  key: string;
  name: string;
  type: ApplicationCustomFieldType;
  default?: unknown;
  options?: string[];
  unique?: boolean;
  required?: boolean;
  show_in_list?: boolean;
  description?: string;
  source?: 'builtin' | 'custom';
  create_time?: number;
  update_time?: number;
}

export const applicationApi = {
  // GET /api/aslan/application/fields
  listFieldDefinitions(): Promise<ApplicationFieldDefinition[]> {
    return http.get('/api/aslan/application/fields');
  },

  // POST /api/aslan/application/fields
  createFieldDefinition(data: ApplicationFieldDefinition): Promise<ApplicationFieldDefinition> {
    return http.post('/api/aslan/application/fields', data);
  },

  // PUT /api/aslan/application/fields/:id
  updateFieldDefinition(id: string, data: ApplicationFieldDefinition): Promise<void> {
    return http.put(`/api/aslan/application/fields/${id}`, data);
  },

  // DELETE /api/aslan/application/fields/:id
  deleteFieldDefinition(id: string): Promise<void> {
    return http.delete(`/api/aslan/application/fields/${id}`);
  },

  // R16 任务2: 批量创建应用（application/handler/router.go:29 POST /applications/bulk）
  bulkCreateApplications(apps: Array<{ name: string; desc?: string; [key: string]: unknown }>): Promise<void> {
    return http.post('/api/aslan/application/applications/bulk', apps);
  },
};

export default applicationApi;
