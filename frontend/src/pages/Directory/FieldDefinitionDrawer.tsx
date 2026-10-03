import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Popconfirm,
  Empty,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import applicationApi, {
  type ApplicationFieldDefinition,
  type ApplicationCustomFieldType,
} from '../../api/application';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface FieldDefinitionDrawerProps {
  open: boolean;
  onClose: () => void;
  onFieldsChange?: () => void;
}

const FIELD_TYPE_OPTIONS: Array<{ label: string; value: ApplicationCustomFieldType; color: string }> = [
  { label: '单行文本 (Text)', value: 'text', color: 'blue' },
  { label: '数值 (Number)', value: 'number', color: 'green' },
  { label: '布尔开关 (Bool)', value: 'bool', color: 'orange' },
  { label: '日期时间 (Datetime)', value: 'datetime', color: 'purple' },
  { label: '单选下拉 (Single Select)', value: 'single_select', color: 'geekblue' },
  { label: '多选标签 (Multi Select)', value: 'multi_select', color: 'cyan' },
  { label: '超链接 (Link)', value: 'link', color: 'volcano' },
  { label: '用户 (User)', value: 'user', color: 'magenta' },
  { label: '用户组 (User Group)', value: 'user_group', color: 'gold' },
  { label: '所属项目 (Project)', value: 'project', color: 'lime' },
  { label: '代码仓库 (Repository)', value: 'repository', color: 'processing' },
  { label: '服务配置 (Service Config)', value: 'service_config', color: 'default' },
];

export const FieldDefinitionDrawer: React.FC<FieldDefinitionDrawerProps> = ({
  open,
  onClose,
  onFieldsChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<ApplicationFieldDefinition[]>([]);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<ApplicationFieldDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Watch field type to conditionally require options
  const selectedType = Form.useWatch('type', form);

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await applicationApi.listFieldDefinitions();
      setFields(Array.isArray(res) ? res : []);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadFields();
    }
  }, [open, loadFields]);

  const handleOpenCreate = () => {
    setEditingField(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'text',
      show_in_list: true,
      required: false,
      unique: false,
      options: [],
    });
    setFormModalOpen(true);
  };

  const handleOpenEdit = (record: ApplicationFieldDefinition) => {
    setEditingField(record);
    form.setFieldsValue({
      key: record.key,
      name: record.name,
      type: record.type,
      options: record.options || [],
      default: record.default,
      description: record.description,
      required: Boolean(record.required),
      unique: Boolean(record.unique),
      show_in_list: record.show_in_list !== false,
    });
    setFormModalOpen(true);
  };

  const handleSaveField = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload: ApplicationFieldDefinition = {
        key: values.key.trim(),
        name: values.name.trim(),
        type: values.type,
        options: values.options && values.options.length > 0 ? values.options : undefined,
        default: values.default,
        description: values.description?.trim(),
        required: values.required,
        unique: values.type === 'multi_select' ? false : values.unique,
        show_in_list: values.show_in_list,
      };

      if (editingField && editingField.id) {
        await applicationApi.updateFieldDefinition(editingField.id, payload);
        feedback.message.success(`字段 [${payload.name}] 更新成功`);
      } else {
        await applicationApi.createFieldDefinition(payload);
        feedback.message.success(`字段 [${payload.name}] 创建成功`);
      }

      setFormModalOpen(false);
      setEditingField(null);
      await loadFields();
      onFieldsChange?.();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      feedback.message.error(errorObj?.response?.data?.message || errorObj?.message || '保存字段定义失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (record: ApplicationFieldDefinition) => {
    if (!record.id) return;
    try {
      await applicationApi.deleteFieldDefinition(record.id);
      feedback.message.success(`字段 [${record.name}] 已删除`);
      await loadFields();
      onFieldsChange?.();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      feedback.message.error(errorObj?.response?.data?.message || errorObj?.message || '删除字段失败');
    }
  };

  const columns: ColumnsType<ApplicationFieldDefinition> = [
    {
      title: '字段键名',
      dataIndex: 'key',
      key: 'key',
      width: 140,
      render: (k) => <Text code>{k}</Text>,
    },
    {
      title: '字段名称',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong>{n}</Text>,
    },
    {
      title: '字段类型',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (t: ApplicationCustomFieldType) => {
        const opt = FIELD_TYPE_OPTIONS.find((o) => o.value === t);
        return <Tag color={opt?.color || 'blue'}>{opt?.label.split(' ')[0] || t}</Tag>;
      },
    },
    {
      title: '属性特征',
      key: 'attributes',
      width: 220,
      render: (_, r) => (
        <Space orientation="horizontal" size={4} wrap>
          {r.required && <Tag color="error">必填</Tag>}
          {r.unique && <Tag color="geekblue">唯一</Tag>}
          {r.show_in_list ? <Tag color="success">列表可见</Tag> : <Tag color="default">列表隐藏</Tag>}
          {r.source === 'builtin' ? <Tag color="gold">系统内置</Tag> : <Tag color="cyan">自定义</Tag>}
        </Space>
      ),
    },
    {
      title: '枚举选项',
      dataIndex: 'options',
      key: 'options',
      ellipsis: true,
      render: (opts?: string[]) =>
        opts && opts.length > 0 ? (
          <Space orientation="horizontal" size={2} wrap>
            {opts.slice(0, 3).map((o) => (
              <Tag key={o} style={{ fontSize: 11 }}>
                {o}
              </Tag>
            ))}
            {opts.length > 3 && <Text type="secondary">+{opts.length - 3}</Text>}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (d) => <Text type="secondary">{d || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_, r) => (
        <Space orientation="horizontal" size={8}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(r)}
            disabled={r.source === 'builtin'}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定要删除字段 [${r.name}] 吗？`}
            description="删除后，已有业务应用中的该自定义字段数据也将被清理。"
            onConfirm={() => handleDeleteField(r)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={r.source === 'builtin'}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={r.source === 'builtin'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space orientation="horizontal" size="small">
            <SettingOutlined style={{ color: '#0066ff' }} />
            <span>数据模型配置 (自定义字段定义)</span>
          </Space>
        }
        open={open}
        onClose={onClose}
        size="large"
        extra={
          <Space orientation="horizontal" size={8}>
            <Button icon={<ReloadOutlined />} onClick={loadFields} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建字段
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            定义业务目录应用实体的通用与扩展字段。开启「列表可见」的自定义属性将直接呈现在业务目录总览表格中。
          </Text>
        </div>

        <Table
          dataSource={fields}
          columns={columns}
          rowKey={(r) => r.id || r.key}
          loading={loading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无字段定义" />,
          }}
        />
      </Drawer>

      <Modal
        title={editingField ? `编辑字段定义 - ${editingField.name}` : '新建自定义字段定义'}
        open={formModalOpen}
        onOk={handleSaveField}
        confirmLoading={saving}
        onCancel={() => setFormModalOpen(false)}
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 16 }}>
          <Form.Item
            name="key"
            label="字段标识 (Key)"
            tooltip="字段的唯一标识，仅支持小写字母、数字及下划线，创建后不可修改"
            rules={[
              { required: true, message: '请输入字段标识 Key' },
              {
                pattern: /^[a-z][a-z0-9_]*$/,
                message: '需以小写英文字母开头，仅包含小写字母、数字与下划线',
              },
            ]}
          >
            <Input placeholder="例如: cluster_region, owner_team" disabled={Boolean(editingField)} />
          </Form.Item>

          <Form.Item
            name="name"
            label="字段名称"
            rules={[{ required: true, message: '请输入字段显示名称' }]}
          >
            <Input placeholder="例如: 部署区域, 负责团队" />
          </Form.Item>

          <Form.Item
            name="type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select options={FIELD_TYPE_OPTIONS} disabled={Boolean(editingField)} />
          </Form.Item>

          {(selectedType === 'single_select' || selectedType === 'multi_select') && (
            <Form.Item
              name="options"
              label="枚举候选项 (Options)"
              rules={[{ required: true, message: '下拉选择类型至少需要提供一个候选项' }]}
              tooltip="输入选项后按回车完成添加"
            >
              <Select mode="tags" placeholder="输入候选项内容按回车" style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item name="default" label="默认值">
            {selectedType === 'bool' ? (
              <Switch checkedChildren="true" unCheckedChildren="false" />
            ) : (
              <Input placeholder="可选，新建应用时的默认填充值" />
            )}
          </Form.Item>

          <Form.Item name="description" label="字段描述">
            <Input.TextArea rows={2} placeholder="关于该字段用途的简要说明" />
          </Form.Item>

          <Space orientation="horizontal" size={24} style={{ marginTop: 8 }}>
            <Form.Item name="required" valuePropName="checked" label="必填属性" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="必填" unCheckedChildren="选填" />
            </Form.Item>

            <Form.Item
              name="unique"
              valuePropName="checked"
              label={
                <Space size={4}>
                  <span>唯一约束</span>
                  <Tooltip title="多选标签类型不支持唯一约束">
                    <InfoCircleOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
              style={{ marginBottom: 0 }}
            >
              <Switch
                checkedChildren="唯一"
                unCheckedChildren="普通"
                disabled={selectedType === 'multi_select'}
              />
            </Form.Item>

            <Form.Item name="show_in_list" valuePropName="checked" label="在目录列表中展示" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="展示" unCheckedChildren="隐藏" defaultChecked />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default FieldDefinitionDrawer;
