import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSelect, ProFormRadio } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, CodeOutlined, GithubOutlined, GitlabOutlined, ApiOutlined } from '@ant-design/icons';
import { settingsApi, type CodeHostItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const CodeHostsPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [testingConn, setTestingConn] = useState(false);

  // R5 任务3: 代码源连通性测试（POST /codehosts/validate）
  const handleTestConnection = async (values: Record<string, unknown>) => {
    setTestingConn(true);
    try {
      await settingsApi.validateCodeHost({
        type: values.type as string,
        address: values.address as string,
        auth_type: values.auth_type as string,
        access_token: values.access_token as string,
        application_id: values.application_id as string,
        client_secret: values.client_secret as string,
      });
      feedback.message.success('代码源连通性测试通过！凭据与服务验证正常');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '连接测试失败，请检查地址与凭据';
      feedback.message.error(`连接测试失败: ${msg}`);
    } finally {
      setTestingConn(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await settingsApi.deleteCodeHost(id);
      feedback.message.success('代码源配置已删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除代码源配置失败（可能仍被项目引用）';
      feedback.message.error(msg);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createCodeHost({
        type: values.type as string,
        address: values.address as string,
        auth_type: values.auth_type as string,
        access_token: values.access_token as string,
        application_id: values.application_id as string,
        client_secret: values.client_secret as string,
        alias: values.alias as string,
      });
      feedback.message.success('代码源集成成功！');
      actionRef.current?.reload();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '代码源集成失败，请检查配置与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'github':
        return <Tag icon={<GithubOutlined />} color="black">GitHub</Tag>;
      case 'gitlab':
        return <Tag icon={<GitlabOutlined />} color="orange">GitLab</Tag>;
      case 'gitee':
        return <Tag color="red">Gitee</Tag>;
      default:
        return <Tag color="blue">{type || 'Git'}</Tag>;
    }
  };

  const columns: ProColumns<CodeHostItem>[] = [
    {
      title: '代码源平台',
      dataIndex: 'type',
      key: 'type',
      render: (_, record) => (
        <Space orientation="horizontal">
          <CodeOutlined style={{ color: '#0066ff' }} />
          {renderTypeIcon(record.type)}
          {record.alias && <Text strong>({record.alias})</Text>}
        </Space>
      ),
    },
    {
      title: '服务地址',
      dataIndex: 'address',
      key: 'address',
      render: (text) => <Text code>{String(text)}</Text>,
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      render: (text) => (
        <Tag color="geekblue">{String(text || 'Personal Access Token')}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Popconfirm
          key="delete"
          title="确定移除此代码源？"
          description="已有工作流若依赖该代码源可能无法拉取仓库代码。"
          onConfirm={() => handleDelete(record.id)}
          okText="移除"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <div>
      <ProTable<CodeHostItem>
        headerTitle="代码源托管集成 (Code Hosts)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getCodeHosts();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-codehost"
            title="添加代码源集成"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加代码源
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
              label="代码托管类型"
              initialValue="gitlab"
              options={[
                { label: 'GitLab (私有部署 / 官方云端)', value: 'gitlab' },
                { label: 'GitHub', value: 'github' },
                { label: 'Gitee (码云)', value: 'gitee' },
                { label: 'Gerrit', value: 'gerrit' },
              ]}
              rules={[{ required: true, message: '请选择代码托管类型' }]}
            />

            <ProFormText
              name="address"
              label="服务站点地址"
              placeholder="例如: https://gitlab.example.com 或 https://github.com"
              rules={[{ required: true, message: '请输入代码源地址' }]}
            />

            <ProFormText
              name="alias"
              label="集成标识别名"
              placeholder="例如: 公司私有 GitLab"
            />

            <ProFormRadio.Group
              name="auth_type"
              label="授权方式"
              initialValue="token"
              options={[
                { label: 'Access Token 个人访问令牌', value: 'token' },
                { label: 'OAuth Application 授权', value: 'oauth' },
              ]}
            />

            <ProFormText.Password
              name="access_token"
              label="Access Token"
              placeholder="具有 api/repo/read_user 权限的访问令牌"
              rules={[{ required: true, message: '请输入 Access Token' }]}
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default CodeHostsPage;
