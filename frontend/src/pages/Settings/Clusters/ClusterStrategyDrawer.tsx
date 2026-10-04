import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Button,
  Tag,
  Space,
  Popconfirm,
  Tooltip,
  Modal,
  Form,
  Input,
  Radio,
  Switch,
  Select,
  Typography,
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  settingsApi,
  type ClusterItem,
  type ClusterScheduleStrategy,
} from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ClusterStrategyDrawerProps {
  open: boolean;
  onClose: () => void;
  cluster: ClusterItem | null;
  onSuccess?: () => void;
}

export const ClusterStrategyDrawer: React.FC<ClusterStrategyDrawerProps> = ({
  open,
  onClose,
  cluster,
  onSuccess,
}) => {
  const [strategies, setStrategies] = useState<ClusterScheduleStrategy[]>([]);
  const [references, setReferences] = useState<Record<string, boolean>>({});
  const [loadingRefs, setLoadingRefs] = useState<boolean>(false);

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingStrategy, setEditingStrategy] = useState<ClusterScheduleStrategy | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [form] = Form.useForm();
  const currentStrategyType = Form.useWatch('strategy', form);

  const fetchReferences = useCallback(async (clusterId: string) => {
    setLoadingRefs(true);
    try {
      const refs = await settingsApi.getClusterStrategyReferences(clusterId);
      const map: Record<string, boolean> = {};
      refs.forEach((r) => {
        if (r.strategy_id) {
          map[r.strategy_id] = Boolean(r.has_references);
        }
      });
      setReferences(map);
    } catch {
      setReferences({});
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    if (open && cluster) {
      setStrategies(cluster.advanced_config?.schedule_strategy || []);
      fetchReferences(cluster.id);
    } else {
      setStrategies([]);
      setReferences({});
    }
  }, [open, cluster, fetchReferences]);

  const handleOpenAdd = () => {
    setEditingStrategy(null);
    form.resetFields();
    form.setFieldsValue({
      strategy: 'normal',
      default: strategies.length === 0,
      node_labels: [],
      tolerations: '',
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (strat: ClusterScheduleStrategy) => {
    setEditingStrategy(strat);
    form.setFieldsValue({
      strategy_name: strat.strategy_name,
      strategy: strat.strategy || 'normal',
      default: Boolean(strat.default),
      node_labels: strat.node_labels || [],
      tolerations: strat.tolerations || '',
    });
    setModalVisible(true);
  };

  const handleSaveStrategy = async () => {
    if (!cluster) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: ClusterScheduleStrategy = {
        strategy_id: editingStrategy?.strategy_id,
        strategy_name: values.strategy_name.trim(),
        strategy: values.strategy,
        default: Boolean(values.default),
        node_labels: values.strategy !== 'normal' ? values.node_labels || [] : [],
        tolerations: values.tolerations || '',
      };

      const updated = await settingsApi.addOrUpdateClusterStrategy(cluster.id, payload);
      feedback.message.success(`调度策略「${payload.strategy_name}」保存成功`);
      setModalVisible(false);
      setStrategies(updated.advanced_config?.schedule_strategy || []);
      await fetchReferences(cluster.id);
      onSuccess?.();
    } catch (err: any) {
      if (err?.errorFields) return;
      feedback.message.error(err?.response?.data?.message || err?.message || '保存调度策略失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (strat: ClusterScheduleStrategy) => {
    if (!cluster) return;
    try {
      const payload: ClusterScheduleStrategy = {
        ...strat,
        default: true,
      };
      const updated = await settingsApi.addOrUpdateClusterStrategy(cluster.id, payload);
      feedback.message.success(`已将「${strat.strategy_name}」设为默认策略`);
      setStrategies(updated.advanced_config?.schedule_strategy || []);
      onSuccess?.();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '设置默认策略失败');
    }
  };

  const handleDeleteStrategy = async (strategyId: string, name: string) => {
    if (!cluster) return;
    try {
      const updated = await settingsApi.deleteClusterStrategy(cluster.id, strategyId);
      feedback.message.success(`调度策略「${name}」已成功删除`);
      setStrategies(updated.advanced_config?.schedule_strategy || []);
      await fetchReferences(cluster.id);
      onSuccess?.();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '删除调度策略失败');
    }
  };

  const columns: ColumnsType<ClusterScheduleStrategy> = [
    {
      title: '策略名称',
      dataIndex: 'strategy_name',
      key: 'strategy_name',
      width: 160,
      render: (text: string, record) => (
        <Space orientation="horizontal" size={6}>
          <Text strong>{text}</Text>
          {record.default && <Tag color="blue">默认策略</Tag>}
        </Space>
      ),
    },
    {
      title: '调度方式',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (val: string) => {
        if (val === 'required') return <Tag color="purple">强制调度</Tag>;
        if (val === 'preferred') return <Tag color="geekblue">优先调度</Tag>;
        return <Tag color="default">随机调度</Tag>;
      },
    },
    {
      title: '节点匹配标签',
      dataIndex: 'node_labels',
      key: 'node_labels',
      render: (labels?: string[]) => {
        if (!labels || labels.length === 0) {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space wrap size={[4, 4]}>
            {labels.map((lbl, idx) => (
              <Tag key={idx} color="cyan">
                {lbl}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '容忍度',
      dataIndex: 'tolerations',
      key: 'tolerations',
      width: 100,
      render: (tol?: string) => {
        if (!tol || !tol.trim()) return <Text type="secondary">未配置</Text>;
        return (
          <Tooltip title={<pre style={{ margin: 0, maxHeight: 200, overflow: 'auto' }}>{tol}</pre>}>
            <Tag color="orange" style={{ cursor: 'pointer' }}>
              已配置
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '引用状态',
      key: 'reference',
      width: 100,
      render: (_, record) => {
        const hasRef = record.strategy_id ? references[record.strategy_id] : false;
        return hasRef ? (
          <Tooltip title="被工作流任务或构建引用中，不可删除">
            <Tag color="error">已引用</Tag>
          </Tooltip>
        ) : (
          <Tag color="success">未引用</Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => {
        const isDefault = Boolean(record.default);
        const hasRef = record.strategy_id ? references[record.strategy_id] : false;
        const cantDelete = isDefault || hasRef;
        const cantDeleteReason = isDefault ? '默认策略不可删除' : '策略被引用，不可删除';

        return (
          <Space size={8}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            >
              编辑
            </Button>
            {!isDefault && (
              <Button
                type="link"
                size="small"
                icon={<StarOutlined />}
                onClick={() => handleSetDefault(record)}
              >
                设为默认
              </Button>
            )}
            {cantDelete ? (
              <Tooltip title={cantDeleteReason}>
                <Button type="link" size="small" danger disabled icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Tooltip>
            ) : (
              <Popconfirm
                title="确定删除该调度策略？"
                description={`删除调度策略「${record.strategy_name}」后将无法被工作流继续指定。`}
                onConfirm={() => record.strategy_id && handleDeleteStrategy(record.strategy_id, record.strategy_name)}
                okText="删除"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <span>集群调度策略配置</span>
            {cluster && <Tag color="blue">{cluster.name}</Tag>}
          </Space>
        }
        placement="right"
        size={780}
        open={open}
        onClose={onClose}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
            新建策略
          </Button>
        }
      >
        <Card
          variant="borderless"
          style={{ background: '#f8fafc', marginBottom: 16, borderRadius: 6 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Space align="start">
            <InfoCircleOutlined style={{ color: '#0066ff', marginTop: 3 }} />
            <div>
              <Text strong>工作流节点调度策略说明</Text>
              <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
                配置工作流任务、构建或测试容器调度到当前 Kubernetes 集群时的 Pod 节点亲和性与容忍度。可设置「默认策略」，新建任务未指定策略时将自动选用默认规则。
              </Paragraph>
            </div>
          </Space>
        </Card>

        <Table
          rowKey={(r) => r.strategy_id || r.strategy_name}
          columns={columns}
          dataSource={strategies}
          loading={loadingRefs}
          pagination={false}
          size="middle"
        />
      </Drawer>

      {/* Add / Edit Strategy Modal */}
      <Modal
        title={editingStrategy ? `编辑调度策略 - ${editingStrategy.strategy_name}` : '新建集群调度策略'}
        open={modalVisible}
        onOk={handleSaveStrategy}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ strategy: 'normal', default: false, node_labels: [] }}
        >
          <Form.Item
            name="strategy_name"
            label="策略名称"
            rules={[
              { required: true, message: '请输入策略名称' },
              { max: 15, message: '策略名称长度不能超过 15 个字符' },
            ]}
          >
            <Input placeholder="例如: 高性能计算节点" maxLength={15} showCount />
          </Form.Item>

          <Form.Item
            name="default"
            label="设为默认策略"
            valuePropName="checked"
            extra="勾选后，调度到该集群未指定策略的工作流任务将默认选用该规则。"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="strategy"
            label="调度方式"
            rules={[{ required: true, message: '请选择调度方式' }]}
          >
            <Radio.Group>
              <Radio value="normal">随机调度 (Normal)</Radio>
              <Radio value="required">强制调度 (Required)</Radio>
              <Radio value="preferred">优先调度 (Preferred)</Radio>
            </Radio.Group>
          </Form.Item>

          {currentStrategyType && currentStrategyType !== 'normal' && (
            <Form.Item
              name="node_labels"
              label="节点匹配标签 (Node Labels)"
              rules={[
                {
                  validator(_, val) {
                    if ((!val || val.length === 0) && currentStrategyType !== 'normal') {
                      return Promise.reject(new Error('强制或优先调度必须至少指定一个节点标签'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              extra="输入 key=value 并按回车添加标签，例如: kubernetes.io/arch=amd64 或 disktype=ssd"
            >
              <Select
                mode="tags"
                placeholder="键入标签后按回车添加，如 env=prod"
                tokenSeparators={[',', ' ']}
              />
            </Form.Item>
          )}

          <Form.Item
            name="tolerations"
            label="配置容忍度 (Tolerations)"
            extra="配置 Pod 容忍的污点 (Toleration YAML 配置)，可选。"
          >
            <TextArea
              rows={4}
              placeholder={`- key: "dedicated"\n  operator: "Equal"\n  value: "zadig"\n  effect: "NoSchedule"`}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ClusterStrategyDrawer;
