import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, InboxOutlined, CheckCircleOutlined, ApiOutlined } from '@ant-design/icons';
import { settingsApi, type RegistryItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const RegistriesPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [validating, setValidating] = useState<boolean>(false);

  const handleSetDefault = async (record: RegistryItem) => {
    try {
      await settingsApi.updateRegistry(record.id, {
        ...record,
        is_default: true,
      });
      feedback.message.success(`已将 [${record.reg_addr}] 设为默认镜像仓库`);
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description ||
        (err as Error)?.message ||
        '设为默认镜像仓库失败';
      feedback.message.error(msg);
    }
  };

  const handleTestConnection = async () => {
    const values = formRef.current?.getFieldsValue();
    const regAddr = values?.reg_addr?.trim();
    if (!regAddr) {
      feedback.message.warning('请先输入镜像仓库地址');
      return;
    }
    const providerMap: Record<string, string> = {
      native: 'native',
      aliyun: 'acr',
      tencent: 'tcr',
      dockerhub: 'dockerhub',
      jfrog: 'jfrog',
    };
    setValidating(true);
    try {
      await settingsApi.validateRegistry({
        reg_addr: regAddr,
        reg_provider: providerMap[values.reg_type as string] || 'native',
        reg_type: values.reg_type as string,
        namespace: values?.namespace || '',
        access_key: values?.access_key || '',
        secret_key: values?.secret_key || '',
      });
      feedback.message.success('镜像仓库连通性测试通过！凭据与服务验证正常');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description ||
        (err as Error)?.message ||
        '镜像仓库连通性测试失败，请检查地址、命名空间与凭据密钥';
      feedback.message.error(`连接测试失败: ${msg}`);
    } finally {
      setValidating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteRegistry(id);
      feedback.message.success('镜像仓库已成功删除');
      actionRef.current?.reload();
    } catch {
      // Handled
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      // 后端要求 reg_provider 必填（models.RegistryNamespace.RegProvider）
      const providerMap: Record<string, string> = {
        native: 'native',
        aliyun: 'acr',
        tencent: 'tcr',
        dockerhub: 'dockerhub',
        jfrog: 'jfrog',
      };
      await settingsApi.createRegistry({
        reg_addr: values.reg_addr as string,
        reg_provider: providerMap[values.reg_type as string] || 'native',
        reg_type: values.reg_type as string,
        namespace: values.namespace as string,
        access_key: values.access_key as string,
        secret_key: values.secret_key as string,
        is_default: values.is_default as boolean,
      });
      feedback.message.success('镜像仓库配置已成功添加！');
      actionRef.current?.reload();
      return true;
    } catch {
      return false;
    }
  };

  const columns: ProColumns<RegistryItem>[] = [
    {
      title: '仓库地址',
      dataIndex: 'reg_addr',
      key: 'reg_addr',
      render: (_, record) => (
        <Space orientation="horizontal">
          <InboxOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.reg_addr}</Text>
          {record.is_default && <Tag icon={<CheckCircleOutlined />} color="success">默认镜像仓</Tag>}
        </Space>
      ),
    },
    {
      title: '仓库类型',
      dataIndex: 'reg_type',
      key: 'reg_type',
      render: (text) => <Tag color="blue">{String(text || 'Docker Registry / Harbor')}</Tag>,
    },
    {
      title: '命名空间 / 组织',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: 'Access Key / 用户名',
      dataIndex: 'access_key',
      key: 'access_key',
      render: (text) => <Text type="secondary">{String(text || '-')}</Text>,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        ...(!record.is_default
          ? [
              <Popconfirm
                key="set-default"
                title="设为默认镜像仓库？"
                description="系统构建与服务部署将默认推拉至此镜像仓库。"
                onConfirm={() => handleSetDefault(record)}
                okText="设为默认"
                cancelText="取消"
              >
                <Button type="link" size="small">
                  设为默认
                </Button>
              </Popconfirm>,
            ]
          : []),
        <Popconfirm
          key="delete"
          title="确定移除该镜像仓库？"
          description="构建步骤若依赖此仓库推拉镜像将受到影响。"
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
      <ProTable<RegistryItem>
        headerTitle="容器镜像仓库集成 (Container Registries)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getRegistries();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-registry"
            title="添加镜像仓库"
            formRef={formRef}
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加镜像仓库
              </Button>
            }
            width={560}
            submitter={{
              render: (_props, defaultDoms) => [
                <Button
                  key="test-connection"
                  icon={<ApiOutlined />}
                  loading={validating}
                  onClick={handleTestConnection}
                >
                  测试连接
                </Button>,
                ...defaultDoms,
              ],
            }}
            onFinish={handleCreate}
          >
            <ProFormSelect
              name="reg_type"
              label="仓库厂商 / 架构"
              initialValue="native"
              options={[
                { label: 'Harbor / 自建 Docker Registry', value: 'native' },
                { label: '阿里云容器镜像服务 (ACR)', value: 'aliyun' },
                { label: '腾讯云容器镜像服务 (TCR)', value: 'tencent' },
                { label: 'Docker Hub 官方', value: 'dockerhub' },
                { label: 'JFrog Artifactory', value: 'jfrog' },
              ]}
              rules={[{ required: true, message: '请选择仓库类型' }]}
            />

            <ProFormText
              name="reg_addr"
              label="镜像仓库域名地址"
              placeholder="例如: registry.example.com 或 harbor.corp.internal"
              rules={[{ required: true, message: '请输入仓库地址' }]}
            />

            <ProFormText
              name="namespace"
              label="默认命名空间 / Project"
              placeholder="例如: library 或 my-org"
              rules={[{ required: true, message: '请输入命名空间' }]}
            />

            <ProFormText
              name="access_key"
              label="用户名 / AccessKey"
              placeholder="具有推拉镜像权限的凭据账户"
              rules={[{ required: true, message: '请输入访问账户' }]}
            />

            <ProFormText.Password
              name="secret_key"
              label="密码 / SecretKey"
              placeholder="访问密码或 Token"
              rules={[{ required: true, message: '请输入凭据密钥' }]}
            />

            <ProFormSwitch
              name="is_default"
              label="设为系统默认构建推送目标"
              tooltip="新建工作流或服务时优先推拉至该仓库"
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default RegistriesPage;
