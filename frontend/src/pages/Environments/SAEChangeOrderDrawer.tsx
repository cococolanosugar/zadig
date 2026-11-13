import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Select,
  Alert,
  Steps,
  Card,
  Descriptions,
  Progress,
} from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import environmentApi, {
  type SAEChangeOrderItem,
  type SAEAppItem,
  type SAEChangeOrderListResponse,
  type SAEPipelineItem,
  type EnvironmentItem,
} from '../../api/environment';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

interface SAEChangeOrderDrawerProps {
  open: boolean;
  projectName?: string;
  /** 深链 ?envName= 携带的环境名；为空时抽屉内提供 SAE 环境选择 */
  envName?: string;
  initialOrderId?: string;
  onClose: () => void;
}

const ORDER_STATUS_MAP: Record<number, { text: string; color: string; badge: 'default' | 'processing' | 'success' | 'error' | 'warning' }> = {
  0: { text: '准备中', color: 'default', badge: 'default' },
  1: { text: '执行中', color: 'processing', badge: 'processing' },
  2: { text: '执行成功', color: 'success', badge: 'success' },
  3: { text: '执行失败', color: 'error', badge: 'error' },
  6: { text: '已终止', color: 'warning', badge: 'warning' },
  8: { text: '待手动确认', color: 'warning', badge: 'warning' },
  9: { text: '回滚待确认', color: 'warning', badge: 'warning' },
  10: { text: '回滚失败', color: 'error', badge: 'error' },
  12: { text: '回滚终止', color: 'warning', badge: 'warning' },
};

const ORDER_TYPE_MAP: Record<string, string> = {
  CoBatchUpdate: '分批更新',
  CoRollback: '一键回滚',
  CoScale: '容量伸缩',
  CoRestart: '实例重启',
  CoStop: '停止实例',
  CoStart: '启动实例',
};

const renderOrderStatus = (status: number | string | undefined) => {
  if (status === undefined || status === null || status === '') return <Tag color="default">未知</Tag>;
  const s = typeof status === 'number' ? status : Number(status);
  const cfg = ORDER_STATUS_MAP[s];
  if (cfg) {
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  }
  return <Tag color="default">{String(status)}</Tag>;
};

const fmtTime = (t: number | string | undefined) => {
  if (t === undefined || t === null || t === '') return '-';
  const n = typeof t === 'string' && !/^\d+$/.test(t) ? t : Number(t);
  if (typeof n === 'number' && !Number.isNaN(n)) {
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms).toLocaleString();
  }
  return String(t);
};

export const SAEChangeOrderDrawer: React.FC<SAEChangeOrderDrawerProps> = ({
  open,
  projectName,
  envName,
  initialOrderId,
  onClose,
}) => {
  const [envs, setEnvs] = useState<EnvironmentItem[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string | undefined>(undefined);
  const [production, setProduction] = useState<boolean>(false);
  const [apps, setApps] = useState<SAEAppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | undefined>(undefined);
  const [orders, setOrders] = useState<SAEChangeOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  // 变更单详情状态
  const [detail, setDetail] = useState<SAEChangeOrderItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activePipeline, setActivePipeline] = useState<SAEPipelineItem | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEnv(envName || undefined);
    setDetail(null);
    setActivePipeline(null);
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
  const fetchOrders = useCallback(async () => {
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
      if (initialOrderId) {
        handleViewDetail(initialOrderId);
      }
    } catch (err: unknown) {
      setOrders([]);
      setListError(err instanceof Error ? err.message : '变更单列表获取失败');
    } finally {
      setLoading(false);
    }
  }, [selectedEnv, selectedApp, projectName, production, initialOrderId]);

  useEffect(() => {
    if (open) fetchOrders();
  }, [open, fetchOrders]);

  const handleEnvChange = (name: string) => {
    setSelectedEnv(name);
    setSelectedApp(undefined);
    setOrders([]);
    setDetail(null);
    setActivePipeline(null);
    const env = envs.find((e) => e.name === name);
    setProduction(Boolean(env?.production));
  };

  const loadPipelineDetail = async (pipelineId: string) => {
    if (!selectedEnv || !selectedApp) return;
    setPipelineLoading(true);
    try {
      const p = await environmentApi.getSAEPipeline(selectedEnv, selectedApp, pipelineId, {
        projectName,
        production,
      });
      setActivePipeline(p);
    } catch {
      // 容错处理
    } finally {
      setPipelineLoading(false);
    }
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

      // 若包含流水线批次，默认加载第一批
      const pipelines = (res.pipelines as Array<{ pipeline_id?: string }>) || [];
      if (pipelines.length > 0 && pipelines[0].pipeline_id) {
        loadPipelineDetail(pipelines[0].pipeline_id);
      }
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '变更单详情获取失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartNextBatch = async () => {
    if (!selectedEnv || !selectedApp || !activePipeline?.next_pipeline_id) return;
    setActing('next_batch');
    try {
      await environmentApi.confirmSAEPipelineBatch(
        selectedEnv,
        selectedApp,
        activePipeline.next_pipeline_id,
        { projectName, production }
      );
      feedback.message.success('已触发开始下一批次变更');
      if (detail?.change_order_id) {
        await handleViewDetail(String(detail.change_order_id));
      }
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '执行下一批失败');
    } finally {
      setActing(null);
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
          if (detail?.change_order_id === order.change_order_id) {
            handleViewDetail(order.change_order_id as string);
          }
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
          if (detail?.change_order_id === order.change_order_id) {
            handleViewDetail(order.change_order_id as string);
          }
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
      title: '变更单 ID',
      key: 'order',
      width: 220,
      render: (_, r) => (
        <div>
          <Text strong style={{ display: 'block' }}>
            {r.change_order_name || r.change_order_id || '-'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.change_order_id || ''}
          </Text>
        </div>
      ),
    },
    {
      title: '变更类型',
      dataIndex: 'co_type',
      key: 'co_type',
      width: 120,
      render: (t) => {
        const name = ORDER_TYPE_MAP[String(t)] || String(t || '-');
        return <Tag color="geekblue">{name}</Tag>;
      },
    },
    {
      title: '分批状态',
      key: 'batch',
      width: 120,
      render: (_, r) => {
        const count = typeof r.batch_count === 'number' ? r.batch_count : 1;
        return (
          <Tag color="cyan">
            {count > 1 ? `${count} 批分步` : '全量单批'}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => renderOrderStatus(s),
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 170,
      render: (t) => fmtTime(t),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            loading={detailLoading && detail?.change_order_id === r.change_order_id}
            onClick={() => handleViewDetail(r.change_order_id as string)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            danger
            loading={acting === r.change_order_id}
            onClick={() => handleAbort(r)}
          >
            中止
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleRollback(r)}
          >
            回滚
          </Button>
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
      options={envs.map((e) => ({
        label: `${e.alias || e.name}${e.production ? '（生产）' : ''}`,
        value: e.name,
      }))}
      notFoundContent="当前项目暂无 SAE 环境"
    />
  );

  const appSelect = (
    <Select
      style={{ width: 240 }}
      placeholder="选择 SAE 应用"
      value={selectedApp}
      onChange={(v) => {
        setSelectedApp(v);
        setDetail(null);
        setActivePipeline(null);
      }}
      options={apps.map((a) => ({
        label: a.app_name || a.app_id || '-',
        value: a.app_id || '',
      }))}
      notFoundContent="该环境下暂无 SAE 应用"
    />
  );

  return (
    <Drawer
      title="阿里云 SAE 变更单管理"
      placement="right"
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="large"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders} disabled={!selectedEnv || !selectedApp}>
            刷新
          </Button>
        </Space>
      }
    >
      <Space orientation="horizontal" size={12} style={{ marginBottom: 16 }} wrap>
        {envName ? <Text strong>环境: {envName}</Text> : envSelect}
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
            emptyText: selectedEnv && selectedApp ? '该应用暂无变更单流水' : '请先选择 SAE 环境与应用',
          }}
        />
      )}

      {/* 变更单详情抽屉 / 卡片 */}
      {detail && (
        <Card
          size="small"
          title={`变更单详情: ${detail.change_order_name || detail.change_order_id}`}
          style={{ marginTop: 24 }}
          extra={
            <Space>
              {activePipeline?.next_pipeline_id && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  loading={acting === 'next_batch'}
                  onClick={handleStartNextBatch}
                >
                  执行下一批
                </Button>
              )}
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRollback(detail)}
              >
                一键回滚
              </Button>
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleAbort(detail)}
              >
                中止变更
              </Button>
            </Space>
          }
        >
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
            <Descriptions.Item label="变更单 ID">{detail.change_order_id}</Descriptions.Item>
            <Descriptions.Item label="变更类型">
              {ORDER_TYPE_MAP[String(detail.co_type)] || String(detail.co_type || '-')}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">{renderOrderStatus(detail.status)}</Descriptions.Item>
            <Descriptions.Item label="分批策略">
              {detail.batch_count ? `${detail.batch_count} 批` : '单批'} ({String(detail.batch_type || '按比例')})
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{fmtTime(detail.create_time)}</Descriptions.Item>
            <Descriptions.Item label="描述">{String(detail.desc || detail.description || '-')}</Descriptions.Item>
          </Descriptions>

          {/* 分批进度步骤条 (Steps) */}
          {Array.isArray(detail.pipelines) && detail.pipelines.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                分批流水发布进度 (Pipelines / Batches)
              </Text>
              <Steps
                size="small"
                current={
                  detail.pipelines.findIndex((p: any) => p.pipeline_id === activePipeline?.pipeline_id) >= 0
                    ? detail.pipelines.findIndex((p: any) => p.pipeline_id === activePipeline?.pipeline_id)
                    : 0
                }
                onChange={(idx) => {
                  const p = (detail.pipelines as any[])[idx];
                  if (p?.pipeline_id) loadPipelineDetail(p.pipeline_id);
                }}
                items={(detail.pipelines as any[]).map((p: any, idx: number) => {
                  const statusNum = Number(p.status);
                  const isDone = statusNum === 2;
                  const isFail = statusNum === 3;
                  const isRunning = statusNum === 1;
                  return {
                    title: p.pipeline_name || `批次 ${idx + 1}`,
                    description: isDone ? '执行完成' : isFail ? '失败' : isRunning ? '执行中' : '等待确认',
                    status: isDone ? 'finish' : isFail ? 'error' : isRunning ? 'process' : 'wait',
                  };
                })}
              />
            </div>
          )}

          {/* 当前批次实例明细 */}
          {activePipeline && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>
                  当前批次实例状态 ({activePipeline.pipeline_name || activePipeline.pipeline_id})
                </Text>
                {pipelineLoading && <SyncOutlined spin />}
              </div>

              <Table
                size="small"
                pagination={false}
                rowKey={(r) => r.instance_id || String(Math.random())}
                dataSource={activePipeline.instances || []}
                locale={{ emptyText: '该批次暂无实例数据' }}
                columns={[
                  {
                    title: '实例 ID',
                    dataIndex: 'instance_id',
                    key: 'instance_id',
                    render: (v) => <Text code>{String(v || '-')}</Text>,
                  },
                  {
                    title: 'IP 地址',
                    dataIndex: 'ip',
                    key: 'ip',
                    render: (v) => String(v || '-'),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v) => {
                      const isOk = String(v).toLowerCase() === 'running' || v === 2 || v === '2';
                      return (
                        <Tag color={isOk ? 'success' : 'processing'}>
                          {String(v || '-')}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: '执行进度',
                    dataIndex: 'progress',
                    key: 'progress',
                    render: (p) => <Progress percent={Number(p) || 100} size="small" />,
                  },
                ]}
              />
            </div>
          )}
        </Card>
      )}
    </Drawer>
  );
};

export default SAEChangeOrderDrawer;
