import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Tag, Space, Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClusterOutlined,
  BranchesOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import workflowApi, { type WorkflowV4Item } from '../../api/workflow';
import http from '../../api/client';
import { useProjectStore } from '../../stores/project';

const { Title, Text } = Typography;

interface EnvInfoItem {
  name: string;
  cluster_name?: string;
  cluster_id?: string;
  namespace?: string;
  status?: string;
  update_time?: number;
  updated_at?: number;
}

export const ProjectOverviewPage: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const currentProject = projectName || useProjectStore((s) => s.currentProject) || '';

  const [loading, setLoading] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowV4Item[]>([]);
  const [envs, setEnvs] = useState<EnvInfoItem[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setEnvLoading(true);
    try {
      const wfList = await workflowApi.getWorkflows(currentProject);
      setWorkflows(wfList);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
    try {
      const res = await http.get<EnvInfoItem[] | { data: EnvInfoItem[] }>(
        `/api/aslan/environment/environments?projectName=${currentProject}`,
        { skipErrorHandler: true }
      );
      const list = Array.isArray(res) ? res : ('data' in res && Array.isArray(res.data) ? res.data : []);
      setEnvs(list);
    } catch {
      setEnvs([]);
    } finally {
      setEnvLoading(false);
    }
  };

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject]);

  const renderEnvStatus = (status?: string) => {
    switch (status) {
      case 'running':
      case 'created':
        return <Tag color="success">{status}</Tag>;
      case 'updating':
      case 'creating':
        return <Tag color="processing">{status}</Tag>;
      case 'error':
      case 'deleting':
        return <Tag color="error">{status}</Tag>;
      default:
        return status ? <Tag color="default">{status}</Tag> : <Tag color="default">unknown</Tag>;
    }
  };

  const envColumns: ColumnsType<EnvInfoItem> = [
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
      render: (_, record) => renderEnvStatus(record.status),
    },
    {
      title: '集群 / 命名空间',
      key: 'cluster',
      render: (_, record) => (
        <Text type="secondary">
          {`${record.cluster_name || record.cluster_id || '-'} / ${record.namespace || '-'}`}
        </Text>
      ),
    },
    {
      title: '最后修改时间',
      dataIndex: 'update_time',
      key: 'update_time',
      render: (_, record) => {
        const t = record.update_time || record.updated_at;
        return t ? new Date(Number(t) * 1000).toLocaleString() : '-';
      },
    },
  ];

  const workflowColumns: ColumnsType<WorkflowV4Item> = [
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
      title: '最后修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (_, record) =>
        record.updated_at ? new Date(record.updated_at * 1000).toLocaleString() : '-',
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
          dataSource={envs}
          columns={envColumns}
          rowKey="name"
          loading={envLoading}
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
