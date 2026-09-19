import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Table,
  Empty,
  Dropdown,
  Modal,
  Form,
  Select,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  EllipsisOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workflowApi, type WorkflowTaskPreview } from '../../api/workflow';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<WorkflowTaskPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const taskRes = await workflowApi.getWorkflowTasks({ pageNum: 1, pageSize: 10 });
      if (taskRes?.workflow_list) {
        setTasks(taskRes.workflow_list);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const cardMenuItems: MenuProps['items'] = [
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新卡片',
      onClick: fetchTasks,
    },
    {
      key: 'view-all',
      icon: <BranchesOutlined />,
      label: '查看全部工作流',
      onClick: () => navigate('/v1/pipelines'),
    },
  ];

  const columns = [
    {
      title: '工作流名称',
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      render: (text: string, record: WorkflowTaskPreview) => (
        <Space orientation="horizontal">
          <BranchesOutlined style={{ color: '#0066ff' }} />
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 500 }}
            onClick={() => navigate(`/v1/pipelines/${record.workflow_name}/task/${record.task_id}`)}
          >
            {text || `Task #${record.task_id}`}
          </Button>
        </Space>
      ),
    },
    {
      title: '执行者',
      dataIndex: 'task_creator',
      key: 'task_creator',
      render: (creator: string) => <Text type="secondary">{creator || 'System'}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time: number) => (
        <Text type="secondary">{time ? new Date(time * 1000).toLocaleString() : '-'}</Text>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="default"
          icon={<PlusOutlined style={{ color: '#0066ff' }} />}
          onClick={() => setAddCardModalOpen(true)}
          style={{
            borderColor: '#0066ff',
            color: '#0066ff',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          添加卡片
        </Button>
      </div>

      {/* Widget Card: 运行中的工作流 */}
      <Card
        variant="borderless"
        title={
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2d3d' }}>
            运行中的工作流
          </span>
        }
        extra={
          <Dropdown menu={{ items: cardMenuItems }} placement="bottomRight">
            <Button type="text" icon={<EllipsisOutlined style={{ fontSize: 18 }} />} />
          </Dropdown>
        }
        style={{
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          backgroundColor: '#ffffff',
        }}
        styles={{
          body: {
            padding: '12px 24px',
            minHeight: 280,
          },
        }}
      >
        {tasks.length > 0 ? (
          <Table
            dataSource={tasks}
            columns={columns}
            rowKey={(r) => `${r.workflow_name || 'task'}-${r.task_id}`}
            pagination={false}
            size="middle"
            loading={loading}
          />
        ) : (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#8c8c8c' }}>暂无数据</span>}
            />
          </div>
        )}
      </Card>

      {/* Add Card Modal */}
      <Modal
        title="添加工作台卡片"
        open={addCardModalOpen}
        onOk={() => {
          feedback.message.success('卡片配置已更新');
          setAddCardModalOpen(false);
        }}
        onCancel={() => setAddCardModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="选择卡片类型" initialValue="workflow">
            <Select
              options={[
                { label: '运行中的工作流', value: 'workflow' },
                { label: '环境状态卡片', value: 'env' },
                { label: '构建统计卡片', value: 'build' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardPage;
