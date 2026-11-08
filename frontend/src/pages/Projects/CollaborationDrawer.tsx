import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Popconfirm,
  Empty,
  Alert,
  InputNumber,
  Row,
  Col,
} from 'antd';
import {
  TeamOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import collaborationApi, {
  type CollaborationModeItem,
  type CollaborationNewResp,
  type Identity,
} from '../../api/collaboration';
import { settingsApi, type UserManagementItem } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface CollaborationDrawerProps {
  open: boolean;
  projectName: string;
  onClose: () => void;
}

function buildMemberInfo(members: string[]): Identity[] {
  return members.map((uid) => ({ identity_type: 'user' as const, uid }));
}

export const CollaborationDrawer: React.FC<CollaborationDrawerProps> = ({
  open,
  projectName,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [modes, setModes] = useState<CollaborationModeItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<CollaborationNewResp | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [usersBrief, setUsersBrief] = useState<UserManagementItem[]>([]);

  // 新建 / 编辑 Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<CollaborationModeItem | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchModes = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const data = await collaborationApi.getCollaborationModes(projectName);
      setModes(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取协同模式列表失败';
      feedback.message.error(msg);
      setModes([]);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  const checkSync = useCallback(async () => {
    if (!projectName) return;
    try {
      const res = await collaborationApi.getCollaborationNew(projectName);
      setSyncStatus(res);
    } catch {
      setSyncStatus(null);
    }
  }, [projectName]);

  const fetchUsersBrief = useCallback(async () => {
    try {
      const users = await settingsApi.getUsersBrief();
      setUsersBrief(users);
    } catch {
      setUsersBrief([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchModes();
      checkSync();
      fetchUsersBrief();
    }
  }, [open, fetchModes, checkSync, fetchUsersBrief]);

  const handleSync = async () => {
    if (!projectName) return;
    setSyncing(true);
    try {
      await collaborationApi.syncCollaborationInstance(projectName, syncStatus?.product || []);
      feedback.message.success('协同模式资源实例已成功同步');
      checkSync();
      fetchModes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '同步协同实例失败';
      feedback.message.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMode(null);
    form.resetFields();
    form.setFieldsValue({
      recycle_day: 7,
      deploy_type: 'k8s',
      members: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CollaborationModeItem) => {
    setEditingMode(item);
    form.setFieldsValue({
      name: item.name,
      members: item.members || [],
      deploy_type: item.deploy_type || 'k8s',
      recycle_day: item.recycle_day ?? 7,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!projectName) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const members: string[] = Array.isArray(values.members) ? values.members : [];
      const member_info = buildMemberInfo(members);

      if (editingMode) {
        // P0-3: 更新时完整保留 products / workflows / deploy_type / project_name，避免 $set 清空
        await collaborationApi.updateCollaborationMode(projectName, editingMode.name, {
          name: values.name.trim(),
          project_name: projectName,
          members,
          member_info,
          deploy_type: values.deploy_type || editingMode.deploy_type || 'k8s',
          recycle_day: Number(values.recycle_day),
          products: editingMode.products || [],
          workflows: editingMode.workflows || [],
          revision: editingMode.revision,
        });
        feedback.message.success('更新协同模式成功');
      } else {
        await collaborationApi.createCollaborationMode(projectName, {
          name: values.name.trim(),
          project_name: projectName,
          members,
          member_info,
          deploy_type: values.deploy_type || 'k8s',
          recycle_day: Number(values.recycle_day),
          products: [],
          workflows: [],
        });
        feedback.message.success('创建协同模式成功');
      }
      setModalOpen(false);
      fetchModes();
      checkSync();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存协同模式失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!projectName) return;
    try {
      await collaborationApi.deleteCollaborationMode(projectName, name);
      feedback.message.success('协同模式已删除');
      fetchModes();
      checkSync();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除协同模式失败';
      feedback.message.error(msg);
    }
  };

  const userOptions = usersBrief.map((u) => ({
    value: u.uid,
    label: `${u.name || u.account || u.uid}${u.account && u.name ? ` (${u.account})` : ''}`,
  }));

  const resolveMemberLabel = (uid: string) => {
    const found = usersBrief.find((u) => u.uid === uid);
    if (!found) return uid;
    return found.name || found.account || uid;
  };

  // P0-4: product / workflow / ifSync 任一有内容即展示同步提示
  const showSyncAlert = Boolean(
    syncStatus &&
      (syncStatus.ifSync ||
        (syncStatus.product && syncStatus.product.length > 0) ||
        (syncStatus.workflow && syncStatus.workflow.length > 0))
  );

  const columns: ColumnsType<CollaborationModeItem> = [
    {
      title: '协同模式名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space orientation="horizontal" size={6}>
          <TeamOutlined style={{ color: '#0066ff' }} />
          <Text strong style={{ fontSize: 13 }}>
            {name}
          </Text>
        </Space>
      ),
    },
    {
      title: '参与成员',
      dataIndex: 'members',
      key: 'members',
      render: (members: string[]) => {
        if (!members || members.length === 0) return <Text type="secondary">全员共享</Text>;
        return (
          <Space wrap size={[4, 4]}>
            {members.slice(0, 3).map((m) => (
              <Tag key={m} color="blue">
                {resolveMemberLabel(m)}
              </Tag>
            ))}
            {members.length > 3 && <Tag>+{members.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '环境数',
      key: 'products',
      width: 100,
      render: (_, r) => <Text>{r.products?.length || 0} 个</Text>,
    },
    {
      title: '工作流数',
      key: 'workflows',
      width: 100,
      render: (_, r) => <Text>{r.workflows?.length || 0} 个</Text>,
    },
    {
      title: '回收周期',
      dataIndex: 'recycle_day',
      key: 'recycle_day',
      width: 110,
      render: (d) => (d ? `${d} 天` : '永不自动回收'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该协同模式？"
            onConfirm={() => handleDelete(record.name)}
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
    <>
      <Drawer
        title={
          <Space>
            <TeamOutlined style={{ color: '#0066ff' }} />
            <span>协同模式管理 ({projectName})</span>
          </Space>
        }
        placement="right"
        open={open}
        onClose={onClose}
        size="large"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchModes} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建协同模式
            </Button>
          </Space>
        }
      >
        {/* P0-4: ifSync | product | workflow 任一有内容即展示 */}
        {showSyncAlert && (
          <Alert
            title="协同资源待同步"
            description="检测到团队协同策略已调整，包含为当前用户自动派生的专属环境或工作流，建议立即同步更新。"
            type="info"
            showIcon
            action={
              <Button
                type="primary"
                size="small"
                icon={<SyncOutlined spin={syncing} />}
                onClick={handleSync}
                loading={syncing}
              >
                立即同步实例
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            协同模式允许团队成员在同一基准项目下按需独占专属环境与工作流，提升多分支并发联调效率。
          </Text>
        </div>

        <Table
          rowKey="name"
          columns={columns}
          dataSource={modes}
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无协同模式配置，可点击右上角新建"
              />
            ),
          }}
        />
      </Drawer>

      {/* 新建 / 编辑协同模式 Modal */}
      <Modal
        title={editingMode ? '编辑协同模式' : '新建协同模式'}
        open={modalOpen}
        onOk={handleFormSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="协同模式名称"
            rules={[{ required: true, message: '请输入协同模式名称' }]}
          >
            <Input placeholder="例如：feature-dev-collab" disabled={!!editingMode} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="deploy_type" label="部署架构">
                <Select
                  options={[
                    { label: 'Kubernetes (K8s)', value: 'k8s' },
                    { label: 'Helm Chart', value: 'helm' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="recycle_day"
                label="资源回收周期 (天)"
                extra="0 为永不自动回收"
              >
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="members"
            label="参与成员"
            extra="按姓名/账号搜索选择；提交时 members 与 member_info 等长且集合一致。不选则默认对项目内所有成员开放协作"
          >
            <Select
              mode="multiple"
              showSearch={{
                optionFilterProp: 'label',
                filterOption: (input, option) => {
                  const label = String(option?.label ?? '').toLowerCase();
                  const value = String(option?.value ?? '').toLowerCase();
                  const q = input.toLowerCase();
                  return label.includes(q) || value.includes(q);
                },
              }}
              placeholder="搜索并选择成员"
              style={{ width: '100%' }}
              options={userOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CollaborationDrawer;
