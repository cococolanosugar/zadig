import React, { useRef } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormTextArea, ProFormRadio, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, HddOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { settingsApi, type ClusterItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const ClustersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteCluster(id);
      feedback.message.success('集群已成功删除');
      actionRef.current?.reload();
    } catch {
      // Handled by api interceptor
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createCluster({
        name: values.name as string,
        description: values.description as string,
        kube_config: values.kube_config as string,
        production: values.production as boolean,
        type: values.access_type as string || 'kubeconfig',
      });
      feedback.message.success('集群接入成功！');
      actionRef.current?.reload();
      return true;
    } catch {
      return false;
    }
  };

  const columns: ProColumns<ClusterItem>[] = [
    {
      title: '集群名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <HddOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
          {record.local && <Tag color="cyan">当前管理集群</Tag>}
          {record.production && <Tag color="orange">生产集群</Tag>}
        </Space>
      ),
    },
    {
      title: '集群状态',
      dataIndex: 'status',
      key: 'status',
      search: false,
      render: (_, record) => {
        const isHealthy = record.status === 'normal' || record.local || !record.status;
        return isHealthy ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            正常通信
          </Tag>
        ) : (
          <Tag icon={<SyncOutlined spin />} color="warning">
            {record.status}
          </Tag>
        );
      },
    },
    {
      title: '接入类型',
      dataIndex: 'type',
      key: 'type',
      search: false,
      render: (_, record) => (
        <Text type="secondary">{record.local ? '内嵌控制面' : record.type || 'KubeConfig'}</Text>
      ),
    },
    {
      title: '描述说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        !record.local ? (
          <Popconfirm
            key="delete"
            title="确定断开此集群连接？"
            description="删除后将无法向该集群调度工作流或部署环境。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              断开连接
            </Button>
          </Popconfirm>
        ) : (
          <Text key="builtin" type="secondary">
            内置保护
          </Text>
        ),
      ],
    },
  ];

  return (
    <div>
      <ProTable<ClusterItem>
        headerTitle="Kubernetes 集群接入管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getClusters();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-cluster"
            title="接入 Kubernetes 集群"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加集群
              </Button>
            }
            width={600}
            onFinish={handleCreate}
          >
            <ProFormText
              name="name"
              label="集群标识名称"
              placeholder="例如: k8s-staging-cluster"
              rules={[{ required: true, message: '请输入集群标识名称' }]}
            />

            <ProFormRadio.Group
              name="access_type"
              label="接入方式"
              initialValue="kubeconfig"
              options={[
                { label: 'KubeConfig 凭据文件', value: 'kubeconfig' },
                { label: 'Zadig Cluster Agent 代理', value: 'agent' },
              ]}
            />

            <ProFormTextArea
              name="kube_config"
              label="KubeConfig 内容 (YAML)"
              placeholder="粘贴包含 clusters, users, contexts 的 kubeconfig 配置文本..."
              rules={[{ required: true, message: '请输入有效 kubeconfig 配置' }]}
              fieldProps={{ rows: 6 }}
            />

            <ProFormSwitch
              name="production"
              label="生产环境集群保护"
              tooltip="开启后，发布至此集群将触发更严格的审批策略与权限阻断。"
            />

            <ProFormTextArea
              name="description"
              label="备注描述"
              placeholder="集群硬件配置、网络拓扑或所属业务线说明"
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default ClustersPage;
