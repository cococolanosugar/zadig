import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography, Drawer, Table, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, AppstoreOutlined, ApiOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { settingsApi, type HelmRepoItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

interface ChartFlatItem {
  name: string;
  versions: string[];
}

export const ChartReposPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [testingConn, setTestingConn] = useState(false);

  // LOOP8-A2: Chart 索引清单抽屉
  const [chartsDrawerOpen, setChartsDrawerOpen] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsRepoName, setChartsRepoName] = useState('');
  const [chartFlatList, setChartFlatList] = useState<ChartFlatItem[]>([]);

  // R5 任务4: Chart 仓库连通性测试（POST /helm/validate）
  const handleTestConnection = async (values: Record<string, unknown>) => {
    setTestingConn(true);
    try {
      await settingsApi.validateHelmRepo({
        repo_name: values.repo_name as string,
        url: values.url as string,
        username: values.username as string,
        password: values.password as string,
      });
      feedback.message.success('Chart 仓库连通性测试通过！索引拉取验证正常');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '连接测试失败，请检查仓库地址与凭据';
      feedback.message.error(`连接测试失败: ${msg}`);
    } finally {
      setTestingConn(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteHelmRepo(id);
      feedback.message.success('Chart 仓库已成功删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除 Chart 仓库失败（可能仍被服务引用）';
      feedback.message.error(msg);
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || 'Chart 仓库添加失败，请检查配置与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  // LOOP8-A2: 查看 Charts 索引清单
  const handleViewCharts = async (record: HelmRepoItem) => {
    const name = record.repo_name || record.id;
    setChartsRepoName(name);
    setChartsDrawerOpen(true);
    setChartsLoading(true);
    setChartFlatList([]);
    try {
      const res = await settingsApi.getHelmCharts(name);
      const entries = res?.entries || {};
      const flat: ChartFlatItem[] = Object.keys(entries).map((chartName) => ({
        name: chartName,
        versions: (entries[chartName] || []).map((v) => v.version).filter(Boolean),
      }));
      setChartFlatList(flat);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '拉取 Chart 索引失败';
      feedback.message.error(msg);
    } finally {
      setChartsLoading(false);
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
        <Button
          key="view-charts"
          type="link"
          icon={<UnorderedListOutlined />}
          onClick={() => handleViewCharts(record)}
        >
          查看 Charts
        </Button>,
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

      {/* LOOP8-A2: Chart 索引清单抽屉 */}
      <Drawer
        title={`Chart 索引清单 - [${chartsRepoName}]`}
        open={chartsDrawerOpen}
        onClose={() => setChartsDrawerOpen(false)}
        size="large"
        destroyOnHidden
      >
        <Spin spinning={chartsLoading}>
          <Table<ChartFlatItem>
            rowKey="name"
            dataSource={chartFlatList}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: chartsLoading ? '加载中…' : '该仓库暂无 Chart 索引' }}
            columns={[
              {
                title: 'Chart 名称',
                dataIndex: 'name',
                key: 'name',
                render: (n) => <Text strong>{n}</Text>,
              },
              {
                title: '可用版本',
                dataIndex: 'versions',
                key: 'versions',
                render: (versions: string[]) =>
                  versions && versions.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {versions.map((v) => (
                        <Tag key={v} color="blue">
                          {v}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
            ]}
          />
        </Spin>
      </Drawer>
    </div>
  );
};

export default ChartReposPage;
