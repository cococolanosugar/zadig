import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Empty, Spin, Tabs } from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  TeamOutlined,
  HistoryOutlined,
  DashboardOutlined,
  FileTextOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import http from '../../api/client';

const { Title, Text } = Typography;

export const PlutusDeliveryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<unknown[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await http.get<unknown[]>('/api/plutus/products', { skipErrorHandler: true });
        setProducts(Array.isArray(res) ? res : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const tabItems = [
    {
      key: 'customer',
      label: (
        <span>
          <TeamOutlined /> 客户管理
        </span>
      ),
    },
    {
      key: 'version',
      label: (
        <span>
          <HistoryOutlined /> 版本管理
        </span>
      ),
    },
    {
      key: 'board',
      label: (
        <span>
          <DashboardOutlined /> 交付看板
        </span>
      ),
    },
    {
      key: 'auditlog',
      label: (
        <span>
          <FileTextOutlined /> 操作日志
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
            客户交付管理 (Plutus)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            针对私有化部署、多客户定制化分发交付的企业级全流程管控平台
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Button type="primary" icon={<UserAddOutlined />} style={{ borderRadius: 4 }}>
            新建客户
          </Button>
          <Button icon={<PlusOutlined />} style={{ borderRadius: 4 }}>
            新建交付项目
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs activeKey={activeTab} items={tabItems} onChange={(k) => setActiveTab(k)} />
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={products}
            columns={[
              {
                title: '交付项目名称',
                dataIndex: 'name',
                key: 'name',
                render: (name) => (
                  <Space orientation="horizontal">
                    <ShopOutlined style={{ color: '#0066ff' }} />
                    <Button type="link" style={{ padding: 0, fontWeight: 600 }}>
                      {name || '-'}
                    </Button>
                  </Space>
                ),
              },
              {
                title: '关联客户数',
                dataIndex: 'customer_count',
                key: 'customer_count',
                render: (count) => (
                  <Space orientation="horizontal">
                    <TeamOutlined />
                    <span>{count || 0} 家</span>
                  </Space>
                ),
              },
              {
                title: '发布版本',
                dataIndex: 'version',
                key: 'version',
                render: (v) => <Tag color="blue">{v || 'v1.0.0'}</Tag>,
              },
              {
                title: '操作',
                key: 'action',
                render: () => <Button type="link">交付控制台</Button>,
              },
            ]}
            locale={{
              emptyText: <Empty description="暂无客户交付项目，请点击新建" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default PlutusDeliveryPage;
