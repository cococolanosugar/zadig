import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Table,
  Empty,
  Dropdown,
  Modal,
  Form,
  Select,
  Input,
  Tag,
  Spin,
  Row,
  Col,
  Statistic,
  Progress,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  EllipsisOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ClusterOutlined,
  ThunderboltOutlined,
  UserOutlined,
  RocketOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

interface DashboardCardConfig {
  id?: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

interface WorkflowResponseItem {
  task_id: number;
  name: string;
  project: string;
  creator: string;
  start_time: number;
  status: string;
  display_name: string;
  workflow_type: string;
}

interface EnvResponseItem {
  name: string;
  alias?: string;
  production: boolean;
  project_name: string;
  update_time: number;
  updated_by: string;
  cluster_id: string;
}

const CARD_TYPE_OPTIONS = [
  { label: '运行中的工作流', value: 'running_workflow' },
  { label: '我的工作流', value: 'my_workflow' },
  { label: '我的环境', value: 'my_env' },
  { label: '服务热力图', value: 'service_update_frequency' },
  { label: '部署效能统计', value: 'deploy_statistics' },
  { label: '服务回滚排行榜', value: 'service_rollback_ranking' },
];

const CARD_TYPE_LABEL: Record<string, string> = {
  running_workflow: '运行中的工作流',
  my_workflow: '我的工作流',
  my_env: '我的环境',
  service_update_frequency: '服务热力图',
  deploy_statistics: '部署效能统计',
  service_rollback_ranking: '服务回滚排行榜',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<DashboardCardConfig[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [cardType, setCardType] = useState<string>('running_workflow');

  // [card.id, data] pairs for each card's fetched data
  const [cardData, setCardData] = useState<Record<string, unknown>>({});

  const loadCardConfig = useCallback(async () => {
    setCardsLoading(true);
    try {
      const res = await http.get<{ cards?: DashboardCardConfig[] }>(
        '/api/aslan/system/dashboard/settings',
        { skipErrorHandler: true }
      );
      const defaultCards = [
        { name: '运行中的工作流', type: 'running_workflow' },
        { name: '部署与交付效能统计', type: 'deploy_statistics' },
        { name: '服务回滚排行榜', type: 'service_rollback_ranking' },
      ];
      const list = res?.cards && res.cards.length > 0 ? res.cards : defaultCards;
      setCards(list);
    } catch {
      setCards([
        { name: '运行中的工作流', type: 'running_workflow' },
        { name: '部署与交付效能统计', type: 'deploy_statistics' },
        { name: '服务回滚排行榜', type: 'service_rollback_ranking' },
      ]);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCardConfig();
  }, [loadCardConfig]);

  const fetchCardData = useCallback(async (card: DashboardCardConfig) => {
    try {
      let data: unknown = null;
      if (card.type === 'running_workflow') {
        data = await http.get<WorkflowResponseItem[]>('/api/aslan/system/dashboard/workflow/running', {
          skipErrorHandler: true,
        });
      } else if (card.type === 'my_workflow') {
        data = await http.get<WorkflowResponseItem[]>(
          `/api/aslan/system/dashboard/workflow/mine${card.id ? `?card_id=${card.id}` : ''}`,
          { skipErrorHandler: true }
        );
      } else if (card.type === 'my_env') {
        const cfg = card.config || {};
        data = await http.get<EnvResponseItem>(
          `/api/aslan/system/dashboard/environment/${cfg.env_name as string}?projectName=${cfg.project_name as string}`,
          { skipErrorHandler: true }
        );
      } else if (card.type === 'deploy_statistics') {
        try {
          // 官方契约：GET /api/aslan/stat/v2/quality/deploy/health
          const health = await http.get<{ success?: number; failure?: number }>(
            '/api/aslan/stat/v2/quality/deploy/health',
            { skipErrorHandler: true }
          );
          const success = health?.success || 0;
          const failure = health?.failure || 0;
          const total = success + failure;
          // R11 任务四: 无数据时如实展示 0/-，不再回落 100% 或捏造指标
          const successRate = total > 0 ? Number(((success / total) * 100).toFixed(1)) : null;
          data = {
            total_deploys: total,
            success_rate: successRate,
            failed_deploys: failure,
          };
        } catch {
          data = {
            total_deploys: 0,
            success_rate: null,
            failed_deploys: 0,
          };
        }
      } else if (card.type === 'service_rollback_ranking') {
        try {
          // 官方契约：GET /api/aslan/stat/v2/quality/rollback/service/top
          const res = await http.get<Array<{ project_name?: string; service_name?: string; count?: number; production?: boolean }>>(
            '/api/aslan/stat/v2/quality/rollback/service/top?top=5',
            { skipErrorHandler: true }
          );
          if (Array.isArray(res) && res.length > 0) {
            data = res.map((item, idx) => ({
              rank: idx + 1,
              service_name: item.service_name || 'unknown',
              count: item.count || 0,
              last_env: item.production ? 'prod' : 'dev/test',
              last_time: '近30天',
              reason: item.project_name ? `所属项目: ${item.project_name}` : '发布回滚',
            }));
          } else {
            data = [];
          }
        } catch {
          data = [];
        }
      }
      setCardData((prev) => ({ ...prev, [card.id || card.name]: data }));
    } catch {
      setCardData((prev) => ({ ...prev, [card.id || card.name]: null }));
    }
  }, []);

  useEffect(() => {
    cards.forEach((card) => {
      fetchCardData(card);
    });
  }, [cards, fetchCardData]);

  const handleSaveCards = async (nextCards: DashboardCardConfig[]) => {
    try {
      await http.put('/api/aslan/system/dashboard/settings', { cards: nextCards });
      setCards(nextCards);
      feedback.message.success('工作台卡片配置已保存');
      return true;
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '卡片配置保存失败');
      return false;
    }
  };

  const handleAddCard = async () => {
    try {
      const values = await addForm.validateFields();
      const newCard: DashboardCardConfig = { name: values.name, type: values.type };
      if (values.type === 'my_env') {
        newCard.config = { project_name: values.project_name, env_name: values.env_name };
      }
      const ok = await handleSaveCards([...cards, newCard]);
      if (ok) {
        setAddCardModalOpen(false);
        addForm.resetFields();
        setCardType('running_workflow');
      }
    } catch {
      // Form validation error
    }
  };

  const handleRemoveCard = (card: DashboardCardConfig) => {
    handleSaveCards(cards.filter((c) => c !== card));
  };

  const cardMenuItems: MenuProps['items'] = [
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新卡片',
      onClick: () => {
        loadCardConfig();
        cards.forEach((c) => fetchCardData(c));
      },
    },
    {
      key: 'view-all',
      icon: <BranchesOutlined />,
      label: '查看全部工作流',
      onClick: () => navigate('/v1/pipelines'),
    },
  ];

  const renderWorkflowList = (items: WorkflowResponseItem[] | null | undefined, emptyText: string) => {
    if (!Array.isArray(items) || items.length === 0) {
      return (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#8c8c8c' }}>{emptyText}</span>} />
        </div>
      );
    }
    return (
      <Table
        dataSource={items}
        rowKey={(r) => `${r.name || 'task'}-${r.task_id}`}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        size="middle"
        columns={[
          {
            title: '工作流名称',
            key: 'name',
            render: (_, record) => (
              <Space orientation="horizontal">
                <BranchesOutlined style={{ color: '#0066ff' }} />
                <Button
                  type="link"
                  style={{ padding: 0, fontWeight: 500 }}
                  onClick={() => navigate(`/v1/pipelines/${record.name}/task/${record.task_id}`)}
                >
                  {record.display_name || record.name}
                </Button>
              </Space>
            ),
          },
          {
            title: '执行者',
            dataIndex: 'creator',
            key: 'creator',
            render: (creator: string) => <Text type="secondary">{creator || 'System'}</Text>,
          },
          {
            title: '创建时间',
            dataIndex: 'start_time',
            key: 'start_time',
            render: (time: number) => (
              <Text type="secondary">{time ? new Date(time * 1000).toLocaleString() : '-'}</Text>
            ),
          },
        ]}
      />
    );
  };

  const renderDeployStatistics = (stats: any) => {
    // R11 任务四: 无数据时如实展示 0 次 / '-'，严禁捏造虚假效能数
    const s = stats || {
      total_deploys: 0,
      success_rate: null,
      failed_deploys: 0,
    };
    return (
      <Row gutter={[24, 24]} align="middle" style={{ padding: '12px 0' }}>
        <Col xs={24} sm={8}>
          <Statistic
            title="总部署发布次数"
            value={s.total_deploys ?? 0}
            prefix={<RocketOutlined style={{ color: '#1677ff' }} />}
            suffix="次"
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="发布成功率"
            value={s.success_rate ?? '-'}
            precision={s.success_rate !== null && s.success_rate !== undefined ? 1 : undefined}
            styles={{ content: { color: s.success_rate !== null && s.success_rate >= 95 ? '#52c41a' : '#8c8c8c' } }}
            prefix={<CheckCircleOutlined />}
            suffix={s.success_rate !== null && s.success_rate !== undefined ? '%' : ''}
          />
          <Progress
            percent={s.success_rate !== null && s.success_rate !== undefined ? s.success_rate : 0}
            size="small"
            status={s.success_rate !== null && s.success_rate >= 95 ? 'normal' : s.success_rate !== null ? 'exception' : 'normal'}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="失败部署次数"
            value={s.failed_deploys ?? 0}
            styles={{ content: { color: s.failed_deploys ? '#fa8c16' : '#52c41a' } }}
            prefix={<ClockCircleOutlined />}
            suffix="次"
          />
        </Col>
      </Row>
    );
  };

  const renderRollbackRanking = (items: any) => {
    const list = Array.isArray(items) ? items : [];
    return (
      <Table
        dataSource={list}
        rowKey="service_name"
        pagination={false}
        size="small"
        columns={[
          {
            title: '排名',
            dataIndex: 'rank',
            key: 'rank',
            width: 70,
            render: (r: number) => {
              const color = r === 1 ? '#ff4d4f' : r === 2 ? '#fa8c16' : r === 3 ? '#faad14' : '#8c8c8c';
              return (
                <Tag color={r <= 3 ? 'gold' : 'default'} style={{ borderRadius: 10, fontWeight: 700, color }}>
                  #{r}
                </Tag>
              );
            },
          },
          {
            title: '脆弱服务名称',
            dataIndex: 'service_name',
            key: 'service_name',
            render: (name: string) => (
              <Space size={6}>
                <RollbackOutlined style={{ color: '#ff4d4f' }} />
                <Text strong style={{ color: '#1f2d3d' }}>{name}</Text>
              </Space>
            ),
          },
          {
            title: '回滚频次',
            dataIndex: 'count',
            key: 'count',
            render: (c: number) => <Tag color="error">{c} 次回滚</Tag>,
          },
          {
            title: '所属环境',
            dataIndex: 'last_env',
            key: 'last_env',
            render: (env: string) => <Tag color="blue">{env}</Tag>,
          },
          {
            title: '主要归因 / 异常类型',
            dataIndex: 'reason',
            key: 'reason',
            render: (reason: string) => <Text type="secondary" style={{ fontSize: 12 }}>{reason}</Text>,
          },
          {
            title: '最近回滚时间',
            dataIndex: 'last_time',
            key: 'last_time',
            render: (t: string) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{t}</span>,
          },
        ]}
      />
    );
  };

  const renderCard = (card: DashboardCardConfig, index: number) => {
    const key = card.id || card.name;
    const data = cardData[key];

    let body: React.ReactNode;
    if (card.type === 'running_workflow') {
      body = Array.isArray(data) ? (
        renderWorkflowList(data as WorkflowResponseItem[], '当前没有正在运行的工作流')
      ) : data === null ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      ) : (
        <Spin />
      );
    } else if (card.type === 'my_workflow') {
      body = Array.isArray(data) ? (
        renderWorkflowList(data as WorkflowResponseItem[], '暂无与我相关的工作流任务')
      ) : data === null ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      ) : (
        <Spin />
      );
    } else if (card.type === 'my_env') {
      const env = data as EnvResponseItem | null | undefined;
      body = env ? (
        <div style={{ padding: '24px 0' }}>
          <Space orientation="horizontal" size={16} wrap>
            <ClusterOutlined style={{ fontSize: 28, color: '#0066ff' }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>{env.name}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={env.production ? 'gold' : 'blue'}>{env.production ? '生产环境' : '测试环境'}</Tag>
                <Tag color="geekblue">{env.project_name}</Tag>
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  最后更新: {env.update_time ? new Date(env.update_time * 1000).toLocaleString() : '-'}
                  {env.updated_by ? ` · ${env.updated_by}` : ''}
                </Text>
              </div>
            </div>
          </Space>
        </div>
      ) : env === null ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="环境不存在或已删除" />
      ) : (
        <Spin />
      );
    } else if (card.type === 'deploy_statistics') {
      body = renderDeployStatistics(data);
    } else if (card.type === 'service_rollback_ranking') {
      body = renderRollbackRanking(data);
    } else {
      body = (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该卡片类型暂不支持" />
        </div>
      );
    }

    return (
      <Card
        key={key || index}
        variant="borderless"
        title={
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2d3d' }}>
            {card.name || CARD_TYPE_LABEL[card.type]}
          </span>
        }
        extra={
          <Space>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveCard(card)}
            />
            <Dropdown menu={{ items: cardMenuItems }} placement="bottomRight">
              <Button type="text" icon={<EllipsisOutlined style={{ fontSize: 18 }} />} />
            </Dropdown>
          </Space>
        }
        style={{
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          backgroundColor: '#ffffff',
        }}
        styles={{ body: { padding: '12px 24px', minHeight: 240 } }}
      >
        {body}
      </Card>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="default"
          icon={<PlusOutlined style={{ color: '#0066ff' }} />}
          onClick={() => setAddCardModalOpen(true)}
          style={{
            borderColor: '#0066ff',
            color: '#0066ff',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          添加卡片
        </Button>
      </div>

      {/* Dashboard Cards (config persisted per-user via /api/aslan/system/dashboard/settings) */}
      {cardsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        cards.map((card, idx) => renderCard(card, idx))
      )}

      {/* Add Card Modal */}
      <Modal
        title="添加工作台卡片"
        open={addCardModalOpen}
        onOk={handleAddCard}
        onCancel={() => setAddCardModalOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={false}
      >
        <Form
          form={addForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ type: 'running_workflow' }}
        >
          <Form.Item name="type" label="选择卡片类型" rules={[{ required: true }]}>
            <Select options={CARD_TYPE_OPTIONS} onChange={(v) => setCardType(v)} />
          </Form.Item>
          <Form.Item name="name" label="卡片名称" rules={[{ required: true, message: '请输入卡片名称' }]}>
            <Input placeholder={CARD_TYPE_LABEL[cardType]} />
          </Form.Item>
          {cardType === 'my_env' && (
            <>
              <Form.Item
                name="project_name"
                label="所属项目"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="例如: demo-k8s" />
              </Form.Item>
              <Form.Item
                name="env_name"
                label="环境名称"
                rules={[{ required: true, message: '请输入环境名称' }]}
              >
                <Input placeholder="例如: dev" />
              </Form.Item>
            </>
          )}
          {cardType === 'service_update_frequency' && (
            <Text type="secondary">
              <ThunderboltOutlined /> 服务热力图卡片将在后续版本支持，请先选择其他卡片类型。
            </Text>
          )}
          {cardType === 'running_workflow' && (
            <Text type="secondary">
              <UserOutlined /> 展示当前集群中所有正在执行的工作流任务。
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardPage;
