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
  Radio,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  SearchOutlined,
  HistoryOutlined,
  AlertOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import environmentApi, { type K8sEventItem } from '../../api/environment';

const { Text } = Typography;

export interface EnvEventsDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  production?: boolean;
  targetResourceName?: string;
  targetResourceType?: string;
}

/**
 * 环境级与资源级 Kubernetes 实时事件抽屉
 * 数据源: GET /api/aslan/environment/kube/events?projectName=&envName=&name=&type=&production=
 */
export const EnvEventsDrawer: React.FC<EnvEventsDrawerProps> = ({
  open,
  onClose,
  projectName,
  envName,
  production = false,
  targetResourceName = '',
  targetResourceType = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<K8sEventItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>('');

  const fetchEvents = useCallback(async () => {
    if (!projectName || !envName) return;
    setLoading(true);
    try {
      const list = await environmentApi.getK8sEvents(
        projectName,
        envName,
        targetResourceName,
        targetResourceType,
        production
      );
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      console.warn('Failed to fetch kube events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [projectName, envName, targetResourceName, targetResourceType, production]);

  useEffect(() => {
    if (open) {
      fetchEvents();
    }
  }, [open, fetchEvents]);

  const filteredEvents = events.filter((e) => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'warning' && e.type?.toLowerCase() === 'warning') ||
      (filterType === 'normal' && e.type?.toLowerCase() === 'normal');
    const matchesKeyword =
      !keyword ||
      (e.reason && e.reason.toLowerCase().includes(keyword.toLowerCase())) ||
      (e.message && e.message.toLowerCase().includes(keyword.toLowerCase()));
    return matchesType && matchesKeyword;
  });

  const warningCount = events.filter((e) => e.type?.toLowerCase() === 'warning').length;

  const formatTime = (ts?: number) => {
    if (!ts) return '-';
    // If timestamp is in seconds, convert to milliseconds
    const date = new Date(ts > 1e11 ? ts : ts * 1000);
    return date.toLocaleString();
  };

  const columns: ColumnsType<K8sEventItem> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t: string) => {
        const isWarn = t?.toLowerCase() === 'warning';
        return (
          <Tag
            icon={isWarn ? <AlertOutlined /> : <InfoCircleOutlined />}
            color={isWarn ? 'error' : 'blue'}
          >
            {t || 'Normal'}
          </Tag>
        );
      },
    },
    {
      title: '原因 (Reason)',
      dataIndex: 'reason',
      key: 'reason',
      width: 160,
      render: (reason: string) => <Text strong>{reason || '-'}</Text>,
    },
    {
      title: '发生次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (c: number) => <Tag color={c > 1 ? 'volcano' : 'default'}>{c || 1} 次</Tag>,
    },
    {
      title: '最近发生时间',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 170,
      render: (ls: number) => <Text type="secondary">{formatTime(ls)}</Text>,
    },
    {
      title: '详细信息 (Message)',
      dataIndex: 'message',
      key: 'message',
      render: (msg: string) => (
        <Text style={{ fontSize: 13, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {msg || '-'}
        </Text>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <Space orientation="horizontal" size="middle">
          <HistoryOutlined style={{ color: '#0066ff' }} />
          <span>
            {targetResourceName
              ? `资源事件: ${targetResourceName}`
              : `环境级事件: ${envName}`}
          </span>
          {warningCount > 0 && (
            <Badge count={`${warningCount} 个异常`} style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size={900}
      extra={
        <Button icon={<ReloadOutlined spin={loading} />} size="small" onClick={fetchEvents}>
          刷新
        </Button>
      }
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Radio.Group
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          buttonStyle="solid"
          size="middle"
        >
          <Radio.Button value="all">全部事件 ({events.length})</Radio.Button>
          <Radio.Button value="warning">
            异常预警 ({warningCount})
          </Radio.Button>
          <Radio.Button value="normal">
            正常 ({events.length - warningCount})
          </Radio.Button>
        </Radio.Group>

        <Input
          placeholder="搜索事件原因 / 消息内容"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      </Space>

      <Table
        dataSource={filteredEvents}
        columns={columns}
        rowKey={(e, idx) => `${e.reason}-${e.last_seen}-${idx}`}
        loading={loading}
        pagination={{ pageSize: 20, size: 'small', showTotal: (t) => `共 ${t} 条事件` }}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                filterType === 'warning'
                  ? '当前环境暂无异常告警事件'
                  : '当前环境暂无 Kubernetes 事件记录'
              }
            />
          ),
        }}
      />
    </Drawer>
  );
};

export default EnvEventsDrawer;
