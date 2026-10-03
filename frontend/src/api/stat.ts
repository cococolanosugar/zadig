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
};

export default statApi;
