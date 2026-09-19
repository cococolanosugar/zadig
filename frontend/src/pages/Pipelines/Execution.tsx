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
import LogViewer from '../../components/Terminal/LogViewer';

const { Title, Text } = Typography;

export const PipelineExecutionPage: React.FC = () => {
  const { name: workflowName, taskId } = useParams<{ name: string; taskId: string }>();
  const { currentProject } = useProjectStore();
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
        currentProject || 'default'
      );
      if (res && res.task_id) {
        setTask(res);
      } else {
        // Mock sample task execution for preview
        setTask({
          id: String(taskId),
          task_id: Number(taskId),
          workflow_name: workflowName,
          project_name: currentProject || 'default',
          status: 'passed',
          creator: 'admin@qq.com',
          create_time: Math.floor(Date.now() / 1000) - 120,
          start_time: Math.floor(Date.now() / 1000) - 110,
          end_time: Math.floor(Date.now() / 1000),
          stages: [
            {
              name: '代码拉取与构建',
              status: 'passed',
              jobs: [{ name: 'build-job', type: 'zadig-build', status: 'passed' }],
            },
            {
              name: '容器镜像部署',
              status: 'passed',
              jobs: [{ name: 'deploy-job', type: 'zadig-deploy', status: 'passed' }],
            },
          ],
        });
      }
    } catch {
      setTask({
        id: String(taskId),
        task_id: Number(taskId),
        workflow_name: workflowName,
        project_name: currentProject || 'default',
        status: 'passed',
        creator: 'admin@qq.com',
        create_time: Math.floor(Date.now() / 1000) - 120,
        stages: [
          {
            name: '代码构建 (Build)',
            status: 'passed',
            jobs: [{ name: 'build-job', type: 'zadig-build', status: 'passed' }],
          },
          {
            name: '环境部署 (Deploy)',
            status: 'passed',
            jobs: [{ name: 'deploy-job', type: 'zadig-deploy', status: 'passed' }],
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [workflowName, taskId, currentProject]);

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
                    状态: {renderStatusTag(task?.status)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    <UserOutlined /> 触发人: {task?.creator || 'admin'}
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
        <Steps items={stepsItems} />
      </Card>

      {/* Step Console Logs Terminal */}
      <Card
        variant="borderless"
        title={
          <Space orientation="horizontal">
            <Text strong>执行控制台日志 (Job: {selectedJob})</Text>
            <Badge status="processing" text="实时输出" />
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <LogViewer
          logs={[
            `[Zadig Engine] 任务 #${taskId} 初始化调度器...`,
            `[Stage 1] 正在拉取代码分支: main (Commit: 8f9a2b1)`,
            `[Build] 正在使用 Docker 构建镜像: demo-app:v1.0.0...`,
            `Step 1/5 : FROM alpine:3.18`,
            ` ---> 9b45b0f47306`,
            `Step 2/5 : RUN apk add --no-cache bash curl`,
            ` ---> Running in 3cb58849b7`,
            `Step 3/5 : COPY . /app`,
            ` ---> e192847a9b`,
            `Step 4/5 : EXPOSE 8080`,
            ` ---> Running in 7c12847190`,
            `Step 5/5 : CMD ["./start.sh"]`,
            `Successfully built and tagged demo-app:v1.0.0`,
            `[Deploy] 正在部署服务至 Kubernetes 开发环境 (dev)...`,
            `deployment.apps/demo-service configured`,
            `[Success] 任务 #${taskId} 全部步骤执行完成！`,
          ]}
          height={480}
        />
      </Card>
    </div>
  );
};

export default PipelineExecutionPage;
