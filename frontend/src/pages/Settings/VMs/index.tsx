import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, Space, Typography, Tooltip } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import { settingsApi, type VMItem } from '../../../api/settings';

const { Text } = Typography;

const renderVmStatus = (status?: string) => {
  switch (status) {
    case 'normal':
      return <Tag color="success">正常</Tag>;
    case 'offline':
      return <Tag color="default">离线</Tag>;
    default:
      return <Tag color="warning">{status || '未知'}</Tag>;
  }
};

export const VMsPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<VMItem>[] = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <DesktopOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      key: 'ip',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      render: (text) =>
        text ? <Tag color="geekblue">{String(text)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '系统平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (_, record) => (
        <Text type="secondary">
          {`${record.platform || '-'} / ${record.architecture || '-'}`}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) =>
        record.error ? (
          <Tooltip title={record.error}>
            {renderVmStatus(record.status)}
          </Tooltip>
        ) : (
          renderVmStatus(record.status)
        ),
    },
  ];

  return (
    <div>
      <ProTable<VMItem>
        headerTitle="主机管理 (Virtual Machine Hosts)"
        actionRef={actionRef}
        rowKey="name"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getVMs();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
      />
    </div>
  );
};

export default VMsPage;
