import React, { useMemo, useRef, useState } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Radio,
  InputNumber,
  Alert,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CodeOutlined,
  GithubOutlined,
  GitlabOutlined,
  EditOutlined,
  CopyOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  settingsApi,
  getCodeHostAuthUrl,
  type CodeHostItem,
  type CodeHostType,
} from '../../../api/settings';

const { Text, Paragraph } = Typography;

const OAUTH_TYPES: CodeHostType[] = ['github', 'gitlab', 'gitee', 'gitee-enterprise'];

const PLATFORM_OPTIONS: Array<{ label: string; value: CodeHostType }> = [
  { label: 'GitLab', value: 'gitlab' },
  { label: 'GitHub', value: 'github' },
  { label: 'Gerrit', value: 'gerrit' },
  { label: 'Gitee', value: 'gitee' },
  { label: 'Gitee 企业版', value: 'gitee-enterprise' },
  { label: 'Perforce', value: 'perforce' },
  { label: '其他 (Other)', value: 'other' },
];

function resolveAddress(type: CodeHostType, values: Record<string, unknown>): string {
  if (type === 'github') return 'https://github.com';
  if (type === 'gitee') return 'https://gitee.com';
  if (type === 'perforce') {
    const host = String(values.perforce_host || '');
    const port = values.perforce_port ? String(values.perforce_port) : '';
    return port ? `${host}:${port}` : host;
  }
  return String(values.address || '');
}

function buildPayload(
  type: CodeHostType,
  values: Record<string, unknown>
): Partial<CodeHostItem> {
  const base: Partial<CodeHostItem> = {
    type,
    alias: (values.alias as string) || undefined,
    address: resolveAddress(type, values),
    enable_proxy: Boolean(values.enable_proxy),
  };

  switch (type) {
    case 'github':
    case 'gitee':
      return {
        ...base,
        application_id: values.application_id as string,
        client_secret: values.client_secret as string,
      };
    case 'gitlab':
    case 'gitee-enterprise':
      return {
        ...base,
        application_id: values.application_id as string,
        client_secret: values.client_secret as string,
        disable_ssl: values.enable_ssl === undefined ? false : !Boolean(values.enable_ssl),
      };
    case 'gerrit':
      return {
        ...base,
        username: values.username as string,
        password: values.password as string,
      };
    case 'perforce':
      return {
        ...base,
        perforce_host: values.perforce_host as string,
        perforce_port: Number(values.perforce_port),
        username: values.username as string,
        password: values.password as string,
      };
    case 'other':
      return {
        ...base,
        auth_type: values.auth_type as string,
        ssh_key: values.auth_type === 'SSH' ? (values.ssh_key as string) : undefined,
        private_access_token:
          values.auth_type === 'PrivateAccessToken'
            ? (values.private_access_token as string)
            : undefined,
      };
    default:
      return base;
  }
}

export const CodeHostsPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CodeHostItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedType = (Form.useWatch('type', form) || 'gitlab') as CodeHostType;
  const otherAuthType = Form.useWatch('auth_type', form) || 'SSH';

  const callbackUrl = useMemo(
    () => `${window.location.origin}/api/directory/codehosts/callback`,
    []
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'gitlab',
      enable_ssl: true,
      enable_proxy: false,
      auth_type: 'SSH',
      perforce_port: 1666,
    });
    setModalOpen(true);
  };

  const openEdit = (record: CodeHostItem) => {
    setEditing(record);
    form.setFieldsValue({
      type: record.type,
      alias: record.alias,
      address: record.address,
      application_id: record.application_id,
      client_secret: record.client_secret,
      username: record.username,
      password: record.password,
      perforce_host: record.perforce_host,
      perforce_port: record.perforce_port || 1666,
      auth_type: record.auth_type || 'SSH',
      ssh_key: record.ssh_key,
      private_access_token: record.private_access_token,
      enable_ssl: !record.disable_ssl,
      enable_proxy: Boolean(record.enable_proxy),
    });
    setModalOpen(true);
  };

  const promptOAuth = (id: number, type: string) => {
    if (!OAUTH_TYPES.includes(type as CodeHostType)) return;
    modal.confirm({
      title: '前往 OAuth 授权',
      content: '代码源已保存。是否立即跳转到平台完成 OAuth 授权？',
      okText: '立即授权',
      cancelText: '稍后',
      onOk: () => {
        window.location.href = getCodeHostAuthUrl(id);
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const type = values.type as CodeHostType;
      const payload = buildPayload(type, values);
      setSubmitting(true);
      if (editing) {
        await settingsApi.updateCodeHost(editing.id, { ...editing, ...payload });
        message.success('代码源配置已更新');
        setModalOpen(false);
        actionRef.current?.reload();
        if (editing.is_ready !== '2' && OAUTH_TYPES.includes(type)) {
          promptOAuth(editing.id, type);
        }
      } else {
        const res = await settingsApi.createCodeHost(payload);
        message.success('代码源集成成功');
        setModalOpen(false);
        actionRef.current?.reload();
        if (res?.id) {
          promptOAuth(res.id, type);
        }
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '保存代码源失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await settingsApi.deleteCodeHost(id);
      message.success('代码源配置已删除');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '删除代码源配置失败（可能仍被项目引用）';
      message.error(msg);
    }
  };

  const handleToggleProxy = async (record: CodeHostItem, val: boolean) => {
    try {
      await settingsApi.updateCodeHost(record.id, { ...record, enable_proxy: val });
      message.success(val ? '已开启代理' : '已关闭代理');
      actionRef.current?.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新代理开关失败';
      message.error(msg);
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'github':
        return (
          <Tag icon={<GithubOutlined />} color="default">
            GitHub
          </Tag>
        );
      case 'gitlab':
        return (
          <Tag icon={<GitlabOutlined />} color="orange">
            GitLab
          </Tag>
        );
      case 'gitee':
      case 'gitee-enterprise':
        return <Tag color="red">{type === 'gitee' ? 'Gitee' : 'Gitee EE'}</Tag>;
      case 'gerrit':
        return <Tag color="blue">Gerrit</Tag>;
      case 'perforce':
        return <Tag color="purple">Perforce</Tag>;
      default:
        return <Tag color="cyan">{type || 'Other'}</Tag>;
    }
  };

  const columns: ProColumns<CodeHostItem>[] = [
    {
      title: '代码源平台',
      dataIndex: 'type',
      key: 'type',
      render: (_, record) => (
        <Space orientation="horizontal">
          <CodeOutlined style={{ color: '#0066ff' }} />
          {renderTypeIcon(record.type)}
          {record.alias && <Text strong>({record.alias})</Text>}
        </Space>
      ),
    },
    {
      title: '服务地址',
      dataIndex: 'address',
      key: 'address',
      render: (text) => <Text code>{String(text || '-')}</Text>,
    },
    {
      title: '授权状态',
      dataIndex: 'is_ready',
      key: 'is_ready',
      width: 220,
      render: (_, record) => {
        const ready = record.is_ready === '2';
        const needOAuth = OAUTH_TYPES.includes(record.type as CodeHostType);
        return (
          <Space orientation="horizontal" size={8}>
            {ready ? (
              <Tag color="success">授权成功</Tag>
            ) : (
              <Tag color="warning">未授权/需重新授权</Tag>
            )}
            {needOAuth && !ready && (
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  window.location.href = getCodeHostAuthUrl(record.id);
                }}
              >
                前往授权
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: '开启代理',
      dataIndex: 'enable_proxy',
      key: 'enable_proxy',
      width: 120,
      render: (_, record) => (
        <Switch
          checked={Boolean(record.enable_proxy)}
          onChange={(val) => handleToggleProxy(record, val)}
        />
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          icon={<EditOutlined />}
          onClick={() => openEdit(record)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确定移除此代码源？"
          description="已有工作流若依赖该代码源可能无法拉取仓库代码。"
          onConfirm={() => handleDelete(record.id)}
          okText="移除"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <div>
      <ProTable<CodeHostItem>
        headerTitle="代码源托管集成 (Code Hosts)"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await settingsApi.getCodeHosts();
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            添加代码源
          </Button>,
        ]}
      />

      <Modal
        title={editing ? '编辑代码源集成' : '添加代码源集成'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnHidden
        width={640}
        okText="保存"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="OAuth 回调地址"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                申请应用时请配置回调地址：
                <Text code copyable={{ text: callbackUrl, tooltips: ['复制', '已复制'] }}>
                  {callbackUrl}
                </Text>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(callbackUrl);
                      message.success('回调地址已复制');
                    } catch {
                      message.error('复制失败');
                    }
                  }}
                >
                  复制
                </Button>
              </Paragraph>
              <Text type="secondary">
                建议申请权限：api、read_user、read_repository
              </Text>
            </div>
          }
        />

        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label="代码托管类型"
            rules={[{ required: true, message: '请选择平台类型' }]}
          >
            <Select options={PLATFORM_OPTIONS} disabled={Boolean(editing)} />
          </Form.Item>

          <Form.Item name="alias" label="集成标识别名">
            <Input placeholder="例如：公司私有 GitLab" />
          </Form.Item>

          {(selectedType === 'github' || selectedType === 'gitee') && (
            <Form.Item label="服务站点地址">
              <Input
                value={selectedType === 'github' ? 'https://github.com' : 'https://gitee.com'}
                disabled
              />
            </Form.Item>
          )}

          {(selectedType === 'gitlab' ||
            selectedType === 'gitee-enterprise' ||
            selectedType === 'gerrit' ||
            selectedType === 'other') && (
            <Form.Item
              name="address"
              label="服务站点地址"
              rules={[{ required: true, message: '请输入服务站点地址' }]}
            >
              <Input placeholder="例如：https://gitlab.example.com" />
            </Form.Item>
          )}

          {OAUTH_TYPES.includes(selectedType) && (
            <>
              <Form.Item
                name="application_id"
                label="Client ID / Application ID"
                rules={[{ required: true, message: '请输入 Application ID' }]}
              >
                <Input placeholder="OAuth Application ID" />
              </Form.Item>
              <Form.Item
                name="client_secret"
                label="Client Secret"
                rules={[{ required: !editing, message: '请输入 Client Secret' }]}
              >
                <Input.Password placeholder="OAuth Client Secret" />
              </Form.Item>
            </>
          )}

          {(selectedType === 'gitlab' || selectedType === 'gitee-enterprise') && (
            <Form.Item
              name="enable_ssl"
              label="开启 SSL 校验"
              valuePropName="checked"
              extra="关闭后对应后端 disable_ssl=true"
            >
              <Switch />
            </Form.Item>
          )}

          {(selectedType === 'gerrit' || selectedType === 'perforce') && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: !editing, message: '请输入密码' }]}
              >
                <Input.Password />
              </Form.Item>
            </>
          )}

          {selectedType === 'perforce' && (
            <>
              <Form.Item
                name="perforce_host"
                label="Perforce Host"
                rules={[{ required: true, message: '请输入 Host' }]}
              >
                <Input placeholder="例如：p4.example.com" />
              </Form.Item>
              <Form.Item
                name="perforce_port"
                label="Perforce Port"
                rules={[
                  { required: true, message: '请输入 Port' },
                  {
                    type: 'number',
                    min: 1,
                    max: 65535,
                    message: '端口范围 1-65535',
                  },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
            </>
          )}

          {selectedType === 'other' && (
            <>
              <Form.Item
                name="auth_type"
                label="授权类型"
                rules={[{ required: true, message: '请选择授权类型' }]}
              >
                <Radio.Group
                  options={[
                    { label: 'SSH', value: 'SSH' },
                    { label: 'Private Access Token', value: 'PrivateAccessToken' },
                  ]}
                />
              </Form.Item>
              {otherAuthType === 'SSH' ? (
                <Form.Item
                  name="ssh_key"
                  label="SSH Private Key"
                  rules={[{ required: true, message: '请输入 SSH Key' }]}
                >
                  <Input.TextArea rows={5} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
                </Form.Item>
              ) : (
                <Form.Item
                  name="private_access_token"
                  label="Private Access Token"
                  rules={[{ required: true, message: '请输入 Token' }]}
                >
                  <Input.Password />
                </Form.Item>
              )}
            </>
          )}

          <Divider />
          <Form.Item name="enable_proxy" label="开启代理" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CodeHostsPage;
