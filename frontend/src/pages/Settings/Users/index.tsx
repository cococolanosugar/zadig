import React, { useRef, useState } from 'react';
import {
  ProTable,
  ModalForm,
  ProFormText,
  ProFormSelect,
} from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Tabs, Space, Popconfirm, Typography } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  type UserManagementItem,
  type UserGroupItem,
  type RoleItem,
} from '../../../api/settings';
import { feedback } from '../../../utils/feedback';
import { useAuthStore } from '../../../stores/auth';

const { Text } = Typography;

export const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const userActionRef = useRef<ActionType>(null);
  const groupActionRef = useRef<ActionType>(null);
  const userInfo = useAuthStore((state) => state.userInfo);
  const currentAccount = userInfo?.account || '';

  const handleDeleteUser = async (uid: string) => {
    try {
      await settingsApi.deleteUser(uid);
      feedback.message.success('用户已成功删除');
      userActionRef.current?.reload();
    } catch {
      // Handled
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
    } catch {
      return false;
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
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '账号来源',
      dataIndex: 'identity_type',
      key: 'identity_type',
      render: (text) => (
        <Tag color="blue">{String(text || 'system')}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
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
      render: (text) => (
        <Space orientation="horizontal">
          <TeamOutlined style={{ color: '#52c41a' }} />
          <Text strong>{String(text)}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text) => <Text type="secondary">{String(text || '无描述')}</Text>,
    },
  ];

  const roleColumns: ProColumns<RoleItem>[] = [
    {
      title: '系统权限角色',
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
      title: '角色说明',
      dataIndex: 'desc',
      key: 'desc',
      render: (text) => <Text type="secondary">{String(text || '默认系统角色')}</Text>,
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
                search={false}
                cardBordered={false}
                options={{ density: false, fullScreen: true, reload: true, setting: false }}
                request={async () => {
                  const list = await settingsApi.getUsers();
                  return {
                    data: list,
                    success: true,
                    total: list.length,
                  };
                }}
                columns={userColumns}
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
              />
            ),
          },
          {
            key: 'roles',
            label: (
              <span>
                <SafetyCertificateOutlined /> RBAC 角色列表
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
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default UsersPage;
