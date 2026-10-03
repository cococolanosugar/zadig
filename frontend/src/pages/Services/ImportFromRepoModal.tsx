import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Switch,
  Button,
  Table,
  Space,
  Typography,
  Alert,
  Tag,
  App,
} from 'antd';
import {
  CloudSyncOutlined,
  SearchOutlined,
  FolderOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { serviceApi, LoadServicePath } from '../../api/service';
import { settingsApi, CodeHostItem } from '../../api/settings';

const { Text } = Typography;

export interface SyncServiceInfo {
  service_name: string;
  codehost_id?: number;
  repo_name?: string;
  repo_owner?: string;
  repo_namespace?: string;
  branch_name?: string;
  load_path?: string;
  is_dir?: boolean;
}

interface ImportFromRepoModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  isProduction?: boolean;
  syncService?: SyncServiceInfo | null;
  onSuccess: (serviceNames: string[]) => void;
}

export const ImportFromRepoModal: React.FC<ImportFromRepoModalProps> = ({
  open,
  onClose,
  projectName,
  isProduction = false,
  syncService = null,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const isSyncMode = Boolean(syncService);

  const [codeHosts, setCodeHosts] = useState<CodeHostItem[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);

  const [namespaces, setNamespaces] = useState<Array<{ name: string; path: string; kind?: string }>>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  const [repos, setRepos] = useState<Array<{ name: string; namespace?: string }>>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [branches, setBranches] = useState<Array<{ name: string }>>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // 预加载得到的服务列表
  const [preloadedServices, setPreloadedServices] = useState<LoadServicePath[]>([]);
  const [preloading, setPreloading] = useState(false);
  const [selectedServiceKeys, setSelectedServiceKeys] = useState<React.Key[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // 初始化加载所有代码源
  const loadCodeHosts = useCallback(async () => {
    setLoadingHosts(true);
    try {
      const list = await settingsApi.getCodeHosts();
      setCodeHosts(list);
    } catch {
      setCodeHosts([]);
    } finally {
      setLoadingHosts(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCodeHosts();
      if (syncService) {
        form.setFieldsValue({
          codehostId: syncService.codehost_id,
          repoOwner: syncService.repo_owner || syncService.repo_namespace,
          repoName: syncService.repo_name,
          branchName: syncService.branch_name,
          path: syncService.load_path,
          isDir: Boolean(syncService.is_dir),
        });
      } else {
        form.resetFields();
        setPreloadedServices([]);
        setSelectedServiceKeys([]);
      }
    }
  }, [open, syncService, loadCodeHosts, form]);

  // 当选择代码源时，加载 Org/Namespaces
  const handleCodeHostChange = async (hostId: number) => {
    form.setFieldsValue({ repoOwner: undefined, repoName: undefined, branchName: undefined });
    setNamespaces([]);
    setRepos([]);
    setBranches([]);
    setPreloadedServices([]);
    setSelectedServiceKeys([]);

    if (!hostId) return;
    setLoadingNamespaces(true);
    try {
      const res = await serviceApi.getCodehostNamespaces(hostId);
      setNamespaces(res);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  // 当选择 Org/Namespace 时，加载仓库
  const handleOwnerChange = async (owner: string) => {
    form.setFieldsValue({ repoName: undefined, branchName: undefined });
    setRepos([]);
    setBranches([]);
    setPreloadedServices([]);
    setSelectedServiceKeys([]);

    const hostId = form.getFieldValue('codehostId');
    if (!hostId || !owner) return;
    const host = codeHosts.find((h) => h.id === hostId);
    setLoadingRepos(true);
    try {
      const res = await serviceApi.getCodehostRepos(hostId, owner, host?.type || 'gitlab');
      setRepos(res);
    } finally {
      setLoadingRepos(false);
    }
  };

  // 当选择仓库时，加载分支
  const handleRepoChange = async (repoName: string) => {
    form.setFieldsValue({ branchName: undefined });
    setBranches([]);
    setPreloadedServices([]);
    setSelectedServiceKeys([]);

    const hostId = form.getFieldValue('codehostId');
    const owner = form.getFieldValue('repoOwner');
    if (!hostId || !owner || !repoName) return;
    setLoadingBranches(true);
    try {
      const res = await serviceApi.getCodehostBranches(hostId, owner, repoName);
      setBranches(res);
    } finally {
      setLoadingBranches(false);
    }
  };

  // 预加载服务
  const handlePreload = async () => {
    try {
      const values = await form.validateFields(['codehostId', 'repoOwner', 'repoName', 'branchName', 'path']);
      setPreloading(true);
      setPreloadedServices([]);
      setSelectedServiceKeys([]);

      const paths: Array<{ path: string; is_dir: boolean }> = [
        {
          path: values.path.trim(),
          is_dir: Boolean(form.getFieldValue('isDir')),
        },
      ];

      const res = await serviceApi.preloadServiceTemplate(values.codehostId, {
        repo_name: values.repoName,
        branch_name: values.branchName,
        repo_owner: values.repoOwner,
        paths,
      });

      setPreloadedServices(res);
      if (res.length === 0) {
        message.warning('指定路径下未发现合法的 Kubernetes 服务配置');
      } else {
        message.success(`成功识别到 ${res.length} 个服务组件`);
        // 默认全选或如果是 sync 模式，匹配目标服务
        if (isSyncMode && syncService) {
          const matched = res.find((s) => s.service_name === syncService.service_name);
          if (matched) {
            setSelectedServiceKeys([matched.service_name]);
          } else {
            message.warning(`识别到的服务中未发现名为 "${syncService.service_name}" 的组件，请确认路径`);
          }
        } else {
          setSelectedServiceKeys(res.map((s) => s.service_name));
        }
      }
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.message || (err as Error)?.message || '预加载失败，请检查配置和代码库权限';
      message.error(errMsg);
    } finally {
      setPreloading(false);
    }
  };

  // 提交导入或同步
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (preloadedServices.length === 0) {
        message.warning('请先点击「预加载服务」识别服务清单');
        return;
      }
      if (selectedServiceKeys.length === 0) {
        message.warning('请至少勾选一个需要导入或同步的服务组件');
        return;
      }

      setSubmitting(true);
      const chosenServices = preloadedServices.filter((s) => selectedServiceKeys.includes(s.service_name));

      if (isSyncMode) {
        // 同步接口要求单个服务: len(service_paths) == 1
        const target = chosenServices[0];
        await serviceApi.syncServiceFromRepo(
          values.codehostId,
          {
            projectName,
            repoName: values.repoName,
            branchName: values.branchName,
            repoOwner: values.repoOwner,
            production: isProduction,
          },
          {
            type: 'k8s',
            product_name: projectName,
            service_paths: [target],
          }
        );
        message.success(`服务 [${target.service_name}] 从代码库同步成功！`);
        onSuccess([target.service_name]);
      } else {
        // 创建接口: load
        await serviceApi.loadServiceFromRepo(
          values.codehostId,
          {
            projectName,
            repoName: values.repoName,
            branchName: values.branchName,
            repoOwner: values.repoOwner,
            production: isProduction,
          },
          {
            type: 'k8s',
            product_name: projectName,
            service_paths: chosenServices,
          }
        );
        message.success(`成功从代码库导入 ${chosenServices.length} 个服务组件！`);
        onSuccess(chosenServices.map((s) => s.service_name));
      }

      onClose();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || (err as Error)?.message || '操作失败，请重试';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const serviceColumns = [
    {
      title: '服务组件名称',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '相对路径',
      dataIndex: 'path',
      key: 'path',
      render: (p: string) => <Text code>{p}</Text>,
    },
    {
      title: '加载模式',
      dataIndex: 'is_dir',
      key: 'is_dir',
      render: (isDir: boolean) =>
        isDir ? (
          <Tag color="blue" icon={<FolderOutlined />}>目录</Tag>
        ) : (
          <Tag color="cyan" icon={<FileTextOutlined />}>单个文件</Tag>
        ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <CloudSyncOutlined style={{ color: '#1677ff' }} />
          <span>{isSyncMode ? `从代码库同步服务 (${syncService?.service_name})` : '从代码库导入服务'}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={isSyncMode ? '同步更新' : '确认导入'}
      cancelText="取消"
      width={720}
      destroyOnHidden
    >
      <Alert
        title={
          isSyncMode
            ? '从绑定的代码库重新拉取 Manifest 文件并更新服务配置。'
            : '支持通过 Git 代码仓库批量识别并加载 Kubernetes YAML 配置文件或目录。'
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="codehostId"
          label="代码源"
          rules={[{ required: true, message: '请选择代码源' }]}
        >
          <Select
            placeholder="请选择代码托管平台"
            loading={loadingHosts}
            onChange={handleCodeHostChange}
            options={codeHosts.map((h) => ({
              value: h.id,
              label: `${h.address} (${h.alias || h.type})`,
            }))}
          />
        </Form.Item>

        <Space orientation="horizontal" style={{ display: 'flex' }} styles={{ item: { flex: 1 } }}>
          <Form.Item
            name="repoOwner"
            label="组织/用户名"
            rules={[{ required: true, message: '请选择或输入组织或用户名' }]}
            style={{ marginBottom: 16 }}
          >
            <Select
              placeholder="请选择组织或用户名"
              loading={loadingNamespaces}
              showSearch
              allowClear
              onChange={handleOwnerChange}
              options={namespaces.map((n) => ({
                value: n.path,
                label: n.name || n.path,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="repoName"
            label="代码仓库"
            rules={[{ required: true, message: '请选择或输入代码仓库' }]}
            style={{ marginBottom: 16 }}
          >
            <Select
              placeholder="请选择代码仓库"
              loading={loadingRepos}
              showSearch
              allowClear
              onChange={handleRepoChange}
              options={repos.map((r) => ({
                value: r.name,
                label: r.name,
              }))}
            />
          </Form.Item>
        </Space>

        <Space orientation="horizontal" style={{ display: 'flex' }} styles={{ item: { flex: 1 } }}>
          <Form.Item
            name="branchName"
            label="分支名称"
            rules={[{ required: true, message: '请选择或输入分支' }]}
            style={{ marginBottom: 16 }}
          >
            <Select
              placeholder="请选择分支"
              loading={loadingBranches}
              showSearch
              allowClear
              options={branches.map((b) => ({
                value: b.name,
                label: b.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="isDir"
            label="目录加载模式"
            valuePropName="checked"
            initialValue={false}
            style={{ marginBottom: 16 }}
          >
            <Switch checkedChildren="目录" unCheckedChildren="单文件" />
          </Form.Item>
        </Space>

        <Form.Item
          name="path"
          label="配置文件或目录路径"
          rules={[{ required: true, message: '请输入文件或目录在仓库中的相对路径' }]}
          extra="例如: manifests/frontend.yaml 或 deploy/services/（目录模式下将自动识别其内所有服务清单）"
        >
          <Input placeholder="例如: deploy/k8s/my-service.yaml 或 k8s/" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            type="dashed"
            icon={<SearchOutlined />}
            loading={preloading}
            onClick={handlePreload}
            block
          >
            预加载服务配置 (解析 YAML)
          </Button>
        </Form.Item>
      </Form>

      {/* 预加载识别结果 */}
      {preloadedServices.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            识别到的服务列表 (已选 {selectedServiceKeys.length} / {preloadedServices.length}):
          </Text>
          <Table
            dataSource={preloadedServices}
            rowKey="service_name"
            columns={serviceColumns}
            size="small"
            pagination={false}
            rowSelection={{
              type: isSyncMode ? 'radio' : 'checkbox',
              selectedRowKeys: selectedServiceKeys,
              onChange: (keys) => setSelectedServiceKeys(keys),
            }}
          />
        </div>
      )}
    </Modal>
  );
};

export default ImportFromRepoModal;
