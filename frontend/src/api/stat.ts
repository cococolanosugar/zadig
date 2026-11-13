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

  export interface DeployHealthStat {
    success: number;
    failure: number;
  }

  export interface RollbackServiceCountItem {
    project_name?: string;
    service_name?: string;
    count: number;
    production: boolean;
  }

  /** LOOP7-A2: 研发效能五维雷达模型 */
  export interface EfficiencyRadarData {
    name: string;
    alias?: string;
    test_success_rate: number;
    release_frequency: number;
    build_frequency: number;
    release_success_rate: number;
    requirement_development_lead_time: number;
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

  // 15. 发布健康度统计 (GET /stat/v2/quality/deploy/health)
  getDeployHealthStats(params?: { startDate?: number; endDate?: number; projects?: string[]; type?: string }): Promise<DeployHealthStat> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.type) q.set('type', params.type);
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/deploy/health${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 16. 发布周趋势 (GET /stat/v2/quality/deploy/trend/weekly)
  getDeployWeeklyTrend(params?: { startDate?: number; endDate?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/deploy/trend/weekly${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 17. 发布月趋势 (GET /stat/v2/quality/deploy/trend/monthly)
  getDeployMonthlyTrend(params?: { startDate?: number; endDate?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/deploy/trend/monthly${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 18. 发布最多服务 Top (GET /stat/v2/quality/deploy/service/top)
  getTopDeployedServices(params?: { startDate?: number; endDate?: number; top?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.top) q.set('top', String(params.top));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/deploy/service/top${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 19. 失败最多服务 Top (GET /stat/v2/quality/deploy/service/failure)
  getTopDeployFailures(params?: { startDate?: number; endDate?: number; top?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.top) q.set('top', String(params.top));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/deploy/service/failure${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 20. 回滚总数 (GET /stat/v2/quality/rollback/total)
  getRollbackTotalStat(params?: { startDate?: number; endDate?: number; projects?: string[] }): Promise<{ total: number }> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/rollback/total${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 21. 回滚最多服务 Top (GET /stat/v2/quality/rollback/service/top)
  getTopRollbackedServices(params?: { startDate?: number; endDate?: number; top?: number; projects?: string[]; type?: string }): Promise<RollbackServiceCountItem[]> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.top) q.set('top', String(params.top));
    if (params?.type) q.set('type', params.type);
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/rollback/service/top${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 22. 回滚周趋势 (GET /stat/v2/quality/rollback/trend/weekly)
  getRollbackWeeklyTrend(params?: { startDate?: number; endDate?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/rollback/trend/weekly${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 23. 最近测试任务 (GET /stat/v2/quality/test/recentTask)
  getRecentTestTasks(params?: { startDate?: number; endDate?: number; projects?: string[] }): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', String(params.startDate));
    if (params?.endDate) q.set('endDate', String(params.endDate));
    if (params?.projects) params.projects.forEach((p) => q.append('projects', p));
    const qs = q.toString();
    return http.get(`/api/aslan/stat/v2/quality/test/recentTask${qs ? `?${qs}` : ''}`, { skipErrorHandler: true });
  },

  // 24. 日测试健康趋势 (POST /stat/v2/quality/test/dailyHealthTrend)
  getDailyTestHealthTrend(body: { startDate: number; endDate: number; projects?: string[] }): Promise<unknown> {
    return http.post('/api/aslan/stat/v2/quality/test/dailyHealthTrend', body, { skipErrorHandler: true });
  },

  // ---------- R7 任务1: L3 效能洞察 v2/ai 端点（stat/handler/router.go:83-87，start_time/end_time 秒级） ----------
  // 效能雷达 (GET /stat/v2/ai/radar)
  getEfficiencyRadar(startTime: number, endTime: number, projects?: string[]): Promise<EfficiencyRadarData[]> {
    const q = new URLSearchParams();
    q.set('start_time', String(startTime));
    q.set('end_time', String(endTime));
    if (projects) projects.forEach((p) => q.append('projects', p));
    return http.get(`/api/aslan/stat/v2/ai/radar?${q.toString()}`, { skipErrorHandler: true });
  },

  // 月度效能关注 (GET /stat/v2/ai/attention)
  getMonthAttention(startTime: number, endTime: number, projects?: string[]): Promise<any> {
    const q = new URLSearchParams();
    q.set('start_time', String(startTime));
    q.set('end_time', String(endTime));
    if (projects) projects.forEach((p) => q.append('projects', p));
    return http.get(`/api/aslan/stat/v2/ai/attention?${q.toString()}`, { skipErrorHandler: true });
  },

  // 项目集效能概览 (GET /stat/v2/ai/overview)
  getProjectsOverview(startTime: number, endTime: number, projects?: string[]): Promise<any> {
    const q = new URLSearchParams();
    q.set('start_time', String(startTime));
    q.set('end_time', String(endTime));
    if (projects) projects.forEach((p) => q.append('projects', p));
    return http.get(`/api/aslan/stat/v2/ai/overview?${q.toString()}`, { skipErrorHandler: true });
  },

  // 近 30 天构建趋势 (GET /stat/v2/ai/build/trend)
  get30DayBuildTrend(startTime: number, endTime: number, projects?: string[]): Promise<any> {
    const q = new URLSearchParams();
    q.set('start_time', String(startTime));
    q.set('end_time', String(endTime));
    if (projects) projects.forEach((p) => q.append('projects', p));
    return http.get(`/api/aslan/stat/v2/ai/build/trend?${q.toString()}`, { skipErrorHandler: true });
  },

  // 需求研发/交付周期 (GET /stat/v2/ai/requirement/period)
  getRequirementPeriod(startTime: number, endTime: number, projects?: string[]): Promise<any> {
    const q = new URLSearchParams();
    q.set('start_time', String(startTime));
    q.set('end_time', String(endTime));
    if (projects) projects.forEach((p) => q.append('projects', p));
    return http.get(`/api/aslan/stat/v2/ai/requirement/period?${q.toString()}`, { skipErrorHandler: true });
  },

  // 测试质量趋势 (POST /api/aslan/stat/quality/testTrend)
  getQualityTestTrend(payload: QualityStatReq): Promise<unknown> {
    return http.post('/api/aslan/stat/quality/testTrend', payload, { skipErrorHandler: true });
  },
};

export default statApi;
