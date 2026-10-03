import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Button, Space, Input, Tag, Row, Col, Statistic, Empty, Spin, Modal, Form, Select, Drawer, Descriptions, Radio, Timeline } from 'antd';
import { Line } from '@ant-design/plots';
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  PlusOutlined,
  FieldTimeOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

const { Title, Text } = Typography;

export interface TestItem {
  name: string;
  desc?: string;
  product_name?: string;
  test_type?: string;
  updated_by?: string;
  update_time?: number;
}

export const QualityCenterPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName?: string }>();

  // Extract test name and task id from routes
  const match = location.pathname.match(/\/test\/(?:detail\/)?(?:function\/)?([^/]+)(?:\/([^/]+))?/);
  const routeTestName = match?.[1];
  const routeTaskId = match?.[2];

  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [stats, setStats] = useState<{ total?: number; success?: number; pass_rate?: number; avg_duration?: number }>({
    total: 0,
    success: 0,
    pass_rate: undefined,
    avg_duration: undefined,
  });

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  // 构建质量效能（对齐旧版质量监控 /api/aslan/stat/quality/*）
  const [buildRange, setBuildRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildHealth, setBuildHealth] = useState<{ totalSuccess: number; totalFailure: number }>({ totalSuccess: 0, totalFailure: 0 });
  const [buildDaily, setBuildDaily] = useState<Array<{ date: string; averageDuration: number }>>([]);
  const [latestTen, setLatestTen] = useState<Array<{ name?: string; productName?: string; duration: number; status: string; taskCreator?: string; createTime?: number }>>([]);

  const fetchBuildQuality = useCallback(async () => {
    if (!projectName) return;
    setBuildLoading(true);
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    const body = { startDate: start, endDate: end, productNames: projectName ? [projectName] : [] };
    try {
      const [healthRes, dailyRes, tenRes] = await Promise.allSettled([
        http.post<{ totalSuccess: number; totalFailure: number }>('/api/aslan/stat/quality/buildHealthMeasure', body, { skipErrorHandler: true }),
        http.post<Array<{ date: string; averageDuration: number }>>('/api/aslan/stat/quality/buildDailyMeasure', body, { skipErrorHandler: true }),
        http.post<Array<{ name?: string; productName?: string; duration: number; status: string; taskCreator?: string; createTime?: number }>>('/api/aslan/stat/quality/buildLatestTenMeasure', body, { skipErrorHandler: true }),
      ]);
      setBuildHealth(healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : { totalSuccess: 0, totalFailure: 0 });
      setBuildDaily(dailyRes.status === 'fulfilled' && Array.isArray(dailyRes.value) ? dailyRes.value : []);
      setLatestTen(tenRes.status === 'fulfilled' && Array.isArray(tenRes.value) ? tenRes.value : []);
    } finally {
      setBuildLoading(false);
    }
  }, [projectName, buildRange]);

  // 部署与回滚质量（stat/v2/quality/deploy|rollback，GET 查询形式）
  const [deployHealth, setDeployHealth] = useState<{ success: number; failure: number }>({ success: 0, failure: 0 });
  const [topDeployed, setTopDeployed] = useState<Array<{ service_name: string; env_name: string; count: number; success: number; failed: number }>>([]);
  const [rollbackTotal, setRollbackTotal] = useState<number>(0);
  const [deployMonthly, setDeployMonthly] = useState<Array<{ date: string; success: number; rollback: number; failed: number; timeout: number }>>([]);
  // 测试健康趋势（stat/v2/quality/test/dailyHealthTrend）
  const [testTrend, setTestTrend] = useState<Array<{ date: string; totalSuccess: number; totalFailure: number; successRate: number }>>([]);

  const fetchDeployRollbackQuality = useCallback(async () => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    const rangeQ = `startDate=${start}&endDate=${end}`;
    try {
      const [healthRes, topRes, rbRes, mtRes] = await Promise.allSettled([
        http.get<{ success: number; failure: number }>(
          `/api/aslan/stat/v2/quality/deploy/health?${rangeQ}`, { skipErrorHandler: true }
        ),
        http.get<Array<{ service_name: string; env_name: string; count: number; success: number; failed: number }>>(
          `/api/aslan/stat/v2/quality/deploy/service/top?${rangeQ}&top=5`, { skipErrorHandler: true }
        ),
        http.get<{ total: number }>(`/api/aslan/stat/v2/quality/rollback/total?${rangeQ}`, { skipErrorHandler: true }),
        http.get<Array<{ date: string; success: number; rollback: number; failed: number; timeout: number }>>(
          `/api/aslan/stat/v2/quality/deploy/trend/monthly?${rangeQ}`, { skipErrorHandler: true }
        ),
      ]);
      setDeployHealth(healthRes.status === 'fulfilled' && healthRes.value ? healthRes.value : { success: 0, failure: 0 });
      setTopDeployed(topRes.status === 'fulfilled' && Array.isArray(topRes.value) ? topRes.value : []);
      setRollbackTotal(rbRes.status === 'fulfilled' && rbRes.value ? Number(rbRes.value.total) || 0 : 0);
      setDeployMonthly(mtRes.status === 'fulfilled' && Array.isArray(mtRes.value) ? mtRes.value : []);
    } catch {
      setDeployHealth({ success: 0, failure: 0 });
      setTopDeployed([]);
      setRollbackTotal(0);
      setDeployMonthly([]);
    }
  }, [buildRange]);

  const fetchTestTrend = useCallback(async () => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - (buildRange === '7d' ? 7 : buildRange === '30d' ? 30 : 90) * 86400;
    try {
      const res = await http.post<Array<{ date: string; totalSuccess: number; totalFailure: number; successRate: number }>>(
        '/api/aslan/stat/v2/quality/test/dailyHealthTrend',
        { start_time: start, end_time: end, projects: projectName ? [projectName] : [] },
        { skipErrorHandler: true }
      );
      setTestTrend(Array.isArray(res) ? res : []);
    } catch {
      setTestTrend([]);
    }
  }, [projectName, buildRange]);

  // 测试详情抽屉（配置 + 任务历史）
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTest, setDetailTest] = useState<TestItem | null>(null);
  const [testTasks, setTestTasks] = useState<Array<Record<string, unknown>>>([]);

  const openTestDetail = useCallback(async (test: TestItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTest(test);
    setTestTasks([]);
    try {
      const res = await http.get<TestItem>(`/api/aslan/testing/test/${encodeURIComponent(test.name)}`, {
        skipErrorHandler: true,
      });
      if (res) setDetailTest({ ...test, ...res });
    } catch {
      // 保留列表数据
    }
    try {
      const res = await http.get<Array<Record<string, unknown>>>(
        `/api/aslan/testing/testtask?projectName=${encodeURIComponent(test.product_name || '')}&testName=${encodeURIComponent(test.name)}&pageSize=10&pageNum=1`,
        { skipErrorHandler: true }
      );
      setTestTasks(Array.isArray(res) ? res : []);
    } catch {
      setTestTasks([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ---------- 测试任务详情 / 事件 / JUnit 报告 / 重启 ----------
  // 契约：GET /testing/testtask/{detail,events,report}?projectName=&testName=&taskID=
  //      POST /testing/testtask/restart?projectName=&testName=&taskID=
  //      HTML 报告: GET /testing/report/html/testing/:project/:test/:taskID/*path（workflowv4: /testing/report/html/workflowv4/:project/:workflow/:job/:taskID/*path）
  interface JUnitCase {
    tc_name: string;
    classname?: string;
    time?: number;
    failure?: { message?: string; _content?: string } | null;
    skipped?: { message?: string } | null;
    error?: { message?: string; _content?: string } | null;
    system_out?: string;
  }
  interface JUnitSuite {
    name: string;
    tests: number;
    failures: number;
    successes?: number;
    skips?: number;
    errors?: number;
    time: number;
    testcase?: JUnitCase[];
  }
  const [taskDetail, setTaskDetail] = useState<Record<string, unknown> | null>(null);
  const [taskEvents, setTaskEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [junitSuites, setJunitSuites] = useState<JUnitSuite[]>([]);
  const [reportTask, setReportTask] = useState<{ taskId: number | string; name: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const openTaskReport = useCallback(
    async (task: Record<string, unknown>) => {
      const taskId = String(task.task_id ?? task.id ?? '');
      if (!detailTest || !taskId) return;
      const projectNameForTask = detailTest.product_name || projectName || '';
      setReportTask({ taskId, name: detailTest.name });
      setReportLoading(true);
      setTaskDetail(null);
      setTaskEvents([]);
      setJunitSuites([]);
      const base = `/api/aslan/testing/testtask`;
      const qs = `projectName=${encodeURIComponent(projectNameForTask)}&testName=${encodeURIComponent(detailTest.name)}&taskID=${taskId}`;
      const [detail, events, report] = await Promise.all([
        http.get<Record<string, unknown>>(`${base}/detail?${qs}`, { skipErrorHandler: true }).catch(() => null),
        http.get<Array<{ event_type: string; time: string; message: string }>>(`${base}/events?${qs}`, { skipErrorHandler: true }).catch(() => []),
        http.get<JUnitSuite[]>(`${base}/report?${qs}`, { skipErrorHandler: true }).catch(() => []),
      ]);
      setTaskDetail(detail && typeof detail === 'object' ? detail : null);
      setTaskEvents(Array.isArray(events) ? events : []);
      setJunitSuites(Array.isArray(report) ? report : []);
      setReportLoading(false);
    },
    [detailTest, projectName]
  );

  const handleRestartTask = useCallback(
    async (task: Record<string, unknown>) => {
      if (!detailTest) return;
      const taskId = String(task.task_id ?? task.id ?? '');
      try {
        await http.post(
          `/api/aslan/testing/testtask/restart?projectName=${encodeURIComponent(detailTest.product_name || projectName || '')}&testName=${encodeURIComponent(detailTest.name)}&taskID=${taskId}`,
          {},
          { skipErrorHandler: true }
        );
        feedback.message.success(`测试任务 #${taskId} 已重新入队`);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.message || '重启失败';
        feedback.message.error(msg);
      }
    },
    [detailTest, projectName]
  );

  // 测试任务产物（GET /testing/testtask/artifact?projectName=&testName=&jobName=&taskID= → 二进制）
  const handleDownloadTestArtifact = useCallback(
    async (task: Record<string, unknown>) => {
      if (!detailTest) return;
      const taskId = String(task.task_id ?? task.id ?? '');
      try {
        const res = await http.get(
          `/api/aslan/testing/testtask/artifact?projectName=${encodeURIComponent(detailTest.product_name || projectName || '')}&testName=${encodeURIComponent(detailTest.name)}&jobName=${encodeURIComponent(detailTest.name.toLowerCase().slice(0, 32))}&taskID=${taskId}`,
          { skipErrorHandler: true, responseType: 'blob' }
        );
        const blob = res instanceof Blob ? res : new Blob([res as BlobPart], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-${detailTest.name}-${taskId}.tar.gz`;
        a.click();
        URL.revokeObjectURL(url);
        feedback.message.success('产物已下载');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description || '产物下载失败（任务可能未配置归档步骤）';
        feedback.message.error(msg);
      }
    },
    [detailTest, projectName]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [testsRes, statRes] = await Promise.all([
        http.get<TestItem[]>('/api/aslan/testing/test'),
        http.get<{ total?: number; success?: number; pass_rate?: number; avg_duration?: number }>(
          '/api/aslan/stat/v2/quality/test/count',
          { skipErrorHandler: true }
        ),
      ]);
      const list = Array.isArray(testsRes) ? testsRes : [];
      setTests(list);
      if (statRes && typeof statRes === 'object') {
        setStats(statRes);
      }
    } catch (err: unknown) {
      setTests([]);
      const msg = err instanceof Error ? err.message : '获取测试用例列表失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchBuildQuality();
    fetchDeployRollbackQuality();
    fetchTestTrend();
  }, [fetchBuildQuality, fetchDeployRollbackQuality, fetchTestTrend]);

  useEffect(() => {
    if (routeTestName && tests.length > 0) {
      const found = tests.find((t) => t.name === routeTestName);
      if (found) {
        openTestDetail(found);
      } else {
        openTestDetail({ name: routeTestName, product_name: projectName });
      }
    }
  }, [routeTestName, tests, openTestDetail, projectName]);

  const handleRunTest = async (record: TestItem) => {
    feedback.message.loading(`正在对 [${record.name}] 触发自动化测试任务...`, 1);
    try {
      await http.post('/api/aslan/testing/testtask', {
        product_name: record.product_name,
        test_name: record.name,
      });
      feedback.message.success(`自动化测试任务 [${record.name}] 已成功触发！`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '触发测试任务失败，请检查测试配置';
      feedback.message.error(msg);
    }
  };

  const handleCreateTest = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await http.post('/api/aslan/testing/test', {
        name: values.name,
        desc: values.desc,
        product_name: values.product_name,
        test_type: values.test_type || 'function',
      });
      feedback.message.success(`测试模块 [${values.name}] 创建成功！`);
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建测试模块失败';
      feedback.message.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const filteredTests = tests.filter((t) => {
    if (!searchText) return true;
    return (
      (t.name && t.name.toLowerCase().includes(searchText.toLowerCase())) ||
      (t.product_name && t.product_name.toLowerCase().includes(searchText.toLowerCase()))
    );
  });

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            质量中心
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            集成服务级别单元测试、端到端自动化功能测试及全量回归质检看板
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索测试名称 / 所属项目"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={() => {
              form.resetFields();
              setCreateModalVisible(true);
            }}
          >
            新建测试
          </Button>
        </Space>
      </div>

      {/* Quality Statistics Metric Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="测试用例与任务总数"
              value={stats.total || tests.length}
              prefix={<BarChartOutlined style={{ color: '#0066ff' }} />}
              styles={{ content: { fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="最近执行成功率"
              value={tests.length > 0 && stats.pass_rate !== undefined ? `${stats.pass_rate}%` : (tests.length > 0 ? '100%' : '-')}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8, border: '1px solid #ebeef5' }}>
            <Statistic
              title="平均质检耗时"
              value={tests.length > 0 && stats.avg_duration ? `${stats.avg_duration} 秒` : '-'}
              prefix={<FieldTimeOutlined style={{ color: '#faad14' }} />}
              styles={{ content: { fontWeight: 600 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Build Quality Charts (对齐旧版质量监控 /api/aslan/stat/quality/*) */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title="构建质量效能"
        extra={
          <Space size={8}>
            <Radio.Group value={buildRange} onChange={(e) => setBuildRange(e.target.value)} size="small">
              <Radio.Button value="7d">近 7 天</Radio.Button>
              <Radio.Button value="30d">近 30 天</Radio.Button>
              <Radio.Button value="90d">近 90 天</Radio.Button>
            </Radio.Group>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchBuildQuality} loading={buildLoading} />
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic title="构建成功次数" value={buildHealth.totalSuccess} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="构建失败次数" value={buildHealth.totalFailure} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="构建健康度"
              value={buildHealth.totalSuccess + buildHealth.totalFailure > 0
                ? `${Math.round((buildHealth.totalSuccess / (buildHealth.totalSuccess + buildHealth.totalFailure)) * 100)}%`
                : '-'}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Col>
        </Row>
        {buildDaily.length > 0 ? (
          <Line
            data={buildDaily.map((d) => ({ date: (d.date || '').slice(5), duration: d.averageDuration }))}
            xField="date"
            yField="duration"
            style={{ lineWidth: 2 }}
            point={{ shapeField: 'circle', sizeField: 3 }}
            height={260}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无构建质量数据`} />
        )}
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>测试健康趋势 (成功率 %)</Text>
        </div>
        {testTrend.length > 0 ? (
          <Line
            data={testTrend.map((d) => ({ date: (d.date || '').slice(5), successRate: d.successRate }))}
            xField="date"
            yField="successRate"
            yAxis={{ min: 0, max: 100 }}
            style={{ lineWidth: 2 }}
            point={{ shapeField: 'circle', sizeField: 3 }}
            height={220}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${buildRange === '7d' ? '近 7 天' : buildRange === '30d' ? '近 30 天' : '近 90 天'}暂无测试趋势数据`} />
        )}
      </Card>

      {/* Latest Ten Builds */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title="最近构建记录"
      >
        {latestTen.length > 0 ? (
          <Table
            dataSource={latestTen}
            rowKey={(r, i) => `${r.productName}-${r.createTime}-${i}`}
            pagination={false}
            size="small"
            columns={[
              { title: '所属项目', dataIndex: 'productName', key: 'productName', render: (p) => <Tag color="blue">{String(p || '-')}</Tag> },
              { title: '耗时', dataIndex: 'duration', key: 'duration', render: (d) => <Text type="secondary">{d ? `${d} 秒` : '-'}</Text> },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (s) => {
                  const map: Record<string, { color: string; text: string }> = {
                    passed: { color: 'success', text: '成功' },
                    failed: { color: 'error', text: '失败' },
                    running: { color: 'processing', text: '执行中' },
                  };
                  const m = map[String(s)] || { color: 'default', text: String(s || '未知') };
                  return <Tag color={m.color}>{m.text}</Tag>;
                },
              },
              { title: '触发人', dataIndex: 'taskCreator', key: 'taskCreator', render: (c) => <Text type="secondary">{String(c || '-')}</Text> },
              {
                title: '创建时间',
                dataIndex: 'createTime',
                key: 'createTime',
                render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构建记录" />
        )}
      </Card>

      {/* Deploy & Rollback Quality (stat/v2/quality/deploy|rollback) */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5', marginBottom: 20 }}
        title="部署与回滚质量"
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchDeployRollbackQuality}>
            刷新
          </Button>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic title="部署成功次数" value={deployHealth.success} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="部署失败次数" value={deployHealth.failure} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="回滚总次数" value={rollbackTotal} />
          </Col>
        </Row>
        <Table
          dataSource={topDeployed}
          rowKey={(r) => `${r.service_name}-${r.env_name}`}
          pagination={false}
          size="small"
          columns={[
            { title: '服务', dataIndex: 'service_name', key: 'service_name', render: (n) => <Text strong>{String(n)}</Text> },
            { title: '环境', dataIndex: 'env_name', key: 'env_name', render: (e) => <Tag color="geekblue">{String(e || '-')}</Tag> },
            { title: '部署次数', dataIndex: 'count', key: 'count', render: (c) => <Tag color="blue">{String(c ?? 0)}</Tag> },
            { title: '成功', dataIndex: 'success', key: 'success', render: (s) => <Text type="secondary">{String(s ?? 0)}</Text> },
            { title: '失败', dataIndex: 'failed', key: 'failed', render: (f) => <Text type="secondary">{String(f ?? 0)}</Text> },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该时间范围暂无部署记录" /> }}
        />
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>部署月度趋势</Text>
        </div>
        {topDeployed.length > 0 || deployMonthly.length > 0 ? (
          <Table
            dataSource={deployMonthly}
            rowKey={(r, i) => `${r.date}-${i}`}
            pagination={false}
            size="small"
            columns={[
              { title: '月份', dataIndex: 'date', key: 'date', render: (d) => <Text strong>{String(d || '-')}</Text> },
              { title: '成功', dataIndex: 'success', key: 'success', render: (s) => <Tag color="success">{String(s ?? 0)}</Tag> },
              { title: '失败', dataIndex: 'failed', key: 'failed', render: (f) => <Tag color={Number(f) > 0 ? 'error' : 'default'}>{String(f ?? 0)}</Tag> },
              { title: '回滚', dataIndex: 'rollback', key: 'rollback', render: (r) => <Tag color={Number(r) > 0 ? 'volcano' : 'default'}>{String(r ?? 0)}</Tag> },
              { title: '超时', dataIndex: 'timeout', key: 'timeout', render: (t) => <Text type="secondary">{String(t ?? 0)}</Text> },
            ]}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度部署数据" /> }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无月度部署趋势数据" />
        )}
      </Card>

      {/* Main Table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 15, color: '#1f2d3d' }}>
          自动化测试套件列表 ({filteredTests.length})
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={filteredTests}
            columns={[
              {
                title: '测试名称',
                dataIndex: 'name',
                key: 'name',
                render: (name, record) => (
                  <Button
                    type="link"
                    style={{ padding: 0, fontWeight: 600 }}
                    onClick={() => openTestDetail(record)}
                  >
                    {name}
                  </Button>
                ),
              },
              {
                title: '归属项目',
                dataIndex: 'product_name',
                key: 'product_name',
                render: (p) => (p ? <Tag color="blue">{p}</Tag> : '-'),
              },
              {
                title: '测试类型',
                dataIndex: 'test_type',
                key: 'test_type',
                render: (t) => <Tag color="geekblue">{t || '功能测试'}</Tag>,
              },
              {
                title: '描述',
                dataIndex: 'desc',
                key: 'desc',
                render: (d) => d || '无描述',
              },
              {
                title: '最近修改人',
                dataIndex: 'updated_by',
                key: 'updated_by',
                render: (u) => u || '-',
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Space orientation="horizontal" size={8}>
                    <Button
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleRunTest(record)}
                    >
                      执行测试
                    </Button>
                  </Space>
                ),
              },
            ]}
            locale={{
              emptyText: (
                <Empty description="暂无自动化测试配置，请点击右上角新建测试" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.resetFields();
                      setCreateModalVisible(true);
                    }}
                  >
                    新建测试
                  </Button>
                </Empty>
              ),
            }}
          />
        )}
      </Card>

      {/* Create Test Modal */}
      <Modal
        title="新建自动化测试套件"
        open={createModalVisible}
        confirmLoading={creating}
        onOk={handleCreateTest}
        onCancel={() => setCreateModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ test_type: 'function' }} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="测试用例名称"
            rules={[{ required: true, message: '请输入测试名称' }]}
          >
            <Input placeholder="例如: api-regression-test" />
          </Form.Item>
          <Form.Item
            name="product_name"
            label="归属项目名称"
            rules={[{ required: true, message: '请输入归属项目' }]}
          >
            <Input placeholder="例如: default 或项目英文标识" />
          </Form.Item>
          <Form.Item name="test_type" label="测试类型">
            <Select
              options={[
                { label: '功能自动化测试 (function)', value: 'function' },
                { label: '集成接口测试 (integration)', value: 'integration' },
                { label: '性能基准测试 (performance)', value: 'performance' },
              ]}
            />
          </Form.Item>
          <Form.Item name="desc" label="用例描述">
            <Input.TextArea rows={3} placeholder="测试范围、用例套件说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Detail Drawer: 配置 + 任务历史 (test/function/:test_name 对齐) */}
      <Drawer
        title={`测试详情: ${detailTest?.name || ''}`}
        placement="right"
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTest(null);
          if (routeTestName) {
            navigate(projectName ? `/v1/projects/detail/${projectName}/test` : '/v1/tests');
          }
        }}
        size="large"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailTest ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="测试类型">
                <Tag color="geekblue">{detailTest.test_type || '功能测试'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{detailTest.product_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{detailTest.desc || '-'}</Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {detailTest.update_time
                  ? `${new Date(detailTest.update_time * 1000).toLocaleString()} · ${detailTest.updated_by || '-'}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              测试任务历史
            </Title>
            <Table
              dataSource={testTasks}
              rowKey={(r) => String(r.task_id || r.id || Math.random())}
              rowClassName={(record) => (routeTaskId && String(record.task_id ?? record.id) === routeTaskId ? 'ant-table-row-selected' : '')}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              columns={[
                {
                  title: '任务 ID',
                  key: 'task_id',
                  render: (_, r) => <Text code>{String(r.task_id ?? r.id ?? '-')}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => {
                    const map: Record<string, 'success' | 'processing' | 'error' | 'default'> = {
                      passed: 'success',
                      failed: 'error',
                      running: 'processing',
                      timeout: 'error',
                    };
                    return <Tag color={map[String(s)] === 'success' ? 'success' : map[String(s)] === 'error' ? 'error' : map[String(s)] === 'processing' ? 'processing' : 'default'}>{String(s || '未知')}</Tag>;
                  },
                },
                {
                  title: '触发人',
                  dataIndex: 'task_creator',
                  key: 'task_creator',
                  render: (c) => <Text type="secondary">{String(c || '-')}</Text>,
                },
                {
                  title: '创建时间',
                  dataIndex: 'create_time',
                  key: 'create_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
                },
                {
                  title: '耗时',
                  dataIndex: 'duration',
                  key: 'duration',
                  render: (_, r) => {
                    const start = r.start_time as number | undefined;
                    const end = r.end_time as number | undefined;
                    if (start && end) return `${end - start}s`;
                    const d = r.duration as number | undefined;
                    return d ? `${d}s` : '-';
                  },
                },
              {
                  title: '操作',
                  key: 'actions',
                  render: (_, r) => (
                    <Space size={0}>
                      <Button type="link" size="small" onClick={() => openTaskReport(r)}>
                        详情/报告
                      </Button>
                      <Button type="link" size="small" onClick={() => handleRestartTask(r)}>
                        重启
                      </Button>
                      <Button type="link" size="small" onClick={() => handleDownloadTestArtifact(r)}>
                        产物
                      </Button>
                    </Space>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测试任务记录" />,
              }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到测试详情" />
        )}
      </Drawer>

      {/* 测试任务详情 / JUnit 报告 (对齐旧版测试报告页) */}
      <Drawer
        title={`任务详情: ${reportTask?.name || ''} #${reportTask?.taskId ?? ''}`}
        placement="right"
        open={!!reportTask}
        onClose={() => setReportTask(null)}
        size="large"
        extra={
          reportTask && detailTest ? (
            <Button
              size="small"
              onClick={() =>
                window.open(
                  `/api/aslan/testing/report/html/testing/${encodeURIComponent(detailTest.product_name || projectName || '')}/${encodeURIComponent(reportTask.name)}/${reportTask.taskId}/`,
                  '_blank'
                )
              }
            >
              打开 HTML 报告
            </Button>
          ) : null
        }
      >
        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 任务概览 */}
            {taskDetail && (
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="状态">
                  <Tag color={String(taskDetail.status) === 'passed' ? 'success' : String(taskDetail.status) === 'failed' ? 'error' : 'processing'}>
                    {String(taskDetail.status || '-')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="触发人">{String(taskDetail.task_creator || '-')}</Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {taskDetail.start_time ? new Date(Number(taskDetail.start_time) * 1000).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="结束时间">
                  {taskDetail.end_time ? new Date(Number(taskDetail.end_time) * 1000).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* JUnit 测试报告 */}
            <Card size="small" title="JUnit 测试报告">
              {junitSuites.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {junitSuites.map((suite, i) => {
                    const total = suite.tests || 0;
                    const failed = (suite.failures || 0) + (suite.errors || 0);
                    return (
                      <div key={suite.name || i} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
                        <Space wrap style={{ marginBottom: 8 }}>
                          <Text strong>{suite.name || '默认套件'}</Text>
                          <Tag color="blue">总数 {total}</Tag>
                          <Tag color="success">成功 {suite.successes ?? total - failed - (suite.skips || 0)}</Tag>
                          <Tag color="error">失败 {suite.failures || 0}</Tag>
                          <Tag color="warning">错误 {suite.errors || 0}</Tag>
                          <Tag color="default">跳过 {suite.skips || 0}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>耗时 {suite.time ?? 0}s</Text>
                        </Space>
                        <Table
                          rowKey={(c) => c.tc_name}
                          dataSource={suite.testcase || []}
                          pagination={false}
                          size="small"
                          columns={[
                            {
                              title: '用例',
                              dataIndex: 'tc_name',
                              render: (n: string) => <Text code>{n}</Text>,
                            },
                            {
                              title: '结果',
                              key: 'result',
                              width: 90,
                              render: (_, c: JUnitCase) =>
                                c.failure ? (
                                  <Tag color="error">失败</Tag>
                                ) : c.error ? (
                                  <Tag color="error">错误</Tag>
                                ) : c.skipped ? (
                                  <Tag color="default">跳过</Tag>
                                ) : (
                                  <Tag color="success">通过</Tag>
                                ),
                            },
                            {
                              title: '耗时 (s)',
                              dataIndex: 'time',
                              width: 90,
                              render: (t: number) => Number(t ?? 0).toFixed(2),
                            },
                            {
                              title: '失败信息',
                              key: 'failure',
                              render: (_, c: JUnitCase) =>
                                c.failure?.message || c.error?.message ? (
                                  <Text type="danger" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                                    {c.failure?.message || c.error?.message}
                                  </Text>
                                ) : c.system_out ? (
                                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{c.system_out}</Text>
                                ) : (
                                  '-'
                                ),
                            },
                          ]}
                          locale={{
                            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该套件无用例数据" />,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 JUnit 报告数据（任务可能未完成或未产出报告）" />
              )}
            </Card>

            {/* 任务事件 */}
            <Card size="small" title="任务事件">
              {taskEvents.length > 0 ? (
                <Timeline
                  items={taskEvents.map((e, i) => ({
                    key: i,
                    color: e.event_type === 'error' ? 'red' : e.event_type === 'warning' ? 'orange' : 'blue',
                    children: (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{e.time}</Text>
                        <div style={{ fontSize: 13 }}>{e.message}</div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务事件" />
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default QualityCenterPage;
