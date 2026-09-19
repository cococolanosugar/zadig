import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Typography, Button, Space, Input, Tag, Empty, Spin } from 'antd';
import {
  HistoryOutlined,
  SearchOutlined,
  PlusOutlined,
  DropboxOutlined,
} from '@ant-design/icons';
import http from '../../api/client';

const { Title, Text } = Typography;

export const DeliveryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('artifacts');
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<unknown[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const fetchArtifacts = async () => {
      setLoading(true);
      try {
        const res = await http.get<unknown[]>('/api/aslan/delivery/artifacts');
        setArtifacts(Array.isArray(res) ? res : []);
      } catch {
        setArtifacts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchArtifacts();
  }, []);

  const tabItems = [
    {
      key: 'artifacts',
      label: (
        <span>
          <DropboxOutlined /> 交付物追踪
        </span>
      ),
    },
    {
      key: 'version',
      label: (
        <span>
          <HistoryOutlined /> 发布版本管理
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            制品管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            端到端追踪产物镜像、二进制压缩包、关联代码 Commit 以及上线部署记录
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索制品名称 / Tag"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }}>
            创建版本发布
          </Button>
        </Space>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={(k) => setActiveTab(k)}
          tabBarStyle={{ marginBottom: 20 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={artifacts}
            columns={[
              {
                title: '制品名称 / 镜像 Tag',
                dataIndex: 'name',
                key: 'name',
                render: (text) => text || '-',
              },
              {
                title: '归属项目',
                dataIndex: 'project_name',
                key: 'project_name',
                render: (proj) => (proj ? <Tag color="blue">{proj}</Tag> : '-'),
              },
              {
                title: '产生工作流',
                dataIndex: 'workflow_name',
                key: 'workflow_name',
                render: (wf) => wf || '-',
              },
              {
                title: '构建产物大小',
                dataIndex: 'size',
                key: 'size',
                render: (s) => s || '-',
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (t) => t || '-',
              },
              {
                title: '操作',
                key: 'action',
                render: () => <Button type="link">查看流向图</Button>,
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无交付物记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default DeliveryPage;
