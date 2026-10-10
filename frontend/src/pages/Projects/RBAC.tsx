import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Popconfirm,
  Typography,
  Tabs,
  Radio,
  Drawer,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  TreeSelect,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  UserOutlined,
  TeamOutlined,
  DeleteOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  rbacApi,
  type PolicyRole,
  type RoleBindingResp,
  type ResourceAction,
} from '../../api/rbac';
import { settingsApi, type UserManagementItem, type UserGroupItem } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

// 动作定义里常见资源名 → 中文标签（未收录的显示原文）
const RESOURCE_LABELS: Record<string, string> = {
  Test: '测试', Build: '构建', Workflow: '工作流', Environment: '环境', Production: '生产环境',
  Service: '服务', Project: '项目', Delivery: '版本交付', ReleasePlan: '发布计划',
  Template: '模板', Cluster: '集群', Notification: '通知', DataCenter: '数据中心',
  Scan: '扫描', Sprint: '迭代', VariableSet: '变量组', Quality: '质量', Dashboard: '看板',
};
const resourceLabel = (r: string) => RESOURCE_LABELS[r] || r;

const RBACPage: React.FC = () => {
  const { projectName = '' } = useParams<{ projectName: string }>();
  const [activeTab, setActiveTab] = useState('bindings');

  // ---------- 绑定 ----------
  const [bindings, setBindings] = useState<RoleBindingResp[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [addBindingOpen, setAddBindingOpen] = useState(false);
  const [bindingForm] = Form.useForm();
  const identityType = Form.useWatch('identity_type', bindingForm) || 'user';
  const bindingRole = Form.useWatch('role', bindingForm);

  // ---------- 角色 ----------
  const [roles, setRoles] = useState<PolicyRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [roleForm] = Form.useForm();
  const [actions, setActions] = useState<ResourceAction[]>([]);
  const [detailRole, setDetailRole] = useState<{ name: string; desc: string; rules: ResourceAction[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [users, setUsers] = useState<UserManagementItem[]>([]);
  const [groups, setGroups] = useState<UserGroupItem[]>([]);

  const loadBindings = async () => {
    if (!projectName) return;
    setBindingsLoading(true);
    const list = await rbacApi.listRoleBindings(projectName);
    setBindings(list);
    setBindingsLoading(false);
  };

  const loadRoles = async () => {
    if (!projectName) return;
    setRolesLoading(true);
    const list = await rbacApi.listRoles(projectName);
    setRoles(list);
    setRolesLoading(false);
  };

  useEffect(() => {
    loadBindings();
    loadRoles();
    // 用户来源用 /api/v1/users/brief（无管理员限制；/users/search 仅系统管理员可用）
    settingsApi.getUsersBrief().then(setUsers);
    settingsApi.getUserGroups().then(setGroups);
    rbacApi.getResourceActions().then(setActions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  // 已绑定的 uid/gid 集合，避免重复添加
  const boundUids = useMemo(
    () => new Set(bindings.filter((b) => b.binding_type === 'user').map((b) => b.user_info?.uid || '')),
    [bindings]
  );
  const boundGids = useMemo(
    () => new Set(bindings.filter((b) => b.binding_type === 'group').map((b) => b.group_info?.group_id || '')),
    [bindings]
  );

  const handleAddBinding = async () => {
    try {
      const values = await bindingForm.validateFields();
      const identity: { identity_type: 'user' | 'group'; uid?: string; gid?: string } =
        values.identity_type === 'group'
          ? { identity_type: 'group', gid: values.gid }
          : { identity_type: 'user', uid: values.uid };
      await rbacApi.createRoleBinding(projectName, { identities: [identity], role: values.role });
      feedback.message.success('绑定已添加');
      setAddBindingOpen(false);
      bindingForm.resetFields();
      loadBindings();
      return true;
    } catch {
      return false;
    }
  };

  const handleRemoveBinding = async (b: RoleBindingResp) => {
    try {
      if (b.binding_type === 'group' && b.group_info) {
        await rbacApi.deleteRoleBindingForGroup(projectName, b.group_info.group_id);
      } else if (b.user_info) {
        await rbacApi.deleteRoleBindingForUser(projectName, b.user_info.uid);
      }
      feedback.message.success('绑定已移除');
      loadBindings();
    } catch {
      feedback.message.error('移除绑定失败');
    }
  };

  const handleCreateRole = async () => {
    try {
      const values = await roleForm.validateFields();
      await rbacApi.createRole(projectName, {
        name: values.name,
        desc: values.desc || '',
        actions: values.actions || [],
      });
      feedback.message.success('角色已创建');
      setCreateRoleOpen(false);
      roleForm.resetFields();
      loadRoles();
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteRole = async (name: string) => {
    try {
      await rbacApi.deleteRole(projectName, name);
      feedback.message.success(`角色 [${name}] 已删除`);
      loadRoles();
    } catch {
      feedback.message.error('删除角色失败（内置角色不可删除）');
    }
  };

  const openRoleDetail = async (name: string) => {
    setDetailLoading(true);
    try {
      const role = await rbacApi.getRole(projectName, name);
      setDetailRole({ name: role.name, desc: role.desc, rules: role.rules || [] });
    } catch {
      feedback.message.error('获取角色规则失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 动作选择树：按 resource 分组，叶子为 "Resource:Verb"
  const actionTreeData = useMemo(
    () =>
      actions.map((a) => ({
        value: a.resource,
        title: resourceLabel(a.resource),
        selectable: false,
        disableCheckbox: true,
        children: a.verbs.map((v) => ({
          value: `${a.resource}:${v}`,
          title: v,
        })),
      })),
    [actions]
  );

  const bindingColumns: ColumnsType<RoleBindingResp> = [
    {
      title: '类型',
      dataIndex: 'binding_type',
      width: 100,
      render: (t: string) =>
        t === 'group' ? (
          <Tag icon={<TeamOutlined />} color="purple">用户组</Tag>
        ) : (
          <Tag icon={<UserOutlined />} color="blue">用户</Tag>
        ),
    },
    {
      title: '成员',
      key: 'member',
      render: (_: unknown, b) => {
        if (b.binding_type === 'group' && b.group_info) {
          return (
            <Space size={4}>
              <Text strong>{b.group_info.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({b.group_info.user_infos?.length || 0} 名成员)
              </Text>
            </Space>
          );
        }
        if (b.user_info) {
          return (
            <Space size={4}>
              <Text strong>{b.user_info.username}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{b.user_info.account}</Text>
            </Space>
          );
        }
        return '-';
      },
    },
    {
      title: '角色',
      key: 'roles',
      render: (_: unknown, b) =>
        (b.roles || []).length > 0 ? (
          <Space size={4} wrap>
            {b.roles.map((r) => (
              <Tag key={r} color="geekblue">{r}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">未分配角色</Text>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, b) => (
        <Popconfirm title="确定移除该绑定？" onConfirm={() => handleRemoveBinding(b)}>
          <Button size="small" type="link" danger icon={<DeleteOutlined />}>移除</Button>
        </Popconfirm>
      ),
    },
  ];

  const roleColumns: ColumnsType<PolicyRole> = [
    {
      title: '角色名',
      dataIndex: 'name',
      render: (n: string, r) => (
        <Space size={4}>
          <Text strong copyable={false}>{n}</Text>
          {r.type === 'system' && <Tag color="gold">内置</Tag>}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'desc', ellipsis: true, render: (d: string) => d || '-' },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => openRoleDetail(r.name)}>
            权限规则
          </Button>
          {r.type !== 'system' && (
            <Popconfirm title={`确定删除角色 [${r.name}]？`} onConfirm={() => handleDeleteRole(r.name)}>
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const identityOptions = useMemo(() => {
    if (identityType === 'group') {
      return groups
        .filter((g) => !boundGids.has(g.id))
        .map((g) => ({ value: g.id, label: `${g.name || g.id}` }));
    }
    return users
      .filter((u) => !boundUids.has(u.uid))
      .map((u) => ({ value: u.uid, label: `${u.name || u.account} (${u.account})` }));
  }, [identityType, users, groups, boundUids, boundGids]);

  const roleOptions = roles.map((r) => ({ value: r.name, label: r.desc ? `${r.name} - ${r.desc}` : r.name }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card variant="borderless" style={{ borderRadius: 8 }}>
        <Space size="middle">
          <SafetyCertificateOutlined style={{ fontSize: 20, color: '#0066ff' }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>项目权限 (RBAC)</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                管理项目 {projectName} 的成员角色绑定与自定义角色权限
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      <Card variant="borderless" style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'bindings',
              label: '成员绑定',
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      为项目成员（用户/用户组）分配角色
                    </Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        bindingForm.setFieldsValue({ identity_type: 'user' });
                        setAddBindingOpen(true);
                      }}
                    >
                      添加绑定
                    </Button>
                  </div>
                  <Table
                    rowKey={(b) => `${b.binding_type}-${b.user_info?.uid || b.group_info?.group_id}`}
                    columns={bindingColumns}
                    dataSource={bindings}
                    loading={bindingsLoading}
                    pagination={false}
                    size="small"
                    locale={{
                      emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员绑定" />,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'roles',
              label: '项目角色',
              children: (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      项目内自定义角色及其权限规则（内置角色只读）
                    </Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateRoleOpen(true)}>
                      新建角色
                    </Button>
                  </div>
                  <Table
                    rowKey="name"
                    columns={roleColumns}
                    dataSource={roles}
                    loading={rolesLoading}
                    pagination={false}
                    size="small"
                    locale={{
                      emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无角色" />,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 添加绑定 */}
      <Modal
        title="添加角色绑定"
        open={addBindingOpen}
        onCancel={() => setAddBindingOpen(false)}
        onOk={handleAddBinding}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={bindingForm} layout="vertical" initialValues={{ identity_type: 'user' }}>
          <Form.Item name="identity_type" label="绑定对象类型">
            <Radio.Group>
              <Radio value="user">用户</Radio>
              <Radio value="group">用户组</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name={identityType === 'group' ? 'gid' : 'uid'}
            label={identityType === 'group' ? '选择用户组' : '选择用户'}
            rules={[{ required: true, message: '请选择绑定对象' }]}
          >
            <Select
              placeholder={identityType === 'group' ? '选择用户组' : '选择用户'}
              options={identityOptions}
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
          <Form.Item name="role" label="分配角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色" options={roleOptions} showSearch={{ optionFilterProp: 'label' }} />
          </Form.Item>
          {bindingRole && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              可先在「项目角色」页查看角色的权限规则
            </Text>
          )}
        </Form>
      </Modal>

      {/* 新建角色 */}
      <Modal
        title="新建项目角色"
        open={createRoleOpen}
        onCancel={() => setCreateRoleOpen(false)}
        onOk={handleCreateRole}
        okText="创建"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[
              { required: true, message: '请输入角色名称' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/, message: '以字母开头，仅含字母/数字/下划线/中划线' },
            ]}
          >
            <Input placeholder="例如 project-developer" />
          </Form.Item>
          <Form.Item name="desc" label="描述">
            <Input placeholder="角色用途说明 (可选)" />
          </Form.Item>
          <Form.Item
            name="actions"
            label="权限动作 (按资源分组，选中叶子节点即授予 Resource:Verb)"
          >
            <TreeSelect
              treeData={actionTreeData}
              multiple
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_ALL}
              placeholder="选择要授予的动作"
              maxTagCount={8}
              treeDefaultExpandAll={false}
              style={{ maxHeight: 320 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色规则详情 */}
      <Drawer
        title={`权限规则: ${detailRole?.name || ''}`}
        placement="right"
        open={!!detailRole}
        onClose={() => setDetailRole(null)}
        size="large"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailRole && detailRole.rules.length > 0 ? (
          <Table
            rowKey="resource"
            dataSource={detailRole.rules}
            pagination={false}
            size="small"
            columns={[
              {
                title: '资源',
                dataIndex: 'resource',
                render: (r: string) => <Text strong>{resourceLabel(r)} <Text type="secondary" style={{ fontSize: 12 }}>({r})</Text></Text>,
              },
              {
                title: '允许的动作',
                dataIndex: 'verbs',
                render: (verbs: string[]) => (
                  <Space size={4} wrap>
                    {verbs.map((v) => (
                      <Tag key={v} color="green">{v}</Tag>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该角色暂无权限规则" style={{ padding: '60px 0' }} />
        )}
      </Drawer>
    </div>
  );
};

export default RBACPage;