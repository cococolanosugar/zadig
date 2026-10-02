import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Empty,
  Spin,
  Button,
  Table,
  Tag,
  Radio,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, Column } from '@ant-design/plots';
import http from '../../api/client';
import { useProjectStore } from '../../stores/project';

const { Title, Text } = Typography;

interface BuildDeployDaily {
  date: string;
  success: number;
  failure?: number;
  rollback?: number;
  timeout?: number;
  total?: number;
}

interface BuildDeployResp {
  total?: number;
  success?: number;
  data?: BuildDeployDaily[];
}

interface TestDashboardResp {
  total_case_count?: number;
  total_exec_count?: number;
  success?: number;
  average_duration?: number;
}

interface MonthlyReleaseStat {
  total: number;
  average_execution_duration: number;
  average_approval_duration: number;
  date: string;
}

interface ReleaseDashboardResp {
  total?: number;
  average_duration?: number;
  data?: MonthlyReleaseStat[];
}

const DIMENSION_TITLES: Record<string, { title: string; desc: string }> = {
  overview: { title: '交付总览', desc: '构建、测试、发布三类交付活动综合视图' },
  build: { title: '构建洞察', desc: '构建任务执行频次与成功率趋势' },
  test: { title: '测试洞察', desc: '自动化测试执行与用例规模统计' },
  deploy: { title: '部署洞察', desc: '部署发布频次与月度交付节奏' },
};

export const InsightDetailPage: React.FC = () => {
  const { dimension = 'overview' } = useParams<{ dimension: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(false);

  const [buildData, setBuildData] = useState<BuildDeployResp>({});
  const [deployData, setDeployData] = useState<BuildDeployResp>({});
  const [testData, setTestData] = useState<TestDashboardResp>({});
  const [releaseData, setReleaseData] = useState<ReleaseDashboardResp>({});

  const meta = DIMENSION_TITLES[dimension] || DIMENSION_TITLES.overview;
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchDimension = useCallback(async () => {
    setLoading(true);
    // 后端 GetBuildStat/GetDeployStat 读 startDate/endDate（unix 秒）；GetTestDashboard/GetReleaseDashboard 无参数
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90) * 86400;
    const requests: Array<Promise<void>> = [];

    if (dimension === 'build' || dimension === 'overview') {
      requests.push(
        http
          .get<BuildDeployResp>(`/api/aslan/stat/dashboard/build?startDate=${startDate}&endDate=${endDate}`, { skipErrorHandler: true })
          .then((res) => setBuildData(res || {}))
          .catch(() => setBuildData({}))
      );
    }
    if (dimension === 'deploy' || dimension === 'overview') {
      requests.push(
        http
          .get<BuildDeployResp>(`/api/aslan/stat/dashboard/deploy?startDate=${startDate}&endDate=${endDate}`, { skipErrorHandler: true })
          .then((res) => setDeployData(res || {}))
          .catch(() => setDeployData({}))
      );
    }
    if (dimension === 'test' || dimension === 'overview') {
      requests.push(
        http
          .get<TestDashboardResp>('/api/aslan/stat/dashboard/test', { skipErrorHandler: true })
          .then((res) => setTestData(res || {}))
          .catch(() => setTestData({}))
      );
    }
    if (dimension === 'deploy' || dimension === 'overview') {
      requests.push(
        http
          .get<ReleaseDashboardResp>('/api/aslan/stat/dashboard/release', { skipErrorHandler: true })
          .then((res) => setReleaseData(res || {}))
          .catch(() => setReleaseData({}))
      );
    }

    await Promise.all(requests);
    setLoading(false);
  }, [dimension, timeRange]);

  useEffect(() => {
    fetchDimension();
  }, [fetchDimension]);

  const toTrendPoints = (
    resp: BuildDeployResp | undefined,
    category: string
  ): Array<{ date: string; count: number; category: string }> =>
    (resp?.data || []).map((d) => ({
      date: (d.date || '').slice(5),
      count: d.total ?? (d.success || 0) + (d.failure || 0) + (d.rollback || 0) + (d.timeout || 0),
      category,
    }));

  const lineConfig = (data: Array<{ date: string; count: number; category: string }>) => ({
    data,
    xField: 'date',
    yField: 'count',
    colorField: 'category',
    point: { shapeField: 'circle', sizeField: 3 },
    style: { lineWidth: 2 },
  });

  const releaseColumns: ColumnsType<MonthlyReleaseStat> = [
    { title: '月份', dataIndex: 'date', key: 'date', render: (d) => <Text strong>{String(d || '-')}</Text> },
    { title: '发布次数', dataIndex: 'total', key: 'total', render: (t) => <Tag color="blue">{String(t ?? 0)}</Tag> },
    {
      title: '平均执行耗时 (秒)',
      dataIndex: 'average_execution_duration',
      key: 'avg_exec',
      render: (v) => <Text type="secondary">{Number(v ?? 0).toFixed(1)}</Text>,
    },
    {
      title: '平均审批耗时 (秒)',
      dataIndex: 'average_approval_duration',
      key: 'avg_approve',
      render: (v) => <Text type="secondary">{Number(v ?? 0).toFixed(1)}</Text>,
    },
  ];

  const renderDimension = () => {
    if (dimension === 'build') {
      const points = toTrendPoints(buildData, '构建任务');
      const successRate =
        (buildData.total || 0) > 0
          ? Number((((buildData.success || 0) / (buildData.total || 1)) * 100).toFixed(1))
          : 0;
      return (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="构建任务总数" value={buildData.total || 0} prefix={<ThunderboltOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="构建成功率"
                  value={successRate}
                  precision={1}
                  suffix="%"
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="构建失败数" value={(buildData.total || 0) - (buildData.success || 0)} />
              </Card>
            </Col>
          </Row>
          <Card variant="borderless" title="构建趋势" style={{ borderRadius: 8, marginTop: 16 }}>
            {points.length > 0 ? (
              <div style={{ height: 300 }}>
                <Line {...lineConfig(points)} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构建趋势数据" />
            )}
          </Card>
        </>
      );
    }

    if (dimension === 'deploy') {
      const points = toTrendPoints(deployData, '部署发布');
      return (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="部署任务总数" value={deployData.total || 0} prefix={<RocketOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="发布版本总数" value={releaseData.total || 0} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="平均发布耗时 (秒)"
                  value={Number(releaseData.average_duration || 0).toFixed(1)}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          </Row>
          <Card variant="borderless" title="部署趋势" style={{ borderRadius: 8, marginTop: 16 }}>
            {points.length > 0 ? (
              <div style={{ height: 300 }}>
                <Line {...lineConfig(points)} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无部署趋势数据" />
            )}
          </Card>
          <Card variant="borderless" title="月度发布统计" style={{ borderRadius: 8, marginTop: 16 }}>
            <Table
              dataSource={releaseData.data || []}
              columns={releaseColumns}
              rowKey="date"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度发布数据" />,
              }}
            />
          </Card>
        </>
      );
    }

    if (dimension === 'test') {
      return (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="用例总数" value={testData.total_case_count || 0} prefix={<ExperimentOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="累计执行次数" value={testData.total_exec_count || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic
                title="执行成功次数"
                value={testData.success || 0}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic
                title="平均执行耗时 (秒)"
                value={testData.average_duration || 0}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
        </Row>
      );
    }

    // overview
    const points = [
      ...toTrendPoints(buildData, '构建任务'),
      ...toTrendPoints(deployData, '部署发布'),
    ];
    return (
      <>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="构建任务总数" value={buildData.total || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="部署任务总数" value={deployData.total || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="自动化测试用例数" value={testData.total_case_count || 0} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card variant="borderless" style={{ borderRadius: 8 }}>
              <Statistic title="发布版本总数" value={releaseData.total || 0} />
            </Card>
          </Col>
        </Row>
        <Card variant="borderless" title="构建 / 部署活动总览" style={{ borderRadius: 8, marginTop: 16 }}>
          {points.length > 0 ? (
            <div style={{ height: 300 }}>
              <Line {...lineConfig(points)} />
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无交付活动数据" />
          )}
        </Card>
        <Card variant="borderless" title="月度发布节奏" style={{ borderRadius: 8, marginTop: 16 }}>
          {(releaseData.data || []).length > 0 ? (
            <div style={{ height: 260 }}>
              <Column
                data={releaseData.data || []}
                xField="date"
                yField="total"
                colorField="total"
              />
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度发布数据" />
          )}
        </Card>
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/v1/insight')}>
                返回洞察
              </Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {meta.title}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {meta.desc}
                  {currentProject ? ` · 项目范围: ${currentProject}` : ' · 全局工作区'}
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal" size={12}>
              <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)} size="middle">
                <Radio.Button value="7d">近 7 天</Radio.Button>
                <Radio.Button value="30d">近 30 天</Radio.Button>
                <Radio.Button value="90d">近 90 天</Radio.Button>
              </Radio.Group>
              <Button icon={<ReloadOutlined />} onClick={fetchDimension} loading={loading}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        renderDimension()
      )}
    </div>
  );
};

export default InsightDetailPage;
