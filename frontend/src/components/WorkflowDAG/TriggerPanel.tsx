import React, { useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  TimePicker,
  Popconfirm,
  Empty,
  Typography,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  BranchesOutlined,
  PlusOutlined,
  ReloadOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { workflowApi } from '../../api/workflow';

const { Text } = Typography;

interface CronItem {
  id: string;
  enabled: boolean;
  frequency: string;
  time: string;
  number: number;
  max_failures?: number;
  cron?: string;
}

interface GeneralHookItem {
  name: string;
  enabled: boolean;
  description?: string;
}

interface GitHookItem {
  id?: string;
  name: string;
  description?: string;
  auto_cancel?: boolean;
  enabled: boolean;
  main_repo?: {
    repo_name?: string;
    repo_owner?: string;
    repo_namespace?: string;
    branch?: string;
    codehost_id?: number;
    events?: string[];
  };
}

const FREQUENCY_OPTIONS = [
  { label: '每天指定时间', value: 'day' },
  { label: '每周一', value: 'monday' },
  { label: '每周二', value: 'tuesday' },
  { label: '每周三', value: 'wednesday' },
  { label: '每周四', value: 'thursday' },
  { label: '每周五', value: 'friday' },
  { label: '每周六', value: 'saturday' },
  { label: '每周日', value: 'sunday' },
  { label: '每 N 分钟', value: 'minutes' },
  { label: '每 N 小时', value: 'hours' },
];

const FREQ_LABEL: Record<string, string> = {
  day: '每天',
  monday: '每周一',
  tuesday: '每周二',
  wednesday: '每周三',
  thursday: '每周四',
  friday: '每周五',
  saturday: '每周六',
  sunday: '每周日',
};

export const TriggerPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  workflowName: string;
  readOnly?: boolean;
}> = ({ open, onClose, workflowName, readOnly = false }) => {
  const [activeTab, setActiveTab] = useState('cron');

  // --- Cron state ---
  const [crons, setCrons] = useState<CronItem[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [cronForm] = Form.useForm();
  const [editingCron, setEditingCron] = useState<CronItem | null>(null);

  // --- Git hook state ---
  const [hooks, setHooks] = useState<GitHookItem[]>([]);
  const [hookLoading, setHookLoading] = useState(false);
  const [hookModalOpen, setHookModalOpen] = useState(false);
  const [hookForm] = Form.useForm();
  const [hookPresetRepo, setHookPresetRepo] = useState<GitHookItem['main_repo'] | null>(null);

  // --- General hook (custom webhook) state ---
  const [generalHooks, setGeneralHooks] = useState<GeneralHookItem[]>([]);
  const [generalLoading, setGeneralLoading] = useState(false);
  const [generalModalOpen, setGeneralModalOpen] = useState(false);
  const [generalForm] = Form.useForm();

  const loadCrons = useCallback(async () => {
    if (!workflowName) return;
    setCronLoading(true);
    try {
      const res = await http.get<CronItem[]>(`/api/aslan/workflow/v4/cron?workflowName=${encodeURIComponent(workflowName)}`, {
        skipErrorHandler: true,
      });
      setCrons(Array.isArray(res) ? res : []);
    } catch {
      setCrons([]);
    } finally {
      setCronLoading(false);
    }
  }, [workflowName]);

  const loadGeneralHooks = useCallback(async () => {
    if (!workflowName) return;
    setGeneralLoading(true);
    try {
      const list = await workflowApi.listGeneralHooks(workflowName);
      setGeneralHooks(list);
    } catch {
      setGeneralHooks([]);
    } finally {
      setGeneralLoading(false);
    }
  }, [workflowName]);

  const handleCreateGeneralHook = async () => {
    try {
      const values = await generalForm.validateFields();
      // 从 preset 取服务端渲染的最新工作流执行参数（后端要求 workflow_arg 非空）
      let workflowArg: unknown;
      try {
        const preset = await workflowApi.getGeneralHookPreset(workflowName);
        workflowArg = preset?.workflow_arg;
      } catch {
        // preset 失败时交由服务端校验
      }
      await workflowApi.createGeneralHook(workflowName, {
        name: values.name,
        enabled: values.enabled ?? true,
        description: values.description || '',
        workflow_arg: workflowArg,
      });
      feedback.message.success('通用 Webhook 触发器已创建');
      setGeneralModalOpen(false);
      loadGeneralHooks();
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '创建失败');
      }
    }
  };

  const handleDeleteGeneralHook = async (item: GeneralHookItem) => {
    try {
      await workflowApi.deleteGeneralHook(workflowName, item.name);
      feedback.message.success('通用 Webhook 触发器已删除');
      loadGeneralHooks();
    } catch {
      // Handled
    }
  };

  const loadHooks = useCallback(async () => {
    if (!workflowName) return;
    setHookLoading(true);
    try {
      const res = await http.get<GitHookItem[]>(
        `/api/aslan/workflow/v4/webhook?workflowName=${encodeURIComponent(workflowName)}`,
        { skipErrorHandler: true }
      );
      setHooks(Array.isArray(res) ? res : []);
    } catch {
      setHooks([]);
    } finally {
      setHookLoading(false);
    }
  }, [workflowName]);

  useEffect(() => {
    if (open) {
      loadCrons();
      loadHooks();
      loadGeneralHooks();
    }
  }, [open, loadCrons, loadHooks, loadGeneralHooks]);

  const openCronModal = (item: CronItem | null) => {
    setEditingCron(item);
    if (item) {
      cronForm.setFieldsValue({
        frequency: item.frequency,
        time: item.time ? dayjs(item.time, 'HH:mm') : undefined,
        number: item.number,
        max_failures: item.max_failures || 0,
        enabled: item.enabled,
      });
    } else {
      cronForm.resetFields();
      cronForm.setFieldsValue({ frequency: 'day', time: dayjs().hour(9).minute(0), number: 10, max_failures: 0, enabled: true });
    }
    setCronModalOpen(true);
  };

  const handleCronSave = async () => {
    try {
      const values = await cronForm.validateFields();
      // 从 preset 取服务端渲染的最新工作流执行参数
      let presetArgs: unknown;
      try {
        const preset = await http.get<{ workflow_v4_args?: unknown }>(
          `/api/aslan/workflow/v4/cron/preset?workflowName=${encodeURIComponent(workflowName)}`,
          { skipErrorHandler: true }
        );
        presetArgs = preset?.workflow_v4_args;
      } catch {
        // preset 失败时交由服务端校验
      }

      const body: Record<string, unknown> = {
        id: editingCron?.id || undefined,
        enabled: values.enabled ?? true,
        frequency: values.frequency,
        time: values.time ? values.time.format('HH:mm') : '',
        number: Number(values.number) || 0,
        max_failures: Number(values.max_failures) || 0,
        workflow_v4_args: presetArgs,
      };

      if (editingCron) {
        await http.put('/api/aslan/workflow/v4/cron', body);
        feedback.message.success('定时触发器已更新');
      } else {
        await http.post(`/api/aslan/workflow/v4/cron/${encodeURIComponent(workflowName)}`, body);
        feedback.message.success('定时触发器已创建');
      }
      setCronModalOpen(false);
      loadCrons();
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '定时触发器保存失败');
      }
    }
  };

  const handleDeleteCron = async (item: CronItem) => {
    try {
      await http.delete(`/api/aslan/workflow/v4/cron/${encodeURIComponent(workflowName)}/trigger/${item.id}`);
      feedback.message.success('定时触发器已删除');
      loadCrons();
    } catch {
      // Handled
    }
  };

  const handleCronToggle = async (item: CronItem) => {
    try {
      await http.put('/api/aslan/workflow/v4/cron', { ...item, enabled: !item.enabled });
      feedback.message.success(`定时触发器已${!item.enabled ? '启用' : '停用'}`);
      loadCrons();
    } catch {
      // Handled
    }
  };

  const openHookModal = async () => {
    setHookPresetRepo(null);
    try {
      const preset = await http.get<GitHookItem>(
        `/api/aslan/workflow/v4/webhook/preset?workflowName=${encodeURIComponent(workflowName)}`,
        { skipErrorHandler: true }
      );
      setHookPresetRepo(preset?.main_repo || null);
    } catch {
      setHookPresetRepo(null);
    }
    hookForm.resetFields();
    hookForm.setFieldsValue({ enabled: true, auto_cancel: false });
    setHookModalOpen(true);
  };

  const handleHookSave = async () => {
    try {
      const values = await hookForm.validateFields();
      const body = {
        name: values.name,
        description: values.description || '',
        auto_cancel: values.auto_cancel || false,
        enabled: values.enabled ?? true,
        is_manual: false,
        main_repo: hookPresetRepo || undefined,
        workflow_name: workflowName,
      };
      await http.post(`/api/aslan/workflow/v4/webhook/${encodeURIComponent(workflowName)}`, body);
      feedback.message.success('Git 触发器已创建');
      setHookModalOpen(false);
      loadHooks();
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || 'Git 触发器保存失败');
      }
    }
  };

  const handleDeleteHook = async (item: GitHookItem) => {
    try {
      await http.delete(`/api/aslan/workflow/v4/webhook/${encodeURIComponent(workflowName)}/trigger/${item.name}`);
      feedback.message.success('Git 触发器已删除');
      loadHooks();
    } catch {
      // Handled
    }
  };

  const cronColumns: ColumnsType<CronItem> = [
    {
      title: '触发规则',
      key: 'frequency',
      render: (_, r) => {
        if (r.frequency === 'minutes' || r.frequency === 'hours') {
          return <Tag color="blue">{`每 ${r.number} ${r.frequency === 'minutes' ? '分钟' : '小时'}`}</Tag>;
        }
        return <Tag color="geekblue">{`${FREQ_LABEL[r.frequency] || r.frequency} ${r.time || ''}`}</Tag>;
      },
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cron',
      key: 'cron',
      render: (c) => <Text code style={{ fontSize: 12 }}>{String(c || '-')}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (_, r) => (
        <Switch size="small" checked={r.enabled} disabled={readOnly} onChange={() => handleCronToggle(r)} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Space orientation="horizontal">
          <Button type="link" size="small" disabled={readOnly} onClick={() => openCronModal(r)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该定时触发器？" onConfirm={() => handleDeleteCron(r)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger disabled={readOnly}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hookColumns: ColumnsType<GitHookItem> = [
    {
      title: '触发器名称',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong>{String(n || '-')}</Text>,
    },
    {
      title: '代码仓库',
      key: 'repo',
      render: (_, r) => (
        <Text code style={{ fontSize: 12 }}>
          {`${r.main_repo?.repo_owner || r.main_repo?.repo_namespace || '-'}/${r.main_repo?.repo_name || '-'} @ ${r.main_repo?.branch || '-'}`}
        </Text>
      ),
    },
    {
      title: '事件',
      key: 'events',
      render: (_, r) => (
        <Space orientation="horizontal" size={4} wrap>
          {(r.main_repo?.events || []).map((e) => (
            <Tag key={e} color="geekblue">{e}</Tag>
          ))}
          {(r.main_repo?.events || []).length === 0 && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: '自动取消',
      dataIndex: 'auto_cancel',
      key: 'auto_cancel',
      render: (v) => (v ? <Tag color="orange">开启</Tag> : <Tag color="default">关闭</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Popconfirm title={`确定删除 Git 触发器 [${r.name}]？`} onConfirm={() => handleDeleteHook(r)} okText="删除" cancelText="取消">
          <Button type="link" size="small" danger disabled={readOnly}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Drawer
      title={`触发器配置: ${workflowName}`}
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'cron',
            label: (
              <span>
                <ClockCircleOutlined /> 定时触发
              </span>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Space>
                    <Button icon={<ReloadOutlined />} size="small" onClick={loadCrons} />
                    {!readOnly && (
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCronModal(null)}>
                        新建定时触发
                      </Button>
                    )}
                  </Space>
                </div>
                <Table
                  dataSource={crons}
                  columns={cronColumns}
                  rowKey="id"
                  loading={cronLoading}
                  pagination={false}
                  size="small"
                  locale={{
                    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无定时触发器" />,
                  }}
                />
              </div>
            ),
          },
          {
            key: 'webhook',
            label: (
              <span>
                <BranchesOutlined /> Git 触发
              </span>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button icon={<ReloadOutlined />} size="small" onClick={loadHooks} />
                  {!readOnly && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={openHookModal}
                    >
                      新建 Git 触发
                    </Button>
                  )}
                </div>
                <Table
                  dataSource={hooks}
                  columns={hookColumns}
                  rowKey="name"
                  loading={hookLoading}
                  pagination={false}
                  size="small"
                  locale={{
                    emptyText: (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Git 触发器（push/PR/tag 事件自动触发工作流）" />
                    ),
                  }}
                />
              </div>
            ),
          },
          {
            key: 'general',
            label: (
              <span>
                <ApiOutlined /> 通用 Webhook
              </span>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  {!readOnly && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        generalForm.resetFields();
                        generalForm.setFieldsValue({ enabled: true });
                        setGeneralModalOpen(true);
                      }}
                    >
                      新建通用 Webhook
                    </Button>
                  )}
                </div>
                <Table
                  dataSource={generalHooks}
                  rowKey="name"
                  loading={generalLoading}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '触发器名称',
                      dataIndex: 'name',
                      key: 'name',
                      render: (n) => <Text strong>{String(n || '-')}</Text>,
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      key: 'description',
                      ellipsis: true,
                      render: (d) => <Text type="secondary">{String(d || '-')}</Text>,
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      key: 'enabled',
                      render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag>,
                    },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_, r) => (
                        <Popconfirm
                          title={`确定删除通用 Webhook [${r.name}]？`}
                          onConfirm={() => handleDeleteGeneralHook(r)}
                          okText="删除"
                          cancelText="取消"
                        >
                          <Button type="link" size="small" danger disabled={readOnly}>
                            删除
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                  locale={{
                    emptyText: (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通用 Webhook 触发器（支持调用任意第三方系统接口触发工作流）" />
                    ),
                  }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Cron create/edit modal */}
      <Modal
        title={editingCron ? '编辑定时触发' : '新建定时触发'}
        open={cronModalOpen}
        onOk={handleCronSave}
        onCancel={() => setCronModalOpen(false)}
        okText={editingCron ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={cronForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="frequency" label="触发频率" rules={[{ required: true }]}>
            <Select options={FREQUENCY_OPTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.frequency !== c.frequency}>
            {({ getFieldValue }) => {
              const freq = getFieldValue('frequency');
              if (freq === 'minutes' || freq === 'hours') {
                return (
                  <Form.Item
                    name="number"
                    label={freq === 'minutes' ? '间隔分钟数' : '间隔小时数'}
                    rules={[{ required: true, message: '请输入间隔数值' }]}
                    initialValue={10}
                  >
                    <InputNumber min={1} max={freq === 'minutes' ? 59 : 23} style={{ width: 120 }} />
                  </Form.Item>
                );
              }
              return (
                <Form.Item name="time" label="触发时间" rules={[{ required: true, message: '请选择触发时间' }]}>
                  <TimePicker format="HH:mm" style={{ width: 140 }} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="max_failures" label="最大失败重试次数 (0 = 不重试)">
            <InputNumber min={0} max={10} style={{ width: 120 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Git hook create modal */}
      <Modal
        title="新建 Git 触发"
        open={hookModalOpen}
        onOk={handleHookSave}
        onCancel={() => setHookModalOpen(false)}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={hookForm} layout="vertical" style={{ marginTop: 16 }}>
          {hookPresetRepo ? (
            <Alert
              title={`代码仓库: ${hookPresetRepo.repo_owner || hookPresetRepo.repo_namespace || '-'}/${hookPresetRepo.repo_name || '-'}`}
              description={`分支: ${hookPresetRepo.branch || '-'}（来自工作流构建配置）`}
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
          ) : (
            <Alert
              title="未从工作流解析到代码仓库"
              description="请先在工作流编排中配置构建任务的代码源，再创建 Git 触发器。"
              type="warning"
              showIcon
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
          )}
          <Form.Item name="name" label="触发器名称" rules={[{ required: true, message: '请输入触发器名称' }]}>
            <Input placeholder="例如: main-branch-trigger" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="触发器用途说明" />
          </Form.Item>
          <Form.Item name="auto_cancel" label="自动取消重复构建" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* General webhook create modal */}
      <Modal
        title="新建通用 Webhook 触发"
        open={generalModalOpen}
        onOk={handleCreateGeneralHook}
        onCancel={() => setGeneralModalOpen(false)}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={generalForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="触发器名称"
            rules={[
              { required: true, message: '请输入触发器名称' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线与连字符' },
            ]}
          >
            <Input placeholder="例如: internal-cmdb-trigger" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="触发器用途说明（例如: 由内部 CMDB 变更触发）" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Alert
            title="Webhook 调用地址"
            description={`POST /api/aslan/workflow/v4/generalhook/${workflowName}/${'{name}'}/webhook，请求体中通过触发器名称匹配。`}
            type="info"
            showIcon
            style={{ borderRadius: 6 }}
          />
        </Form>
      </Modal>
    </Drawer>
  );
};

export default TriggerPanel;
