import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
  Space,
  Input,
  Tag,
  Empty,
  Modal,
  Form,
  Popconfirm,
  Drawer,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FolderOpenOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

// /api/aslan/application/applications — models.Application
export interface CatalogApplication {
  id: string;
  name: string;
  key: string;
  project: string;
  type?: string;
  owner?: string;
  description?: string;
  testing_service_name?: string;
  production_service_name?: string;
  create_time?: number;
  update_time?: number;
}

export const DirectoryPage: React.FC = () => {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogApplication | null>(null);
  const [form] = Form.useForm();

  // Detail Drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<CatalogApplication | null>(null);

  const loadApplications = useCallback(
    async (p: number, ps: number, query: string) => {
      setLoading(true);
      try {
        const res = await http.post<{ items: CatalogApplication[]; total: number }>(
          '/api/aslan/application/applications/search',
          { query, page: p, page_size: ps, filters: [] },
          { skipErrorHandler: true }
        );
        const list = res?.items || [];
        setItems(list);
        setTotal(res?.total || 0);

        // If routeId is present, match it
        if (routeId) {
          const found = list.find((it) => String(it.id) === String(routeId));
          if (found) {
            setDetailItem(found);
            setDetailOpen(true);
          }
        }
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [routeId]
  );

  useEffect(() => {
    loadApplications(page, pageSize, searchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    loadApplications(1, pageSize, searchText.trim());
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenDetail = (record: CatalogApplication) => {
    setDetailItem(record);
    setDetailOpen(true);
    navigate(`/v1/directory/detail/${record.id}`);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailItem(null);
    navigate('/v1/directory');
  };

  const handleEdit = (record: CatalogApplication) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      key: record.key,
      project: record.project,
      type: record.type,
      owner: record.owner,
      description: record.description,
      testing_service_name: record.testing_service_name,
      production_service_name: record.production_service_name,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await http.put(`/api/aslan/application/applications/${editing.id}`, { ...editing, ...values });
        feedback.message.success(`应用 [${values.name}] 已更新`);
      } else {
        await http.post('/api/aslan/application/applications', values);
        feedback.message.success(`应用 [${values.name}] 创建成功`);
      }
      setModalOpen(false);
      setEditing(null);
      loadApplications(page, pageSize, searchText.trim());
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '保存失败');
      }
    }
  };

  const handleDelete = async (record: CatalogApplication) => {
    try {
      await http.delete(`/api/aslan/application/applications/${record.id}`);
      feedback.message.success(`应用 [${record.name}] 已删除`);
      loadApplications(page, pageSize, searchText.trim());
    } catch {
      // Handled
    }
  };

  const columns: ColumnsType<CatalogApplication> = [
    {
      title: '业务系统名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space orientation="horizontal">
          <FolderOpenOutlined style={{ color: '#0066ff' }} />
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 600 }}
            onClick={() => handleOpenDetail(record)}
          >
            {name}
          </Button>
        </Space>
      ),
    },
    { title: '标识 (Key)', dataIndex: 'key', key: 'key', render: (k) => <Text code>{String(k || '-')}</Text> },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t) => <Tag color="geekblue">{String(t || '-')}</Tag>,
    },
    { title: '所属项目', dataIndex: 'project', key: 'project', render: (p) => <Tag color="blue">{String(p || '-')}</Tag> },
    { title: '负责人', dataIndex: 'owner', key: 'owner', render: (o) => <Text type="secondary">{String(o || '-')}</Text> },
    {
      title: '关联服务 (测试 / 生产)',
      key: 'services',
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {`${record.testing_service_name || '-'} / ${record.production_service_name || '-'}`}
        </Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'update_time',
      key: 'update_time',
      render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space orientation="horizontal">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定要删除业务应用 [${record.name}] 吗？`}
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
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          业务目录 (Service Catalog)
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          企业微服务与系统全景视图，按业务域梳理上下游拓扑关系、开发环境依赖及发布拓扑
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space orientation="horizontal" size={12}>
            <Input
              placeholder="搜索应用名称 / Key / 负责人"
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadApplications(page, pageSize, searchText.trim())}>
              刷新
            </Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建应用
          </Button>
        </div>

        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 个业务应用`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: <Empty description="暂无业务应用数据，点击右上角「新建应用」添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      {/* Edit / Create Modal */}
      <Modal
        title={editing ? '编辑业务应用' : '新建业务应用'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={handleSave}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="例如: 订单中心" />
          </Form.Item>
          <Form.Item
            name="key"
            label="应用标识 (英文)"
            rules={[
              { required: true, message: '请输入应用标识' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符' },
            ]}
          >
            <Input placeholder="例如: order-center" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请输入所属项目' }]}>
            <Input placeholder="例如: demo-k8s" />
          </Form.Item>
          <Form.Item name="type" label="应用类型">
            <Input placeholder="例如: 微服务 / 中间件 / Web 应用" />
          </Form.Item>
          <Form.Item name="owner" label="负责人">
            <Input placeholder="例如: 张三" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="应用职责与边界说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer for /v1/directory/detail/:id */}
      <Drawer
        title={
          <Space>
            <FolderOpenOutlined style={{ color: '#0066ff' }} />
            <span>业务系统详情: {detailItem?.name}</span>
          </Space>
        }
        open={detailOpen}
        onClose={handleCloseDetail}
        size={600}
      >
        {detailItem && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="系统名称">{detailItem.name}</Descriptions.Item>
            <Descriptions.Item label="标识 (Key)">
              <Text code>{detailItem.key}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="所属项目">
              <Tag color="blue">{detailItem.project}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="系统类型">
              <Tag color="geekblue">{detailItem.type || '微服务'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="负责人">{detailItem.owner || '-'}</Descriptions.Item>
            <Descriptions.Item label="测试环境服务">
              {detailItem.testing_service_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="生产环境服务">
              {detailItem.production_service_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {detailItem.update_time ? new Date(detailItem.update_time * 1000).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="职责描述">
              {detailItem.description || '暂无描述'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default DirectoryPage;
