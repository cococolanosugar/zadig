import React, { useEffect, useRef, useState } from 'react';
import {
  ProTable,
  ModalForm,
  ProFormText,
  ProFormSelect,
} from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Tabs, Space, Popconfirm, Typography, Form, Modal, Descriptions, Spin, Input } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  EditOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  type UserManagementItem,
  type UserGroupItem,
  type RoleItem,
} from '../../../api/settings';
import { rbacApi } from '../../../api/rbac';
import { authApi } from '../../../api/auth';
import { feedback } from '../../../utils/feedback';
import { useAuthStore } from '../../../stores/auth';
import { GroupMembersDrawer } from './GroupMembersDrawer';

const { Text, Title } = Typography;

export const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const userActionRef = useRef<ActionType>(null);
  const groupActionRef = useRef<ActionType>(null);
  // R16 任务4: 系统用户总数统计（GET /api/v1/users/count，异常时静默降级不影响表格）
  const [userCount, setUserCount] = useState<number | null>(null);
  const userInfo = useAuthStore((state) => state.userInfo);
  const currentAccount = userInfo?.account || '';

  // User Group management state
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroupItem | null>(null);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<UserGroupItem | null>(null);
  const [editGroupModalVisible, setEditGroupModalVisible] = useState<boolean>(false);

  // LOOP9-A2: 编辑用户
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserManagementItem | null>(null);
  const [editUserForm] = Form.useForm();
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);

  // R16 任务4: 拉取系统用户总数统计（接口异常时保持 null 不展示，不影响表格）
  useEffect(() => {
    authApi
      .getUserCount()
      .then((res) => {
        const total = Number(res?.total_user);
        setUserCount(Number.isFinite(total) ? total : null);
      })
      .catch(() => setUserCount(null));
  }, []);

  const handleCreateGroup = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createUserGroup({
        name: values.name as string,
        description: values.description as string,
        uids: [],
      });
      feedback.message.success('用户组创建成功！');
      groupActionRef.current?.reload();
      return true;
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '创建用户组失败');
      return false;
    }
  };

  const handleUpdateGroup = async (values: Record<string, unknown>) => {
    if (!editingGroup) return false;
    try {
      await settingsApi.updateUserGroup(editingGroup.id, {
        name: values.name as string,
        description: values.description as string,
      });
      feedback.message.success('用户组信息更新成功！');
      setEditGroupModalVisible(false);
      setEditingGroup(null);
      groupActionRef.current?.reload();
      return true;
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '更新用户组失败');
      return false;
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    try {
      await settingsApi.deleteUserGroup(id);
      feedback.message.success(`用户组「${name}」已成功删除`);
      groupActionRef.current?.reload();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '删除用户组失败');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await settingsApi.deleteUser(uid);
      feedback.message.success('用户已成功删除');
      userActionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除用户失败，请检查权限';
      feedback.message.error(msg);
    }
  };

  // LOOP9-A2: 打开编辑用户弹窗
  const handleOpenEditUser = (record: UserManagementItem) => {
    setEditingUser(record);
    editUserForm.setFieldsValue({
      name: record.name || '',
      email: record.email || '',
      phone: record.phone || '',
    });
    setEditUserModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const values = await editUserForm.validateFields();
      setEditUserSubmitting(true);
      await settingsApi.updateUser(editingUser.uid, {
        name: values.name,
        email: values.email,
        phone: values.phone,
      });
      feedback.message.success(`用户 [${editingUser.account}] 信息已更新`);
      setEditUserModalVisible(false);
      setEditingUser(null);
      userActionRef.current?.reload();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '更新用户信息失败';
      feedback.message.error(msg);
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleCreateUser = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createUser({
        account: values.account as string,
        name: values.name as string,
        email: values.email as string,
        password: values.password as string,
        phone: values.phone as string,
      });
      feedback.message.success('用户创建成功！');
      userActionRef.current?.reload();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '创建用户失败，请检查参数与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  // R8 任务3: 管理端重置密码
  const [resetPwdTarget, setResetPwdTarget] = useState<UserManagementItem | null>(null);
  const [resetPwdForm] = Form.useForm();
  const [resettingPwd, setResettingPwd] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);

  const handleResetPassword = async () => {
    if (!resetPwdTarget) return false;
    try {
      const values = await resetPwdForm.validateFields();
      setResettingPwd(true);
      await settingsApi.resetUserPassword(resetPwdTarget.uid, values.new_password);
      feedback.message.success(`用户 [${resetPwdTarget.account}] 密码已重置`);
      setResetPwdOpen(false);
      resetPwdForm.resetFields();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '重置密码失败（后端校验：密码需包含大小写字母与数字且不少于 8 位，非本人账号受服务端策略限制）';
      feedback.message.error(msg);
      return false;
    } finally {
      setResettingPwd(false);
    }
  };

  // R8 任务3: 管理端重置 MFA（后端 DisableUserMFA 仅允许本人操作，他人调用将被拒绝并透出错误）
  const handleResetMFA = async (record: UserManagementItem) => {
    try {
      await settingsApi.resetUserMFA(record.uid);
      feedback.message.success(`用户 [${record.account}] 的 MFA 已重置`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '重置 MFA 失败（服务端仅允许用户本人操作 MFA）';
      feedback.message.error(msg);
    }
  };

  const userColumns: ProColumns<UserManagementItem>[] = [
    {
      title: '用户账号',
      dataIndex: 'account',
      key: 'account',
      render: (_, record) => (
        <Space orientation="horizontal">
          <UserOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.account || record.name}</Text>
          {record.account === currentAccount && <Tag color="gold">当前登录</Tag>}
        </Space>
      ),
    },
    {
      title: '显示姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text>{String(text || '-')}</Text>,
    },
    {
      title: '电子邮箱',
      dataIndex: 'email',
      key: 'email',
      search: false,
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '账号来源',
      dataIndex: 'identity_type',
      key: 'identity_type',
      search: false,
      render: (text) => (
        <Tag color="blue">{String(text || 'system')}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      search: false,
      width: 300,
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleOpenEditUser(record)}
        >
          编辑
        </Button>,
        <Button
          key="reset-pwd"
          type="link"
          size="small"
          icon={<KeyOutlined />}
          onClick={() => {
            setResetPwdTarget(record);
            resetPwdForm.resetFields();
            setResetPwdOpen(true);
          }}
        >
          重置密码
        </Button>,
        <Popconfirm
          key="reset-mfa"
          title={`确定重置用户 [${record.account}] 的 MFA？`}
          description="重置后该用户的 MFA 配置将被停用，需重新绑定。"
          onConfirm={() => handleResetMFA(record)}
          okText="重置 MFA"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" size="small" danger icon={<SafetyOutlined />}>
            重置 MFA
          </Button>
        </Popconfirm>,
        record.account !== currentAccount ? (
          <Popconfirm
            key="delete"
            title="确定删除此账号？"
            onConfirm={() => handleDeleteUser(record.uid)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ) : (
          <Text key="self" type="secondary">
            当前登录账号
          </Text>
        ),
      ],
    },
  ];

  const groupColumns: ProColumns<UserGroupItem>[] = [
    {
      title: '用户组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="horizontal">
          <TeamOutlined style={{ color: '#52c41a' }} />
          <Text strong>{String(text)}</Text>
          {record.type === 'system' && <Tag color="blue">系统预设</Tag>}
        </Space>
      ),
    },
    {
      title: '描述说明',
      dataIndex: 'description',
      key: 'description',
      render: (text) => <Text type="secondary">{String(text || '无描述')}</Text>,
    },
    {
      title: '成员总数',
      dataIndex: 'user_total',
      key: 'user_total',
      width: 120,
      render: (val, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedGroupForMembers(record);
            setMembersDrawerOpen(true);
          }}
        >
          {`${val ?? 0} 人`}
        </Button>
      ),
    },
    {
      title: '关联系统角色',
      dataIndex: 'system_role_names',
      key: 'system_role_names',
      render: (_, record) => {
        const roles = record.system_role_names;
        if (!roles || roles.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space wrap size={[4, 4]}>
            {roles.map((r, i) => (
              <Tag key={i} color="orange">
                {r}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 200,
      render: (_, record) => [
        <Button
          key="members"
          type="link"
          size="small"
          icon={<TeamOutlined />}
          onClick={() => {
            setSelectedGroupForMembers(record);
            setMembersDrawerOpen(true);
          }}
        >
          成员管理
        </Button>,
        record.type !== 'system' ? (
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingGroup(record);
              setEditGroupModalVisible(true);
            }}
          >
            编辑
          </Button>
        ) : null,
        record.type !== 'system' ? (
          <Popconfirm
            key="delete"
            title="确定删除此用户组？"
            description={`删除「${record.name}」后，关联该组的权限策略将失效。`}
            onConfirm={() => handleDeleteGroup(record.id, record.name)}
            okText="删除"
            cancelText="取消"
          >
            <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ) : null,
      ],
    },
  ];

  // R8 任务2: 系统角色与模板（数据源 role-templates）
  const [roleDetailOpen, setRoleDetailOpen] = useState(false);
  const [roleDetailLoading, setRoleDetailLoading] = useState(false);
  const [roleDetail, setRoleDetail] = useState<{ name: string; desc?: string; rules: Array<{ resource: string; verbs: string[] }> } | null>(null);

  const openRoleDetail = async (role: RoleItem) => {
    setRoleDetailOpen(true);
    setRoleDetailLoading(true);
    setRoleDetail({ name: role.name, desc: role.desc, rules: [] });
    try {
      const detail = await rbacApi.getRoleTemplate(role.name);
      setRoleDetail({
        name: detail?.name || role.name,
        desc: detail?.desc || role.desc,
        rules: Array.isArray(detail?.rules) ? detail.rules : [],
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '角色权限详情获取失败';
      feedback.message.error(msg);
    } finally {
      setRoleDetailLoading(false);
    }
  };

  const roleColumns: ProColumns<RoleItem>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space orientation="horizontal">
          <SafetyCertificateOutlined style={{ color: '#faad14' }} />
          <Text strong>{String(text)}</Text>
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'desc',
      key: 'desc',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (t) => (Number(t) === 1 ? <Tag color="gold">系统内置</Tag> : <Tag color="blue">自定义模板</Tag>),
    },
    {
      title: '操作',
      key: 'role_action',
      width: 120,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openRoleDetail(record)}>
          查看权限详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'users',
            label: (
              <span>
                <UserOutlined /> 用户账号
              </span>
            ),
            children: (
              <ProTable<UserManagementItem>
                actionRef={userActionRef}
                rowKey="uid"
                search={{ labelWidth: 'auto' }}
                cardBordered={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                request={async (params) => {
                  // LOOP9-A2: 服务端分页 + 姓名/账号关键词检索
                  const res = await settingsApi.getUsersPaged({
                    page: params.current || 1,
                    per_page: params.pageSize || 20,
                    name: (params.name as string) || (params.account as string) || undefined,
                  });
                  return {
                    data: res.users,
                    success: true,
                    total: res.total,
                  };
                }}
                columns={userColumns}
                headerTitle={
                  <Space size={8}>
                    <span>用户账号管理</span>
                    {userCount !== null && (
                      <Tag color="blue">系统用户总数：{userCount}</Tag>
                    )}
                  </Space>
                }
                toolBarRender={() => [
                  <ModalForm
                    key="add-user"
                    title="添加新用户"
                    trigger={
                      <Button type="primary" icon={<PlusOutlined />}>
                        添加用户
                      </Button>
                    }
                    width={520}
                    onFinish={handleCreateUser}
                  >
                    <ProFormText
                      name="account"
                      label="登录账号 / 用户名"
                      placeholder="例如: developer@example.com"
                      rules={[{ required: true, message: '请输入登录账号' }]}
                    />

                    <ProFormText
                      name="name"
                      label="用户显示姓名"
                      placeholder="例如: 张三"
                      rules={[{ required: true, message: '请输入显示姓名' }]}
                    />

                    <ProFormText
                      name="email"
                      label="工作邮箱"
                      placeholder="例如: dev@corp.com"
                      rules={[
                        { required: true, message: '请输入邮箱' },
                        { type: 'email', message: '请输入有效邮箱格式' },
                      ]}
                    />

                    <ProFormText.Password
                      name="password"
                      label="初始登录密码"
                      placeholder="初始密码 (至少包含大小写字母与数字)"
                      rules={[{ required: true, message: '请输入初始密码' }]}
                    />

                    <ProFormSelect
                      name="role"
                      label="系统初始角色"
                      initialValue="user"
                      options={[
                        { label: '标准普通用户 (User)', value: 'user' },
                        { label: '系统管理员 (Admin)', value: 'admin' },
                      ]}
                      extra="系统默认创建为普通用户；项目级精细授权请在项目「RBAC」页配置角色与绑定，此处仅声明账号类型，角色信息以后端实际生效为准。"
                    />
                  </ModalForm>,
                ]}
              />
            ),
          },
          {
            key: 'groups',
            label: (
              <span>
                <TeamOutlined /> 用户组
              </span>
            ),
            children: (
              <ProTable<UserGroupItem>
                actionRef={groupActionRef}
                rowKey={(r) => r.id || r.name}
                search={false}
                cardBordered={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                request={async () => {
                  const list = await settingsApi.getUserGroups();
                  return {
                    data: list,
                    success: true,
                    total: list.length,
                  };
                }}
                columns={groupColumns}
                toolBarRender={() => [
                  <ModalForm
                    key="add-group"
                    title="新建用户组"
                    trigger={
                      <Button type="primary" icon={<PlusOutlined />}>
                        新建用户组
                      </Button>
                    }
                    width={480}
                    onFinish={handleCreateGroup}
                  >
                    <ProFormText
                      name="name"
                      label="用户组名称"
                      placeholder="例如: 前端开发组 / QA测试组"
                      rules={[{ required: true, message: '请输入用户组名称' }]}
                    />
                    <ProFormText
                      name="description"
                      label="描述说明"
                      placeholder="用户组职能或负责业务域说明"
                    />
                  </ModalForm>,
                ]}
              />
            ),
          },
          {
            key: 'roles',
            label: (
              <span>
                <SafetyCertificateOutlined /> 系统角色与模板
              </span>
            ),
            children: (
              <ProTable<RoleItem>
                rowKey="name"
                search={false}
                cardBordered={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                request={async () => {
                  const list = await settingsApi.getRoles();
                  return {
                    data: list,
                    success: true,
                    total: list.length,
                  };
                }}
                columns={roleColumns}
                locale={{
                  emptyText: <Typography.Text type="secondary">暂无角色模板</Typography.Text>,
                }}
              />
            ),
          },
        ]}
      />

      {/* R8 任务3: 重置密码 Modal */}
      <Modal
        title={`重置用户密码: ${resetPwdTarget?.account || ''}`}
        open={resetPwdOpen}
        onOk={handleResetPassword}
        onCancel={() => setResetPwdOpen(false)}
        confirmLoading={resettingPwd}
        okText="确认重置"
        cancelText="取消"
        width={460}
        destroyOnHidden
      >
        <Form form={resetPwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度不少于 8 位' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                message: '密码必须包含大小写字母和数字',
              },
            ]}
            extra="密码规则与创建用户一致：包含大小写字母与数字，长度不少于 8 位。"
          >
            <Input.Password placeholder="输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* LOOP9-A2: 编辑用户信息 Modal */}
      <Modal
        title={`编辑用户: ${editingUser?.account || ''}`}
        open={editUserModalVisible}
        onCancel={() => {
          setEditUserModalVisible(false);
          setEditingUser(null);
        }}
        onOk={handleUpdateUser}
        confirmLoading={editUserSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={editUserForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="显示姓名"
            rules={[{ required: true, message: '请输入显示姓名' }]}
          >
            <Input placeholder="用户显示名称" />
          </Form.Item>
          <Form.Item
            name="email"
            label="工作邮箱"
            rules={[
              { type: 'email', message: '请输入合法的邮箱地址' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="可选，手机号或座机" />
          </Form.Item>
        </Form>
      </Modal>

      {/* R8 任务2: 角色权限详情 Modal */}
      <Modal
        title={`角色权限详情: ${roleDetail?.name || ''}`}
        open={roleDetailOpen}
        onCancel={() => setRoleDetailOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setRoleDetailOpen(false)}>
            关闭
          </Button>,
        ]}
        width={560}
      >
        <Spin spinning={roleDetailLoading}>
          <div style={{ paddingTop: 12 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="模板名称">{roleDetail?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="说明">{roleDetail?.desc || '-'}</Descriptions.Item>
            </Descriptions>
            <Title level={5} style={{ marginTop: 16 }}>
              权限规则 (resource → verbs)
            </Title>
            {roleDetail && roleDetail.rules.length > 0 ? (
              roleDetail.rules.map((rule, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{rule.resource}</Text>
                  <Space wrap size={[4, 4]} style={{ marginLeft: 8 }}>
                    {(rule.verbs || []).map((v) => (
                      <Tag key={v} color="geekblue">
                        {v}
                      </Tag>
                    ))}
                  </Space>
                </div>
              ))
            ) : (
              <Text type="secondary">该模板未声明细粒度权限规则（全局预设角色）。</Text>
            )}
          </div>
        </Spin>
      </Modal>

      {/* Edit Group Modal */}
      <ModalForm
        title={`编辑用户组: ${editingGroup?.name || ''}`}
        open={editGroupModalVisible}
        onOpenChange={setEditGroupModalVisible}
        width={480}
        initialValues={editingGroup ? { name: editingGroup.name, description: editingGroup.description } : undefined}
        params={{ id: editingGroup?.id }}
        request={async () => ({
          name: editingGroup?.name || '',
          description: editingGroup?.description || '',
        })}
        onFinish={handleUpdateGroup}
      >
        <ProFormText
          name="name"
          label="用户组名称"
          rules={[{ required: true, message: '请输入用户组名称' }]}
        />
        <ProFormText
          name="description"
          label="描述说明"
        />
      </ModalForm>

      {/* Members Management Drawer */}
      <GroupMembersDrawer
        open={membersDrawerOpen}
        onClose={() => {
          setMembersDrawerOpen(false);
          setSelectedGroupForMembers(null);
        }}
        group={selectedGroupForMembers}
        onSuccess={() => groupActionRef.current?.reload()}
      />
    </div>
  );
};

export default UsersPage;
