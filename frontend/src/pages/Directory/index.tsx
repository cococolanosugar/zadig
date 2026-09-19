import React, { useState } from 'react';
import { Card, Table, Typography, Button, Space, Input, Tag, Empty } from 'antd';
import {
  FolderOpenOutlined,
  SearchOutlined,
  PlusOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const DirectoryPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');

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
            业务目录
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            微服务架构拓扑与组织业务树，建立系统服务间的调用与依赖拓扑
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索业务域 / 系统"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={() => feedback.message.info('新建业务目录分组')}
          >
            新建业务域
          </Button>
        </Space>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Table
          dataSource={[]}
          columns={[
            {
              title: '业务系统名称',
              dataIndex: 'name',
              key: 'name',
              render: (name) => (
                <Space orientation="horizontal">
                  <FolderOpenOutlined style={{ color: '#0066ff' }} />
                  <Text strong>{name}</Text>
                </Space>
              ),
            },
            {
              title: '归属团队',
              dataIndex: 'team',
              key: 'team',
              render: () => <Tag color="geekblue">基础架构研发部</Tag>,
            },
            {
              title: '包含微服务数',
              dataIndex: 'service_count',
              key: 'service_count',
              render: () => (
                <Space orientation="horizontal">
                  <ClusterOutlined />
                  <span>0 个</span>
                </Space>
              ),
            },
            {
              title: '操作',
              key: 'action',
              render: () => <Button type="link">拓扑架构图</Button>,
            },
          ]}
          locale={{
            emptyText: <Empty description="暂无业务目录数据，点击右上角新建" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>
    </div>
  );
};

export default DirectoryPage;
