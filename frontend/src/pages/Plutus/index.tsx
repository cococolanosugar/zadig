import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tabs,
  Card,
  Table,
  Tag,
  Alert,
  Select,
  Modal,
  Form,
  Input,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  RocketOutlined,
  ScheduleOutlined,
  BranchesOutlined,
  TeamOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  ReloadOutlined,
  PlusOutlined,
  SendOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useProjectStore } from '../../stores/project';
import plutusApi, {
  type PlutusCustomer,
  type PlutusCustomerGroup,
  type PlutusVersion,
  type PlutusOperationLog,
} from '../../api/plutus';
import { feedback } from '../../utils/feedback';

const { Title, Text, Paragraph } = Typography;

export const PlutusDeliveryPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, currentProject, setCurrentProject } = useProjectStore();

  const [activeTab, setActiveTab] = useState<string>('board');
  const [loading, setLoading] = useState<boolean>(false);
  const [enterpriseServiceAvailable, setEnterpriseServiceAvailable] = useState<boolean>(true);

  // 数据列表
  const [groups, setGroups] = useState<PlutusCustomerGroup[]>([]);
  const [customers, setCustomers] = useState<PlutusCustomer[]>([]);
  const [versions, setVersions] = useState<PlutusVersion[]>([]);
  const [logs, setLogs] = useState<PlutusOperationLog[]>([]);

  // 弹窗状态
  const [createCustomerVisible, setCreateCustomerVisible] = useState<boolean>(false);
  const [createGroupVisible, setCreateGroupVisible] = useState<boolean>(false);
  const [pushModalVisible, setPushModalVisible] = useState<boolean>(false);
  const [selectedVersion, setSelectedVersion] = useState<PlutusVersion | null>(null);

  const [customerForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [pushForm] = Form.useForm();

  const currentProjectName = currentProject || projects[0]?.name || '';

  const loadData = useCallback(async () => {
    if (!currentProjectName) return;
    setLoading(true);
    try {
      const [grpList, custList, verList, opList] = await Promise.all([
        plutusApi.listCustomerGroups(currentProjectName).catch(() => []),
        plutusApi.listCustomers(currentProjectName).catch(() => []),
        plutusApi.listVersions(currentProjectName).catch(() => []),
        plutusApi.listOperations({ productName: currentProjectName }).catch(() => []),
      ]);

      setGroups(grpList);
      setCustomers(custList);
      setVersions(verList);
      setLogs(opList);

      // 若所有列表全部空且后端无 plutus 微服务响应
      if (grpList.length === 0 && custList.length === 0 && verList.length === 0) {
        setEnterpriseServiceAvailable(false);
      } else {
        setEnterpriseServiceAvailable(true);
      }
    } catch {
      setEnterpriseServiceAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [currentProjectName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 新建客户提交
  const handleCreateCustomer = async () => {
    try {
      const values = await customerForm.validateFields();
      await plutusApi.createCustomer({
        ...values,
        product_name: currentProjectName,
      });
      feedback.message.success('创建交付客户成功');
      setCreateCustomerVisible(false);
      customerForm.resetFields();
      loadData();
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '创建客户失败');
    }
  };

  // 新建客户组提交
  const handleCreateGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      await plutusApi.createCustomerGroup({
        ...values,
        product_name: currentProjectName,
      });
      feedback.message.success('创建客户分组成功');
      setCreateGroupVisible(false);
      groupForm.resetFields();
      loadData();
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '创建客户分组失败');
    }
  };

  // 触发版本下发
  const handlePushVersion = async () => {
    try {
      const values = await pushForm.validateFields();
      await plutusApi.pushVersion({
        ...values,
        productName: currentProjectName,
        versionName: selectedVersion?.version_name,
        versionID: selectedVersion?.version_id,
      });
      feedback.message.success('版本下发任务已发起');
      setPushModalVisible(false);
      pushForm.resetFields();
      loadData();
    } catch (err: unknown) {
      feedback.message.error(err instanceof Error ? err.message : '下发版本失败');
    }
  };

  // 客户列表表格列
  const customerColumns: ColumnsType<PlutusCustomer> = [
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'name',
      render: (v, r) => (
        <div>
          <Text strong>{v}</Text>
          {r.alias && <Text type="secondary" style={{ marginLeft: 8 }}>({r.alias})</Text>}
        </div>
      ),
    },
    {
      title: '所属分组',
      dataIndex: 'group_name',
      key: 'group',
      render: (g) => g ? <Tag color="blue">{g}</Tag> : <Tag>未分组</Tag>,
    },
    {
      title: '目标集群 / 命名空间',
      key: 'cluster',
      render: (_, r) => (
        <span>
          {r.cluster_id || '-'} / <Text code>{r.namespace || 'default'}</Text>
        </span>
      ),
    },
    {
      title: '当前运行版本',
      dataIndex: 'current_version',
      key: 'version',
      render: (ver) => ver ? <Tag color="green">{ver}</Tag> : <Tag color="orange">未部署</Tag>,
    },
    {
      title: '健康状态',
      dataIndex: 'status',
      key: 'status',
      render: (s) => (
        <Tag color={s === 'running' || s === 'healthy' ? 'success' : 'processing'}>
          {String(s || '在线')}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => {
              feedback.message.info(`正在连接客户控制台: ${r.customer_name}`);
            }}
          >
            控制台
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => {
              feedback.modal?.confirm({
                title: `确认移除客户 [${r.customer_name}]？`,
                content: '移除后将停止该客户的私有化版本持续交付追踪。',
                onOk: async () => {
                  await plutusApi.deleteCustomer(currentProjectName, r.customer_name);
                  feedback.message.success('已移除客户');
                  loadData();
                },
              });
            }}
          >
            移除
          </Button>
        </Space>
      ),
    },
  ];

  // 版本列表表格列
  const versionColumns: ColumnsType<PlutusVersion> = [
    {
      title: '版本号',
      dataIndex: 'version_name',
      key: 'version_name',
      render: (v) => <Text strong code>{v}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'desc',
      key: 'desc',
      render: (d) => d || '-',
    },
    {
      title: '包含微服务数',
      key: 'services',
      render: (_, r) => <Tag color="purple">{r.services?.length || 0} 个服务</Tag>,
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      render: (c) => c || '系统',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            onClick={() => {
              setSelectedVersion(r);
              setPushModalVisible(true);
            }}
          >
            下发到客户组
          </Button>
        </Space>
      ),
    },
  ];

  // 操作审计表格列
  const logColumns: ColumnsType<PlutusOperationLog> = [
    { title: '操作人', dataIndex: 'username', key: 'username', width: 140 },
    { title: '动作', dataIndex: 'action', key: 'action', width: 160 },
    { title: '目标对象', dataIndex: 'target', key: 'target', width: 220 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={s === 'success' ? 'success' : 'processing'}>{s || '成功'}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* 顶部标题与项目切换 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            端到端价值流交付中心 (Plutus)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            面向多客户、私有化环境与定制化分发版本的端到端版本交付与状态管控
          </Text>
        </div>

        <Space>
          <Select
            style={{ width: 200 }}
            value={currentProjectName}
            onChange={(p) => setCurrentProject(p)}
            options={projects.map((p) => ({ label: p.alias || p.name, value: p.name }))}
            placeholder="选择项目"
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 社区版模式提示 Banner */}
      {!enterpriseServiceAvailable && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
          title="当前处于社区就绪模式 (Plutus 交付能力已就绪)"
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span>
                当前环境检测到未挂载闭源 Plutus 微服务后端。界面已对齐官方完整数据模型与操作契约，您也可以无缝使用原生工作流与发布计划体验持续交付。
              </span>
              <Space>
                <Button size="small" type="primary" ghost icon={<BranchesOutlined />} onClick={() => navigate('/v1/releaseWorkflow')}>
                  前往工作流交付
                </Button>
                <Button size="small" icon={<ScheduleOutlined />} onClick={() => navigate('/v1/releasePlan')}>
                  前往发布计划
                </Button>
              </Space>
            </div>
          }
        />
      )}

      {/* 核心指标统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card size="small" variant="borderless">
            <Statistic
              title="已纳管交付客户"
              value={customers.length}
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" variant="borderless">
            <Statistic
              title="客户分组数"
              value={groups.length}
              prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" variant="borderless">
            <Statistic
              title="纳管发布版本"
              value={versions.length}
              prefix={<RocketOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small" variant="borderless">
            <Statistic
              title="在线集群与环境"
              value={customers.filter((c) => c.status === 'running' || c.status === 'healthy').length}
              prefix={<CloudServerOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 核心业务标签页 */}
      <Card variant="borderless" styles={{ body: { padding: '12px 20px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'board',
              label: (
                <span>
                  <AppstoreOutlined /> 交付大盘
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text strong>客户分组与版本同步拓扑</Text>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateGroupVisible(true)}>
                      新建分组
                    </Button>
                  </div>

                  <Row gutter={[16, 16]}>
                    {groups.map((g) => (
                      <Col xs={24} sm={12} md={8} key={g.group_id || g.group_name}>
                        <Card
                          size="small"
                          title={
                            <Space>
                              <TeamOutlined style={{ color: '#1677ff' }} />
                              <span>{g.group_name}</span>
                            </Space>
                          }
                          extra={<Tag color="blue">{g.customer_count ?? g.customers?.length ?? 0} 个客户</Tag>}
                        >
                          <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ minHeight: 40 }}>
                            {g.description || '暂无分组描述信息'}
                          </Paragraph>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              包含客户: {(g.customers || []).slice(0, 3).join(', ') || '暂无客户'}
                            </Text>
                            <Button size="small" type="link">
                              配置分发
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    ))}
                    {groups.length === 0 && (
                      <Col span={24}>
                        <div style={{ padding: '32px 0', textAlign: 'center', color: '#8c8c8c' }}>
                          暂无客户分组，点击右上角「新建分组」开启多租户定制化交付
                        </div>
                      </Col>
                    )}
                  </Row>
                </div>
              ),
            },
            {
              key: 'customers',
              label: (
                <span>
                  <TeamOutlined /> 客户管理
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateCustomerVisible(true)}>
                      添加客户
                    </Button>
                  </div>
                  <Table
                    columns={customerColumns}
                    dataSource={customers}
                    rowKey={(r) => r.customer_name || String(Math.random())}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
            {
              key: 'versions',
              label: (
                <span>
                  <RocketOutlined /> 交付版本库
                </span>
              ),
              children: (
                <Table
                  columns={versionColumns}
                  dataSource={versions}
                  rowKey={(r) => r.version_id || r.version_name || String(Math.random())}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'logs',
              label: (
                <span>
                  <HistoryOutlined /> 交付审计日志
                </span>
              ),
              children: (
                <Table
                  columns={logColumns}
                  dataSource={logs}
                  rowKey={(r) => r.id || String(Math.random())}
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 新建客户 Modal */}
      <Modal
        title="添加交付客户"
        open={createCustomerVisible}
        onOk={handleCreateCustomer}
        onCancel={() => setCreateCustomerVisible(false)}
        destroyOnHidden
      >
        <Form form={customerForm} layout="vertical">
          <Form.Item name="customer_name" label="客户标识 (唯一 Code)" rules={[{ required: true, message: '请输入客户标识' }]}>
            <Input placeholder="例如: alipay-prod" />
          </Form.Item>
          <Form.Item name="alias" label="客户显示名称">
            <Input placeholder="例如: 支付宝专有云生产" />
          </Form.Item>
          <Form.Item name="group_name" label="所属分组">
            <Select placeholder="选择客户分组" allowClear options={groups.map((g) => ({ label: g.group_name, value: g.group_name }))} />
          </Form.Item>
          <Form.Item name="cluster_id" label="目标集群 ID">
            <Input placeholder="例如: local" />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间">
            <Input placeholder="例如: prod" />
          </Form.Item>
          <Form.Item name="description" label="备注说明">
            <Input.TextArea rows={3} placeholder="输入客户私有化部署要求或网络限制等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建客户分组 Modal */}
      <Modal
        title="新建客户分组"
        open={createGroupVisible}
        onOk={handleCreateGroup}
        onCancel={() => setCreateGroupVisible(false)}
        destroyOnHidden
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item name="group_name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="例如: 金融私有云组" />
          </Form.Item>
          <Form.Item name="description" label="分组描述">
            <Input.TextArea rows={3} placeholder="输入分组业务定位或环境特征" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 下发版本 Modal */}
      <Modal
        title={`下发版本 [${selectedVersion?.version_name || ''}]`}
        open={pushModalVisible}
        onOk={handlePushVersion}
        onCancel={() => setPushModalVisible(false)}
        destroyOnHidden
      >
        <Form form={pushForm} layout="vertical">
          <Form.Item name="group_name" label="目标客户分组" rules={[{ required: true, message: '请选择下发分组' }]}>
            <Select placeholder="选择下发分组" options={groups.map((g) => ({ label: g.group_name, value: g.group_name }))} />
          </Form.Item>
          <Form.Item name="deploy_type" label="部署模式" initialValue="byRenderSet">
            <Select
              options={[
                { label: 'RenderSet 变量差量部署', value: 'byRenderSet' },
                { label: '全量历史版本回溯部署', value: 'byHistory' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlutusDeliveryPage;
