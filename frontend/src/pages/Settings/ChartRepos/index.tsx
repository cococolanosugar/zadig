import React, { useRef } from 'react';
import { ProTable, ModalForm, ProFormText } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import { settingsApi, type HelmRepoItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const ChartReposPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteHelmRepo(id);
      feedback.message.success('Chart 仓库已成功删除');
      actionRef.current?.reload();
    } catch {
      // Handled
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createHelmRepo({
        repo_name: values.repo_name as string,
        url: values.url as string,
        username: values.username as string,
        password: values.password as string,
        projects: [],
      });
      feedback.message.success('Chart 仓库配置已成功添加！');
      actionRef.current?.reload();
      return true;
    } catch {
      return false;
    }
  };

  const columns: ProColumns<HelmRepoItem>[] = [
    {
      title: '仓库名称',
      dataIndex: 'repo_name',
      key: 'repo_name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <AppstoreOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.repo_name || record.id}</Text>
        </Space>
      ),
    },
    {
      title: '仓库地址 (URL)',
      dataIndex: 'url',
      key: 'url',
      render: (text) => <Text code>{String(text || '-')}</Text>,
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
      title: '更新人',
      dataIndex: 'update_by',
      key: 'update_by',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Popconfirm
          key="delete"
          title="确定移除该 Chart 仓库？"
          description="依赖此仓库的 Helm 服务创建与发布将受到影响。"
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
      <ProTable<HelmRepoItem>
        headerTitle="Helm Chart 仓库 (Chart Repositories)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getHelmRepos();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-chart-repo"
            title="添加 Chart 仓库"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加 Chart 仓库
              </Button>
            }
            width={560}
            onFinish={handleCreate}
          >
            <ProFormText
              name="repo_name"
              label="仓库名称"
              placeholder="例如: corp-charts"
              rules={[{ required: true, message: '请输入仓库名称' }]}
            />
            <ProFormText
              name="url"
              label="仓库地址"
              placeholder="例如: https://charts.example.com"
              rules={[
                { required: true, message: '请输入仓库地址' },
                { type: 'url', message: '请输入合法的 URL 地址' },
              ]}
            />
            <ProFormText
              name="username"
              label="认证用户名 (可选)"
              placeholder="私有仓库访问账户"
            />
            <ProFormText.Password
              name="password"
              label="认证密码 (可选)"
              placeholder="访问密码或 Token"
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default ChartReposPage;
