import http from './client';

export interface QualityStatReq {
  startDate: number;
  endDate: number;
  productNames: string[];
}

export interface DailyAverageDurationItem {
  date: string;
  averageDuration: number;
}

export interface BuildTenDurationItem {
  productName: string;
  duration: number;
  status: string;
  taskCreator: string;
  createTime: number;
  pipelineName?: string;
  displayName?: string;
  taskID?: number;
  type?: string;
}

export interface BuildTrendCurrentDay {
  success: number;
  failure: number;
  timeout: number;
}

export interface BuildTrendSumItem {
  day: number;
  currentDay: BuildTrendCurrentDay;
}

export interface BuildTrendResp {
  currentDay?: BuildTrendCurrentDay;
  sum?: BuildTrendSumItem[];
}

export interface TestHealthResp {
  totalSuccess: number;
  totalFailure: number;
}

export interface RollbackImageTag {
  name: string;
  tag: string;
}

export interface RollbackStatItem {
  project_name: string;
  service_name: string;
  env_name: string;
  rollback_time: number;
  rollback_detail: string;
  rollback_by: string;
  rollback_before_image_tag?: RollbackImageTag[];
  rollback_after_image_tag?: RollbackImageTag[];
}

export interface GetRollbackStatResp {
  total: number;
  data: RollbackStatItem[];
}

export interface RollbackStatQuery {
  startDate: number;
  endDate: number;
  projects?: string[];
  type?: 'both' | 'production' | 'testing';
}

export interface AiPromptResp {
  prompts: string[];
}

export interface AiAnalysisReq {
  prompt: string;
  project_list?: string[];
  start_time?: number;
  end_time?: number;
}

export interface AiAnalysisResp {
  answer: string;
  input_data?: string;
  overall_project_prompt?: string;
  token_num?: number;
}

export interface StatDashboardConfig {
  id: string;
  type: 'efficiency' | 'quality' | string;
  name: string;
  source: 'zadig' | 'external' | string;
  function: string;
  weight: number;
  api_config?: {
    external_system_id: string;
    api_path: string;
    queries?: Array<{ key: string; value: string }>;
  };
}

export interface StatDashboardItem {
  type: string;
  id: string;
  data: number | string | boolean | null;
  score: number;
  error?: string;
  has_value: boolean;
}

export interface StatDashboardByProject {
  project_key: string;
  project_name: string;
  score: number;
  facts: StatDashboardItem[];
}

export interface StatDashboardBasicData {
  build_total: number;
  build_success: number;
  test_total: number;
  test_success: number;
  deploy_total: number;
  deploy_success: number;
  production_deploy_total: number;
  production_deploy_success: number;
}

export const statApi = {
  // --- Group A: 质量/效能度量 (POST /stat/quality/* & GET /stat/v2/quality/rollback/stat) ---
  // 0. 构建健康度 (成功/失败总数)
  getBuildHealthMeasure(body: QualityStatReq): Promise<{ totalSuccess: number; totalFailure: number }> {
    return http.post('/api/aslan/stat/quality/buildHealthMeasure', body, { skipErrorHandler: true });
  },

  // 1. 平均构建时长
  getBuildAverageMeasure(body: QualityStatReq): Promise<DailyAverageDurationItem[]> {
    return http.post('/api/aslan/stat/quality/buildAverageMeasure', body, { skipErrorHandler: true });
  },

  // 2. Top10 耗时构建
  getBuildTenDurationMeasure(body: QualityStatReq): Promise<BuildTenDurationItem[]> {
    return http.post('/api/aslan/stat/quality/buildTenDurationMeasure', body, { skipErrorHandler: true });
  },

  // 3. 构建趋势 (周/日维度: 成功、失败、超时)
  getBuildTrendMeasure(body: QualityStatReq): Promise<BuildTrendResp> {
    return http.post('/api/aslan/stat/quality/buildTrend', body, { skipErrorHandler: true });
  },

  // 4. 测试平均时长
  getTestAverageMeasure(body: QualityStatReq): Promise<DailyAverageDurationItem[]> {
    return http.post('/api/aslan/stat/quality/testAverageMeasure', body, { skipErrorHandler: true });
  },

  // 5. 测试健康度 (成功/失败总数)
  getTestHealthMeasure(body: QualityStatReq): Promise<TestHealthResp> {
    return http.post('/api/aslan/stat/quality/testHealthMeasure', body, { skipErrorHandler: true });
  },

  // 6. 回滚统计详情 (v2 列表)
  getRollbackStat(params: RollbackStatQuery): Promise<GetRollbackStatResp> {
    const q = new URLSearchParams();
    q.set('startDate', String(params.startDate));
    q.set('endDate', String(params.endDate));
    q.set('type', params.type || 'both');
    if (params.projects && params.projects.length > 0) {
      params.projects.forEach((p) => q.append('projects', p));
    }
    return http.get(`/api/aslan/stat/v2/quality/rollback/stat?${q.toString()}`, { skipErrorHandler: true });
  },

  // --- Group B: AI 分析 (/stat/v2/ai/analysis & prompt) ---
  // 7. 获取推荐 Prompt
  getAiAnalysisPrompts(): Promise<AiPromptResp> {
    return http.get('/api/aslan/stat/v2/ai/analysis/prompt', { skipErrorHandler: true });
  },

  // 8. 触发 AI 统计分析
  getAiAnalysis(body: AiAnalysisReq): Promise<AiAnalysisResp> {
    return http.post('/api/aslan/stat/v2/ai/analysis', body);
  },

  // --- Group C: 效能看板与指标配置 (v2 config & dashboard) ---
  // 9. 获取看板指标配置列表
  listDashboardConfigs(): Promise<StatDashboardConfig[]> {
    return http
      .get<{ configs: StatDashboardConfig[] }>('/api/aslan/stat/v2/config')
      .then((res) => (Array.isArray(res?.configs) ? res.configs : []));
  },

  // 10. 创建看板指标配置
  createDashboardConfig(payload: StatDashboardConfig): Promise<unknown> {
    return http.post('/api/aslan/stat/v2/config', payload);
  },

  // 11. 更新看板指标配置
  updateDashboardConfig(id: string, payload: StatDashboardConfig): Promise<unknown> {
    return http.put(`/api/aslan/stat/v2/config/${id}`, payload);
  },

  // 12. 删除看板指标配置 (移除指标项)
  deleteDashboardConfig(id: string): Promise<unknown> {
    return http.delete(`/api/aslan/stat/v2/config/${id}`);
  },

  // 13. 获取自定义看板项目评分及事实数据
  getStatsDashboard(startTime: number, endTime: number): Promise<StatDashboardByProject[]> {
    return http
      .get<{ dashboard: StatDashboardByProject[] }>(
        `/api/aslan/stat/v2/dashboard?start_time=${startTime}&end_time=${endTime}`
      )
      .then((res) => (Array.isArray(res?.dashboard) ? res.dashboard : []));
  },

  // 14. 获取全局基础效能概览
  getStatsDashboardGeneral(startTime: number, endTime: number): Promise<StatDashboardBasicData> {
    return http.get<StatDashboardBasicData>(
      `/api/aslan/stat/v2/dashboard/general?start_time=${startTime}&end_time=${endTime}`
    );
  },
};

export default statApi;
