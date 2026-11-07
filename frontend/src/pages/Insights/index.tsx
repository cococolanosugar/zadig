import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Radio,
  Empty,
  Button,
  Select,
  Drawer,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Tooltip,
  Segmented,
  Alert,
  Spin,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
  RobotOutlined,
  BulbOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  TrophyOutlined,
  DashboardOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/plots';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';
import { AiAnalysisDrawer } from '../../components/InsightAI/AiAnalysisDrawer';
import {
  statApi,
  type StatDashboardConfig,
  type StatDashboardByProject,
  type StatDashboardBasicData,
} from '../../api/stat';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

interface TrendPoint {
  date: string;
  count: number;
  category: string;
}

interface SuccessRateItem {
  type: string;
  value: number;
}

interface DailyCountItem {
  date: string;
  count: number;
  category: string;
}

interface DashboardStatResp {
  total?: number;
  success?: number;
  data?: Array<{ date: string; success: number; failure: number; total: number; rollback?: number; timeout?: number }>;
}

const INDICATOR_PRESETS: Record<
  string,
  { name: string; type: string; function: string; weight: number }
> = {
  build_average_duration: {
    name: '构建平均耗时',
    type: 'efficiency',
    function: 'build_average_duration',
    weight: 20,
  },
  build_success_rate: {
    name: '构建成功率',
    type: 'efficiency',
    function: 'build_success_rate',
    weight: 20,
  },
  deploy_success_rate: {
    name: '部署成功率',
    type: 'efficiency',
    function: 'deploy_success_rate',
    weight: 20,
  },
  deploy_frequency: {
    name: '部署频次(周)',
    type: 'efficiency',
    function: 'deploy_frequency',
    weight: 10,
  },
  test_pass_rate: {
    name: '测试通过率',
    type: 'quality',
    function: 'test_pass_rate',
    weight: 15,
  },
  test_average_duration: {
    name: '测试平均耗时',
    type: 'efficiency',
    function: 'test_average_duration',
    weight: 15,
  },
  release_frequency: {
    name: '发布频次(周)',
    type: 'efficiency',
    function: 'release_frequency',
    weight: 10,
  },
};

export const InsightsPage: React.FC = () => {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState<boolean>(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'overview' | 'dashboard'>('overview');

  // V1 KPI metrics & chart data
  const [kpiMetrics, setKpiMetrics] = useState({
    successRate: 0,
    buildTotal: 0,
    totalDeploys: 0,
    activeServices: 0,
  });
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [successRateData, setSuccessRateData] = useState<SuccessRateItem[]>([]);
  const [durationData, setDurationData] = useState<DailyCountItem[]>([]);

  // V2 Dashboard & Config state
  const [dashboardConfigs, setDashboardConfigs] = useState<StatDashboardConfig[]>([]);
  const [dashboardProjects, setDashboardProjects] = useState<StatDashboardByProject[]>([]);
  const [dashboardGeneral, setDashboardGeneral] = useState<StatDashboardBasicData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState<boolean>(false);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [editingConfig, setEditingConfig] = useState<StatDashboardConfig | null>(null);
  const [configForm] = Form.useForm();
  const [configSubmitting, setConfigSubmitting] = useState<boolean>(false);

  const fetchInsightData = useCallback(async () => {
    setLoading(true);
    try {
      const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : 90;
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - daysCount * 86400;

      const [buildRes, deployRes, svcRes] = await Promise.allSettled([
        http.get<DashboardStatResp>(`/api/aslan/stat/dashboard/build?startDate=${startDate}&endDate=${endDate}`, {
          skipErrorHandler: true,
        }),
        http.get<DashboardStatResp>(`/api/aslan/stat/dashboard/deploy?startDate=${startDate}&endDate=${endDate}`, {
          skipErrorHandler: true,
        }),
        currentProject
          ? http.get<any[]>(`/api/aslan/service/services?projectName=${currentProject}`, {
              skipErrorHandler: true,
            })
          : Promise.resolve([]),
      ]);

      const buildData: DashboardStatResp =
        buildRes.status === 'fulfilled' && buildRes.value ? buildRes.value : {};
      const deployData: DashboardStatResp =
        deployRes.status === 'fulfilled' && deployRes.value ? deployRes.value : {};
      const serviceList =
        svcRes.status === 'fulfilled' && Array.isArray(svcRes.value) ? svcRes.value : [];

      const dailyCount = (d: { total?: number; success?: number; failure?: number; rollback?: number; timeout?: number }) =>
        d.total ?? (d.success || 0) + (d.failure || 0) + (d.rollback || 0) + (d.timeout || 0);

      const points: TrendPoint[] = [];
      (buildData.data || []).forEach((d) => {
        points.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '构建任务' });
      });
      (deployData.data || []).forEach((d) => {
        points.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '部署发布' });
      });
      setTrendData(points);

      const dailyCounts: DailyCountItem[] = [];
      (buildData.data || []).forEach((d) => {
        dailyCounts.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '构建任务' });
      });
      (deployData.data || []).forEach((d) => {
        dailyCounts.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '部署发布' });
      });
      setDurationData(dailyCounts);

      const buildSuccess = buildData.success || 0;
      const buildTotal = buildData.total || 0;
      const deploySuccess = deployData.success || 0;
      const deployTotal = deployData.total || 0;
      const breakdown: SuccessRateItem[] = [];
      if (buildSuccess > 0) breakdown.push({ type: '构建成功', value: buildSuccess });
      if (buildTotal - buildSuccess > 0) breakdown.push({ type: '构建失败', value: buildTotal - buildSuccess });
      if (deploySuccess > 0) breakdown.push({ type: '部署成功', value: deploySuccess });
      if (deployTotal - deploySuccess > 0) breakdown.push({ type: '部署失败', value: deployTotal - deploySuccess });
      setSuccessRateData(breakdown);

      const totalExecs = buildTotal + deployTotal;
      const successCount = buildSuccess + deploySuccess;
      setKpiMetrics({
        successRate: totalExecs > 0 ? Number(((successCount / totalExecs) * 100).toFixed(1)) : 0,
        buildTotal,
        totalDeploys: deployTotal,
        activeServices: serviceList.length,
      });
    } catch {
      // R7 任务3: 静默失败治理
      feedback.message.error('加载效能概览数据失败');
    } finally {
      setLoading(false);
    }
  }, [currentProject, timeRange]);

  const fetchDashboardConfigs = useCallback(async () => {
    try {
      const list = await statApi.listDashboardConfigs();
      setDashboardConfigs(list);
    } catch {
      setDashboardConfigs([]);
      // R7 任务3: 静默失败治理
      feedback.message.error('获取自定义看板配置列表失败');
    }
  }, []);

  const fetchDashboardV2 = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : 90;
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - daysCount * 86400;

      const [dashRes, genRes] = await Promise.allSettled([
        statApi.getStatsDashboard(startDate, endDate),
        statApi.getStatsDashboardGeneral(startDate, endDate),
      ]);
      if (dashRes.status === 'fulfilled') {
        setDashboardProjects(dashRes.value || []);
      }
      if (genRes.status === 'fulfilled') {
        setDashboardGeneral(genRes.value);
      }
    } catch {
      // R7 任务3: 静默失败治理
      feedback.message.error('加载多项目效能大盘数据失败');
    } finally {
      setDashboardLoading(false);
    }
  }, [timeRange]);

  // ---------- R7 任务1: 月度效能关注 ----------
  const [attentionModalOpen, setAttentionModalOpen] = useState(false);
  const [monthAttention, setMonthAttention] = useState<any>(null);
  const [attentionLoading, setAttentionLoading] = useState(false);

  const fetchMonthAttention = useCallback(async () => {
    const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : 90;
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - daysCount * 86400;
    setAttentionLoading(true);
    try {
      const res = await statApi.getMonthAttention(startDate, endDate, currentProject ? [currentProject] : undefined);
      setMonthAttention(res || null);
    } catch (err: unknown) {
      setMonthAttention(null);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '月度效能关注数据获取失败';
      feedback.message.error(msg);
    } finally {
      setAttentionLoading(false);
    }
  }, [timeRange, currentProject]);

  const handleOpenAttention = () => {
    setAttentionModalOpen(true);
    fetchMonthAttention();
  };

  useEffect(() => {
    fetchInsightData();
    fetchDashboardConfigs();
  }, [fetchInsightData, fetchDashboardConfigs]);

  useEffect(() => {
    if (viewMode === 'dashboard') {
      fetchDashboardV2();
    }
  }, [viewMode, fetchDashboardV2]);

  const handleOpenAddConfig = () => {
    setEditingConfig(null);
    configForm.resetFields();
    configForm.setFieldsValue({
      preset: 'build_average_duration',
      id: 'build_average_duration',
      name: '构建平均耗时',
      type: 'efficiency',
      source: 'zadig',
      function: 'build_average_duration',
      weight: 20,
    });
    setConfigModalOpen(true);
  };

  const handleOpenEditConfig = (record: StatDashboardConfig) => {
    setEditingConfig(record);
    configForm.setFieldsValue({
      preset: record.id in INDICATOR_PRESETS ? record.id : 'custom',
      id: record.id,
      name: record.name,
      type: record.type,
      source: record.source,
      function: record.function,
      weight: record.weight,
      // R7 任务2: 外源配置回填（queries 数组序列化为 key=value& 串）
      api_path: record.api_config?.api_path || '',
      queries: (record.api_config?.queries || []).map((q) => `${q.key}=${q.value}`).join('&'),
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setConfigSubmitting(true);
      // R7 任务2: 外源指标组装 api_config，避免外源配置丢失
      let apiConfig: StatDashboardConfig['api_config'];
      if ((values.source || 'zadig') === 'external') {
        const queries = String(values.queries || '')
          .split('&')
          .map((pair) => pair.trim())
          .filter(Boolean)
          .map((pair) => {
            const eq = pair.indexOf('=');
            return eq === -1
              ? { key: pair, value: '' }
              : { key: pair.slice(0, eq), value: pair.slice(eq + 1) };
          });
        apiConfig = {
          external_system_id: '',
          api_path: String(values.api_path || '').trim(),
          queries,
        };
      }
      const payload: StatDashboardConfig = {
        id: values.id.trim(),
        name: values.name.trim(),
        type: values.type,
        source: values.source || 'zadig',
        function: values.function.trim(),
        weight: Number(values.weight ?? 0),
        ...(apiConfig ? { api_config: apiConfig } : {}),
      };

      if (editingConfig) {
        await statApi.updateDashboardConfig(editingConfig.id, payload);
        feedback.message.success('更新看板指标配置成功');
      } else {
        await statApi.createDashboardConfig(payload);
        feedback.message.success('创建看板指标配置成功');
      }

      setConfigModalOpen(false);
      fetchDashboardConfigs();
      fetchDashboardV2();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存看板配置失败';
      feedback.message.error(msg);
    } finally {
      setConfigSubmitting(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await statApi.deleteDashboardConfig(id);
      feedback.message.success('已移除指标项');
      fetchDashboardConfigs();
      fetchDashboardV2();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移除指标项失败';
      feedback.message.error(msg);
    }
  };

  const lineConfig = {
    data: trendData,
    xField: 'date',
    yField: 'count',
    colorField: 'category',
    point: { shapeField: 'circle', sizeField: 3 },
    style: {
      lineWidth: 2,
    },
  };

  const pieConfig = {
    data: successRateData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.5,
    legend: {
      color: {
        position: 'right' as const,
      },
    },
  };

  const columnConfig = {
    data: durationData,
    xField: 'date',
    yField: 'count',
    colorField: 'category',
    group: true,
  };

  // V2 Dashboard Columns
  const dashboardColumns = useMemo<ColumnsType<StatDashboardByProject>>(() => {
    const cols: ColumnsType<StatDashboardByProject> = [
      {
        title: '项目名称',
        dataIndex: 'project_name',
        key: 'project_name',
        width: 180,
        fixed: 'left',
        render: (name, r) => (
          <Space size={4}>
            <Text strong>{name || r.project_key}</Text>
            {name && r.project_key && name !== r.project_key && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({r.project_key})
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: '综合效能得分',
        dataIndex: 'score',
        key: 'score',
        width: 140,
        sorter: (a, b) => a.score - b.score,
        render: (score) => {
          let color = 'gold';
          if (score >= 80) color = 'green';
          else if (score >= 60) color = 'blue';
          return (
            <Space size={6}>
              <TrophyOutlined
                style={{
                  color: score >= 80 ? '#52c41a' : score >= 60 ? '#1677ff' : '#faad14',
                  fontSize: 16,
                }}
              />
              <Tag color={color} style={{ fontSize: 13, fontWeight: 'bold' }}>
                {score.toFixed(1)} 分
              </Tag>
            </Space>
          );
        },
      },
    ];

    dashboardConfigs.forEach((cfg) => {
      cols.push({
        title: (
          <div>
            <div>{cfg.name}</div>
            <div style={{ fontSize: 11, fontWeight: 'normal', color: '#8c8c8c' }}>
              权重 {cfg.weight}%
            </div>
          </div>
        ),
        key: cfg.id,
        align: 'center',
        render: (_: unknown, record: StatDashboardByProject) => {
          const fact = (record.facts || []).find((f) => f.id === cfg.id);
          if (!fact || !fact.has_value) {
            return <Text type="secondary">-</Text>;
          }
          if (fact.error) {
            return (
              <Tooltip title={fact.error}>
                <Tag color="error">异常</Tag>
              </Tooltip>
            );
          }
          const displayVal =
            typeof fact.data === 'number'
              ? fact.data % 1 === 0
                ? fact.data
                : fact.data.toFixed(1)
              : String(fact.data ?? '-');

          return (
            <Space size={4}>
              <Text strong>{displayVal}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({fact.score.toFixed(1)}分)
              </Text>
            </Space>
          );
        },
      });
    });

    return cols;
  }, [dashboardConfigs]);

  const configTableColumns: ColumnsType<StatDashboardConfig> = [
    {
      title: '指标标识 (ID)',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: '指标分类',
      dataIndex: 'type',
      key: 'type',
      render: (type) =>
        type === 'quality' ? (
          <Tag color="purple">交付质量</Tag>
        ) : (
          <Tag color="cyan">研发效能</Tag>
        ),
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      render: (source) => (source === 'external' ? <Tag color="orange">外部系统</Tag> : <Tag color="blue">系统采集</Tag>),
    },
    {
      title: '计算函数 / 公式',
      dataIndex: 'function',
      key: 'function',
      render: (fn) => (
        <Tooltip title={fn}>
          <Text ellipsis style={{ maxWidth: 140 }}>
            {fn}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      render: (w) => <Text>{w}%</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditConfig(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认从看板中移除该指标项？"
            okText="移除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteConfig(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              移除指标项
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
      {/* Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space size="middle" align="center">
              <DashboardOutlined style={{ fontSize: 24, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  研发效能与交付洞察 (Delivery Insights)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  当前项目范围: <strong>{currentProject || '全局工作区'}</strong>
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space size={12} wrap align="center">
              <Segmented
                value={viewMode}
                onChange={(v) => setViewMode(v as 'overview' | 'dashboard')}
                options={[
                  { label: '活动趋势大盘', value: 'overview', icon: <BarChartOutlined /> },
                  { label: '效能指标看板', value: 'dashboard', icon: <TrophyOutlined /> },
                ]}
              />

              <Button
                icon={<SettingOutlined />}
                onClick={() => setConfigDrawerOpen(true)}
              >
                看板配置
              </Button>

              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => setAiDrawerOpen(true)}
                style={{ background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)', border: 'none' }}
              >
                AI 效能洞察分析
              </Button>
              <Select
                value={undefined}
                placeholder="维度详情"
                style={{ width: 120 }}
                onChange={(v) => navigate(`/v1/insight/detail/${v}`)}
                options={[
                  { label: '交付总览', value: 'overview' },
                  { label: '构建洞察', value: 'build' },
                  { label: '测试洞察', value: 'test' },
                  { label: '部署洞察', value: 'deploy' },
                ]}
              />
              <Button
                icon={<BulbOutlined />}
                onClick={handleOpenAttention}
              >
                月度效能关注
              </Button>
              <Radio.Group
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                size="middle"
              >
                <Radio.Button value="7d">近 7 天</Radio.Button>
                <Radio.Button value="14d">近 14 天</Radio.Button>
                <Radio.Button value="30d">近 30 天</Radio.Button>
                <Radio.Button value="90d">近 90 天</Radio.Button>
              </Radio.Group>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchInsightData();
                  if (viewMode === 'dashboard') fetchDashboardV2();
                }}
                loading={loading || dashboardLoading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* VIEW 1: Overview Charts & Daily Trend */}
      {viewMode === 'overview' && (
        <>
          {/* KPI Cards */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="交付全流程成功率"
                  value={kpiMetrics.successRate}
                  precision={1}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  suffix="%"
                  loading={loading}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="周期构建任务总数"
                  value={kpiMetrics.buildTotal}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                  suffix="次"
                  loading={loading}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="周期累计交付频次"
                  value={kpiMetrics.totalDeploys}
                  prefix={<ThunderboltOutlined style={{ color: '#0066ff' }} />}
                  suffix="次"
                  loading={loading}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="纳管活跃微服务数"
                  value={kpiMetrics.activeServices}
                  prefix={<DeploymentUnitOutlined style={{ color: '#722ed1' }} />}
                  suffix="个"
                  loading={loading}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts Section */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card
                variant="borderless"
                title={`构建与部署活动趋势 (${timeRange === '7d' ? '近 7 天' : timeRange === '14d' ? '近 14 天' : timeRange === '30d' ? '近 30 天' : '近 90 天'})`}
                style={{ borderRadius: 8 }}
              >
                {trendData.length > 0 ? (
                  <div style={{ height: 280 }}>
                    <Line {...lineConfig} />
                  </div>
                ) : (
                  <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card
                variant="borderless"
                title="任务执行状态分布"
                style={{ borderRadius: 8 }}
              >
                {successRateData.length > 0 ? (
                  <div style={{ height: 280 }}>
                    <Pie {...pieConfig} />
                  </div>
                ) : (
                  <Empty description="暂无状态数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Daily Volume Breakdown */}
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                variant="borderless"
                title="每日任务执行总量对比 (构建 vs 部署)"
                style={{ borderRadius: 8 }}
              >
                {durationData.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <Column {...columnConfig} />
                  </div>
                ) : (
                  <Empty description="暂无每日执行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* VIEW 2: Dashboard V2 with Dynamic Indicator Scoreboard */}
      {viewMode === 'dashboard' && (
        <>
          {/* General Stats V2 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="累计构建次数 (成功率)"
                  value={dashboardGeneral?.build_total || 0}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      / 成功 {dashboardGeneral?.build_success || 0}
                    </Text>
                  }
                  prefix={<ClockCircleOutlined style={{ color: '#0066ff' }} />}
                  loading={dashboardLoading}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="累计测试执行 (通过数)"
                  value={dashboardGeneral?.test_total || 0}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      / 通过 {dashboardGeneral?.test_success || 0}
                    </Text>
                  }
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  loading={dashboardLoading}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="累计部署发布 (成功数)"
                  value={dashboardGeneral?.deploy_total || 0}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      / 成功 {dashboardGeneral?.deploy_success || 0}
                    </Text>
                  }
                  prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
                  loading={dashboardLoading}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="生产环境部署频次 (成功数)"
                  value={dashboardGeneral?.production_deploy_total || 0}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      / 成功 {dashboardGeneral?.production_deploy_success || 0}
                    </Text>
                  }
                  prefix={<DeploymentUnitOutlined style={{ color: '#722ed1' }} />}
                  loading={dashboardLoading}
                />
              </Card>
            </Col>
          </Row>

          {/* V2 Dashboard Projects Table */}
          <Card
            variant="borderless"
            style={{ borderRadius: 8 }}
            title={
              <Space>
                <TrophyOutlined style={{ color: '#0066ff' }} />
                <span>各项目效能成熟度指标看板 (Dashboard V2)</span>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                  (已启用 {dashboardConfigs.length} 项评估指标，可通过右上角「看板配置」自定义指标和权重)
                </Text>
              </Space>
            }
            extra={
              <Button
                icon={<SettingOutlined />}
                type="link"
                onClick={() => setConfigDrawerOpen(true)}
              >
                管理看板指标
              </Button>
            }
          >
            <Table
              dataSource={dashboardProjects}
              rowKey="project_key"
              columns={dashboardColumns}
              loading={dashboardLoading}
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个项目` }}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无项目看板评分数据，请确保已配置有效指标项并执行了构建/部署/测试"
                  />
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* AI Analysis Drawer */}
      <AiAnalysisDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        defaultProject={currentProject}
      />

      {/* Dashboard Configuration Drawer (F6) */}
      <Drawer
        title={
          <Space>
            <SettingOutlined style={{ color: '#0066ff' }} />
            <span>效能看板配置</span>
          </Space>
        }
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        destroyOnHidden
        size={760}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAddConfig}
          >
            添加指标项
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            title="看板指标说明"
            description="效能看板综合各纳管指标项得分并按权重计算出项目的整体工程成熟度分数。您可以从系统预设模板快速添加指标，或定义个性化计算公式。"
          />

          <Table
            dataSource={dashboardConfigs}
            rowKey="id"
            columns={configTableColumns}
            pagination={false}
            size="small"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无指标项，请点击右上角「添加指标项」"
                />
              ),
            }}
          />
        </div>
      </Drawer>

      {/* Add / Edit Indicator Config Modal */}
      <Modal
        title={editingConfig ? `编辑指标项：${editingConfig.name}` : '添加看板指标项'}
        open={configModalOpen}
        onOk={handleSaveConfig}
        confirmLoading={configSubmitting}
        onCancel={() => setConfigModalOpen(false)}
        destroyOnHidden
        width={560}
      >
        <Form form={configForm} layout="vertical" style={{ marginTop: 16 }}>
          {!editingConfig && (
            <Form.Item name="preset" label="快捷选择预设指标">
              <Select
                placeholder="请选择预设指标模板"
                onChange={(key) => {
                  if (key in INDICATOR_PRESETS) {
                    const preset = INDICATOR_PRESETS[key];
                    configForm.setFieldsValue({
                      id: key,
                      name: preset.name,
                      type: preset.type,
                      function: preset.function,
                      weight: preset.weight,
                    });
                  }
                }}
                options={[
                  { label: '构建平均耗时 (build_average_duration)', value: 'build_average_duration' },
                  { label: '构建成功率 (build_success_rate)', value: 'build_success_rate' },
                  { label: '部署成功率 (deploy_success_rate)', value: 'deploy_success_rate' },
                  { label: '部署频次 (deploy_frequency)', value: 'deploy_frequency' },
                  { label: '测试通过率 (test_pass_rate)', value: 'test_pass_rate' },
                  { label: '测试平均耗时 (test_average_duration)', value: 'test_average_duration' },
                  { label: '发布频次 (release_frequency)', value: 'release_frequency' },
                  { label: '自定义指标 (Custom)', value: 'custom' },
                ]}
              />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="id"
                label="指标唯一标识 (ID)"
                rules={[{ required: true, message: '请输入指标标识' }]}
              >
                <Input
                  disabled={!!editingConfig}
                  placeholder="例如：build_success_rate"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="指标显示名称"
                rules={[{ required: true, message: '请输入指标名称' }]}
              >
                <Input placeholder="例如：构建成功率" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="指标所属类别"
                rules={[{ required: true, message: '请选择指标类别' }]}
              >
                <Radio.Group>
                  <Radio value="efficiency">研发效能</Radio>
                  <Radio value="quality">交付质量</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="数据来源">
                <Radio.Group>
                  <Radio value="zadig">系统采集</Radio>
                  <Radio value="external">外部系统</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="function"
            label="计算函数 / 换算公式"
            rules={[{ required: true, message: '请输入计算函数标识或公式' }]}
            extra="支持预设函数名或公式，例如：build_average_duration 或 90000/(x+900)"
          >
            <Input placeholder="例如：build_average_duration" />
          </Form.Item>

          <Form.Item
            name="weight"
            label="综合评分权重 (0~100 %)"
            rules={[{ required: true, message: '请输入权重' }]}
            extra="各指标权重总和建议控制在 100 以内"
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          {/* R7 任务2: 外源指标 api_config 配置（source === 'external' 时展开） */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.source !== c.source}>
            {({ getFieldValue }) =>
              getFieldValue('source') === 'external' ? (
                <>
                  <Alert
                    type="info"
                    showIcon
                    title="外源指标配置"
                    description="数据来自外部系统 API，保存后将随看板评分计算轮询获取。"
                    style={{ marginBottom: 16, borderRadius: 6 }}
                  />
                  <Form.Item
                    name="api_path"
                    label="API 路径 (api_path)"
                    rules={[{ required: true, message: '请输入外源 API 路径' }]}
                    extra="相对外部系统根地址的路径，例如：/api/v1/metrics/build"
                  >
                    <Input placeholder="/api/v1/metrics/build" />
                  </Form.Item>
                  <Form.Item
                    name="queries"
                    label="查询参数 (queries)"
                    extra="格式：key1=value1&key2=value2，保存时解析为键值对数组"
                  >
                    <Input placeholder="project=demo&interval=1d" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 月度效能关注 Modal (R7 任务1) */}
      <Modal
        title="月度效能关注 (AI Insights)"
        open={attentionModalOpen}
        onCancel={() => setAttentionModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setAttentionModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={620}
      >
        <Spin spinning={attentionLoading}>
          {monthAttention ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
              {monthAttention.system_answer && (
                <Alert
                  type="info"
                  showIcon
                  title="系统判定关注事项"
                  description={<span style={{ whiteSpace: 'pre-wrap' }}>{String(monthAttention.system_answer)}</span>}
                  style={{ borderRadius: 6 }}
                />
              )}
              {monthAttention.ai_answer && (
                <Alert
                  type="warning"
                  showIcon
                  title="AI 综合关注事项"
                  description={<span style={{ whiteSpace: 'pre-wrap' }}>{String(monthAttention.ai_answer)}</span>}
                  style={{ borderRadius: 6 }}
                />
              )}
              {!monthAttention.system_answer && !monthAttention.ai_answer && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前统计周期内暂无关注事项" />
              )}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={attentionLoading ? '正在获取月度效能关注...' : '暂无数据'} />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default InsightsPage;
