import React, { useRef } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, DatabaseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { settingsApi, type StorageItem } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

export const StoragePage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteStorage(id);
      feedback.message.success('对象存储配置已成功删除');
      actionRef.current?.reload();
    } catch {
      // Handled
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await settingsApi.createStorage({
        endpoint: values.endpoint as string,
        bucket: values.bucket as string,
        ak: values.ak as string,
        sk: values.sk as string,
        insecure: values.insecure as boolean,
        is_default: values.is_default as boolean,
      });
      feedback.message.success('对象存储接入成功！');
      actionRef.current?.reload();
      return true;
    } catch {
      return false;
    }
  };

  const columns: ProColumns<StorageItem>[] = [
    {
      title: '服务节点 (Endpoint)',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (_, record) => (
        <Space orientation="horizontal">
          <DatabaseOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.endpoint}</Text>
          {record.is_default && <Tag icon={<CheckCircleOutlined />} color="success">系统默认存储</Tag>}
        </Space>
      ),
    },
    {
      title: '存储桶 (Bucket)',
      dataIndex: 'bucket',
      key: 'bucket',
      render: (text) => <Tag color="blue">{String(text)}</Tag>,
    },
    {
      title: 'Access Key (AK)',
      dataIndex: 'ak',
      key: 'ak',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: '通信协议',
      dataIndex: 'insecure',
      key: 'insecure',
      render: (insecure) => (
        <Tag color={insecure ? 'warning' : 'green'}>{insecure ? 'HTTP (非安全)' : 'HTTPS (SSL)'}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Popconfirm
          key="delete"
          title="确定移除该对象存储？"
          description="构建归档与测试报告将无法向该存储桶写入。"
          onConfirm={() => handleDelete(record.id)}
          okText="删除"
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
      <ProTable<StorageItem>
        headerTitle="对象存储配置 (Object Storage / S3 / OSS)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getStorages();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-storage"
            title="添加对象存储 (S3 兼容协议)"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                添加存储
              </Button>
            }
            width={560}
            onFinish={handleCreate}
          >
            <ProFormText
              name="endpoint"
              label="Endpoint 域名地址"
              placeholder="例如: s3.amazonaws.com 或 minio.corp.internal:9000"
              rules={[{ required: true, message: '请输入 Endpoint 地址' }]}
            />

            <ProFormText
              name="bucket"
              label="存储桶名称 (Bucket)"
              placeholder="例如: zadig-artifacts"
              rules={[{ required: true, message: '请输入存储桶名称' }]}
            />

            <ProFormText
              name="ak"
              label="Access Key (AK)"
              placeholder="具有读写权限的 Access Key"
              rules={[{ required: true, message: '请输入 Access Key' }]}
            />

            <ProFormText.Password
              name="sk"
              label="Secret Key (SK)"
              placeholder="Secret Key"
              rules={[{ required: true, message: '请输入 Secret Key' }]}
            />

            <ProFormSwitch
              name="insecure"
              label="允许非 SSL 连接 (HTTP)"
              tooltip="针对未配置证书的局域网 MinIO 节点开启"
            />

            <ProFormSwitch
              name="is_default"
              label="设为系统默认归档存储"
            />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default StoragePage;
