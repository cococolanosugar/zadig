import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  Tag,
  Space,
  Typography,
  Tooltip,
  Button,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  Tabs,
  Radio,
  Alert,
  Empty,
  App,
  Card,
  Spin,
} from 'antd';
import {
  DesktopOutlined,
  PlusOutlined,
  CodeOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  type VMItem,
  type AgentAccessCmds,
} from '../../../api/settings';

const { Text, Paragraph } = Typography;

const renderVmStatus = (status?: string) => {
  switch (status) {
    case 'normal':
      return <Tag color="success">正常 (Online)</Tag>;
    case 'offline':
      return <Tag color="default">离线 (Offline)</Tag>;
    case 'abnormal':
      return <Tag color="error">异常 (Abnormal)</Tag>;
    default:
      return <Tag color="warning">{status || '未就绪'}</Tag>;
  }
};

export const VMsPage: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined);

  // 接入命令弹窗
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessModalLoading, setAccessModalLoading] = useState(false);
  const [accessVmName, setAccessVmName] = useState('');
  const [accessCmds, setAccessCmds] = useState<AgentAccessCmds | null>(null);
  const [activeOsTab, setActiveOsTab] = useState<'linux' | 'macos' | 'windows'>('linux');
  const [activeArch, setActiveArch] = useState<'amd64' | 'arm64'>('amd64');
  const [activeWinShell, setActiveWinShell] = useState<'powershell' | 'cmd'>('powershell');

  // 添加主机弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  // R16 任务1: 主机凭据连通性测试与批量导入
  const [testingConnection, setTestingConnection] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchJson, setBatchJson] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // 升级命令弹窗
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeVmName, setUpgradeVmName] = useState('');
  const [upgradeCmds, setUpgradeCmds] = useState<Record<string, string>>({});

  // 接入指南弹窗
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // 加载标签列表（R16 任务1: 优先私钥标签注册表，失败回退 VM 标签）
  const fetchLabels = useCallback(async () => {
    try {
      const res = await settingsApi.getPrivateKeyLabels();
      if (res.length > 0) {
        setLabels(res);
        return;
      }
      setLabels([]);
    } catch {
      try {
        const fallback = await settingsApi.getVMLabels();
        setLabels(Array.isArray(fallback) ? fallback : []);
      } catch {
        setLabels([]);
      }
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const copyToClipboard = (text?: string) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        message.success('接入命令已成功复制到剪贴板');
      }).catch(() => {
        message.info('请手动复制命令内容');
      });
    } else {
      message.info('请手动复制命令内容');
    }
  };

  const handleOpenAccessCmd = async (record: VMItem) => {
    if (!record.id) {
      message.warning(`主机 [${record.name}] 尚未关联 ID，请确认后端接入状态`);
      return;
    }
    setAccessVmName(record.name);
    setAccessModalOpen(true);
    setAccessModalLoading(true);
    try {
      const cmds = await settingsApi.getVMAccessCmd(record.id);
      setAccessCmds(cmds);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取主机接入命令失败';
      message.error(msg);
      setAccessModalOpen(false);
    } finally {
      setAccessModalLoading(false);
    }
  };

  const handleOffline = async (record: VMItem) => {
    const targetId = record.id || record.name;
    try {
      await settingsApi.offlineVM(targetId);
      message.success(`主机 [${record.name}] 已成功设为离线状态`);
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '主机离线操作失败';
      message.error(msg);
    }
  };

  const handleRecovery = async (record: VMItem) => {
    const targetId = record.id || record.name;
    try {
      const res = (await settingsApi.recoveryVM(targetId)) as { recovery_cmd?: Record<string, string> };
      if (res && res.recovery_cmd && Object.keys(res.recovery_cmd).length > 0) {
        message.info(`主机 [${record.name}] 恢复指令已生成，请在目标主机执行重新启动 Agent`);
      } else {
        message.success(`主机 [${record.name}] 已下发恢复指令`);
      }
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '恢复主机操作失败';
      message.error(msg);
    }
  };

  const handleUpgrade = async (record: VMItem) => {
    const targetId = record.id || record.name;
    try {
      const res = await settingsApi.upgradeVMAgent(targetId);
      if (res && res.upgrade === false && (!res.upgrade_cmd || Object.keys(res.upgrade_cmd).length === 0)) {
        message.info(`主机 [${record.name}] 的 zadig-agent 已是最新版本！`);
      } else if (res && res.upgrade_cmd && Object.keys(res.upgrade_cmd).length > 0) {
        setUpgradeVmName(record.name);
        setUpgradeCmds(res.upgrade_cmd);
        setUpgradeModalOpen(true);
      } else {
        message.success(`主机 [${record.name}] 升级指令已下发`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '检测升级失败';
      message.error(msg);
    }
  };

  const handleDelete = async (record: VMItem) => {
    const targetId = record.id || record.name;
    try {
      await settingsApi.deleteHost(targetId);
      message.success(`主机 [${record.name}] 已成功移除`);
      actionRef.current?.reload();
      fetchLabels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除主机失败';
      message.error(msg);
    }
  };

  // R16 任务1: 主机凭据连通性测试（校验必填项后调用 /privateKey/validate）
  const handleTestConnection = async () => {
    try {
      const values = await createForm.validateFields();
      setTestingConnection(true);
      await settingsApi.validatePrivateKey({
        name: values.name,
        label: values.label,
        ip: values.ip,
      });
      message.success('主机凭据与 SSH 连通性握手验证成功！');
    } catch (err: any) {
      if (!err?.errorFields) {
        const msg = err?.response?.data?.message || err?.message || '连通性测试失败，请检查主机地址与凭据';
        message.error(msg);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // R16 任务1: 批量导入主机（POST /privateKey/batch，option=skip）
  const handleBatchImport = async () => {
    let items: Array<Record<string, unknown>>;
    try {
      items = JSON.parse(batchJson.trim());
      if (!Array.isArray(items) || items.length === 0) {
        message.warning('导入内容需为非空的 JSON 主机数组');
        return;
      }
    } catch {
      message.error('JSON 解析失败，请检查格式（示例：[{"name":"host-1","label":"ci","ip":"192.168.1.10"}]）');
      return;
    }
    setBatchSubmitting(true);
    try {
      await settingsApi.batchCreatePrivateKeys({
        option: 'skip',
        data: items.map((it) => ({
          name: String(it.name || '').trim(),
          label: String(it.label || '').trim(),
          ip: String(it.ip || '').trim(),
          user_name: String(it.user_name || 'root').trim(),
        })),
      });
      message.success(`批量导入完成，已提交 ${items.length} 台主机（同名主机按 skip 策略跳过）`);
      setBatchModalOpen(false);
      setBatchJson('');
      actionRef.current?.reload();
      fetchLabels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '批量导入失败，请检查 JSON 配置';
      message.error(msg);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleCreateHostSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const res = await settingsApi.createAgentHost({
        name: values.name,
        label: values.label,
        ip: values.ip,
      });
      message.success(`主机 [${values.name}] 添加成功，正在获取接入命令...`);
      setCreateModalOpen(false);
      createForm.resetFields();
      actionRef.current?.reload();
      fetchLabels();

      if (res && res.vm_id) {
        setAccessVmName(values.name);
        setAccessModalOpen(true);
        setAccessModalLoading(true);
        try {
          const cmds = await settingsApi.getVMAccessCmd(res.vm_id);
          setAccessCmds(cmds);
        } catch {
          // ignore
        } finally {
          setAccessModalLoading(false);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '添加主机失败，请检查参数';
      message.error(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // 获取当前选中的接入命令字符串
  const getCurrentAccessCmd = (): string => {
    if (!accessCmds) return '';
    if (activeOsTab === 'linux') {
      return accessCmds.linux_platform?.[activeArch]?.shell || '';
    }
    if (activeOsTab === 'macos') {
      return accessCmds.macos_platform?.[activeArch]?.shell || '';
    }
    if (activeOsTab === 'windows') {
      const win = accessCmds.windows_platform?.amd64;
      return (activeWinShell === 'powershell' ? win?.powershell : win?.cmd) || '';
    }
    return '';
  };

  const columns: ProColumns<VMItem>[] = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space orientation="horizontal">
          <DesktopOutlined style={{ color: '#0066ff' }} />
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      key: 'ip',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: '标签 (Label)',
      dataIndex: 'label',
      key: 'label',
      render: (text) =>
        text ? <Tag color="geekblue">{String(text)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '系统平台 / 架构',
      dataIndex: 'platform',
      key: 'platform',
      render: (_, record) => (
        <Text type="secondary">
          {record.platform || record.architecture
            ? `${record.platform || '-'} / ${record.architecture || '-'}`
            : '-'}
        </Text>
      ),
    },
    {
      title: 'Agent 状态',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) =>
        record.error ? (
          <Tooltip title={record.error}>
            {renderVmStatus(record.status)}
          </Tooltip>
        ) : (
          renderVmStatus(record.status)
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<CodeOutlined />}
            onClick={() => handleOpenAccessCmd(record)}
          >
            接入命令
          </Button>

          {record.status !== 'offline' ? (
            <Popconfirm
              title={`确认将主机 [${record.name}] 设置为离线？`}
              description="离线后该主机将不再接收新的工作流任务调度"
              onConfirm={() => handleOffline(record)}
              okText="确认离线"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<DisconnectOutlined />}>
                离线
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={`确认恢复主机 [${record.name}]？`}
              onConfirm={() => handleRecovery(record)}
              okText="确认恢复"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<ReloadOutlined />}>
                恢复
              </Button>
            </Popconfirm>
          )}

          <Button
            type="link"
            size="small"
            icon={<CloudSyncOutlined />}
            onClick={() => handleUpgrade(record)}
          >
            升级
          </Button>

          <Popconfirm
            title={`确认删除主机 [${record.name}]？`}
            description="删除后将解除其在系统中的所有配置与调度注册"
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
    <div>
      <ProTable<VMItem>
        headerTitle="主机管理 (Virtual Machine Hosts)"
        actionRef={actionRef}
        rowKey="name"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        toolbar={{
          actions: [
            <Space key="filter" size="small">
              <Text type="secondary" style={{ fontSize: 13 }}>标签筛选：</Text>
              <Select
                placeholder="全部主机标签"
                style={{ width: 160 }}
                allowClear
                value={selectedLabel}
                onChange={(val) => {
                  setSelectedLabel(val);
                  actionRef.current?.reload();
                }}
                options={labels.map((l) => ({ label: l, value: l }))}
              />
            </Space>,
            <Button
              key="guide"
              icon={<QuestionCircleOutlined />}
              onClick={() => setGuideModalOpen(true)}
            >
              接入说明
            </Button>,
            <Button
              key="batch-import"
              icon={<PlusOutlined />}
              onClick={() => {
                setBatchJson('');
                setBatchModalOpen(true);
              }}
            >
              批量导入
            </Button>,
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateModalOpen(true);
              }}
            >
              添加主机
            </Button>,
          ],
        }}
        request={async () => {
          const list = await settingsApi.getVMs(selectedLabel);
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space orientation="vertical" size={4}>
                  <Text strong>暂无已接入的主机资源</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    点击右上角「添加主机」登记主机并获取一键安装命令，在目标 Linux、macOS 或 Windows 主机上执行即可完成接入。
                  </Text>
                </Space>
              }
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  setCreateModalOpen(true);
                }}
              >
                立即添加主机
              </Button>
            </Empty>
          ),
        }}
      />

      {/* 添加主机 Modal */}
      <Modal
        title="添加主机资源 (Add VM Host)"
        open={createModalOpen}
        onOk={handleCreateHostSubmit}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createSubmitting}
        destroyOnHidden
        width={560}
        okText="添加并获取命令"
        cancelText="取消"
        footer={[
          <Button key="cancel" onClick={() => setCreateModalOpen(false)}>
            取消
          </Button>,
          <Button key="test-conn" loading={testingConnection} onClick={handleTestConnection}>
            测试连接
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createSubmitting}
            onClick={handleCreateHostSubmit}
          >
            添加并获取命令
          </Button>,
        ]}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="主机名称 (Host Name)"
            rules={[
              { required: true, message: '请输入主机名称' },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                message: '首字符必须为英文字母，仅支持字母、数字与下划线(_)',
              },
            ]}
            extra="用于在工作流主机部署中唯一标识此主机"
          >
            <Input placeholder="例如：build_node_01" maxLength={32} />
          </Form.Item>

          <Form.Item
            name="label"
            label="主机标签 (Label)"
            extra="为便于在工作流调度中批量选择同类型主机，可设置标签（如 ci-worker、gpu-runner 等）"
          >
            <Input placeholder="例如：ci-worker" maxLength={32} />
          </Form.Item>

          <Form.Item
            name="ip"
            label="IP 地址 (可选)"
            rules={[
              {
                pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
                message: '请输入合法的 IPv4 地址格式',
              },
            ]}
            extra="登记该主机的内网或公网 IP，便于网络定位与排障"
          >
            <Input placeholder="例如：192.168.1.100" />
          </Form.Item>
        </Form>
      </Modal>

      {/* R16 任务1: 批量导入主机 Modal */}
      <Modal
        title="批量导入主机 (Batch Import)"
        open={batchModalOpen}
        onOk={handleBatchImport}
        onCancel={() => setBatchModalOpen(false)}
        confirmLoading={batchSubmitting}
        destroyOnHidden
        width={640}
        okText="确认导入"
        cancelText="取消"
      >
        <Alert
          type="info"
          showIcon
          title="JSON 数组格式，字段：name（必填）、label、ip、user_name（默认 root）"
          style={{ margin: '16px 0 12px', borderRadius: 6 }}
        />
        <Input.TextArea
          rows={12}
          value={batchJson}
          onChange={(e) => setBatchJson(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          placeholder={`[
  { "name": "build_node_02", "label": "ci-worker", "ip": "192.168.1.101", "user_name": "root" },
  { "name": "build_node_03", "label": "ci-worker", "ip": "192.168.1.102", "user_name": "root" }
]`}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          导入策略为 skip：同名主机将被跳过，不会覆盖已有配置。
        </Text>
      </Modal>

      {/* 接入命令展示 Modal */}
      <Modal
        title={`主机接入命令: ${accessVmName}`}
        open={accessModalOpen}
        onCancel={() => setAccessModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAccessModalOpen(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(getCurrentAccessCmd())}
            disabled={!getCurrentAccessCmd()}
          >
            一键复制命令
          </Button>,
        ]}
        destroyOnHidden
        width={760}
      >
        {accessModalLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <Alert
              type="info"
              showIcon
              title="请复制下方命令，在目标机器终端中以管理员 (root / Administrator) 身份执行。命令将自动下载并启动 zadig-agent，完成与本平台的双向心跳注册。"
            />

            <Tabs
              activeKey={activeOsTab}
              onChange={(k) => setActiveOsTab(k as 'linux' | 'macos' | 'windows')}
              items={[
                {
                  key: 'linux',
                  label: 'Linux',
                  children: (
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      <Space>
                        <Text strong>系统架构：</Text>
                        <Radio.Group
                          value={activeArch}
                          onChange={(e) => setActiveArch(e.target.value)}
                        >
                          <Radio.Button value="amd64">x86_64 (amd64)</Radio.Button>
                          <Radio.Button value="arm64">ARM64 (aarch64)</Radio.Button>
                        </Radio.Group>
                      </Space>
                      <Paragraph
                        code
                        copyable
                        style={{
                          background: '#1e1e1e',
                          color: '#52c41a',
                          padding: 16,
                          borderRadius: 6,
                          maxHeight: 220,
                          overflowY: 'auto',
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {accessCmds?.linux_platform?.[activeArch]?.shell || '未生成接入命令'}
                      </Paragraph>
                    </Space>
                  ),
                },
                {
                  key: 'macos',
                  label: 'macOS (Darwin)',
                  children: (
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      <Space>
                        <Text strong>芯片架构：</Text>
                        <Radio.Group
                          value={activeArch}
                          onChange={(e) => setActiveArch(e.target.value)}
                        >
                          <Radio.Button value="arm64">Apple Silicon (M系列/arm64)</Radio.Button>
                          <Radio.Button value="amd64">Intel (x86_64)</Radio.Button>
                        </Radio.Group>
                      </Space>
                      <Paragraph
                        code
                        copyable
                        style={{
                          background: '#1e1e1e',
                          color: '#52c41a',
                          padding: 16,
                          borderRadius: 6,
                          maxHeight: 220,
                          overflowY: 'auto',
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {accessCmds?.macos_platform?.[activeArch]?.shell || '未生成接入命令'}
                      </Paragraph>
                    </Space>
                  ),
                },
                {
                  key: 'windows',
                  label: 'Windows',
                  children: (
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      <Space>
                        <Text strong>执行终端：</Text>
                        <Radio.Group
                          value={activeWinShell}
                          onChange={(e) => setActiveWinShell(e.target.value)}
                        >
                          <Radio.Button value="powershell">PowerShell (推荐)</Radio.Button>
                          <Radio.Button value="cmd">CMD 命令提示符</Radio.Button>
                        </Radio.Group>
                      </Space>
                      <Paragraph
                        code
                        copyable
                        style={{
                          background: '#1e1e1e',
                          color: '#52c41a',
                          padding: 16,
                          borderRadius: 6,
                          maxHeight: 220,
                          overflowY: 'auto',
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {(activeWinShell === 'powershell'
                          ? accessCmds?.windows_platform?.amd64?.powershell
                          : accessCmds?.windows_platform?.amd64?.cmd) || '未生成接入命令'}
                      </Paragraph>
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 升级 Agent 弹窗 */}
      <Modal
        title={`升级 zadig-agent: ${upgradeVmName}`}
        open={upgradeModalOpen}
        onCancel={() => setUpgradeModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setUpgradeModalOpen(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => {
              const cmd = Object.values(upgradeCmds)[0];
              copyToClipboard(cmd);
            }}
          >
            复制升级命令
          </Button>,
        ]}
        destroyOnHidden
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Alert
            type="warning"
            showIcon
            title="检测到该主机上的 zadig-agent 有可用的新版本更新，请在目标主机执行以下命令完成升级："
          />
          {Object.entries(upgradeCmds).map(([shellType, cmdStr]) => (
            <Space orientation="vertical" key={shellType} style={{ width: '100%' }}>
              <Text strong>{shellType} 升级命令：</Text>
              <Paragraph
                code
                copyable
                style={{
                  background: '#1e1e1e',
                  color: '#faad14',
                  padding: 16,
                  borderRadius: 6,
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontSize: 12,
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {cmdStr}
              </Paragraph>
            </Space>
          ))}
        </div>
      </Modal>

      {/* 接入说明 Modal */}
      <Modal
        title="主机资源接入指南 (Host Agent Guide)"
        open={guideModalOpen}
        onCancel={() => setGuideModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setGuideModalOpen(false)}>
            我知道了
          </Button>,
        ]}
        destroyOnHidden
        width={680}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Card size="small" variant="borderless" style={{ background: '#f8fafc', borderRadius: 6 }}>
            <Space orientation="vertical" size={12}>
              <Text strong style={{ fontSize: 15 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> 什么是 zadig-agent？
              </Text>
              <Text type="secondary" style={{ lineHeight: 1.6 }}>
                zadig-agent 是运行在宿主机上的轻量级执行器程序，负责与 Zadig 后端建立安全的双向长连接，并在主机上执行工作流构建、测试、脚本扫描或主机服务部署等作业任务。
              </Text>
            </Space>
          </Card>

          <Card size="small" variant="borderless" style={{ background: '#f8fafc', borderRadius: 6 }}>
            <Space orientation="vertical" size={12}>
              <Text strong style={{ fontSize: 15 }}>
                <DesktopOutlined style={{ color: '#0066ff' }} /> 接入三步流程：
              </Text>
              <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                <li>
                  <Text strong>登记主机</Text>：点击页面右上角「添加主机」，输入主机名称、标签以及可选 IP。
                </li>
                <li>
                  <Text strong>获取命令</Text>：系统将自动生成包含接入令牌（Token）和服务器寻址的一键安装 Shell/PowerShell 命令。
                </li>
                <li>
                  <Text strong>宿主机运行</Text>：在目标 Linux、macOS 或 Windows 主机上以管理员身份执行该命令，zadig-agent 将自动完成守护进程常驻并上报心跳。
                </li>
              </ol>
            </Space>
          </Card>
        </div>
      </Modal>
    </div>
  );
};

export default VMsPage;
