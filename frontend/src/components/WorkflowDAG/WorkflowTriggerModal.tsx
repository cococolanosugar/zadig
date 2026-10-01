import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Spin,
} from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { workflowApi, type WorkflowParam } from '../../api/workflow';
import { feedback } from '../../utils/feedback';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

export interface WorkflowTriggerModalProps {
  visible: boolean;
  workflowName: string;
  projectName: string;
  onClose: () => void;
}

/**
 * 执行工作流 Modal — 数据源为 GET /api/aslan/workflow/v4/preset/:name
 * （渲染后的完整 WorkflowV4：params + stages），用户修改 params 值后
 * 将整个 preset 作为 POST /workflowtask 的请求体。
 */
export const WorkflowTriggerModal: React.FC<WorkflowTriggerModalProps> = ({
  visible,
  workflowName,
  projectName,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [preset, setPreset] = useState<Record<string, unknown> | null>(null);
  const [params, setParams] = useState<WorkflowParam[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (visible && workflowName) {
      setPresetLoading(true);
      setPreset(null);
      setParams([]);
      workflowApi
        .getWorkflowPreset(workflowName)
        .then((res) => {
          if (res) {
            setPreset(res as unknown as Record<string, unknown>);
            setParams(res.params || []);
            const initialValues: Record<string, string> = {};
            (res.params || []).forEach((p) => {
              initialValues[p.name] = p.value ?? p.default ?? '';
            });
            form.setFieldsValue(initialValues);
          }
        })
        .catch(() => feedback.message.error('获取工作流执行参数失败'))
        .finally(() => setPresetLoading(false));
    }
  }, [visible, workflowName, form]);

  const handleExecute = async () => {
    if (!preset) return;
    setLoading(true);
    try {
      const values = await form.validateFields();
      const updatedParams = params.map((p) => ({
        ...p,
        value: values[p.name] ?? p.value ?? '',
      }));
      const res = await workflowApi.triggerWorkflow({
        ...(preset as Record<string, unknown>),
        project: projectName,
        params: updatedParams,
      });

      feedback.message.success(`工作流 ${workflowName} 已成功启动！`);
      onClose();

      const taskId = res?.task_id || 1;
      navigate(`/v1/pipelines/${workflowName}/task/${taskId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) feedback.message.error(`触发失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const renderParamField = (p: WorkflowParam) => {
    switch (p.type) {
      case 'choice':
        return (
          <Select
            options={(p.choice_option || []).map((opt) => ({ label: opt, value: opt }))}
            placeholder="请选择"
          />
        );
      case 'text':
        return <Input.TextArea rows={2} placeholder={p.description || '请输入'} />;
      default:
        return <Input placeholder={p.description || '请输入'} />;
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
          disabled={presetLoading || !preset}
          onClick={() => form.submit()}
        >
          立即执行
        </Button>,
      ]}
      width={560}
    >
      {presetLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#64748b' }}>正在获取工作流执行参数...</div>
        </div>
      ) : params.length > 0 ? (
        <Form form={form} layout="vertical" onFinish={handleExecute} style={{ marginTop: 16 }}>
          {params.map((p) => (
            <Form.Item
              key={p.name}
              name={p.name}
              label={
                <Space orientation="horizontal" size={6}>
                  <Text strong>{p.name}</Text>
                  {p.type && <Text type="secondary" style={{ fontSize: 11 }}>({p.type})</Text>}
                </Space>
              }
              tooltip={p.description}
              rules={p.type === 'repo' ? undefined : [{ required: false }]}
            >
              {renderParamField(p)}
            </Form.Item>
          ))}
        </Form>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Text type="secondary">该工作流没有可配置的运行参数，点击「立即执行」直接启动。</Text>
        </div>
      )}
    </Modal>
  );
};

export default WorkflowTriggerModal;
