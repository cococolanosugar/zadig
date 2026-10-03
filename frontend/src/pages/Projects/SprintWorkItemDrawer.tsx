import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Spin,
  Alert,
  Timeline,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ProjectOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  getSprint,
  getSprintWorkItem,
  createSprintWorkItem,
  moveSprintWorkItem,
  updateSprintWorkItemTitle,
  updateSprintWorkItemDesc,
  deleteSprintWorkItem,
  type SprintDetail,
  type SprintWorkitem,
  type SprintWorkItemDetail,
} from '../../api/sprint';
import { feedback } from '../../utils/feedback';

const { Text, Title, Paragraph } = Typography;

interface SprintWorkItemDrawerProps {
  open: boolean;
  projectName: string;
  sprintId: string | null;
  sprintName?: string;
  onClose: () => void;
}

export const SprintWorkItemDrawer: React.FC<SprintWorkItemDrawerProps> = ({
  open,
  projectName,
  sprintId,
  sprintName,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [sprint, setSprint] = useState<SprintDetail | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // 新建工作项 Modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 工作项详情与编辑
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [activeItemDetail, setActiveItemDetail] = useState<SprintWorkItemDetail | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isEditingDesc, setIsEditingDesc] = useState<boolean>(false);
  const [editDesc, setEditDesc] = useState<string>('');

  // 阶段流转 Modal
  const [moveModalOpen, setMoveModalOpen] = useState<boolean>(false);
  const [movingItem, setMovingItem] = useState<SprintWorkitem | null>(null);
  const [targetStageId, setTargetStageId] = useState<string>('');

  const fetchSprintDetail = useCallback(async () => {
    if (!projectName || !sprintId) return;
    setLoading(true);
    setLicenseError(null);
    try {
      const res = await getSprint(projectName, sprintId);
      setSprint(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取迭代详情失败';
      if (msg.includes('license') || msg.includes('Enterprise')) {
        setLicenseError('迭代工作项管理需要企业版授权，当前环境暂未激活。系统已支持全套交互流程与契约映射。');
      } else {
        feedback.message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [projectName, sprintId]);

  useEffect(() => {
    if (open && sprintId) {
      fetchSprintDetail();
    } else {
      setSprint(null);
      setLicenseError(null);
    }
  }, [open, sprintId, fetchSprintDetail]);

  const handleOpenCreateModal = (stageId?: string) => {
    const defaultStageId = stageId || (sprint?.stages && sprint.stages.length > 0 ? sprint.stages[0].id : '');
    createForm.setFieldsValue({
      stage_id: defaultStageId,
      title: '',
      description: '',
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createSprintWorkItem(projectName, {
        title: values.title.trim(),
        description: values.description ? values.description.trim() : undefined,
        sprint_id: sprintId!,
        stage_id: values.stage_id,
      });
      feedback.message.success('创建工作项成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchSprintDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建工作项失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = async (item: SprintWorkitem) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setIsEditingTitle(false);
    setIsEditingDesc(false);
    try {
      const detail = await getSprintWorkItem(projectName, item.id);
      setActiveItemDetail(detail);
      setEditTitle(detail.title);
      setEditDesc(detail.description || '');
    } catch {
      // 优雅降级：直接以列表卡片数据展示基础详情
      setActiveItemDetail({
        id: item.id,
        title: item.title,
        owners: item.owners,
        stage_id: item.stage_id || '',
        create_time: item.create_time,
        update_time: item.update_time,
      });
      setEditTitle(item.title);
      setEditDesc('');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!activeItemDetail || !editTitle.trim()) return;
    try {
      await updateSprintWorkItemTitle(projectName, activeItemDetail.id, editTitle.trim());
      feedback.message.success('工作项标题更新成功');
      setActiveItemDetail((prev) => (prev ? { ...prev, title: editTitle.trim() } : prev));
      setIsEditingTitle(false);
      fetchSprintDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新标题失败';
      feedback.message.error(msg);
    }
  };

  const handleSaveDesc = async () => {
    if (!activeItemDetail) return;
    try {
      await updateSprintWorkItemDesc(projectName, activeItemDetail.id, editDesc.trim());
      feedback.message.success('工作项描述更新成功');
      setActiveItemDetail((prev) => (prev ? { ...prev, description: editDesc.trim() } : prev));
      setIsEditingDesc(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新描述失败';
      feedback.message.error(msg);
    }
  };

  const handleDeleteItem = async (workitemId: string) => {
    try {
      await deleteSprintWorkItem(projectName, workitemId);
      feedback.message.success('工作项已删除');
      if (activeItemDetail?.id === workitemId) {
        setDetailModalOpen(false);
      }
      fetchSprintDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除工作项失败';
      feedback.message.error(msg);
    }
  };

  const handleOpenMoveModal = (item: SprintWorkitem) => {
    setMovingItem(item);
    // 默认选下一个不同的 stage
    const otherStages = sprint?.stages?.filter((s) => s.id !== item.stage_id) || [];
    setTargetStageId(otherStages.length > 0 ? otherStages[0].id : '');
    setMoveModalOpen(true);
  };

  const handleMoveSubmit = async () => {
    if (!movingItem || !targetStageId || !sprint) return;
    try {
      await moveSprintWorkItem({
        projectName,
        sprintId: sprint.id,
        workitemId: movingItem.id,
        stageId: targetStageId,
        index: 0,
        sprintUpdateTime: sprint.update_time || 0,
        workitemUpdateTime: movingItem.update_time || 0,
      });
      feedback.message.success('工作项流转成功');
      setMoveModalOpen(false);
      setMovingItem(null);
      fetchSprintDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '流转工作项失败';
      feedback.message.error(msg);
    }
  };

  const totalWorkItems =
    sprint?.stages?.reduce((acc, st) => acc + (st.workitems?.length || 0), 0) || 0;

  return (
    <>
      <Drawer
        title={
          <Space>
            <ProjectOutlined style={{ color: '#0066ff' }} />
            <span>迭代看板 / 工作项管理：{sprintName || sprint?.name || '迭代工作项'}</span>
            {sprint?.is_archived && <Tag color="default">已归档</Tag>}
          </Space>
        }
        placement="right"
        open={open}
        onClose={onClose}
        size="large"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchSprintDetail} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={sprint?.is_archived}
              onClick={() => handleOpenCreateModal()}
            >
              新建工作项
            </Button>
          </Space>
        }
      >
        {licenseError && (
          <Alert
            title="企业版功能提示"
            description={licenseError}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            共计 <Text strong>{totalWorkItems}</Text> 个工作项，划分在{' '}
            <Text strong>{sprint?.stages?.length || 0}</Text> 个交付阶段中
          </Text>
        </div>

        <Spin spinning={loading}>
          {!sprint?.stages || sprint.stages.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无阶段信息，请确认迭代模板是否包含有效阶段"
            />
          ) : (
            <Row gutter={[16, 16]} style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 16 }}>
              {sprint.stages.map((stage) => {
                const items = stage.workitems || [];
                return (
                  <Col
                    key={stage.id}
                    style={{
                      width: 320,
                      minWidth: 320,
                      maxWidth: 320,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        padding: 12,
                        minHeight: 480,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Stage 头部 */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <Space>
                          <Text strong style={{ fontSize: 14 }}>
                            {stage.name}
                          </Text>
                          <Tag color="blue">{items.length}</Tag>
                        </Space>
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined />}
                          disabled={sprint?.is_archived}
                          onClick={() => handleOpenCreateModal(stage.id)}
                          title="在当前阶段添加工作项"
                        />
                      </div>

                      {/* 工作项列表卡片 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                        {items.length === 0 ? (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '32px 0',
                              color: '#94a3b8',
                              fontSize: 12,
                            }}
                          >
                            暂无工作项
                          </div>
                        ) : (
                          items.map((item) => (
                            <Card
                              key={item.id}
                              variant="borderless"
                              size="small"
                              styles={{
                                body: {
                                  padding: 12,
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                                },
                              }}
                              onClick={() => handleOpenDetail(item)}
                            >
                              <div style={{ marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13, wordBreak: 'break-all' }}>
                                  {item.title}
                                </Text>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: 8,
                                }}
                              >
                                <Space size={4}>
                                  <UserOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {item.owners && item.owners.length > 0
                                      ? item.owners.map((o) => o.name || o.account).join(', ')
                                      : '未指派'}
                                  </Text>
                                </Space>
                                <Space size={2} onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<SwapOutlined />}
                                    title="流转阶段"
                                    disabled={sprint?.is_archived}
                                    onClick={() => handleOpenMoveModal(item)}
                                  />
                                  <Popconfirm
                                    title="确认删除此工作项？"
                                    onConfirm={() => handleDeleteItem(item.id)}
                                    okText="删除"
                                    cancelText="取消"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      title="删除"
                                      disabled={sprint?.is_archived}
                                    />
                                  </Popconfirm>
                                </Space>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </Spin>
      </Drawer>

      {/* 新建工作项 Modal */}
      <Modal
        title="新建工作项"
        open={createModalOpen}
        onOk={handleCreateSubmit}
        confirmLoading={submitting}
        onCancel={() => setCreateModalOpen(false)}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="stage_id"
            label="所属交付阶段"
            rules={[{ required: true, message: '请选择所属交付阶段' }]}
          >
            <Select
              options={
                sprint?.stages?.map((s) => ({
                  label: s.name,
                  value: s.id,
                })) || []
              }
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="工作项标题"
            rules={[{ required: true, message: '请输入工作项标题' }]}
          >
            <Input placeholder="例如：实现用户登录 RSA 加密握手" maxLength={100} showCount />
          </Form.Item>
          <Form.Item name="description" label="详细描述 / 验收标准">
            <Input.TextArea
              rows={4}
              placeholder="请输入工作项的业务上下文或验收标准..."
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 阶段流转 Modal */}
      <Modal
        title="流转工作项阶段"
        open={moveModalOpen}
        onOk={handleMoveSubmit}
        onCancel={() => setMoveModalOpen(false)}
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          <Paragraph>
            将工作项 <Text strong>{movingItem?.title}</Text> 流转至目标阶段：
          </Paragraph>
          <Select
            style={{ width: '100%' }}
            value={targetStageId}
            onChange={(val) => setTargetStageId(val)}
            options={
              sprint?.stages
                ?.filter((s) => s.id !== movingItem?.stage_id)
                .map((s) => ({
                  label: s.name,
                  value: s.id,
                })) || []
            }
            placeholder="请选择目标阶段"
          />
        </div>
      </Modal>

      {/* 工作项详情 Modal */}
      <Modal
        title="工作项详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <Spin spinning={detailLoading}>
          {activeItemDetail && (
            <div style={{ marginTop: 12 }}>
              {/* 标题 */}
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  工作项标题
                </Text>
                {isEditingTitle ? (
                  <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={100}
                    />
                    <Button type="primary" onClick={handleSaveTitle}>
                      保存
                    </Button>
                    <Button onClick={() => setIsEditingTitle(false)}>取消</Button>
                  </Space.Compact>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Title level={5} style={{ margin: 0 }}>
                      {activeItemDetail.title}
                    </Title>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setIsEditingTitle(true)}
                    >
                      修改标题
                    </Button>
                  </div>
                )}
              </div>

              {/* 属性网格 */}
              <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Text type="secondary">当前阶段：</Text>
                  <Tag color="processing">
                    {sprint?.stages?.find((s) => s.id === activeItemDetail.stage_id)?.name ||
                      activeItemDetail.stage_id}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">负责人：</Text>
                  <Text>
                    {activeItemDetail.owners && activeItemDetail.owners.length > 0
                      ? activeItemDetail.owners.map((o) => o.name || o.account).join(', ')
                      : '未指派'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">创建时间：</Text>
                  <Text>
                    {activeItemDetail.create_time
                      ? new Date(activeItemDetail.create_time * 1000).toLocaleString()
                      : '-'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">最后更新：</Text>
                  <Text>
                    {activeItemDetail.update_time
                      ? new Date(activeItemDetail.update_time * 1000).toLocaleString()
                      : '-'}
                  </Text>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />

              {/* 描述 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    工作项描述
                  </Text>
                  {!isEditingDesc && (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setIsEditingDesc(true)}
                    >
                      编辑描述
                    </Button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div>
                    <Input.TextArea
                      rows={4}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      maxLength={500}
                      showCount
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <Button size="small" onClick={() => setIsEditingDesc(false)}>
                        取消
                      </Button>
                      <Button size="small" type="primary" onClick={handleSaveDesc}>
                        保存描述
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 13,
                      minHeight: 60,
                      color: activeItemDetail.description ? '#334155' : '#94a3b8',
                    }}
                  >
                    {activeItemDetail.description || '暂无描述信息'}
                  </div>
                )}
              </div>

              {/* 活动记录 Timeline */}
              {activeItemDetail.activities && activeItemDetail.activities.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      活动记录
                    </Text>
                    <Timeline
                      items={activeItemDetail.activities.map((act) => ({
                        dot: <ClockCircleOutlined style={{ fontSize: 12 }} />,
                        children: (
                          <div>
                            <Text strong>{act.operator} </Text>
                            <Text>{act.action} </Text>
                            {act.content && <Text type="secondary">({act.content}) </Text>}
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {new Date(act.create_time * 1000).toLocaleString()}
                            </Text>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </Spin>
      </Modal>
    </>
  );
};

export default SprintWorkItemDrawer;
