import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Empty, Spin, Tooltip } from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import http from '../../api/client';

const { Title, Text } = Typography;

export const PlutusDeliveryPage: React.FC = () => {
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
          <Tooltip title="客户交付管理依赖企业版 Plutus 组件，请联系管理员确认部署情况">
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }} disabled>
              新建交付项目
            </Button>
          </Tooltip>
        </Space>
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
