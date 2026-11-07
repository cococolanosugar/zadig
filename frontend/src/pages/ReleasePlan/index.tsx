import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
  Space,
  Input,
  Tag,
  Empty,
  Modal,
  Form,
  DatePicker,
  Drawer,
  Descriptions,
  Popconfirm,
  Badge,
  Switch,
  Checkbox,
  Spin,
  Alert,
  Timeline,
} from 'antd';
import {
  ScheduleOutlined,
  SearchOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  SettingOutlined,
  CopyOutlined,
  FileTextOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { releasePlanApi, type ReleasePlanItem, type ReleaseJobItem } from '../../api/releasePlan';
import { feedback } from '../../utils/feedback';
import { useAuthStore } from '../../stores/auth';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 已进入终态的 Job 不再提供执行/重试/跳过操作
const readOnlyJobStatus = (status?: string) =>
  ['success', 'skipped', 'cancelled'].includes(String(status || ''));

export const ReleasePlanPage: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetId = searchParams.get('id') || searchParams.get('name');

  const [plans, setPlans] = useState<ReleasePlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');

  // Modal state
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Hook Settings Modal state
  const [hookModalVisible, setHookModalVisible] = useState<boolean>(false);
  const [hookLoading, setHookLoading] = useState<boolean>(false);
  const [savingHook, setSavingHook] = useState<boolean>(false);
  const [hookForm] = Form.useForm();

  // Drawer state
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [activePlan, setActivePlan] = useState<ReleasePlanItem | null>(null);

  // R4-A2: 真实编排数据（getPlan 拉取的实时 jobs 与审批态）
  const [planDetail, setPlanDetail] = useState<ReleasePlanItem | null>(null);
  const [planDetailLoading, setPlanDetailLoading] = useState<boolean>(false);
  const [jobActing, setJobActing] = useState<string | null>(null);
  // 复制计划
  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [copyTarget, setCopyTarget] = useState<ReleasePlanItem | null>(null);
  const [copyName, setCopyName] = useState<string>('');
  const [copying, setCopying] = useState<boolean>(false);
  // 操作日志
  const [logsModalOpen, setLogsModalOpen] = useState<boolean>(false);
  const [planLogs, setPlanLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await releasePlanApi.getPlans();
      setPlans(data);
    } catch (err: any) {
      setPlans([]);
      feedback.message.error(err?.message || '获取发布计划失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (targetId && plans.length > 0) {
      const found = plans.find((p) => p.id === targetId || p.name === targetId);
      if (found) {
        setActivePlan(found);
        setDetailDrawerVisible(true);
      }
    }
  }, [targetId, plans]);

  const handleCreatePlan = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const range = values.timeRange;
      const startTime = range && range[0] ? range[0].format('YYYY-MM-DD HH:mm') : undefined;
      const endTime = range && range[1] ? range[1].format('YYYY-MM-DD HH:mm') : undefined;

      const payload: Partial<ReleasePlanItem> = {
        name: values.name,
        description: values.description,
        manager: values.manager || userInfo?.account || 'admin',
        start_time: startTime,
        end_time: endTime,
        release_time: endTime ? `${startTime || ''} ~ ${endTime}` : undefined,
        status: 'planning',
      };

      await releasePlanApi.createPlan(payload);
      feedback.message.success(`发布计划 [${values.name}] 创建成功！`);
      setCreateModalVisible(false);
      form.resetFields();
      fetchPlans();
    } catch (err: any) {
      feedback.message.error(err?.message || '创建发布计划失败，请检查参数');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (id: string, name: string) => {
    try {
      await releasePlanApi.deletePlan(id);
      feedback.message.success(`发布计划 [${name}] 已成功删除`);
      fetchPlans();
    } catch (err: any) {
      feedback.message.error(err?.message || '删除发布计划失败');
    }
  };

  // --- R4-A2: 真实 Job 执行编排 ---
  const loadPlanDetail = useCallback(async (planId: string) => {
    if (!planId) return;
    setPlanDetailLoading(true);
    try {
      const detail = await releasePlanApi.getPlan(planId);
      setPlanDetail(detail || null);
    } catch (err: unknown) {
      setPlanDetail(null);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '发布计划详情获取失败');
      feedback.message.error(msg);
    } finally {
      setPlanDetailLoading(false);
    }
  }, []);

  // Drawer 打开或活跃计划变化时拉取实时数据
  useEffect(() => {
    const planId = activePlan?.id || activePlan?._id || '';
    if (detailDrawerVisible && planId) {
      loadPlanDetail(planId);
    }
    if (!detailDrawerVisible) {
      setPlanDetail(null);
    }
  }, [detailDrawerVisible, activePlan, loadPlanDetail]);

  const runJobAction = async (
    job: ReleaseJobItem,
    action: 'execute' | 'retry' | 'skip'
  ) => {
    const planId = activePlan?.id || activePlan?._id || planDetail?.id || '';
    if (!planId || !job.id) return;
    setJobActing(`${action}-${job.id}`);
    try {
      if (action === 'execute') {
        await releasePlanApi.executeJob(planId, { id: job.id, name: job.name, type: job.type });
        feedback.message.success(`任务 [${job.name}] 已开始执行`);
      } else if (action === 'retry') {
        await releasePlanApi.retryJob(planId, { id: job.id });
        feedback.message.success(`任务 [${job.name}] 已重新入队重试`);
      } else {
        await releasePlanApi.skipJob(planId, { id: job.id });
        feedback.message.success(`任务 [${job.name}] 已跳过`);
      }
      await loadPlanDetail(planId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '任务操作失败');
      feedback.message.error(msg);
    } finally {
      setJobActing(null);
    }
  };

  const handleApprovePlan = async () => {
    const planId = activePlan?.id || activePlan?._id || planDetail?.id || '';
    if (!planId) return;
    setJobActing('approve');
    try {
      await releasePlanApi.approvePlan(planId);
      feedback.message.success('发布计划审批已通过');
      await loadPlanDetail(planId);
      fetchPlans();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '审批操作失败');
      feedback.message.error(msg);
    } finally {
      setJobActing(null);
    }
  };

  const handleCopyPlan = async () => {
    const planId = copyTarget?.id || copyTarget?._id || '';
    if (!planId || !copyName.trim()) {
      feedback.message.warning('请输入新计划名称');
      return;
    }
    setCopying(true);
    try {
      await releasePlanApi.copyPlan(planId, copyName.trim());
      feedback.message.success(`发布计划已复制为 [${copyName.trim()}]`);
      setCopyModalOpen(false);
      setCopyName('');
      setCopyTarget(null);
      fetchPlans();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '复制发布计划失败');
      feedback.message.error(msg);
    } finally {
      setCopying(false);
    }
  };

  const openPlanLogs = async (record: ReleasePlanItem) => {
    const planId = record.id || record._id || '';
    if (!planId) return;
    setLogsModalOpen(true);
    setLogsLoading(true);
    setPlanLogs([]);
    try {
      const logs = await releasePlanApi.getPlanLogs(planId);
      setPlanLogs(logs);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '发布计划操作日志获取失败');
      feedback.message.error(msg);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenHookModal = async () => {
    setHookModalVisible(true);
    setHookLoading(true);
    try {
      const data = await releasePlanApi.getHookSettings();
      hookForm.setFieldsValue({
        enable: data.enable ?? false,
        enable_call_back: data.enable_call_back ?? false,
        hook_address: data.hook_address || '',
        hook_secret: data.hook_secret || '',
        hook_events: data.hook_events || [],
      });
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '获取 Hook 设置失败');
    } finally {
      setHookLoading(false);
    }
  };

  const handleSaveHook = async () => {
    try {
      const values = await hookForm.validateFields();
      setSavingHook(true);
      await releasePlanApi.updateHookSettings({
        enable: Boolean(values.enable),
        enable_call_back: Boolean(values.enable_call_back),
        hook_address: values.hook_address || '',
        hook_secret: values.hook_secret || '',
        hook_events: values.hook_events || [],
      });
      feedback.message.success('发布计划 Hook 设置保存成功');
      setHookModalVisible(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      feedback.message.error(err?.response?.data?.message || err?.message || '保存 Hook 设置失败');
    } finally {
      setSavingHook(false);
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (p.manager && p.manager.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns: ColumnsType<ReleasePlanItem> = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space orientation="vertical" size={2}>
          <Space orientation="horizontal">
            <ScheduleOutlined style={{ color: '#0066ff' }} />
            <Text strong>{name}</Text>
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        switch (status) {
          case 'success':
            return <Badge status="success" text={<Text style={{ color: '#52c41a' }}>已完成</Text>} />;
          case 'executing':
            return <Badge status="processing" text={<Text style={{ color: '#0066ff' }}>发布中</Text>} />;
          case 'failed':
            return <Badge status="error" text={<Text style={{ color: '#ff4d4f' }}>异常挂起</Text>} />;
          default:
            return <Badge status="default" text={<Text type="secondary">规划中</Text>} />;
        }
      },
    },
    {
      title: '发布窗口 / 目标上线时间',
      key: 'time_window',
      render: (_, record) => {
        const timeStr =
          record.release_time ||
          (record.start_time && record.end_time ? `${record.start_time} ~ ${record.end_time}` : '-');
        return (
          <Space size={6}>
            <CalendarOutlined style={{ color: '#8c8c8c' }} />
            <Text style={{ fontSize: 13 }}>{timeStr}</Text>
          </Space>
        );
      },
    },
    {
      title: '负责人',
      dataIndex: 'manager',
      key: 'manager',
      width: 160,
      render: (m) => <Tag color="geekblue">{m || '未指定'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="middle" wrap>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setActivePlan(record);
              setDetailDrawerVisible(true);
            }}
          >
            详情编排
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              setCopyTarget(record);
              setCopyName(`${record.name}-copy`);
              setCopyModalOpen(true);
            }}
          >
            复制
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openPlanLogs(record)}>
            查看日志
          </Button>
          <Popconfirm
            title={`确认删除发布计划 [${record.name}]？`}
            onConfirm={() => handleDeletePlan(record.id || record._id || '', record.name)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Header */}
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
            发布计划 (Release Plans)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            跨项目、多业务线统一编排版本发布日历，跟踪版本发布窗口与里程碑进度
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索发布计划名称 / 负责人"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchPlans} loading={loading}>
            刷新
          </Button>
          <Button icon={<SettingOutlined />} onClick={handleOpenHookModal}>
            Hook 设置
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={() => {
              form.resetFields();
              setCreateModalVisible(true);
            }}
          >
            新建发布计划
          </Button>
        </Space>
      </div>

      {/* Main Table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Table
          rowKey={(r) => r.id || r._id || r.name}
          dataSource={filteredPlans}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个发布计划` }}
          locale={{
            emptyText: (
              <Empty
                description="暂无发布计划记录，可点击上方新建创建首个发布窗口"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    setCreateModalVisible(true);
                  }}
                >
                  新建发布计划
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新建版本发布计划"
        open={createModalVisible}
        onOk={handleCreatePlan}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={creating}
        okText="立即创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ manager: userInfo?.account || 'admin' }}
        >
          <Form.Item
            name="name"
            label="计划标识名称"
            rules={[{ required: true, message: '请输入发布计划名称' }]}
          >
            <Input placeholder="例如: 2026Q3-核心微服务大版本上线" />
          </Form.Item>

          <Form.Item name="manager" label="主负责人">
            <Input placeholder="输入负责人姓名或邮箱" />
          </Form.Item>

          <Form.Item name="timeRange" label="计划发布时间窗口">
            <RangePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          <Form.Item name="description" label="计划目标与变更说明">
            <TextArea rows={3} placeholder="简述本次版本发布的核心业务功能、上下游依赖与风险预案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <ScheduleOutlined style={{ color: '#0066ff' }} />
            <span>发布计划详情编排: {activePlan?.name}</span>
          </Space>
        }
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setActivePlan(null);
          if (targetId) {
            navigate('/v1/releasePlan');
          }
        }}
        size="large"
      >
        {activePlan && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="计划名称">{planDetail?.name || activePlan.name}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color="blue">{planDetail?.status || activePlan.status || 'planning'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="责任人">{planDetail?.manager || activePlan.manager || '-'}</Descriptions.Item>
              <Descriptions.Item label="发布窗口">{planDetail?.release_time || activePlan.release_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="说明备注">{planDetail?.description || activePlan.description || '无详细说明'}</Descriptions.Item>
            </Descriptions>

            {/* R4-A2: 审批门禁（wait_for_approval 或包含审批节点时渲染） */}
            {(planDetail?.status === 'wait_for_approval' ||
              (planDetail?.jobs || []).some((j) => j.type === 'approval')) && (
              <Alert
                type="warning"
                showIcon
                icon={<SafetyOutlined />}
                title="该发布计划等待审批"
                description="审批通过后发布计划才能继续推进执行。"
                style={{ marginBottom: 16, borderRadius: 6 }}
                action={
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={jobActing === 'approve'}
                    onClick={handleApprovePlan}
                  >
                    审批通过
                  </Button>
                }
              />
            )}

            <Title level={5} style={{ marginTop: 8 }}>
              发布任务编排 (Jobs)
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              计划内的真实发布任务列表，执行状态与操作实时同步服务端。
            </Paragraph>

            <Table
              rowKey={(j) => j.id || j.name}
              dataSource={planDetail?.jobs || []}
              loading={planDetailLoading}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Job 名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (n) => <Text strong>{String(n || '-')}</Text>,
                },
                {
                  title: '类型',
                  dataIndex: 'type',
                  key: 'type',
                  width: 120,
                  render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 110,
                  render: (s) => {
                    switch (s) {
                      case 'success':
                        return <Tag color="success">成功</Tag>;
                      case 'failed':
                        return <Tag color="error">失败</Tag>;
                      case 'executing':
                      case 'running':
                        return <Tag color="processing">执行中</Tag>;
                      case 'skipped':
                        return <Tag color="default">已跳过</Tag>;
                      case 'wait_for_approval':
                        return <Tag color="warning">待审批</Tag>;
                      default:
                        return <Tag color="default">待执行</Tag>;
                    }
                  },
                },
                {
                  title: '负责人 / 执行人',
                  key: 'people',
                  width: 170,
                  render: (_, j) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {j.manager || '-'}{j.executed_by ? ` / ${j.executed_by}` : ''}
                    </Text>
                  ),
                },
                {
                  title: '操作',
                  key: 'job_action',
                  width: 190,
                  render: (_, j: ReleaseJobItem) => {
                    const planId = activePlan?.id || activePlan?._id || '';
                    const actionable = Boolean(planId && j.id && !readOnlyJobStatus(j.status));
                    return (
                      <Space size={0}>
                        {j.status === 'failed' ? (
                          <Button
                            type="link"
                            size="small"
                            disabled={!actionable}
                            loading={jobActing === `retry-${j.id}`}
                            onClick={() => runJobAction(j, 'retry')}
                          >
                            重试
                          </Button>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            disabled={!actionable}
                            loading={jobActing === `execute-${j.id}`}
                            onClick={() => runJobAction(j, 'execute')}
                          >
                            执行
                          </Button>
                        )}
                        <Button
                          type="link"
                          size="small"
                          disabled={!actionable}
                          loading={jobActing === `skip-${j.id}`}
                          onClick={() => runJobAction(j, 'skip')}
                        >
                          跳过
                        </Button>
                      </Space>
                    );
                  },
                },
              ]}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={planDetailLoading ? '正在加载编排任务...' : '该计划暂无编排任务，可在创建时定义 Job 列表'}
                  />
                ),
              }}
            />
          </div>
        )}
      </Drawer>

      {/* 复制发布计划 Modal (R4-A2) */}
      <Modal
        title={`复制发布计划: ${copyTarget?.name || ''}`}
        open={copyModalOpen}
        onOk={handleCopyPlan}
        onCancel={() => {
          setCopyModalOpen(false);
          setCopyTarget(null);
        }}
        confirmLoading={copying}
        okText="确认复制"
        cancelText="取消"
        width={480}
      >
        <div style={{ paddingTop: 16 }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>新计划名称:</Text>
          <Input
            placeholder="输入新发布计划名称"
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
          />
        </div>
      </Modal>

      {/* 发布计划操作日志 Modal (R4-A2) */}
      <Modal
        title={`发布计划操作日志${activePlan ? `: ${activePlan.name}` : ''}`}
        open={logsModalOpen}
        onCancel={() => setLogsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setLogsModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={640}
      >
        <Spin spinning={logsLoading}>
          {planLogs.length > 0 ? (
            <Timeline
              style={{ marginTop: 16 }}
              items={planLogs.map((log, idx) => ({
                key: idx,
                children: (
                  <div>
                    <Text strong>{String(log?.username || log?.user_name || log?.user || '-')}</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {log?.time ? new Date(typeof log.time === 'number' ? log.time * 1000 : log.time).toLocaleString() : ''}
                    </Text>
                    <div>
                      <Text style={{ fontSize: 13 }}>{String(log?.content || log?.message || JSON.stringify(log))}</Text>
                    </div>
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作日志" style={{ padding: '24px 0' }} />
          )}
        </Spin>
      </Modal>

      {/* Hook Settings Modal */}
      <Modal
        title="发布计划 Hook 设置"
        open={hookModalVisible}
        onOk={handleSaveHook}
        onCancel={() => setHookModalVisible(false)}
        confirmLoading={savingHook}
        okText="保存配置"
        cancelText="取消"
        width={580}
      >
        <Spin spinning={hookLoading}>
          <Form
            form={hookForm}
            layout="vertical"
            style={{ marginTop: 16 }}
            initialValues={{
              enable: false,
              enable_call_back: false,
              hook_events: [],
            }}
          >
            <Form.Item
              name="enable"
              label="启用 Webhook 事件通知"
              valuePropName="checked"
              extra="开启后，发布计划状态变更时将向目标地址发送 HTTP POST Webhook 请求。"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="hook_address"
              label="Webhook 地址"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (getFieldValue('enable') && !value) {
                      return Promise.reject(new Error('启用通知时必须填写 Webhook 地址'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input placeholder="https://api.example.com/webhook/release" />
            </Form.Item>
            <Form.Item
              name="hook_secret"
              label="签名密钥 (Secret)"
              extra="用于生成 X-Zadig-Signature 请求签名防篡改校验，可选。"
            >
              <Input.Password placeholder="输入签名校验密钥" />
            </Form.Item>
            <Form.Item
              name="hook_events"
              label="触发事件类型"
              extra="勾选需要向 Webhook 发送通知的发布阶段事件。"
            >
              <Checkbox.Group
                options={[
                  { label: '完成规划 (finish_planning)', value: 'finish_planning' },
                  { label: '开始执行 (start_execute)', value: 'start_execute' },
                  { label: '所有任务完成 (all_job_done)', value: 'all_job_done' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="enable_call_back"
              label="开启回调状态接收 (Callback)"
              valuePropName="checked"
              extra="允许外部系统通过回调接口更新发布计划状态或注入审批结果。"
            >
              <Switch />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </div>
  );
};

export default ReleasePlanPage;
