import React, { useRef } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Space, Popconfirm, Typography, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

// /api/aslan/system/keyvault — models.KeyVaultItem (变量组/共享变量)
interface KeyVaultItem {
  id: string;
  group: string;
  key: string;
  value?: string;
  is_sensitive?: boolean;
  description?: string;
  project_name?: string;
  is_system_wide?: boolean;
  updated_by?: string;
  updated_at?: number;
}

export const KeyVaultPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const handleDelete = async (id: string) => {
    try {
      await http.delete(`/api/aslan/system/keyvault/items/${id}`);
      feedback.message.success('共享变量已删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '删除共享变量失败，请检查权限';
      feedback.message.error(msg);
    }
  };

  const handleSave = async (values: Record<string, unknown>) => {
    try {
      await http.post('/api/aslan/system/keyvault/items', {
        group: values.group || 'default',
        key: values.key,
        value: values.value,
        is_sensitive: values.is_sensitive || false,
        description: values.description || '',
        project_name: values.project_name || '',
      });
      feedback.message.success('共享变量已保存');
      actionRef.current?.reload();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查网络与权限';
      feedback.message.error(msg);
      return false;
    }
  };

  const columns: ProColumns<KeyVaultItem>[] = [
    {
      title: '变量组',
      dataIndex: 'group',
      key: 'group',
      render: (_, record) => <Tag color="geekblue">{String(record.group || 'default')}</Tag>,
    },
    {
      title: '变量名 (Key)',
      dataIndex: 'key',
      key: 'key',
      render: (_, record) => (
        <Space orientation="horizontal">
          <KeyOutlined style={{ color: '#0066ff' }} />
          <Text strong copyable>{record.key}</Text>
        </Space>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (_, record) =>
        record.is_sensitive ? (
          <Text type="secondary">****** (敏感值)</Text>
        ) : (
          <Text code style={{ fontSize: 12 }}>{String(record.value || '-')}</Text>
        ),
    },
    {
      title: '敏感',
      dataIndex: 'is_sensitive',
      key: 'is_sensitive',
      render: (v) => (v ? <Tag color="volcano">敏感</Tag> : <Tag color="default">普通</Tag>),
    },
    {
      title: '作用范围',
      key: 'scope',
      render: (_, record) =>
        record.is_system_wide ? (
          <Tag color="gold">全系统</Tag>
        ) : (
          <Tag color="blue">{String(record.project_name || '-')}</Tag>
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (d) => <Text type="secondary">{String(d || '-')}</Text>,
    },
    {
      title: '更新',
      key: 'updated',
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.updated_at ? `${new Date(record.updated_at * 1000).toLocaleDateString()} · ${record.updated_by || '-'}` : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Popconfirm
          key="delete"
          title={`确定删除变量 [${record.group}/${record.key}]？`}
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
      <ProTable<KeyVaultItem>
        headerTitle="变量组 · 共享变量 (Key Vault)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          try {
            const res = await http.get<KeyVaultItem[]>('/api/aslan/system/keyvault/items', {
              skipErrorHandler: true,
            });
            const list = Array.isArray(res) ? res : [];
            return { data: list, success: true, total: list.length };
          } catch {
            return { data: [], success: true, total: 0 };
          }
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-kv"
            title="新建共享变量"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建变量
              </Button>
            }
            width={560}
            onFinish={handleSave}
          >
            <ProFormText
              name="group"
              label="变量组名称"
              placeholder="例如: common-config（同名归入同组）"
              initialValue="default"
              rules={[{ required: true, message: '请输入变量组名称' }]}
            />
            <ProFormText
              name="key"
              label="变量名 (Key)"
              placeholder="例如: DB_HOST"
              rules={[
                { required: true, message: '请输入变量名' },
                { pattern: /^[A-Za-z0-9_.-]+$/, message: '仅支持字母、数字、下划线、点与连字符' },
              ]}
            />
            <ProFormTextArea name="value" label="变量值" placeholder="变量值内容" />
            <ProFormSwitch name="is_sensitive" label="敏感值（回显时脱敏）" />
            <ProFormText name="project_name" label="归属项目 (留空为全局变量)" placeholder="例如: demo-k8s" />
            <ProFormTextArea name="description" label="描述" placeholder="变量用途说明" />
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default KeyVaultPage;
