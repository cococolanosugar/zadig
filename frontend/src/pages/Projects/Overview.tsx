import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Tag, Space, Empty, Spin } from 'antd';
import {
  ClusterOutlined,
  BranchesOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import workflowApi, { type WorkflowV4Item } from '../../api/workflow';
import { useProjectStore } from '../../stores/project';

const { Title, Text } = Typography;

export const ProjectOverviewPage: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const currentProject = useProjectStore((s) => s.currentProject) || projectName || 'demo-k8s';

  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowV4Item[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const wfList = await workflowApi.getWorkflows(currentProject);
      setWorkflows(wfList);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject]);

  const envColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space orientation="horizontal">
          <ClusterOutlined style={{ color: '#0066ff' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '归属',
      dataIndex: 'project',
      key: 'project',
      render: () => <Tag color="blue">{currentProject}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="default">未部署</Tag>,
    },
    {
      title: '最后修改时间',
      dataIndex: 'update_time',
      key: 'update_time',
      render: (t: string) => t || '-',
    },
  ];

  const workflowColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space orientation="horizontal">
          <BranchesOutlined style={{ color: '#0066ff' }} />
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 600 }}
            onClick={() => navigate(`/v1/projects/detail/${currentProject}/pipelines`)}
          >
            {name}
          </Button>
        </Space>
      ),
    },
    {
      title: '步骤',
      dataIndex: 'stages',
      key: 'stages',
      render: (stages: string[]) =>
        stages && stages.length > 0 ? (
          <Space orientation="horizontal">
            {stages.map((s, idx) => (
              <Tag key={idx}>{s}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="success">就绪</Tag>,
    },
    {
      title: '最后修改时间',
      dataIndex: 'update_time',
      key: 'update_time',
      render: (t: string) => t || '-',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Environments Info Section matching live Zadig */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClusterOutlined style={{ color: '#0066ff', fontSize: 18 }} />
            <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
              环境信息
            </Title>
          </div>
        }
        extra={
          <Space orientation="horizontal">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={fetchData}
            >
              刷新
            </Button>
            <Button
              type="primary"
              ghost
              icon={<PlusOutlined />}
              size="small"
              onClick={() => navigate(`/v1/projects/detail/${currentProject}/envs`)}
            >
              新建环境
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={[]}
          columns={envColumns}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {/* Workflow Info Section matching live Zadig */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BranchesOutlined style={{ color: '#0066ff', fontSize: 18 }} />
            <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
              工作流信息
            </Title>
          </div>
        }
        extra={
          <Space orientation="horizontal">
            <Button
              type="primary"
              ghost
              icon={<PlusOutlined />}
              size="small"
              onClick={() => navigate(`/v1/projects/detail/${currentProject}/pipelines`)}
            >
              新建工作流
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin />
          </div>
        ) : (
          <Table
            dataSource={workflows}
            columns={workflowColumns}
            rowKey="name"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        )}
      </Card>
    </div>
  );
};

export default ProjectOverviewPage;
