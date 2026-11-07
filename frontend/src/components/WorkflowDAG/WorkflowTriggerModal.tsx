import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Spin,
  Tooltip,
} from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { workflowApi, type WorkflowParam } from '../../api/workflow';
import { feedback } from '../../utils/feedback';
import { useNavigate } from 'react-router-dom';
import ChunkUploader, { type ChunkUploaderValue } from '../common/ChunkUploader';

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
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});
  const [dynamicLoading, setDynamicLoading] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const renderDynamicVar = useCallback(
    async (
      param: WorkflowParam,
      currentPreset: Record<string, unknown>,
      forceDefault = false
    ) => {
      setDynamicLoading((prev) => ({ ...prev, [param.name]: true }));
      try {
        const options = await workflowApi.renderDynamicVariables(
          projectName,
          '',
          '',
          '',
          param.name,
          currentPreset
        );
        const list = Array.isArray(options) ? options : [];
        setDynamicOptions((prev) => ({ ...prev, [param.name]: list }));

        const curVal = form.getFieldValue(param.name);
        if ((!curVal || forceDefault) && list.length > 0) {
          form.setFieldsValue({ [param.name]: list[0] });
        }
      } catch (err) {
        console.error(`Failed to render dynamic variable ${param.name}:`, err);
      } finally {
        setDynamicLoading((prev) => ({ ...prev, [param.name]: false }));
      }
    },
    [projectName, form]
  );

  useEffect(() => {
    if (visible && workflowName) {
      setPresetLoading(true);
      setPreset(null);
      setParams([]);
      setDynamicOptions({});
      setDynamicLoading({});
      workflowApi
        .getWorkflowPreset(workflowName)
        .then((res) => {
          if (res) {
            const rawPreset = res as unknown as Record<string, unknown>;
            setPreset(rawPreset);
            const pList = res.params || [];
            setParams(pList);
            const initialValues: Record<string, string> = {};
            pList.forEach((p) => {
              initialValues[p.name] = p.value ?? p.default ?? '';
            });
            form.setFieldsValue(initialValues);

            // 触发所有 script 类型的动态变量初始化渲染
            pList.forEach((p) => {
              if (p.type === 'script') {
                renderDynamicVar(p, rawPreset, !p.value);
              }
            });
          }
        })
        .catch(() => feedback.message.error('获取工作流执行参数失败'))
        .finally(() => setPresetLoading(false));
    }
  }, [visible, workflowName, form, renderDynamicVar]);

  const handleRefreshDynamicVar = (param: WorkflowParam) => {
    if (!preset) return;
    const currentValues = form.getFieldsValue();
    const currentPreset = {
      ...preset,
      params: params.map((p) => ({
        ...p,
        value: currentValues[p.name] ?? p.value ?? '',
      })),
    };
    renderDynamicVar(param, currentPreset, false);
  };

  const handleExecute = async () => {
    if (!preset) return;
    setLoading(true);
    try {
      const values = await form.validateFields();
      const updatedParams = params.map((p) => {
        const val = values[p.name] ?? p.value ?? '';
        if (p.type === 'file' && typeof val === 'object' && val !== null) {
          const fileVal = val as ChunkUploaderValue;
          return {
            ...p,
            value: fileVal.file_name,
            file_id: fileVal.file_id,
          };
        }
        return {
          ...p,
          value: val,
        };
      });
      const res = await workflowApi.triggerWorkflow({
        ...(preset as Record<string, unknown>),
        project: projectName,
        params: updatedParams,
      });

      feedback.message.success(`工作流 ${workflowName} 已成功启动！`);
      onClose();

      const taskId = res?.task_id || 1;
      // R12 任务二: 触发后直达执行页 — 标准路径需带 /v1 前缀，否则被根路由诚实 404 捕获
      const targetUrl = projectName
        ? `/v1/projects/detail/${projectName}/pipelines/custom/${workflowName}/${taskId}`
        : `/v1/pipelines/${workflowName}/task/${taskId}`;
      navigate(targetUrl);
    } catch (err: unknown) {
      // R2-A9: 错误兜底 — 无 message 时也给出明确失败提示，不再静默
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '触发失败，请稍后重试';
      feedback.message.error(`触发失败: ${msg}`);
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
      case 'multi-select':
        return (
          <Select
            mode="multiple"
            options={(p.choice_option || []).map((opt) => ({ label: opt, value: opt }))}
            placeholder="请选择 (多选)"
          />
        );
      case 'script': {
        const options = dynamicOptions[p.name] || [];
        const isVarLoading = !!dynamicLoading[p.name];
        return (
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              showSearch
              allowClear
              placeholder={isVarLoading ? '计算动态选项中...' : '请选择动态变量选项'}
              loading={isVarLoading}
              options={options.map((opt) => ({ label: opt, value: opt }))}
              notFoundContent={isVarLoading ? <Spin size="small" /> : '暂无可用动态选项'}
            />
            <Tooltip title="重新计算动态选项">
              <Button
                icon={<ReloadOutlined spin={isVarLoading} />}
                disabled={isVarLoading}
                onClick={() => handleRefreshDynamicVar(p)}
              />
            </Tooltip>
          </Space.Compact>
        );
      }
      case 'text':
        return <Input.TextArea rows={2} placeholder={p.description || '请输入'} />;
      case 'file':
        return (
          <ChunkUploader
            extraPrompt={`为参数 ${p.name} 上传大文件（最大 500MB），用于任务容器挂载`}
          />
        );
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
