import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Radio,
} from 'antd';
import {
  LineChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/plots';
import { useProjectStore } from '../../stores/project';

const { Title, Text } = Typography;

export const InsightsPage: React.FC = () => {
  const { currentProject } = useProjectStore();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Trend data for Line Chart
  const trendData = [
    { date: '09-13', count: 12, category: '构建任务' },
    { date: '09-13', count: 8, category: '部署发布' },
    { date: '09-14', count: 18, category: '构建任务' },
    { date: '09-14', count: 14, category: '部署发布' },
    { date: '09-15', count: 15, category: '构建任务' },
    { date: '09-15', count: 11, category: '部署发布' },
    { date: '09-16', count: 24, category: '构建任务' },
    { date: '09-16', count: 19, category: '部署发布' },
    { date: '09-17', count: 20, category: '构建任务' },
    { date: '09-17', count: 17, category: '部署发布' },
    { date: '09-18', count: 28, category: '构建任务' },
    { date: '09-18', count: 23, category: '部署发布' },
    { date: '09-19', count: 22, category: '构建任务' },
    { date: '09-19', count: 18, category: '部署发布' },
  ];

  // Success rate data for Pie Chart
  const successRateData = [
    { type: '构建成功', value: 135 },
    { type: '部署成功', value: 104 },
    { type: '测试通过', value: 89 },
    { type: '执行失败', value: 11 },
  ];

  // Duration distribution data for Column Chart
  const durationData = [
    { service: 'auth-api', duration: 45, stage: '编译构建' },
    { service: 'auth-api', duration: 25, stage: '容器部署' },
    { service: 'gateway', duration: 32, stage: '编译构建' },
    { service: 'gateway', duration: 18, stage: '容器部署' },
    { service: 'order-svc', duration: 58, stage: '编译构建' },
    { service: 'order-svc', duration: 35, stage: '容器部署' },
    { service: 'frontend', duration: 28, stage: '编译构建' },
    { service: 'frontend', duration: 15, stage: '容器部署' },
  ];

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
    xField: 'service',
    yField: 'duration',
    colorField: 'stage',
    group: true,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  当前项目: <strong>{currentProject || '全局'}</strong>
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space orientation="horizontal">
              <Radio.Group
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                size="middle"
              >
                <Radio.Button value="7d">近 7 天</Radio.Button>
                <Radio.Button value="30d">近 30 天</Radio.Button>
                <Radio.Button value="90d">近 90 天</Radio.Button>
              </Radio.Group>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="交付成功率"
              value={96.8}
              precision={1}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix="%"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              较上周期提升 +1.2%
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="平均构建时长"
              value={38}
              prefix={<ClockCircleOutlined style={{ color: '#0066ff' }} />}
              suffix="秒"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              缓存命中率 82%
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="日均交付频次"
              value={24.5}
              precision={1}
              prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
              suffix="次/天"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              高频持续交付达标
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="活跃微服务数"
              value={4}
              prefix={<DeploymentUnitOutlined style={{ color: '#13c2c2' }} />}
              suffix="个"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              全链路健康正常
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Charts Grid */}
      <Row gutter={[16, 16]}>
        {/* Trend Line Chart */}
        <Col xs={24} lg={16}>
          <Card
            variant="borderless"
            title="每日构建与部署交付频次趋势"
            style={{ borderRadius: 8 }}
          >
            <div style={{ height: 320 }}>
              <Line {...lineConfig} />
            </div>
          </Card>
        </Col>

        {/* Success Rate Pie Chart */}
        <Col xs={24} lg={8}>
          <Card
            variant="borderless"
            title="任务执行状态占比"
            style={{ borderRadius: 8 }}
          >
            <div style={{ height: 320 }}>
              <Pie {...pieConfig} />
            </div>
          </Card>
        </Col>

        {/* Duration Column Chart */}
        <Col xs={24}>
          <Card
            variant="borderless"
            title="重点服务各阶段执行耗时对比 (秒)"
            style={{ borderRadius: 8 }}
          >
            <div style={{ height: 300 }}>
              <Column {...columnConfig} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InsightsPage;
