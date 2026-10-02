import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Table, Typography, Tag, Empty, Button, Radio, Flex } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import http from '../../api/client';

const { Text } = Typography;

// GET /api/aslan/environment/environments/:envName/workloads -> NamespaceResource { services: ServiceResp[] }
interface WorkloadItem {
  env_name: string;
  name: string;
  type: string;
  product_name: string;
  ready: string | boolean;
  status?: string;
  images?: string[];
}

const WORKLOAD_TYPES = ['Deployment', 'StatefulSet', 'DaemonSet', 'CronJob', 'Job'];

/**
 * 环境资源视图（对齐旧版 zadig-ee-portal 环境页「资源视图」：按工作负载类型分类展示）
 * 数据源: GET /api/aslan/environment/environments/:envName/workloads?projectName=&perPage=200&page=1
 */
export const EnvWorkloadsDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  envName: string;
  projectName: string;
  production?: boolean;
}> = ({ open, onClose, envName, projectName, production }) => {
  const [loading, setLoading] = useState(false);
  const [workloads, setWorkloads] = useState<WorkloadItem[]>([]);
  const [activeType, setActiveType] = useState<string>('Deployment');

  const loadWorkloads = useCallback(async () => {
    if (!envName || !projectName) return;
    setLoading(true);
    const prodParam = production ? '&production=true' : '';
    try {
      const res = await http.get<{ total?: number; workloads?: any[]; services?: any[] } | any[]>(
        `/api/aslan/environment/environments/${envName}/workloads?projectName=${encodeURIComponent(projectName)}&perPage=200&page=1${prodParam}`,
        { skipErrorHandler: true }
      );
      const rawList = Array.isArray(res) ? res : (res?.services || res?.workloads || []);
      const formatted: WorkloadItem[] = rawList.map((item: any) => ({
        env_name: item.env_name || envName,
        name: item.service_name || item.name || '',
        type: item.workLoadType || item.workload_type || item.type || 'Deployment',
        product_name: item.product_name || projectName,
        ready: item.ready ?? (item.status === 'Running' || item.status === 'True'),
        status: item.status || 'Running',
        images: Array.isArray(item.images) ? item.images : [],
      }));
      setWorkloads(formatted);
      // Auto-select first available type if current activeType has no items
      if (formatted.length > 0) {
        const availableTypes = WORKLOAD_TYPES.filter((t) => formatted.some((w) => w.type.toLowerCase() === t.toLowerCase()));
        if (availableTypes.length > 0 && !formatted.some((w) => w.type.toLowerCase() === activeType.toLowerCase())) {
          setActiveType(availableTypes[0]);
        }
      }
    } catch {
      setWorkloads([]);
    } finally {
      setLoading(false);
    }
  }, [envName, projectName, production, activeType]);

  useEffect(() => {
    if (open) {
      loadWorkloads();
    }
  }, [open, loadWorkloads]);

  const filtered = workloads.filter((w) => w.type.toLowerCase() === activeType.toLowerCase());

  const columns: ColumnsType<WorkloadItem> = [
    {
      title: '服务 / 工作负载名称',
      dataIndex: 'name',
      key: 'name',
      render: (n, record) => (
        <Flex vertical gap={2}>
          <Text strong copyable>{n}</Text>
          {record.images && record.images.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.images[0]}
            </Text>
          )}
        </Flex>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (t) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: 'Ready 状态',
      dataIndex: 'ready',
      key: 'ready',
      width: 120,
      render: (v, record) => {
        const isReady = typeof v === 'boolean' ? v : String(v).includes('/') ? !v.startsWith('0/') : v === 'True' || record.status === 'Running';
        return (
          <Tag color={isReady ? 'success' : 'warning'}>
            {typeof v === 'string' ? v : isReady ? 'Ready' : 'Not Ready'}
          </Tag>
        );
      },
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => (
        <Tag color={s === 'Running' ? 'processing' : s === 'Failed' ? 'error' : 'default'}>
          {s || 'Unknown'}
        </Tag>
      ),
    },
  ];

  const availableTypes = WORKLOAD_TYPES.filter((t) => workloads.some((w) => w.type.toLowerCase() === t.toLowerCase()));

  return (
    <Drawer
      title={`资源视图: ${envName}`}
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={loadWorkloads}>
          刷新
        </Button>
      }
    >
      {workloads.length > 0 ? (
        <>
          {availableTypes.length > 0 && (
            <Radio.Group
              value={activeType}
              onChange={(e) => setActiveType(e.target.value)}
              style={{ marginBottom: 16 }}
              optionType="button"
              buttonStyle="solid"
              options={availableTypes.map((t) => ({
                label: `${t} (${workloads.filter((w) => w.type.toLowerCase() === t.toLowerCase()).length})`,
                value: t,
              }))}
            />
          )}
          <Table
            dataSource={filtered.length > 0 ? filtered : workloads}
            columns={columns}
            rowKey={(r) => `${r.type}-${r.name}`}
            loading={loading}
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无 ${activeType} 类型工作负载`} /> }}
          />
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '加载中...' : `环境 [${envName}] 中暂无工作负载`} />
      )}
    </Drawer>
  );
};

export default EnvWorkloadsDrawer;
