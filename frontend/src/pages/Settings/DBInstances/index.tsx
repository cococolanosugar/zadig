import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, DatabaseOutlined, ApiOutlined } from '@ant-design/icons';
import { settingsApi, type DBInstanceItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const DBInstancesPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [testingConn, setTestingConn] = useState(false);

  // R5 任务4: 数据库实例连通性测试（POST /dbinstance/validate）
  const handleTestConnection = async (values: Record<string, unknown>) => {
    setTestingConn(true);
    try {
      await settingsApi.validateDBInstance({
        name: values.name as string,
        type: values.type as string,
        host: values.host as string,
        port: String(values.port ?? ''),
        username: values.username as string,
        password: values.password as string,
      });
      feedback.message.success('数据库连通性测试通过！主机与凭据验证正常');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '连接测试失败，请检查主机、端口与凭据';
      feedback.message.error(`连接测试失败: ${msg}`);
    } finally {
      setTestingConn(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteDBInstance(id);
      feedback.message.success('数据库实例已成功删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除数据库实例失败（可能仍被项目引用）';
      feedback.message.error(msg);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createDBInstance({
        name: values.name as string,
        type: values.type as string,
        host: values.host as string,
        port: String(values.port ?? ''),
        username: values.username as string,
        password: values.password as string,
        projects: [],
      });
      feedback.message.success('数据库实例配置已成功添加！');
      actionRef.current?.reload();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '数据库实例添加失败，请检查配置与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  const columns: ProColumns<DBInstanceItem>[] = [
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <DatabaseOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '数据库类型',
      dataIndex: 'type',
      key: 'type',
      render: (text) => <Tag color="blue">{String(text || 'mysql')}</Tag>,
    },
    {
      title: '连接地址',
      dataIndex: 'host',
      key: 'host',
      render: (_, record) => (
        <Text code>
          {`${record.host}${record.port ? `:${record.port}` : ''}`}
        </Text>
      ),
    },
    {
      title: '认证用户',
      dataIndex: 'username',
      key: 'username',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '授权项目',
      dataIndex: 'projects',
      key: 'projects',
      render: (_, record) =>
        record.projects && record.projects.length > 0 ? (
          <Space orientation="horizontal" size={4} wrap>
            {record.projects.map((p) => (
              <Tag key={p} color="geekblue">{p}</Tag>
            ))}
          </Space>
        ) : (
          <Tag color="green">所有项目</Tag>
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Popconfirm
          key="delete"
          title="确定移除该数据库实例？"
          description="依赖此实例的工作流 SQL 任务将无法执行。"
          onConfirm={() => handleDelete(record.id)}
          okText="移除"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <div>
      <ProTable<DBInstanceItem>
        headerTitle="数据库实例管理 (Database Instances)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getDBInstances();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-db-instance"
            title="添加数据库实例"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加数据库实例
              </Button>
            }
            width={560}
            onFinish={handleCreate}
            submitter={{
              render: (props, dom) => [
                ...dom,
                <Button
                  key="test-conn"
                  icon={<ApiOutlined />}
                  loading={testingConn}
                  onClick={async () => {
                    const values = (await props.form?.validateFields()) || {};
                    await handleTestConnection(values as Record<string, unknown>);
                  }}
                >
                  测试连接
                </Button>,
              ],
            }}
          >
            <ProFormSelect
              name="type"
              label="数据库类型"
              initialValue="mysql"
              options={[
                { label: 'MySQL', value: 'mysql' },
                { label: 'MariaDB', value: 'mariadb' },
                { label: 'PostgreSQL', value: 'postgres' },
                { label: 'SQL Server', value: 'sqlserver' },
                { label: 'Redis', value: 'redis' },
                { label: 'MongoDB', value: 'mongodb' },
              ]}
              rules={[{ required: true, message: '请选择数据库类型' }]}
            />
            <ProFormText
              name="name"
              label="实例名称"
              placeholder="例如: prod-mysql-main"
              rules={[{ required: true, message: '请输入实例名称' }]}
            />
            <ProFormText
              name="host"
              label="主机地址"
              placeholder="例如: 10.0.12.34 或 db.example.internal"
              rules={[{ required: true, message: '请输入主机地址' }]}
            />
            <ProFormText
              name="port"
              label="端口"
              placeholder="例如: 3306"
              rules={[{ required: true, message: '请输入端口' }]}
            />
            <ProFormText
              name="username"
              label="用户名"
              placeholder="具有执行权限的数据库账户"
              rules={[{ required: true, message: '请输入用户名' }]}
            />
            <ProFormText.Password
              name="password"
              label="密码"
              placeholder="数据库访问密码"
              rules={[{ required: true, message: '请输入密码' }]}
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default DBInstancesPage;
