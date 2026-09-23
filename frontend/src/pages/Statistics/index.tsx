import React, { useEffect, useState, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Table,
  Tag,
  Button,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PieChartOutlined,
  HddOutlined,
  CloudServerOutlined,
  BranchesOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Column } from '@ant-design/plots';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

interface ClusterItem {
  id: string;
  name: string;
  status?: string;
  production?: boolean;
  is_local?: boolean;
  description?: string;
}

interface StatOverviewResp {
  project_count?: number;
  cluster_count?: number;
  service_count?: number;
  workflow_count?: number;
  env_count?: number;
  artifact_count?: number;
}

interface DailyBuildStat {
  date: string;
  success: number;
  failure: number;
  total: number;
}

export const StatisticsPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [stat, setStat] = useState<StatOverviewResp>({});
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [weekly, setWeekly] = useState<Array<{ date: string; count: number; category: string }>>([]);

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      // 近 7 天构建活动（真实每日统计）
      const end = Math.floor(Date.now() / 1000);
      const start = end - 7 * 86400;

      const [overviewRes, clusterRes, buildRes] = await Promise.allSettled([
        http.get<StatOverviewResp>('/api/aslan/stat/dashboard/overview', { skipErrorHandler: true }),
        http.get<ClusterItem[] | { data: ClusterItem[] }>('/api/aslan/cluster/clusters', {
          skipErrorHandler: true,
        }),
        http.get<{ data?: DailyBuildStat[] }>(
          `/api/aslan/stat/dashboard/build?startDate=${start}&endDate=${end}`,
          { skipErrorHandler: true }
        ),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setStat(overviewRes.value);
      }

      if (clusterRes.status === 'fulfilled') {
        const raw = clusterRes.value;
        setClusters(Array.isArray(raw) ? raw : (raw as { data?: ClusterItem[] })?.data || []);
      }

      if (buildRes.status === 'fulfilled' && buildRes.value) {
        const daily = buildRes.value.data || [];
        setWeekly(
          daily.map((d) => ({
            date: (d.date || '').slice(5),
            count: d.total || 0,
            category: '构建任务',
          }))
        );
      }
    } catch {
      feedback.message.error('加载全局统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const columnConfig = {
    data: weekly,
    xField: 'date',
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

  const columns: ColumnsType<ClusterItem> = [
    {
      title: 'Kubernetes 集群名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ClusterItem) => (
        <Space orientation="horizontal">
          <HddOutlined style={{ color: '#0066ff' }} />
          <Text strong>{text || record.id}</Text>
          {record.is_local && <Tag color="blue">当前宿主</Tag>}
        </Space>
      ),
    },
    {
      title: '集群类型',
      key: 'type',
      render: (_, record) =>
        record.production ? <Tag color="gold">生产集群</Tag> : <Tag color="geekblue">标准集群</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (d) => <Text type="secondary">{String(d || '-')}</Text>,
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) =>
        status ? (
          <Tag color={String(status).includes('正常') || String(status).toLowerCase().includes('normal') ? 'success' : 'processing'}>
            {status}
          </Tag>
        ) : (
          <Tag color="default">未知</Tag>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
      {/* Top Header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <PieChartOutlined style={{ fontSize: 22, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  全局数据概览与资源统计 (Platform Statistics)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  平台工作流、服务、环境与制品总量，集群纳管与近 7 天构建活跃度
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadStatistics} loading={loading}>
              刷新数据
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Summary KPI Cards — 全部来自 /api/stat/dashboard/overview 真实计数 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="工作流总数"
              value={stat.workflow_count ?? 0}
              prefix={<BranchesOutlined style={{ color: '#0066ff' }} />}
              loading={loading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="服务总数"
              value={stat.service_count ?? 0}
              prefix={<AppstoreOutlined style={{ color: '#722ed1' }} />}
              loading={loading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="环境总数"
              value={stat.env_count ?? 0}
              prefix={<CloudServerOutlined style={{ color: '#52c41a' }} />}
              loading={loading}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="容器制品归档总量"
              value={stat.artifact_count ?? 0}
              prefix={<CloudServerOutlined style={{ color: '#faad14' }} />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Weekly Activity & Cluster Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title="近 7 天构建活动 (真实每日统计)"
            style={{ borderRadius: 8 }}
          >
            {weekly.length > 0 ? (
              <div style={{ height: 280 }}>
                <Column {...columnConfig} />
              </div>
            ) : (
              <Empty description="近 7 天暂无构建记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title="集群纳管概览"
            style={{ borderRadius: 8 }}
          >
            <Table
              dataSource={clusters}
              columns={columns}
              rowKey={(r) => r.id || r.name}
              pagination={false}
              size="middle"
              loading={loading}
              locale={{
                emptyText: <Empty description="暂无纳管集群" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsPage;
