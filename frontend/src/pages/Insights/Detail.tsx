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
  FieldTimeOutlined,
  TrophyOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, Column } from '@ant-design/plots';
import http from '../../api/client';
import statApi, {
  type DailyAverageDurationItem,
  type BuildTenDurationItem,
  type TestHealthResp,
  type RollbackStatItem,
} from '../../api/stat';
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

  const [buildAverageData, setBuildAverageData] = useState<DailyAverageDurationItem[]>([]);
  const [buildTenDurationData, setBuildTenDurationData] = useState<BuildTenDurationItem[]>([]);
  const [testAverageData, setTestAverageData] = useState<DailyAverageDurationItem[]>([]);
  const [testHealthData, setTestHealthData] = useState<TestHealthResp>({ totalSuccess: 0, totalFailure: 0 });
  const [rollbackStatData, setRollbackStatData] = useState<RollbackStatItem[]>([]);
  const [activeBuildTab, setActiveBuildTab] = useState<'trend' | 'average' | 'topTen'>('trend');

  const meta = DIMENSION_TITLES[dimension] || DIMENSION_TITLES.overview;
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchDimension = useCallback(async () => {
    setLoading(true);
    // 后端 GetBuildStat/GetDeployStat 读 startDate/endDate（unix 秒）；GetTestDashboard/GetReleaseDashboard 无参数
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90) * 86400;
    const requests: Array<Promise<void>> = [];

    const reqBody = {
      startDate,
      endDate,
      productNames: currentProject ? [currentProject] : [],
    };

    if (dimension === 'build' || dimension === 'overview') {
      requests.push(
        http
          .get<BuildDeployResp>(`/api/aslan/stat/dashboard/build?startDate=${startDate}&endDate=${endDate}`, { skipErrorHandler: true })
          .then((res) => setBuildData(res || {}))
          .catch(() => setBuildData({})),
        statApi
          .getBuildAverageMeasure(reqBody)
          .then((res) => setBuildAverageData(Array.isArray(res) ? res : []))
          .catch(() => setBuildAverageData([])),
        statApi
          .getBuildTenDurationMeasure(reqBody)
          .then((res) => setBuildTenDurationData(Array.isArray(res) ? res : []))
          .catch(() => setBuildTenDurationData([]))
      );
    }
    if (dimension === 'deploy' || dimension === 'overview') {
      requests.push(
        http
          .get<BuildDeployResp>(`/api/aslan/stat/dashboard/deploy?startDate=${startDate}&endDate=${endDate}`, { skipErrorHandler: true })
          .then((res) => setDeployData(res || {}))
          .catch(() => setDeployData({})),
        http
          .get<ReleaseDashboardResp>('/api/aslan/stat/dashboard/release', { skipErrorHandler: true })
          .then((res) => setReleaseData(res || {}))
          .catch(() => setReleaseData({})),
        statApi
          .getRollbackStat({
            startDate,
            endDate,
            projects: currentProject ? [currentProject] : undefined,
            type: 'both',
          })
          .then((res) => setRollbackStatData(res?.data || []))
          .catch(() => setRollbackStatData([]))
      );
    }
    if (dimension === 'test' || dimension === 'overview') {
      requests.push(
        http
          .get<TestDashboardResp>('/api/aslan/stat/dashboard/test', { skipErrorHandler: true })
          .then((res) => setTestData(res || {}))
          .catch(() => setTestData({})),
        statApi
          .getTestAverageMeasure(reqBody)
          .then((res) => setTestAverageData(Array.isArray(res) ? res : []))
          .catch(() => setTestAverageData([])),
        statApi
          .getTestHealthMeasure(reqBody)
          .then((res) => setTestHealthData(res || { totalSuccess: 0, totalFailure: 0 }))
          .catch(() => setTestHealthData({ totalSuccess: 0, totalFailure: 0 }))
      );
    }

    await Promise.all(requests);
    setLoading(false);
  }, [currentProject, dimension, timeRange]);

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

  const durationLineConfig = (data: DailyAverageDurationItem[], label: string) => ({
    data: data.map((d) => ({ date: d.date.slice(5), duration: Math.round(d.averageDuration), category: label })),
    xField: 'date',
    yField: 'duration',
    colorField: 'category',
    point: { shapeField: 'circle', sizeField: 3 },
    style: { lineWidth: 2 },
  });

  const topTenColumns: ColumnsType<BuildTenDurationItem> = [
    {
      title: '流水线 / 工作流',
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      render: (v) => <Text strong>{v || '-'}</Text>,
    },
    {
      title: '任务 ID',
      dataIndex: 'taskID',
      key: 'taskID',
      render: (v) => <Tag color="blue">#{v}</Tag>,
    },
    {
      title: '执行耗时',
      dataIndex: 'duration',
      key: 'duration',
      sorter: (a, b) => a.duration - b.duration,
      render: (v) => {
        const sec = Number(v) || 0;
        return (
          <Space orientation="horizontal" size={4}>
            <ClockCircleOutlined style={{ color: sec > 300 ? '#ff4d4f' : '#faad14' }} />
            <Text>{sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`}</Text>
          </Space>
        );
      },
    },
    {
      title: '执行状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => (
        <Tag color={v === 'passed' || v === 'success' ? 'success' : v === 'failed' ? 'error' : 'default'}>
          {v || 'unknown'}
        </Tag>
      ),
    },
    {
      title: '触发人',
      dataIndex: 'taskCreator',
      key: 'taskCreator',
      render: (v) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      render: (v) => (v ? new Date(v * 1000).toLocaleString('zh-CN', { hour12: false }) : '-'),
    },
  ];

  const rollbackColumns: ColumnsType<RollbackStatItem> = [
    {
      title: '环境',
      dataIndex: 'env_name',
      key: 'env_name',
      render: (v) => <Tag color="geekblue">{v || '-'}</Tag>,
    },
    {
      title: '服务名称',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (v) => <Text strong>{v || '-'}</Text>,
    },
    {
      title: '回滚时间',
      dataIndex: 'rollback_time',
      key: 'rollback_time',
      render: (v) => (v ? new Date(v * 1000).toLocaleString('zh-CN', { hour12: false }) : '-'),
    },
    {
      title: '操作人',
      dataIndex: 'rollback_by',
      key: 'rollback_by',
      render: (v) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '镜像变更 (回滚前 → 回滚后)',
      key: 'image_change',
      render: (_, r) => {
        const before = r.rollback_before_image_tag?.map((img) => `${img.name}:${img.tag}`).join(', ');
        const after = r.rollback_after_image_tag?.map((img) => `${img.name}:${img.tag}`).join(', ');
        return (
          <Space orientation="vertical" size={2}>
            <Text type="secondary" ellipsis style={{ maxWidth: 280, fontSize: 12 }}>
              前: {before || '-'}
            </Text>
            <Text copyable ellipsis style={{ maxWidth: 280, fontSize: 12, color: '#1677ff' }}>
              后: {after || '-'}
            </Text>
          </Space>
        );
      },
    },
  ];

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
      const overallAvg =
        buildAverageData.length > 0
          ? Math.round(
              buildAverageData.reduce((acc, curr) => acc + curr.averageDuration, 0) / buildAverageData.length
            )
          : 0;

      return (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="构建任务总数" value={buildData.total || 0} prefix={<ThunderboltOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
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
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="构建失败数"
                  value={(buildData.total || 0) - (buildData.success || 0)}
                  styles={{ content: { color: (buildData.total || 0) - (buildData.success || 0) > 0 ? '#cf1322' : undefined } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="周期平均耗时"
                  value={overallAvg}
                  suffix="秒"
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
          </Row>

          <Card
            variant="borderless"
            title="构建度量图表与明细"
            extra={
              <Radio.Group
                value={activeBuildTab}
                onChange={(e) => setActiveBuildTab(e.target.value)}
                size="small"
              >
                <Radio.Button value="trend">执行频次趋势</Radio.Button>
                <Radio.Button value="average">
                  <FieldTimeOutlined style={{ marginRight: 4 }} />
                  平均时长趋势
                </Radio.Button>
                <Radio.Button value="topTen">
                  <TrophyOutlined style={{ marginRight: 4 }} />
                  Top 10 耗时任务
                </Radio.Button>
              </Radio.Group>
            }
            style={{ borderRadius: 8, marginTop: 16 }}
          >
            {activeBuildTab === 'trend' && (
              points.length > 0 ? (
                <div style={{ height: 320 }}>
                  <Line {...lineConfig(points)} />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构建趋势数据" />
              )
            )}

            {activeBuildTab === 'average' && (
              buildAverageData.length > 0 ? (
                <div style={{ height: 320 }}>
                  <Line {...durationLineConfig(buildAverageData, '平均构建耗时 (秒)')} />
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构建平均耗时数据" />
              )
            )}

            {activeBuildTab === 'topTen' && (
              <Table
                dataSource={buildTenDurationData}
                columns={topTenColumns}
                rowKey={(r) => `${r.pipelineName}-${r.taskID}`}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                size="small"
                locale={{
                  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Top 10 耗时构建记录" />,
                }}
              />
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
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="部署任务总数" value={deployData.total || 0} prefix={<RocketOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic title="发布版本总数" value={releaseData.total || 0} />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="平均发布耗时 (秒)"
                  value={Number(releaseData.average_duration || 0).toFixed(1)}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card variant="borderless" style={{ borderRadius: 8 }}>
                <Statistic
                  title="环境回滚事件"
                  value={rollbackStatData.length}
                  prefix={<RollbackOutlined style={{ color: rollbackStatData.length > 0 ? '#ff4d4f' : '#52c41a' }} />}
                  styles={{ content: { color: rollbackStatData.length > 0 ? '#cf1322' : undefined } }}
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

          <Card
            variant="borderless"
            title="环境服务回滚统计明细"
            style={{ borderRadius: 8, marginTop: 16 }}
            extra={<Tag color="blue">{rollbackStatData.length} 条回滚记录</Tag>}
          >
            <Table
              dataSource={rollbackStatData}
              columns={rollbackColumns}
              rowKey={(r, i) => `${r.env_name}-${r.service_name}-${r.rollback_time}-${i}`}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无回滚记录" />,
              }}
            />
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
      const testTotal = (testHealthData.totalSuccess || 0) + (testHealthData.totalFailure || 0);
      const testPassRate = testTotal > 0 ? Math.round(((testHealthData.totalSuccess || 0) / testTotal) * 100) : 100;

      return (
        <>
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
                  title="测试通过率"
                  value={testPassRate}
                  suffix="%"
                  styles={{ content: { color: testPassRate >= 80 ? '#52c41a' : '#cf1322' } }}
                  prefix={<CheckCircleOutlined style={{ color: testPassRate >= 80 ? '#52c41a' : '#cf1322' }} />}
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

          <Card variant="borderless" title="测试执行平均时长趋势" style={{ borderRadius: 8, marginTop: 16 }}>
            {testAverageData.length > 0 ? (
              <div style={{ height: 320 }}>
                <Line {...durationLineConfig(testAverageData, '测试平均时长 (秒)')} />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测试平均耗时趋势数据" />
            )}
          </Card>
        </>
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
              <Statistic
                title="回滚事件数"
                value={rollbackStatData.length}
                styles={{ content: { color: rollbackStatData.length > 0 ? '#cf1322' : undefined } }}
              />
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
