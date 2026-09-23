import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Typography,
  Popconfirm,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export interface VariableSetItem {
  id: string;
  name: string;
  description?: string;
  project_name?: string;
  variable_yaml?: string;
  created_at?: number;
  created_by?: string;
  updated_at?: number;
  updated_by?: string;
}

export const VarsGroupPage: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const [loading, setLoading] = useState(false);
  const [dataList, setDataList] = useState<VariableSetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<VariableSetItem | null>(null);
  const [form] = Form.useForm();

  const fetchVariableSets = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const res = await http.get<{
        variable_set_list?: VariableSetItem[];
        total?: number;
      }>(
        `/api/aslan/project/variablesets?page=${page}&perPage=${pageSize}&projectName=${projectName}&ifPassFilter=true`,
        { skipErrorHandler: true }
      );
      setDataList(res?.variable_set_list || []);
      setTotal(res?.total || 0);
    } catch {
      setDataList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectName, page, pageSize]);

  useEffect(() => {
    fetchVariableSets();
  }, [fetchVariableSets]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      variable_yaml: '# 请输入 YAML 格式变量，例如：\nkey1: "value1"\nport: 8080\nenv: "production"',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: VariableSetItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      variable_yaml: item.variable_yaml || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        await http.put(
          `/api/aslan/project/variablesets/${editingItem.id}?projectName=${projectName}`,
          values
        );
        feedback.message.success(`变量组 [${values.name}] 更新成功`);
      } else {
        await http.post(
          `/api/aslan/project/variablesets?projectName=${projectName}`,
          values
        );
        feedback.message.success(`变量组 [${values.name}] 创建成功`);
      }
      setModalOpen(false);
      setEditingItem(null);
      fetchVariableSets();
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '保存变量组失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: VariableSetItem) => {
    try {
      await http.delete(
        `/api/aslan/project/variablesets/${item.id}?projectName=${projectName}`
      );
      feedback.message.success(`变量组 [${item.name}] 删除成功`);
      fetchVariableSets();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '删除变量组失败');
    }
  };

  const filteredList = dataList.filter((item) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const columns: ColumnsType<VariableSetItem> = [
    {
      title: '变量组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space orientation="horizontal">
          <CodeOutlined style={{ color: '#0066ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (desc ? <Text type="secondary">{desc}</Text> : '-'),
    },
    {
      title: '最后修改人',
      dataIndex: 'updated_by',
      key: 'updated_by',
      render: (by, record) => by || record.created_by || '-',
    },
    {
      title: '最后修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (time, record) => {
        const t = time || record.created_at;
        return t ? dayjs(t * 1000).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space orientation="horizontal">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定要删除变量组 [${record.name}] 吗？`}
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
              变量组管理
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              支持在项目中维护通用的 YAML 格式变量组，以便服务和工作流统一复用与动态覆盖
            </Text>
          </div>
          <Space orientation="horizontal">
            <Input
              placeholder="搜索变量组名称/描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchVariableSets} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建变量组
            </Button>
          </Space>
        </div>

        <Table
          dataSource={filteredList}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无变量组，点击右上角「新建变量组」添加"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑变量组' : '新建变量组'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="变量组名称"
            rules={[
              { required: true, message: '请输入变量组名称' },
              {
                pattern: /^[a-z0-9-]+$/,
                message: '名称仅支持小写字母、数字及中划线 (-)',
              },
            ]}
          >
            <Input placeholder="例如：global-config-vars" disabled={!!editingItem} />
          </Form.Item>

          <Form.Item name="description" label="变量组描述">
            <Input placeholder="请输入简要业务描述" />
          </Form.Item>

          <Form.Item
            name="variable_yaml"
            label="YAML 变量配置"
            rules={[{ required: true, message: '请输入 YAML 变量内容' }]}
            help="输入合法的 YAML 键值对，用于在环境构建或服务编排中作为变量覆盖注入"
          >
            <TextArea
              rows={12}
              style={{
                fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                fontSize: 13,
                backgroundColor: '#fafafa',
              }}
              placeholder="key: value"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VarsGroupPage;
