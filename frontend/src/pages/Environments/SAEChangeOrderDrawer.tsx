import React, { useEffect, useState } from 'react';
import { Drawer, Table, Tag, Typography, Space, Button, Select, Alert, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import environmentApi, {
  type SAEChangeOrderItem,
  type SAEAppItem,
  type SAEChangeOrderListResponse,
  type EnvironmentItem,
} from '../../api/environment';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

interface SAEChangeOrderDrawerProps {
  open: boolean;
  projectName?: string;
  /** 深链 ?envName= 携带的环境名；为空时抽屉内提供 SAE 环境选择 */
  envName?: string;
  onClose: () => void;
}

// 阿里云 SAE 变更单状态：0 准备 / 1 执行中 / 2 成功 / 3 失败（10+ 为系统/终止类，按进行中呈现）
const renderOrderStatus = (status: number | string | undefined) => {
  if (status === undefined || status === null || status === '') return <Tag color="default">未知</Tag>;
  const s = typeof status === 'number' ? status : Number(status);
  if (!Number.isNaN(s)) {
    if (s === 2) return <Tag color="success">成功</Tag>;
    if (s === 3) return <Tag color="error">失败</Tag>;
    if (s === 0) return <Tag color="default">准备中</Tag>;
    if (s === 1 || s >= 10) return <Tag color="processing">进行中</Tag>;
  }
  return <Tag color="default">{String(status)}</Tag>;
};

const fmtTime = (t: number | string | undefined) => {
  if (t === undefined || t === null || t === '') return '-';
  const n = typeof t === 'string' && !/^\d+$/.test(t) ? t : Number(t);
  if (typeof n === 'number' && !Number.isNaN(n)) {
    const ms = n < 1e12 ? n * 1000 : n; // 秒级时间戳兼容
    return new Date(ms).toLocaleString();
  }
  return String(t);
};

/**
 * SAE 变更单抽屉（P0-02 专属交互）
 * 层级选择：SAE 环境 → SAE 应用 → 变更单列表；支持详情、中止与回滚（均带二次确认）。
 * 契约：pkg/microservice/aslan/core/environment/handler/router.go:232,237-245（列表/详情/中止/回滚需 SAE License 特性）
 */
const SAEChangeOrderDrawer: React.FC<SAEChangeOrderDrawerProps> = ({ open, projectName, envName, onClose }) => {
  const [envs, setEnvs] = useState<EnvironmentItem[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string | undefined>(undefined);
  const [production, setProduction] = useState<boolean>(false);
  const [apps, setApps] = useState<SAEAppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | undefined>(undefined);
  const [orders, setOrders] = useState<SAEChangeOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  // 详情内嵌展开（阿里云透传结构，防御性渲染已知字段）
  const [detail, setDetail] = useState<SAEChangeOrderItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEnv(envName || undefined);
    setDetail(null);
    setListError(null);
  }, [open, envName]);

  // 打开且未指定环境：拉取 SAE 环境列表供选择
  useEffect(() => {
    if (!open || envName || !projectName) return;
    environmentApi
      .listSAEEnvs(projectName)
      .then((list) => {
        setEnvs(list);
        if (list.length === 1) {
          setSelectedEnv(list[0].name);
          setProduction(Boolean(list[0].production));
        }
      })
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'SAE 环境列表获取失败');
      });
  }, [open, envName, projectName]);

  // 环境确定后拉取应用列表
  useEffect(() => {
    if (!open || !selectedEnv || !projectName) {
      setApps([]);
      return;
    }
    setListError(null);
    setLoading(true);
    environmentApi
      .listSAEApps({ projectName, envName: selectedEnv, production })
      .then((list) => {
        setApps(list);
        if (list.length === 1 && list[0].app_id) {
          setSelectedApp(list[0].app_id);
        }
      })
      .catch((err: unknown) => {
        setApps([]);
        setListError(err instanceof Error ? err.message : 'SAE 应用列表获取失败');
      })
      .finally(() => setLoading(false));
  }, [open, selectedEnv, production, projectName]);

  // 应用确定后拉取变更单列表
  const fetchOrders = React.useCallback(async () => {
    if (!selectedEnv || !selectedApp) {
      setOrders([]);
      return;
    }
    setListError(null);
    setLoading(true);
    try {
      const res: SAEChangeOrderListResponse = await environmentApi.listSAEChangeOrders(selectedEnv, selectedApp, {
        projectName,
        production,
      });
      setOrders(res.change_order_list || []);
    } catch (err: unknown) {
      // 社区部署未启用 SAE License 时后端会返回许可错误，原样呈现给用户
      setOrders([]);
      setListError(err instanceof Error ? err.message : '变更单列表获取失败');
    } finally {
      setLoading(false);
    }
  }, [selectedEnv, selectedApp, projectName, production]);

  useEffect(() => {
    if (open) fetchOrders();
  }, [open, fetchOrders]);

  const handleEnvChange = (name: string) => {
    setSelectedEnv(name);
    setSelectedApp(undefined);
    setOrders([]);
    const env = envs.find((e) => e.name === name);
    setProduction(Boolean(env?.production));
  };

  const handleViewDetail = async (orderId: string) => {
    if (!selectedEnv || !selectedApp) return;
    setDetailLoading(true);
    try {
      const res = await environmentApi.getSAEChangeOrderDetail(selectedEnv, selectedApp, orderId, {
        projectName,
        production,
      });
      setDetail(res);
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '变更单详情获取失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAbort = (order: SAEChangeOrderItem) => {
    if (!selectedEnv || !selectedApp || !order.change_order_id) return;
    feedback.modal?.confirm({
      title: '确认中止该变更单？',
      content: `变更单 [${order.change_order_name || order.change_order_id}] 将被中止执行，进行中的流程会停止。`,
      okText: '中止变更',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActing(order.change_order_id as string);
        try {
          await environmentApi.abortSAEChangeOrder(selectedEnv, selectedApp, order.change_order_id as string, {
            projectName,
            production,
          });
          feedback.message.success('变更单已中止');
          await fetchOrders();
        } catch (err: unknown) {
          feedback.message.error(err instanceof Error ? err.message : '中止失败');
        } finally {
          setActing(null);
        }
      },
    });
  };

  const handleRollback = (order: SAEChangeOrderItem) => {
    if (!selectedEnv || !selectedApp || !order.change_order_id) return;
    feedback.modal?.confirm({
      title: '确认回滚该变更单？',
      content: `变更单 [${order.change_order_name || order.change_order_id}] 将回滚到上一个稳定版本，请确认业务影响。`,
      okText: '一键回滚',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActing(order.change_order_id as string);
        try {
          await environmentApi.rollbackSAEChangeOrder(selectedEnv, selectedApp, order.change_order_id as string, {
            projectName,
            production,
          });
          feedback.message.success('回滚已发起');
          await fetchOrders();
        } catch (err: unknown) {
          feedback.message.error(err instanceof Error ? err.message : '回滚失败');
        } finally {
          setActing(null);
        }
      },
    });
  };

  const columns: ColumnsType<SAEChangeOrderItem> = [
    {
      title: '变更单',
      key: 'order',
      width: 220,
      render: (_, r) => (
        <div>
          <Text strong style={{ display: 'block' }}>{r.change_order_name || r.change_order_id || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.change_order_id || ''}</Text>
        </div>
      ),
    },
    { title: '变更类型', dataIndex: 'co_type', key: 'co_type', width: 120, render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s) => renderOrderStatus(s) },
    { title: '创建人', dataIndex: 'create_user_id', key: 'create_user_id', width: 130, render: (u) => String(u || '-') },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 160, render: (t) => fmtTime(t) },
    {
      title: '操作',
      key: 'action',
      width: 230,
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" loading={detailLoading && detail?.change_order_id === r.change_order_id} onClick={() => handleViewDetail(r.change_order_id as string)}>
            详情
          </Button>
          <Tooltip title="中止执行中的变更">
            <Button type="link" size="small" danger loading={acting === r.change_order_id} onClick={() => handleAbort(r)}>
              中止变更
            </Button>
          </Tooltip>
          <Tooltip title="回滚到上一个稳定版本">
            <Button type="link" size="small" danger onClick={() => handleRollback(r)}>
              一键回滚
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const envSelect = (
    <Select
      style={{ width: 220 }}
      placeholder="选择 SAE 环境"
      value={selectedEnv}
      onChange={handleEnvChange}
      options={envs.map((e) => ({ label: `${e.alias || e.name}${e.production ? '（生产）' : ''}`, value: e.name }))}
      notFoundContent="当前项目暂无 SAE 环境"
    />
  );

  const appSelect = (
    <Select
      style={{ width: 240 }}
      placeholder="选择 SAE 应用"
      value={selectedApp}
      onChange={(v) => setSelectedApp(v)}
      options={apps.map((a) => ({ label: a.app_name || a.app_id || '-', value: a.app_id || '' }))}
      notFoundContent="该环境下暂无 SAE 应用"
    />
  );

  return (
    <Drawer
      title="SAE 变更单"
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchOrders} disabled={!selectedEnv || !selectedApp}>
          刷新
        </Button>
      }
    >
      <Space orientation="horizontal" size={12} style={{ marginBottom: 16 }} wrap>
        {envName ? (
          <Text strong>环境: {envName}</Text>
        ) : (
          envSelect
        )}
        {appSelect}
      </Space>

      {listError ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Alert
              type="error"
              showIcon
              title="数据加载失败"
              description={listError}
            style={{ maxWidth: 520, margin: '0 auto 16px', textAlign: 'left' }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchOrders} disabled={!selectedEnv || !selectedApp}>
            重试
          </Button>
        </div>
      ) : (
        <Table
          dataSource={orders}
          rowKey={(r) => r.change_order_id || String(Math.random())}
          loading={loading}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{
            emptyText: selectedEnv && selectedApp ? '该应用暂无变更单' : '请先选择 SAE 环境与应用',
          }}
        />
      )}

      {detail && (
        <div style={{ marginTop: 24 }}>
          <Space orientation="horizontal" size={8} style={{ marginBottom: 8 }}>
            <Text strong>变更单详情: {detail.change_order_name || detail.change_order_id}</Text>
            {renderOrderStatus(detail.status)}
          </Space>
          {detail.desc ? (
            <Paragraph type="secondary" style={{ fontSize: 13 }}>{String(detail.desc)}</Paragraph>
          ) : null}
          {/* 阿里云 DescribeChangeOrder 透传字段防御性渲染：描述与流水线阶段 */}
          {Array.isArray(detail.descriptions) && detail.descriptions.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>变更描述</Text>
              {(detail.descriptions as unknown[]).map((d, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{String(d)}</Tag>
              ))}
            </div>
          ) : null}
          {Array.isArray(detail.pipelines) && detail.pipelines.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={detail.pipelines as Array<Record<string, unknown>>}
              columns={[
                { title: '阶段', dataIndex: 'stage_name', key: 'stage', render: (v) => String(v || '-') },
                { title: '流水线', dataIndex: 'pipeline_name', key: 'pipeline', render: (v) => String(v || '-') },
                { title: '状态', dataIndex: 'pipeline_status', key: 'status', render: (v) => String(v || '-') },
              ]}
            />
          ) : null}
        </div>
      )}
    </Drawer>
  );
};

export default SAEChangeOrderDrawer;
