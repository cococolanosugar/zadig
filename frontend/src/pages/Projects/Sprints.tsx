import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Empty,
  Drawer,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ScheduleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

// GET /api/aslan/sprint_management/v1/sprint?projectName= — models.Sprint
interface SprintItem {
  id: string;
  name: string;
  key?: string;
  key_initials?: string;
  template_id?: string;
  stages?: Array<{ id?: string; name?: string }>;
  is_archived?: boolean;
  created_by?: { name?: string; account?: string };
  create_time?: number;
  updated_by?: { name?: string; account?: string };
  update_time?: number;
}

// GET /api/aslan/sprint_management/v1/sprint_template — models.SprintTemplate
interface SprintTemplateItem {
  id: string;
  name: string;
  key?: string;
  key_initials?: string;
  stages?: Array<{ name?: string }>;
}

export const SprintsPage: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingSprint, setEditingSprint] = useState<SprintItem | null>(null);
  const [form] = Form.useForm();
  // 创建时选择的迭代模板
  const [templates, setTemplates] = useState<SprintTemplateItem[]>([]);

  // 迭代配置抽屉状态 (对齐 /sprints/config 路由；数据源为 sprint_template 模板列表)
  const [configDrawerOpen, setConfigDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (location.pathname.endsWith('/config')) {
      setConfigDrawerOpen(true);
    }
  }, [location.pathname]);

  const handleCloseConfig = () => {
    setConfigDrawerOpen(false);
    if (location.pathname.endsWith('/config')) {
      navigate(`/v1/projects/detail/${projectName}/sprints`);
    }
  };

  const fetchSprints = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      // 注意：无尾斜杠；后端 gin 路由注册为 sprint.GET("")
      const res = await http.get<SprintItem[]>(
        `/api/aslan/sprint_management/v1/sprint?projectName=${projectName}`
      );
      setSprints(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      setSprints([]);
      const msg = err instanceof Error ? err.message : '获取迭代列表失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  const loadTemplates = useCallback(async () => {
    if (!projectName) return;
    try {
      const res = await http.get<SprintTemplateItem[]>(
        `/api/aslan/sprint_management/v1/sprint_template?projectName=${projectName}`,
        { skipErrorHandler: true }
      );
      setTemplates(Array.isArray(res) ? res : []);
    } catch {
      setTemplates([]);
    }
  }, [projectName]);

  useEffect(() => {
    fetchSprints();
    loadTemplates();
  }, [fetchSprints, loadTemplates]);

  // 创建：POST /sprint?projectName=&templateID=&name=（后端从模板实例化迭代）
  const handleCreateOrUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingSprint) {
        // 后端仅支持改名：PUT /sprint/:id/name?projectName=&name=
        await http.put(
          `/api/aslan/sprint_management/v1/sprint/${editingSprint.id}/name?projectName=${projectName}&name=${encodeURIComponent(values.name)}`,
          {}
        );
        feedback.message.success('迭代名称更新成功');
      } else {
        await http.post(
          `/api/aslan/sprint_management/v1/sprint?projectName=${projectName}&templateID=${values.template_id}&name=${encodeURIComponent(values.name)}`,
          {}
        );
        feedback.message.success('新建迭代成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingSprint(null);
      fetchSprints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存迭代失败，请检查配置参数';
      feedback.message.error(msg);
    }
  };

  const handleDelete = async (sprintId: string) => {
    try {
      await http.delete(
        `/api/aslan/sprint_management/v1/sprint/${sprintId}?projectName=${projectName}`
      );
      feedback.message.success('迭代删除成功');
      fetchSprints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除迭代失败';
      feedback.message.error(msg);
    }
  };

  const handleArchiveToggle = async (record: SprintItem) => {
    try {
      if (record.is_archived) {
        await http.put(
          `/api/aslan/sprint_management/v1/sprint/${record.id}/activate?projectName=${projectName}`,
          {}
        );
        feedback.message.success(`迭代 [${record.name}] 已激活`);
      } else {
        await http.put(
          `/api/aslan/sprint_management/v1/sprint/${record.id}/archive?projectName=${projectName}`,
          {}
        );
        feedback.message.success(`迭代 [${record.name}] 已归档`);
      }
      fetchSprints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      feedback.message.error(msg);
    }
  };

  const handleOpenEdit = (record: SprintItem) => {
    setEditingSprint(record);
    form.setFieldsValue({ name: record.name });
    setModalVisible(true);
  };

  const filteredSprints = sprints.filter((s) =>
    s.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<SprintItem> = [
    {
      title: '迭代名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <Space orientation="horizontal" size={8}>
            <ScheduleOutlined style={{ color: '#0066ff' }} />
            <Text strong style={{ fontSize: 14 }}>
              {text}
            </Text>
            {record.key && <Text code style={{ fontSize: 12 }}>{record.key}</Text>}
          </Space>
          {record.is_archived && <Tag color="default">已归档</Tag>}
        </Space>
      ),
    },
    {
      title: '阶段数',
      key: 'stages',
      width: 100,
      render: (_, record) => <Text type="secondary">{record.stages?.length ?? 0}</Text>,
    },
    { title: '模板', dataIndex: 'template_id', key: 'template_id', render: (t) => <Text type="secondary">{String(t || '-')}</Text> },
    {
      title: '创建人',
      key: 'created_by',
      width: 130,
      render: (_, record) => <Tag>{record.created_by?.name || record.created_by?.account || 'admin'}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'update_time',
      key: 'update_time',
      width: 170,
      render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            改名
          </Button>
          <Button type="link" size="small" onClick={() => handleArchiveToggle(record)}>
            {record.is_archived ? '激活' : '归档'}
          </Button>
          <Popconfirm
            title="确认删除该迭代？"
            onConfirm={() => handleDelete(record.id)}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metric KPI Card */}
      <Row gutter={16}>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="全部迭代"
              value={sprints.length}
              prefix={<ScheduleOutlined style={{ color: '#0066ff' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Container */}
      <Card variant="borderless" styles={{ body: { padding: '20px 24px' } }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Input
            placeholder="搜索迭代名称..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />

          <Space size="middle">
            <Button
              icon={<SettingOutlined />}
              onClick={() => setConfigDrawerOpen(true)}
            >
              迭代配置
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchSprints} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingSprint(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建迭代
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredSprints}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个迭代` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无迭代记录，可点击右上角「新建迭代」规划产品冲刺"
              />
            ),
          }}
        />
      </Card>

      {/* Create / Rename Sprint Modal */}
      <Modal
        title={editingSprint ? '迭代改名' : '新建项目交付迭代'}
        open={modalVisible}
        onOk={handleCreateOrUpdate}
        onCancel={() => {
          setModalVisible(false);
          setEditingSprint(null);
        }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editingSprint ? (
            <Alert
              title="后端当前仅支持修改迭代名称；周期与阶段请在创建时通过模板确定"
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
          ) : (
            <Form.Item
              name="template_id"
              label="迭代模板"
              rules={[{ required: true, message: '请选择迭代模板' }]}
              extra="迭代阶段将按所选模板实例化"
            >
              <Select
                placeholder="请选择迭代模板"
                options={templates.map((t) => ({ label: t.name, value: t.id }))}
                notFoundContent="暂无迭代模板"
              />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="迭代名称"
            rules={[{ required: true, message: '请输入迭代名称' }]}
          >
            <Input placeholder="例如：Sprint-2409 核心功能交付" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sprint Configuration Drawer (对齐 /sprints/config 路由；展示迭代模板列表) */}
      <Drawer
        title={
          <Space>
            <SettingOutlined style={{ color: '#0066ff' }} />
            <span>迭代模板配置 ({projectName})</span>
          </Space>
        }
        placement="right"
        open={configDrawerOpen}
        onClose={handleCloseConfig}
        size="large"
      >
        <Table
          dataSource={templates}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '模板名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{String(n)}</Text> },
            { title: '标识', dataIndex: 'key', key: 'key', render: (k) => <Text code>{String(k || '-')}</Text> },
            { title: '阶段数', key: 'stages', render: (_, r) => <Text type="secondary">{r.stages?.length ?? 0}</Text> },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无迭代模板" /> }}
        />
      </Drawer>
    </div>
  );
};

export default SprintsPage;
