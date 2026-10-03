import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Typography,
  Tag,
  Empty,
  Button,
  Space,
  Input,
  Select,
  Statistic,
  Row,
  Col,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  SearchOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import environmentApi, { type K8sNodeItem } from '../../api/environment';

const { Text } = Typography;

export interface EnvNodesDrawerProps {
  open: boolean;
  onClose: () => void;
  clusterId?: string;
  envName: string;
}

/**
 * 环境所属集群节点列表抽屉
 * 数据源: GET /api/aslan/environment/kube/nodes?clusterId=
 */
export const EnvNodesDrawer: React.FC<EnvNodesDrawerProps> = ({
  open,
  onClose,
  clusterId = '',
  envName,
}) => {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<K8sNodeItem[]>([]);
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await environmentApi.getK8sNodes(clusterId);
      setNodes(res?.data || []);
      setAllLabels(res?.labels || []);
    } catch (err: unknown) {
      console.warn('Failed to fetch cluster nodes:', err);
      setNodes([]);
      setAllLabels([]);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    if (open) {
      fetchNodes();
    }
  }, [open, fetchNodes]);

  const filteredNodes = nodes.filter((n) => {
    const matchesKeyword =
      !searchKeyword ||
      n.ip.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (n.labels || []).some((l) => l.toLowerCase().includes(searchKeyword.toLowerCase()));
    const matchesLabel =
      !selectedLabel || (n.labels || []).includes(selectedLabel);
    return matchesKeyword && matchesLabel;
  });

  const readyCount = nodes.filter((n) => n.ready).length;

  const columns: ColumnsType<K8sNodeItem> = [
    {
      title: '节点名称 / IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => (
        <Space orientation="horizontal" size={6}>
          <ClusterOutlined style={{ color: '#0066ff' }} />
          <Text strong copyable>
            {ip}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'ready',
      key: 'ready',
      width: 130,
      render: (ready: boolean) => (
        <Tag
          icon={ready ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={ready ? 'success' : 'error'}
        >
          {ready ? 'Ready' : 'NotReady'}
        </Tag>
      ),
    },
    {
      title: '节点标签 (Labels)',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels: string[]) => {
        const list = Array.isArray(labels) ? labels : [];
        if (list.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space wrap size={[4, 4]}>
            {list.slice(0, 5).map((l, i) => (
              <Tag key={i} color="geekblue" style={{ fontSize: 11 }}>
                {l}
              </Tag>
            ))}
            {list.length > 5 && (
              <Tag style={{ fontSize: 11 }}>+{list.length - 5} 项</Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Drawer
      title={
        <Space orientation="horizontal" size="middle">
          <ClusterOutlined style={{ color: '#0066ff' }} />
          <span>集群节点列表: {envName || '当前环境'}</span>
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size={880}
      extra={
        <Button icon={<ReloadOutlined spin={loading} />} size="small" onClick={fetchNodes}>
          刷新
        </Button>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" variant="borderless" style={{ background: '#f8fafc' }}>
            <Statistic title="总节点数" value={nodes.length} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" variant="borderless" style={{ background: '#f8fafc' }}>
            <Statistic
              title="健康就绪 (Ready)"
              value={readyCount}
              styles={{ content: { color: '#52c41a' } }}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" variant="borderless" style={{ background: '#f8fafc' }}>
            <Statistic
              title="异常离线"
              value={nodes.length - readyCount}
              styles={{ content: { color: nodes.length - readyCount > 0 ? '#ff4d4f' : '#64748b' } }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input
          placeholder="搜索节点名称 / IP / 标签"
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Select
          placeholder="按节点标签过滤"
          allowClear
          showSearch
          style={{ width: 320 }}
          value={selectedLabel}
          onChange={(val) => setSelectedLabel(val || null)}
          options={allLabels.map((l) => ({ label: l, value: l }))}
        />
      </Space>

      <Table
        dataSource={filteredNodes}
        columns={columns}
        rowKey="ip"
        loading={loading}
        pagination={{ pageSize: 20, size: 'small', showTotal: (t) => `共 ${t} 个节点` }}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="未获取到集群节点数据"
            />
          ),
        }}
      />
    </Drawer>
  );
};

export default EnvNodesDrawer;
