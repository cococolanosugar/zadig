import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  Tabs,
  Badge,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  HddOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowUpOutlined,
  PoweroffOutlined,
  CodeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  listPMHosts,
  listPMLabels,
  createPMHost,
  updatePMHost,
  deletePMHost,
  getAgentAccessCmd,
  offlineVM,
  recoveryVM,
  upgradeAgent,
  type PMHost,
  type AgentAccessCmds,
} from '../../api/pmHost';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

export const ProjectHostsPage: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const [loading, setLoading] = useState<boolean>(false);
  const [hosts, setHosts] = useState<PMHost[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('all');

  // 新建/编辑主机 Modal
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingHost, setEditingHost] = useState<PMHost | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isAgentMode, setIsAgentMode] = useState<boolean>(true);

  // 接入命令 Modal
  const [cmdModalVisible, setCmdModalVisible] = useState<boolean>(false);
  const [cmdLoading, setCmdLoading] = useState<boolean>(false);
  const [activeHostForCmd, setActiveHostForCmd] = useState<PMHost | null>(null);
  const [accessCmds, setAccessCmds] = useState<AgentAccessCmds | null>(null);
  const [activeOsTab, setActiveOsTab] = useState<string>('linux');
  const [activeArch, setActiveArch] = useState<string>('amd64');

  const fetchHosts = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const data = await listPMHosts(projectName, searchText.trim() || undefined);
      setHosts(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取主机列表失败';
      feedback.message.error(msg);
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, [projectName, searchText]);

  const fetchLabels = useCallback(async () => {
    try {
      const data = await listPMLabels();
      setLabels(data);
    } catch {
      setLabels([]);
    }
  }, []);

  useEffect(() => {
    fetchHosts();
    fetchLabels();
  }, [fetchHosts, fetchLabels]);

  const handleOpenCreate = () => {
    setEditingHost(null);
    setIsAgentMode(true);
    form.resetFields();
    form.setFieldsValue({
      port: 22,
      user_name: 'root',
      schedule_workflow: true,
      is_prod: false,
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (host: PMHost) => {
    setEditingHost(host);
    setIsAgentMode(!!host.schedule_workflow);
    form.setFieldsValue({
      name: host.name,
      ip: host.ip,
      port: host.port || 22,
      user_name: host.user_name || 'root',
      label: host.label,
      is_prod: !!host.is_prod,
      schedule_workflow: !!host.schedule_workflow,
      description: host.description,
    });
    setModalVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!projectName) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingHost) {
        await updatePMHost(projectName, editingHost.id, {
          name: values.name.trim(),
          ip: values.ip.trim(),
          port: Number(values.port),
          user_name: values.user_name.trim(),
          label: values.label,
          is_prod: !!values.is_prod,
          schedule_workflow: !!values.schedule_workflow,
          description: values.description ? values.description.trim() : undefined,
          private_key: values.private_key,
        });
        feedback.message.success('更新主机成功');
      } else {
        await createPMHost(projectName, {
          name: values.name.trim(),
          ip: values.ip.trim(),
          port: Number(values.port),
          user_name: values.user_name.trim(),
          label: values.label,
          is_prod: !!values.is_prod,
          schedule_workflow: !!values.schedule_workflow,
          description: values.description ? values.description.trim() : undefined,
          private_key: values.private_key,
          provider: 0,
        });
        feedback.message.success('新建主机成功');
      }
      setModalVisible(false);
      fetchHosts();
      fetchLabels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存主机失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (hostId: string) => {
    if (!projectName) return;
    try {
      await deletePMHost(projectName, hostId);
      feedback.message.success('主机已删除');
      fetchHosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除主机失败';
      feedback.message.error(msg);
    }
  };

  const handleToggleOffline = async (host: PMHost) => {
    if (!projectName) return;
    try {
      if (host.status === 'offline') {
        await recoveryVM(projectName, host.id);
        feedback.message.success(`主机 [${host.name}] 已恢复上线`);
      } else {
        await offlineVM(projectName, host.id);
        feedback.message.success(`主机 [${host.name}] 已离线停用`);
      }
      fetchHosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作主机状态失败';
      feedback.message.error(msg);
    }
  };

  const handleUpgrade = async (host: PMHost) => {
    if (!projectName) return;
    try {
      await upgradeAgent(projectName, host.id);
      feedback.message.success(`主机 [${host.name}] Agent 升级指令已下发`);
      fetchHosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '升级 Agent 失败';
      feedback.message.error(msg);
    }
  };

  const handleOpenAccessCmd = async (host: PMHost) => {
    if (!projectName) return;
    setActiveHostForCmd(host);
    setCmdModalVisible(true);
    setCmdLoading(true);
    try {
      const res = await getAgentAccessCmd(projectName, host.id);
      setAccessCmds(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取 Agent 接入命令失败';
      feedback.message.error(msg);
    } finally {
      setCmdLoading(false);
    }
  };

  const getCmdSnippet = (): string => {
    if (!accessCmds) return '';
    let platformObj = accessCmds.linux_platform;
    if (activeOsTab === 'macos') platformObj = accessCmds.macos_platform;
    if (activeOsTab === 'windows') platformObj = accessCmds.windows_platform;

    if (!platformObj) return '';
    const archObj = activeArch === 'arm64' ? platformObj.arm64 : platformObj.amd64;
    if (!archObj) return '';

    // 取该架构下的命令语句
    return Object.values(archObj).join('\n') || '';
  };

  const handleCopyCmd = () => {
    const snippet = getCmdSnippet();
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    feedback.message.success('接入命令已复制到剪贴板');
  };

  const filteredHosts = hosts.filter((h) => {
    const matchLabel = selectedLabel === 'all' || h.label === selectedLabel;
    return matchLabel;
  });

  const totalCount = hosts.length;
  const normalCount = hosts.filter((h) => h.status === 'normal').length;
  const offlineCount = hosts.filter((h) => h.status === 'offline').length;
  const abnormalCount = hosts.filter((h) => h.status === 'abnormal' || h.status === 'disconnected').length;
  const updateNeededCount = hosts.filter((h) => h.agent?.need_update).length;

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'normal':
        return <Tag color="success" icon={<CheckCircleOutlined />}>正常在线</Tag>;
      case 'abnormal':
        return <Tag color="error" icon={<CloseCircleOutlined />}>异常</Tag>;
      case 'offline':
        return <Tag color="default" icon={<PoweroffOutlined />}>已离线</Tag>;
      case 'disconnected':
        return <Tag color="warning">失去连接</Tag>;
      default:
        return <Tag color="processing">{status || '未知'}</Tag>;
    }
  };

  const columns: ColumnsType<PMHost> = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space vertical size={2}>
          <Space size={8}>
            <HddOutlined style={{ color: '#0066ff' }} />
            <Text strong style={{ fontSize: 14 }}>
              {name}
            </Text>
            {record.is_prod && <Tag color="volcano">生产主机</Tag>}
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
      title: 'IP / 端口',
      key: 'ip',
      render: (_, record) => (
        <Space vertical size={1}>
          <Text code style={{ fontSize: 13 }}>
            {record.ip}:{record.port}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            用户: {record.user_name || 'root'}
          </Text>
        </Space>
      ),
    },
    {
      title: '模式 / 架构',
      key: 'mode',
      render: (_, record) => (
        <Space vertical size={2}>
          {record.schedule_workflow ? (
            <Tag color="cyan">Agent 模式</Tag>
          ) : (
            <Tag color="blue">SSH 秘钥</Tag>
          )}
          {record.vm_info && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.vm_info.platform || 'Linux'} {record.vm_info.architecture || 'amd64'}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      render: (label) => (label ? <Tag color="geekblue">{label}</Tag> : <Text type="secondary">-</Text>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => (
        <Tooltip title={record.error || undefined}>
          <div>{renderStatusTag(status)}</div>
        </Tooltip>
      ),
    },
    {
      title: 'Agent 版本',
      key: 'agent_version',
      width: 140,
      render: (_, record) => {
        if (!record.schedule_workflow) return <Text type="secondary">-</Text>;
        return (
          <Space vertical size={1}>
            <Text style={{ fontSize: 12 }}>{record.agent?.agent_version || '-'}</Text>
            {record.agent?.need_update && (
              <Badge status="processing" text={<Text style={{ fontSize: 11, color: '#fa8c16' }}>有新版本</Text>} />
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          {record.schedule_workflow && (
            <Button
              type="link"
              size="small"
              icon={<CodeOutlined />}
              onClick={() => handleOpenAccessCmd(record)}
            >
              接入命令
            </Button>
          )}
          {record.schedule_workflow && record.agent?.need_update && (
            <Button
              type="link"
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={() => handleUpgrade(record)}
            >
              升级
            </Button>
          )}
          <Popconfirm
            title={`确认${record.status === 'offline' ? '恢复上线' : '下线该主机'}？`}
            onConfirm={() => handleToggleOffline(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small">
              {record.status === 'offline' ? '恢复' : '下线'}
            </Button>
          </Popconfirm>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认彻底删除该主机？"
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
      {/* 顶部指标卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="全部主机"
              value={totalCount}
              prefix={<HddOutlined style={{ color: '#0066ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="正常在线"
              value={normalCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="离线主机"
              value={offlineCount}
              prefix={<PoweroffOutlined style={{ color: '#8c8c8c' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="异常或待升级"
              value={abnormalCount + updateNeededCount}
              prefix={<CloudServerOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 主表格容器 */}
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
          <Space size="middle">
            <Input
              placeholder="搜索主机名称或 IP..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            {labels.length > 0 && (
              <Select
                value={selectedLabel}
                onChange={setSelectedLabel}
                style={{ width: 160 }}
                options={[
                  { label: '全部标签', value: 'all' },
                  ...labels.map((l) => ({ label: l, value: l })),
                ]}
              />
            )}
          </Space>

          <Space size="middle">
            <Button icon={<ReloadOutlined />} onClick={fetchHosts} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建主机
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredHosts}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 台主机` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无主机资源，请点击右上角「新建主机」添加"
              />
            ),
          }}
        />
      </Card>

      {/* 新建 / 编辑主机 Modal */}
      <Modal
        title={editingHost ? '编辑主机配置' : '新建项目主机'}
        open={modalVisible}
        onOk={handleFormSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        destroyOnHidden
        width={580}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="主机名称"
                rules={[{ required: true, message: '请输入主机名称' }]}
              >
                <Input placeholder="例如：host-build-node-01" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="label" label="主机标签">
                <Select
                  placeholder="选择或输入标签"
                  allowClear
                  options={labels.map((l) => ({ label: l, value: l }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="ip"
                label="主机 IP"
                rules={[{ required: true, message: '请输入主机 IP 地址' }]}
              >
                <Input placeholder="例如：192.168.1.100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="port"
                label="SSH 端口"
                rules={[{ required: true, message: '端口必填' }]}
              >
                <Input type="number" placeholder="22" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="user_name"
                label="登录用户名"
                rules={[{ required: true, message: '用户名必填' }]}
              >
                <Input placeholder="root" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_prod" label="生产主机" valuePropName="checked">
                <Switch checkedChildren="生产" unCheckedChildren="测试" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="schedule_workflow"
            label="接入模式"
            valuePropName="checked"
            extra="推荐使用 Agent 模式，具备实时心跳监控、自愈探针与流式任务执行调度"
          >
            <Switch
              checkedChildren="Agent 守护进程模式"
              unCheckedChildren="SSH 秘钥直接调用"
              onChange={(checked) => setIsAgentMode(checked)}
            />
          </Form.Item>

          {!isAgentMode && (
            <Form.Item
              name="private_key"
              label="SSH 私钥"
              rules={[{ required: true, message: 'SSH 模式必须输入私钥' }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              />
            </Form.Item>
          )}

          <Form.Item name="description" label="描述信息">
            <Input.TextArea rows={2} placeholder="用于承载工作流 PM 服务构建部署任务" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看 Agent 接入命令 Modal */}
      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: '#0066ff' }} />
            <span>Agent 接入安装命令：{activeHostForCmd?.name}</span>
          </Space>
        }
        open={cmdModalVisible}
        onCancel={() => setCmdModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopyCmd}>
            复制安装命令
          </Button>,
          <Button key="close" onClick={() => setCmdModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={680}
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph type="secondary" style={{ fontSize: 13 }}>
            登录目标主机，执行以下一键安装命令以启动 Zadig Agent 守护进程：
          </Paragraph>

          <Tabs
            activeKey={activeOsTab}
            onChange={setActiveOsTab}
            items={[
              { key: 'linux', label: 'Linux' },
              { key: 'macos', label: 'macOS' },
              { key: 'windows', label: 'Windows' },
            ]}
          />

          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text type="secondary">CPU 架构：</Text>
            <Select
              size="small"
              value={activeArch}
              onChange={setActiveArch}
              style={{ width: 120 }}
              options={[
                { label: 'AMD64 (x86_64)', value: 'amd64' },
                { label: 'ARM64 (aarch64)', value: 'arm64' },
              ]}
            />
          </div>

          <div
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              padding: 16,
              borderRadius: 6,
              fontFamily: 'Consolas, monospace',
              fontSize: 12,
              overflowX: 'auto',
              maxHeight: 240,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {cmdLoading ? '正在生成接入脚本...' : getCmdSnippet() || '暂无该架构下的安装脚本'}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectHostsPage;
