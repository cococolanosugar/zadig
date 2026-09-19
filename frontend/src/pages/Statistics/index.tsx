import React from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Table,
  Tag,
  Progress,
} from 'antd';
import {
  PieChartOutlined,
  HddOutlined,
  CloudServerOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Column } from '@ant-design/plots';

const { Title, Text } = Typography;

interface ClusterUsageItem {
  cluster: string;
  cpu_usage: number;
  mem_usage: number;
  pod_count: number;
  status: string;
}

const CLUSTER_METRICS: ClusterUsageItem[] = [
  {
    cluster: 'local-cluster (控制面集群)',
    cpu_usage: 42,
    mem_usage: 68,
    pod_count: 36,
    status: 'Healthy',
  },
  {
    cluster: 'staging-k8s-cluster',
    cpu_usage: 28,
    mem_usage: 45,
    pod_count: 18,
    status: 'Healthy',
  },
];

export const StatisticsPage: React.FC = () => {
  // Weekly deployment activity
  const activityData = [
    { day: '周一', count: 18 },
    { day: '周二', count: 24 },
    { day: '周三', count: 32 },
    { day: '周四', count: 29 },
    { day: '周五', count: 38 },
    { day: '周六', count: 8 },
    { day: '周日', count: 5 },
  ];

  const columnConfig = {
    data: activityData,
    xField: 'day',
    yField: 'count',
    style: {
      fill: '#0066ff',
      maxWidth: 40,
    },
    label: {
      text: 'count',
      style: {
        fill: '#ffffff',
        opacity: 0.8,
      },
    },
  };

  const columns = [
    {
      title: 'Kubernetes 集群',
      dataIndex: 'cluster',
      key: 'cluster',
      render: (text: string) => (
        <Space orientation="horizontal">
          <HddOutlined style={{ color: '#0066ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'CPU 分配率',
      dataIndex: 'cpu_usage',
      key: 'cpu_usage',
      render: (usage: number) => (
        <div style={{ width: 140 }}>
          <Progress percent={usage} size="small" status="active" />
        </div>
      ),
    },
    {
      title: '内存占用率',
      dataIndex: 'mem_usage',
      key: 'mem_usage',
      render: (usage: number) => (
        <div style={{ width: 140 }}>
          <Progress percent={usage} size="small" strokeColor="#52c41a" />
        </div>
      ),
    },
    {
      title: '托管 Pod 总量',
      dataIndex: 'pod_count',
      key: 'pod_count',
      render: (count: number) => <Tag color="blue">{count} 个</Tag>,
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag icon={<CheckCircleOutlined />} color="success">正常稳定</Tag>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <PieChartOutlined style={{ fontSize: 22, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  全局数据概览与资源统计 (Data Overview)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  集群基础设施资源、服务部署活跃度及整体运行健康概览
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="平台累计执行流水线"
              value={1280}
              prefix={<BranchesOutlined style={{ color: '#0066ff' }} />}
              suffix="次"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="容器镜像归档总量"
              value={342}
              prefix={<CloudServerOutlined style={{ color: '#52c41a' }} />}
              suffix="个"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="托管计算节点总数"
              value={6}
              prefix={<HddOutlined style={{ color: '#faad14' }} />}
              suffix="台"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="平台在线运行时长"
              value={99.98}
              precision={2}
              prefix={<CheckCircleOutlined style={{ color: '#13c2c2' }} />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Weekly Activity & Cluster Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title="本周部署活跃度分布 (按工作日)"
            style={{ borderRadius: 8 }}
          >
            <div style={{ height: 280 }}>
              <Column {...columnConfig} />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title="集群计算资源分配概览"
            style={{ borderRadius: 8 }}
          >
            <Table
              dataSource={CLUSTER_METRICS}
              columns={columns}
              rowKey="cluster"
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsPage;
