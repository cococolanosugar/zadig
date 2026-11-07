import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Switch,
  Button,
  Table,
  Space,
  Typography,
  Alert,
  Tooltip,
  App,
} from 'antd';
import {
  AppstoreAddOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { serviceApi, ServiceVariableKV, YamlTemplateDetail } from '../../api/service';
import YamlEditor from '../../components/Editor/YamlEditor';

const { Text } = Typography;

export interface SyncTemplateServiceInfo {
  service_name: string;
  template_id?: string;
  auto_sync?: boolean;
  variable_yaml?: string;
  service_variable_kvs?: ServiceVariableKV[];
}

interface ImportFromTemplateModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  isProduction?: boolean;
  syncService?: SyncTemplateServiceInfo | null;
  onSuccess: (serviceName: string) => void;
}

export const ImportFromTemplateModal: React.FC<ImportFromTemplateModalProps> = ({
  open,
  onClose,
  projectName,
  isProduction = false,
  syncService = null,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const isSyncMode = Boolean(syncService);

  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [currentVariables, setCurrentVariables] = useState<ServiceVariableKV[]>([]);
  const [currentVariableYaml, setCurrentVariableYaml] = useState<string>('');

  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 加载 YAML 模板列表
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const list = await serviceApi.getYamlTemplates(projectName);
      setTemplates(list);
    } catch (err: unknown) {
      setTemplates([]);
      message.error(err instanceof Error ? err.message : 'YAML 模板列表获取失败');
    } finally {
      setLoadingTemplates(false);
    }
  }, [projectName, message]);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setShowPreview(false);
      setPreviewContent('');
      if (syncService) {
        form.setFieldsValue({
          serviceName: syncService.service_name,
          templateId: syncService.template_id,
          autoSync: Boolean(syncService.auto_sync),
        });
        setCurrentVariables(syncService.service_variable_kvs || []);
        setCurrentVariableYaml(syncService.variable_yaml || '');
      } else {
        form.resetFields();
        setCurrentVariables([]);
        setCurrentVariableYaml('');
      }
    }
  }, [open, syncService, loadTemplates, form]);

  // 当选择模板时，获取模板变量详情
  const handleTemplateChange = async (templateId: string) => {
    setShowPreview(false);
    setPreviewContent('');
    if (!templateId) {
      setCurrentVariables([]);
      setCurrentVariableYaml('');
      return;
    }
    try {
      const detail: YamlTemplateDetail | null = await serviceApi.getYamlTemplateDetail(templateId);
      if (detail) {
        setCurrentVariables(detail.service_variable_kvs || []);
        setCurrentVariableYaml(detail.variable_yaml || '');
      }
    } catch {
      message.error('获取模板变量失败');
    }
  };

  // 修改单条变量值
  const handleVariableValueChange = (index: number, val: unknown) => {
    const updated = [...currentVariables];
    updated[index] = { ...updated[index], value: val };
    setCurrentVariables(updated);
  };

  // 切换预览 YAML
  const handleTogglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      return;
    }

    try {
      const values = await form.validateFields(['serviceName', 'templateId']);
      setPreviewLoading(true);

      // 先转换变量 KV -> YAML
      let varYaml = currentVariableYaml;
      let varKvs = currentVariables;
      try {
        const convertRes = await serviceApi.convertVariableKVAndYaml({
          action: 'toYaml',
          kvs: varKvs,
          yaml: varYaml,
        });
        if (convertRes?.yaml) {
          varYaml = convertRes.yaml;
          varKvs = convertRes.kvs || varKvs;
        }
      } catch {
        // Fallback to local state
      }

      const rendered = await serviceApi.previewServiceTemplate(projectName, {
        service_name: values.serviceName.trim(),
        project_name: projectName,
        template_id: values.templateId,
        auto_sync: Boolean(form.getFieldValue('autoSync')),
        variable_yaml: varYaml,
        service_variable_kvs: varKvs,
      });

      setPreviewContent(rendered || '# 预览内容为空');
      setShowPreview(true);
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '生成预览失败，请检查服务名称与变量输入';
      message.error(errMsg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 提交创建或同步
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 同步最新变量为 YAML 字符串
      let varYaml = currentVariableYaml;
      let varKvs = currentVariables;
      try {
        const convertRes = await serviceApi.convertVariableKVAndYaml({
          action: 'toYaml',
          kvs: varKvs,
          yaml: varYaml,
        });
        if (convertRes?.yaml) {
          varYaml = convertRes.yaml;
          varKvs = convertRes.kvs || varKvs;
        }
      } catch {
        // Fallback to local
      }

      const payload = {
        service_name: values.serviceName.trim(),
        project_name: projectName,
        template_id: values.templateId,
        auto_sync: Boolean(values.autoSync),
        variable_yaml: varYaml,
        service_variable_kvs: varKvs,
      };

      if (isSyncMode) {
        await serviceApi.reloadServiceFromTemplate(projectName, isProduction, payload);
        message.success(`服务 [${payload.service_name}] 从模板同步更新成功！`);
      } else {
        await serviceApi.loadServiceFromTemplate(projectName, isProduction, payload);
        message.success(`使用模板创建服务 [${payload.service_name}] 成功！`);
      }

      onSuccess(payload.service_name);
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || (err as Error)?.message || '保存失败，请检查参数';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const variableColumns = [
    {
      title: '键名 (Key)',
      dataIndex: 'key',
      key: 'key',
      width: 160,
      render: (k: string) => <Text code>{k}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'desc',
      key: 'desc',
      width: 180,
      render: (d: string) => <Text type="secondary">{d || '-'}</Text>,
    },
    {
      title: '变量值 (Value)',
      key: 'value',
      render: (_: unknown, record: ServiceVariableKV, index: number) => {
        if (record.type === 'enum' && record.options && record.options.length > 0) {
          return (
            <Select
              size="small"
              value={String(record.value ?? '')}
              onChange={(val) => handleVariableValueChange(index, val)}
              options={record.options.map((opt) => ({ value: opt, label: opt }))}
              style={{ width: '100%' }}
            />
          );
        }
        if (record.type === 'bool') {
          return (
            <Switch
              size="small"
              checked={Boolean(record.value)}
              onChange={(checked) => handleVariableValueChange(index, checked)}
            />
          );
        }
        return (
          <Input
            size="small"
            value={String(record.value ?? '')}
            onChange={(e) => handleVariableValueChange(index, e.target.value)}
            placeholder="请输入变量值"
          />
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <AppstoreAddOutlined style={{ color: '#1677ff' }} />
          <span>{isSyncMode ? `从模板同步更新服务 (${syncService?.service_name})` : '新建服务 - 使用模板新建'}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={isSyncMode ? '同步更新' : '确认创建'}
      cancelText="取消"
      width={760}
      destroyOnHidden
    >
      <Alert
        title={
          isSyncMode
            ? '更新服务与所选模板关联，并按配置变量重新渲染服务 Manifest。'
            : '从全局 YAML 模板库快速生成服务，支持配置变量注入与实时渲染预览。'
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="serviceName"
          label="服务组件名称 (DNS 命名规范)"
          rules={[{ required: true, message: '请输入服务名称' }]}
        >
          <Input
            placeholder="例如: order-service"
            disabled={isSyncMode}
          />
        </Form.Item>

        <Form.Item
          name="templateId"
          label="选择 YAML 模板"
          rules={[{ required: true, message: '请选择基础模板' }]}
        >
          <Select
            placeholder="请选择 YAML 模板"
            loading={loadingTemplates}
            onChange={handleTemplateChange}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        {/* 变量表格 */}
        {currentVariables.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              模板变量配置 ({currentVariables.length}):
            </Text>
            <Table
              dataSource={currentVariables}
              rowKey="key"
              columns={variableColumns}
              size="small"
              pagination={false}
              bordered
            />
          </div>
        )}

        <Form.Item
          name="autoSync"
          valuePropName="checked"
          initialValue={false}
          style={{ marginBottom: 16 }}
        >
          <Space>
            <span>自动同步模板 (Auto Sync):</span>
            <Switch />
            <Tooltip title="开启后，对模板库操作应用到服务时，该服务配置将自动基于模板内容同步。">
              <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
            </Tooltip>
          </Space>
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            type="dashed"
            icon={showPreview ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            loading={previewLoading}
            onClick={handleTogglePreview}
            block
          >
            {showPreview ? '关闭 YAML 预览' : '生成并预览渲染后的 Kubernetes YAML'}
          </Button>
        </Form.Item>
      </Form>

      {/* 实时预览区 */}
      {showPreview && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            渲染生成的 Kubernetes YAML:
          </Text>
          <YamlEditor value={previewContent} theme="light" height={280} readOnly />
        </div>
      )}
    </Modal>
  );
};

export default ImportFromTemplateModal;
