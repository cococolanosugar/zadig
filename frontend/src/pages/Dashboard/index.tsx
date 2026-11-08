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
  Tag,
  Spin,
  Row,
  Col,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  EllipsisOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ClusterOutlined,
  UserOutlined,
  PlayCircleOutlined,
  AppstoreOutlined,
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
  {
    label: '运行中的工作流',
    value: 'running_workflow',
    description: '显示系统中正在运行的工作流任务实时状态',
    icon: <PlayCircleOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
  },
  {
    label: '我的工作流',
    value: 'my_workflow',
    description: '显示个人关注的工作流列表，支持快速触发运行',
    icon: <BranchesOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
  },
  {
    label: '我的环境',
    value: 'my_env',
    description: '显示个人关注的环境及服务运行状态',
    icon: <ClusterOutlined style={{ fontSize: 28, color: '#faad14' }} />,
  },
];

const CARD_TYPE_LABEL: Record<string, string> = {
  running_workflow: '运行中的工作流',
  my_workflow: '我的工作流',
  my_env: '我的环境',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<DashboardCardConfig[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);
  const [addingType, setAddingType] = useState<string | null>(null);

  const [cardData, setCardData] = useState<Record<string, unknown>>({});

  const loadCardConfig = useCallback(async () => {
    setCardsLoading(true);
    try {
      const res = await http.get<{ cards?: DashboardCardConfig[] }>(
        '/api/aslan/system/dashboard/settings',
        { skipErrorHandler: true }
      );
      const defaultCards = [{ name: '运行中的工作流', type: 'running_workflow' }];
      const list = res?.cards && res.cards.length > 0 ? res.cards : defaultCards;
      setCards(list);
    } catch {
      setCards([{ name: '运行中的工作流', type: 'running_workflow' }]);
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
        const cfg = (card.config || {}) as {
          env_name?: string;
          project_name?: string;
          production?: boolean;
        };
        const envName = cfg.env_name || '';
        const projectName = cfg.project_name || '';
        const production = cfg.production ? 'true' : 'false';
        data = await http.get<EnvResponseItem>(
          `/api/aslan/system/dashboard/environment/${envName}?projectName=${projectName}&production=${production}`,
          { skipErrorHandler: true }
        );
      }
      setCardData((prev) => ({ ...prev, [card.id || card.name]: data }));
    } catch {
      setCardData((prev) => ({ ...prev, [card.id || card.name]: null }));
    }
  }, []);

  const refreshAllCardData = useCallback(() => {
    cards.forEach((card) => {
      fetchCardData(card);
    });
  }, [cards, fetchCardData]);

  useEffect(() => {
    refreshAllCardData();
  }, [refreshAllCardData]);

  // 工作台数据 5 秒自动轮询
  useEffect(() => {
    if (cards.length === 0) return undefined;
    const timer = window.setInterval(() => {
      cards.forEach((card) => {
        fetchCardData(card);
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [cards, fetchCardData]);

  const handleSaveCards = async (nextCards: DashboardCardConfig[], silent = false) => {
    try {
      await http.put('/api/aslan/system/dashboard/settings', { cards: nextCards });
      setCards(nextCards);
      if (!silent) {
        feedback.message.success('工作台卡片配置已保存');
      }
      return true;
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '卡片配置保存失败');
      return false;
    }
  };

  const operateCard = async (type: string) => {
    setAddingType(type);
    try {
      const option = CARD_TYPE_OPTIONS.find((o) => o.value === type);
      const newCard: DashboardCardConfig = {
        name: option?.label || CARD_TYPE_LABEL[type] || type,
        type,
      };
      if (type === 'my_env') {
        newCard.config = { project_name: '', env_name: '', production: false };
      }
      const ok = await handleSaveCards([...cards, newCard]);
      if (ok) {
        setAddCardModalOpen(false);
      }
    } finally {
      setAddingType(null);
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
        refreshAllCardData();
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
              <Text strong style={{ fontSize: 16 }}>{env.name || '未配置环境'}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={env.production ? 'gold' : 'blue'}>{env.production ? '生产环境' : '测试环境'}</Tag>
                {env.project_name ? <Tag color="geekblue">{env.project_name}</Tag> : null}
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
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="环境不存在或尚未配置" />
      ) : (
        <Spin />
      );
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

      {cardsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        cards.map((card, idx) => renderCard(card, idx))
      )}

      <Modal
        title={
          <Space>
            <AppstoreOutlined />
            <span>选择工作台卡片</span>
          </Space>
        }
        open={addCardModalOpen}
        onCancel={() => setAddCardModalOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
          {CARD_TYPE_OPTIONS.map((opt) => (
            <Col xs={24} sm={12} md={8} key={opt.value}>
              <Card
                hoverable
                variant="outlined"
                onClick={() => {
                  if (!addingType) operateCard(opt.value);
                }}
                style={{ height: '100%', cursor: addingType ? 'wait' : 'pointer' }}
                styles={{ body: { padding: 16 } }}
              >
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <div>{opt.icon}</div>
                  <Text strong style={{ fontSize: 15 }}>{opt.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    {opt.description}
                  </Text>
                  <Button
                    type="primary"
                    block
                    loading={addingType === opt.value}
                    disabled={!!addingType && addingType !== opt.value}
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!addingType) operateCard(opt.value);
                    }}
                  >
                    添加卡片
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            <UserOutlined /> 单击卡片即可添加至工作台，配置将自动持久化。
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
