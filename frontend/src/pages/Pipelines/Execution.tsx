import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Steps,
  Typography,
  Badge,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { workflowApi, type WorkflowTaskExecution } from '../../api/workflow';
import { useProjectStore } from '../../stores/project';
import { feedback } from '../../utils/feedback';
import LogViewer from '../../components/Terminal/LogViewer';

const { Title, Text } = Typography;

export const PipelineExecutionPage: React.FC = () => {
  const { name: workflowName, taskId, projectName } = useParams<{ name: string; taskId: string; projectName?: string }>();
  const { currentProject } = useProjectStore();
  const activeProject = projectName || currentProject || 'default';
  const navigate = useNavigate();

  const [task, setTask] = useState<WorkflowTaskExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>('build-job');

  const loadTask = useCallback(async () => {
    if (!workflowName || !taskId) return;
    setLoading(true);
    try {
      const res = await workflowApi.getWorkflowTask(
        workflowName,
        taskId,
        activeProject
      );
      if (res && res.task_id) {
        setTask(res);
      } else {
        setTask(null);
        feedback.message.warning('任务不存在或已被清理');
      }
    } catch {
      setTask(null);
      feedback.message.error('获取任务详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [workflowName, taskId, activeProject]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const renderStatusTag = (status?: string) => {
    switch (status) {
      case 'passed':
      case 'success':
        return <Tag icon={<CheckCircleOutlined />} color="success">构建成功</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">正在执行</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">执行失败</Tag>;
      default:
        return <Tag color="default">排队中</Tag>;
    }
  };

  const stepsItems =
    task?.stages?.map((stage) => {
      let stepStatus: 'finish' | 'process' | 'error' | 'wait' = 'finish';
      if (stage.status === 'running') stepStatus = 'process';
      else if (stage.status === 'failed') stepStatus = 'error';
      else if (stage.status === 'waiting') stepStatus = 'wait';

      return {
        title: stage.name,
        description: (
          <div style={{ marginTop: 4 }}>
            {stage.jobs.map((j) => (
              <Tag
                key={j.name}
                color={selectedJob === j.name ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedJob(j.name)}
              >
                {j.name} ({j.status})
              </Tag>
            ))}
          </div>
        ),
        status: stepStatus,
      };
    }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top action header */}
      <Card variant="borderless" styles={{ body: { padding: '16px 24px' } }} style={{ borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space orientation="horizontal" size="middle">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/v1/pipelines')}
              >
                返回工作流
              </Button>
              <BranchesOutlined style={{ fontSize: 20, color: '#0066ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {workflowName} #{taskId} 任务详情
                </Title>
                <Space orientation="horizontal" style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    所属项目: <Tag color="blue">{activeProject}</Tag>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    状态: {renderStatusTag(task?.status)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <UserOutlined /> 触发人: {task?.creator || '-'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <ClockCircleOutlined /> 开始时间: {task?.create_time ? new Date(task.create_time * 1000).toLocaleString() : '-'}
                  </Text>
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Button
              icon={<SyncOutlined />}
              loading={loading}
              onClick={loadTask}
            >
              刷新进度
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Pipeline Stage Progress Steps */}
      <Card
        variant="borderless"
        title="工作流 Stage 阶段执行流"
        style={{ borderRadius: 8 }}
      >
        {task ? (
          <Steps items={stepsItems} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading ? '加载中...' : '未找到任务执行详情'}
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* Step Console Logs Terminal */}
      <Card
        variant="borderless"
        title={
          <Space orientation="horizontal">
            <Text strong>执行控制台日志 (Job: {selectedJob})</Text>
            <Badge status="default" text="暂未接入日志流" />
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <LogViewer height={480} />
      </Card>
    </div>
  );
};

export default PipelineExecutionPage;
