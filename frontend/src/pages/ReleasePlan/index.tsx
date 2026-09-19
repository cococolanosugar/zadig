import React, { useState } from 'react';
import { Card, Table, Typography, Button, Space, Input, Tag, Empty } from 'antd';
import {
  ScheduleOutlined,
  SearchOutlined,
  PlusOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const ReleasePlanPage: React.FC = () => {
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
            发布计划
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            跨项目、多业务线统一编排版本发布日历，跟踪版本发布窗口与里程碑
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索发布计划"
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
            onClick={() => feedback.message.info('新建发布计划向导')}
          >
            新建发布计划
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
              title: '计划名称',
              dataIndex: 'name',
              key: 'name',
              render: (name) => (
                <Space orientation="horizontal">
                  <ScheduleOutlined style={{ color: '#0066ff' }} />
                  <Text strong>{name}</Text>
                </Space>
              ),
            },
            {
              title: '发布状态',
              dataIndex: 'status',
              key: 'status',
              render: () => <Tag color="processing">进行中</Tag>,
            },
            {
              title: '发布窗口 / 目标上线时间',
              dataIndex: 'release_time',
              key: 'release_time',
              render: (t) => t || '-',
            },
            {
              title: '负责人',
              dataIndex: 'manager',
              key: 'manager',
              render: () => 'admin@qq.com',
            },
            {
              title: '检查项就绪状态',
              key: 'checklist',
              render: () => (
                <Space orientation="horizontal">
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>全部就绪</span>
                </Space>
              ),
            },
            {
              title: '操作',
              key: 'action',
              render: () => <Button type="link">详情编排</Button>,
            },
          ]}
          locale={{
            emptyText: <Empty description="暂无发布计划记录，点击右上角新建" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>
    </div>
  );
};

export default ReleasePlanPage;
