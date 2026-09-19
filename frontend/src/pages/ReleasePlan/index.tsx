import React, { useState, useEffect, useCallback } from 'react';
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
  DatePicker,
  Drawer,
  Descriptions,
  Popconfirm,
  Badge,
} from 'antd';
import {
  ScheduleOutlined,
  SearchOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { releasePlanApi, type ReleasePlanItem } from '../../api/releasePlan';
import { feedback } from '../../utils/feedback';
import { useAuthStore } from '../../stores/auth';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export const ReleasePlanPage: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [plans, setPlans] = useState<ReleasePlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');

  // Modal state
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Drawer state
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [activePlan, setActivePlan] = useState<ReleasePlanItem | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await releasePlanApi.getPlans();
      setPlans(data);
    } catch (err: any) {
      setPlans([]);
      feedback.message.error(err?.message || '获取发布计划失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreatePlan = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const range = values.timeRange;
      const startTime = range && range[0] ? range[0].format('YYYY-MM-DD HH:mm') : undefined;
      const endTime = range && range[1] ? range[1].format('YYYY-MM-DD HH:mm') : undefined;

      const payload: Partial<ReleasePlanItem> = {
        name: values.name,
        description: values.description,
        manager: values.manager || userInfo?.account || 'admin',
        start_time: startTime,
        end_time: endTime,
        release_time: endTime ? `${startTime || ''} ~ ${endTime}` : undefined,
        status: 'planning',
      };

      await releasePlanApi.createPlan(payload);
      feedback.message.success(`发布计划 [${values.name}] 创建成功！`);
      setCreateModalVisible(false);
      form.resetFields();
      fetchPlans();
    } catch (err: any) {
      feedback.message.error(err?.message || '创建发布计划失败，请检查参数');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (id: string, name: string) => {
    try {
      await releasePlanApi.deletePlan(id);
      feedback.message.success(`发布计划 [${name}] 已成功删除`);
      fetchPlans();
    } catch (err: any) {
      feedback.message.error(err?.message || '删除发布计划失败');
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (p.manager && p.manager.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns: ColumnsType<ReleasePlanItem> = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space orientation="vertical" size={2}>
          <Space orientation="horizontal">
            <ScheduleOutlined style={{ color: '#0066ff' }} />
            <Text strong>{name}</Text>
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        switch (status) {
          case 'success':
            return <Badge status="success" text={<Text style={{ color: '#52c41a' }}>已完成</Text>} />;
          case 'executing':
            return <Badge status="processing" text={<Text style={{ color: '#0066ff' }}>发布中</Text>} />;
          case 'failed':
            return <Badge status="error" text={<Text style={{ color: '#ff4d4f' }}>异常挂起</Text>} />;
          default:
            return <Badge status="default" text={<Text type="secondary">规划中</Text>} />;
        }
      },
    },
    {
      title: '发布窗口 / 目标上线时间',
      key: 'time_window',
      render: (_, record) => {
        const timeStr =
          record.release_time ||
          (record.start_time && record.end_time ? `${record.start_time} ~ ${record.end_time}` : '-');
        return (
          <Space size={6}>
            <CalendarOutlined style={{ color: '#8c8c8c' }} />
            <Text style={{ fontSize: 13 }}>{timeStr}</Text>
          </Space>
        );
      },
    },
    {
      title: '负责人',
      dataIndex: 'manager',
      key: 'manager',
      width: 160,
      render: (m) => <Tag color="geekblue">{m || '未指定'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            onClick={() => {
              setActivePlan(record);
              setDetailDrawerVisible(true);
            }}
          >
            详情编排
          </Button>
          <Popconfirm
            title={`确认删除发布计划 [${record.name}]？`}
            onConfirm={() => handleDeletePlan(record.id || record._id || '', record.name)}
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
      {/* Header */}
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
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            发布计划 (Release Plans)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            跨项目、多业务线统一编排版本发布日历，跟踪版本发布窗口与里程碑进度
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索发布计划名称 / 负责人"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchPlans} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={() => {
              form.resetFields();
              setCreateModalVisible(true);
            }}
          >
            新建发布计划
          </Button>
        </Space>
      </div>

      {/* Main Table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Table
          rowKey={(r) => r.id || r._id || r.name}
          dataSource={filteredPlans}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个发布计划` }}
          locale={{
            emptyText: (
              <Empty
                description="暂无发布计划记录，可点击上方新建创建首个发布窗口"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    setCreateModalVisible(true);
                  }}
                >
                  新建发布计划
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新建版本发布计划"
        open={createModalVisible}
        onOk={handleCreatePlan}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={creating}
        okText="立即创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ manager: userInfo?.account || 'admin' }}
        >
          <Form.Item
            name="name"
            label="计划标识名称"
            rules={[{ required: true, message: '请输入发布计划名称' }]}
          >
            <Input placeholder="例如: 2026Q3-核心微服务大版本上线" />
          </Form.Item>

          <Form.Item name="manager" label="主负责人">
            <Input placeholder="输入负责人姓名或邮箱" />
          </Form.Item>

          <Form.Item name="timeRange" label="计划发布时间窗口">
            <RangePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          <Form.Item name="description" label="计划目标与变更说明">
            <TextArea rows={3} placeholder="简述本次版本发布的核心业务功能、上下游依赖与风险预案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <ScheduleOutlined style={{ color: '#0066ff' }} />
            <span>发布计划详情编排: {activePlan?.name}</span>
          </Space>
        }
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        size="large"
      >
        {activePlan && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="计划名称">{activePlan.name}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color="blue">{activePlan.status || 'planning'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="责任人">{activePlan.manager || '-'}</Descriptions.Item>
              <Descriptions.Item label="发布窗口">{activePlan.release_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="说明备注">{activePlan.description || '无详细说明'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24 }}>
              里程碑检查项 (Release Checklist)
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              包含质量门禁、安全扫描与生产发布审批的自动化核验状态。
            </Paragraph>

            <Card variant="borderless" style={{ background: '#fafafa', borderRadius: 6 }}>
              <Space vertical size={12} style={{ width: '100%' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong>代码审查门禁：</Text>
                  <Tag color="success">已通过</Tag>
                </Space>
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong>自动化回归测试：</Text>
                  <Tag color="success">已通过 (100%)</Tag>
                </Space>
                <Space>
                  <InfoCircleOutlined style={{ color: '#faad14' }} />
                  <Text strong>生产变更审批单：</Text>
                  <Tag color="warning">待主管签批</Tag>
                </Space>
              </Space>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ReleasePlanPage;
