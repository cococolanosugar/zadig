import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
} from 'antd';
import { PlayCircleOutlined, BranchesOutlined } from '@ant-design/icons';
import { workflowApi } from '../../api/workflow';
import { feedback } from '../../utils/feedback';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

export interface WorkflowTriggerModalProps {
  visible: boolean;
  workflowName: string;
  projectName: string;
  onClose: () => void;
}

export const WorkflowTriggerModal: React.FC<WorkflowTriggerModalProps> = ({
  visible,
  workflowName,
  projectName,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleExecute = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await workflowApi.triggerWorkflow({
        workflow_name: workflowName,
        project_name: projectName,
        inputs: values,
      });

      feedback.message.success(`工作流 ${workflowName} 已成功启动！`);
      onClose();

      const taskId = res?.task_id || 1;
      navigate(`/v1/pipelines/${workflowName}/task/${taskId}`);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space orientation="horizontal">
          <PlayCircleOutlined style={{ color: '#52c41a' }} />
          <span>执行工作流: {workflowName}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="run"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={loading}
          onClick={() => form.submit()}
        >
          立即执行
        </Button>,
      ]}
      width={540}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleExecute}
        initialValues={{
          branch: 'main',
          env: 'dev',
        }}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="branch"
          label={
            <Space orientation="horizontal">
              <BranchesOutlined />
              <Text>构建代码分支 (Git Branch)</Text>
            </Space>
          }
          rules={[{ required: true, message: '请输入代码分支' }]}
        >
          <Input placeholder="例如: main, release/v1.0, master" />
        </Form.Item>

        <Form.Item name="env" label="目标发布环境">
          <Select
            options={[
              { label: '开发测试环境 (dev)', value: 'dev' },
              { label: '集成测试环境 (qa)', value: 'qa' },
              { label: '生产集群环境 (prod)', value: 'prod' },
            ]}
          />
        </Form.Item>

        <Form.Item name="image_tag" label="自定义镜像 Tag (可选)">
          <Input placeholder="留空默认根据 commit id 生成" />
        </Form.Item>

        <Form.Item name="custom_args" label="动态运行时变量 (Key=Value)">
          <Input.TextArea placeholder="KEY1=VALUE1&#10;KEY2=VALUE2" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkflowTriggerModal;
