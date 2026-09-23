import React, { useState, useEffect, useCallback } from 'react';
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
} from 'antd';
import {
  LineChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/plots';
import http from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/project';

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

export const InsightsPage: React.FC = () => {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState<boolean>(false);

  const [kpiMetrics, setKpiMetrics] = useState({
    successRate: 0,
    buildTotal: 0,
    totalDeploys: 0,
    activeServices: 0,
  });

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [successRateData, setSuccessRateData] = useState<SuccessRateItem[]>([]);
  const [durationData, setDurationData] = useState<DailyCountItem[]>([]);

  const fetchInsightData = useCallback(async () => {
    setLoading(true);
    try {
      const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      // Backend reads startDate/endDate (unix seconds), not a days count
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

      // Trend points from real daily stats
      // 注意: build daily 含 total; deploy daily 无 total，由 success+rollback+failed+timeout 求和
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

      // Daily totals for the column chart
      const dailyCounts: DailyCountItem[] = [];
      (buildData.data || []).forEach((d) => {
        dailyCounts.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '构建任务' });
      });
      (deployData.data || []).forEach((d) => {
        dailyCounts.push({ date: (d.date || '').slice(5), count: dailyCount(d), category: '部署发布' });
      });
      setDurationData(dailyCounts);

      // Success/failure breakdown from real counts
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
      // Handled
    } finally {
      setLoading(false);
    }
  }, [currentProject, timeRange]);

  useEffect(() => {
    fetchInsightData();
  }, [fetchInsightData]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
      {/* Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <LineChartOutlined style={{ fontSize: 22, color: '#0066ff' }} />
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
            <Space orientation="horizontal" size={12}>
              <Select
                value={undefined}
                placeholder="维度详情"
                style={{ width: 140 }}
                onChange={(v) => navigate(`/v1/insight/detail/${v}`)}
                options={[
                  { label: '交付总览', value: 'overview' },
                  { label: '构建洞察', value: 'build' },
                  { label: '测试洞察', value: 'test' },
                  { label: '部署洞察', value: 'deploy' },
                ]}
              />
              <Radio.Group
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                size="middle"
              >
                <Radio.Button value="7d">近 7 天</Radio.Button>
                <Radio.Button value="30d">近 30 天</Radio.Button>
                <Radio.Button value="90d">近 90 天</Radio.Button>
              </Radio.Group>
              <Button icon={<ReloadOutlined />} onClick={fetchInsightData} loading={loading}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

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
            title={`构建与部署活动趋势 (${timeRange === '7d' ? '近 7 天' : timeRange === '30d' ? '近 30 天' : '近 90 天'})`}
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
    </div>
  );
};

export default InsightsPage;
