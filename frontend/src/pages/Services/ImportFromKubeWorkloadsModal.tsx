import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  Checkbox,
  Tag,
  Divider,
  App,
  Tabs,
  Empty,
} from 'antd';
import {
  ClusterOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { serviceApi } from '../../api/service';
import settingsApi, { ClusterItem } from '../../api/settings';
import { environmentApi, AvailableNamespace } from '../../api/environment';

const { Text } = Typography;

interface ImportFromKubeWorkloadsModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  isProduction?: boolean;
  onSuccess: (serviceName: string) => void;
}

const WORKLOAD_LABELS: Record<string, string> = {
  deployment: 'Deployment (无状态副本)',
  statefulset: 'StatefulSet (有状态服务)',
  daemonset: 'DaemonSet (守护进程)',
  service: 'Service (网络服务)',
  configmap: 'ConfigMap (配置字典)',
  ingress: 'Ingress (路由规则)',
  secret: 'Secret (加密密文)',
  pvc: 'PVC (持久卷声明)',
};

export const ImportFromKubeWorkloadsModal: React.FC<ImportFromKubeWorkloadsModalProps> = ({
  open,
  onClose,
  projectName,
  isProduction = false,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(false);

  const [namespaces, setNamespaces] = useState<AvailableNamespace[]>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');

  const [workloadsMap, setWorkloadsMap] = useState<Record<string, string[]>>({});
  const [loadingWorkloads, setLoadingWorkloads] = useState(false);

  // 用户已勾选的工作负载映射 { deployment: ['app-a'], service: ['app-a-svc'] }
  const [selectedWorkloads, setSelectedWorkloads] = useState<Record<string, string[]>>({});

  const [submitting, setSubmitting] = useState(false);

  // 1. 打开时拉取集群列表
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setClusters([]);
      setNamespaces([]);
      setSelectedClusterId('');
      setSelectedNamespace('');
      setWorkloadsMap({});
      setSelectedWorkloads({});
      return;
    }

    const fetchClusters = async () => {
      setLoadingClusters(true);
      try {
        const list = await settingsApi.getClusters();
        setClusters(list);
        if (list.length > 0) {
          const firstId = list[0].id;
          form.setFieldValue('cluster_id', firstId);
          setSelectedClusterId(firstId);
        }
      } catch {
        message.error('获取集群列表失败');
      } finally {
        setLoadingClusters(false);
      }
    };

    fetchClusters();
  }, [open, form, message]);

  // 2. 集群变化时拉取 Namespace
  const fetchNamespaces = useCallback(async (cId: string) => {
    if (!cId) {
      setNamespaces([]);
      return;
    }
    setLoadingNamespaces(true);
    try {
      const nsList = await environmentApi.getAvailableNamespaces(cId);
      setNamespaces(nsList);
      if (nsList.length > 0) {
        const firstNs = nsList[0].name;
        form.setFieldValue('namespace', firstNs);
        setSelectedNamespace(firstNs);
      } else {
        form.setFieldValue('namespace', undefined);
        setSelectedNamespace('');
        setWorkloadsMap({});
        setSelectedWorkloads({});
      }
    } catch {
      setNamespaces([]);
    } finally {
      setLoadingNamespaces(false);
    }
  }, [form]);

  useEffect(() => {
    if (selectedClusterId) {
      fetchNamespaces(selectedClusterId);
    }
  }, [selectedClusterId, fetchNamespaces]);

  // 3. Cluster + Namespace 均具备时拉取 Workloads
  const fetchWorkloads = useCallback(async () => {
    if (!selectedClusterId || !selectedNamespace || !projectName) return;
    setLoadingWorkloads(true);
    try {
      const resp = await serviceApi.getKubeWorkloads(projectName, selectedClusterId, selectedNamespace);
      const wMap = resp.workloads_map || {};
      setWorkloadsMap(wMap);
      setSelectedWorkloads({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取集群工作负载失败';
      message.error(msg);
      setWorkloadsMap({});
    } finally {
      setLoadingWorkloads(false);
    }
  }, [selectedClusterId, selectedNamespace, projectName, message]);

  useEffect(() => {
    if (selectedClusterId && selectedNamespace) {
      fetchWorkloads();
    }
  }, [selectedClusterId, selectedNamespace, fetchWorkloads]);

  // 处理勾选工作负载
  const handleToggleWorkload = (kind: string, name: string, checked: boolean) => {
    setSelectedWorkloads((prev) => {
      const currentList = prev[kind] || [];
      const updatedList = checked
        ? Array.from(new Set([...currentList, name]))
        : currentList.filter((item) => item !== name);

      // 若服务名称为空且选了首个 deployment 或 statefulset，自动给服务名赋值
      const curServiceName = form.getFieldValue('service_name');
      if (!curServiceName && checked && (kind === 'deployment' || kind === 'statefulset')) {
        form.setFieldValue('service_name', name);
      }

      return {
        ...prev,
        [kind]: updatedList,
      };
    });
  };

  const handleSelectAllInKind = (kind: string, allNames: string[], checked: boolean) => {
    setSelectedWorkloads((prev) => ({
      ...prev,
      [kind]: checked ? [...allNames] : [],
    }));
  };

  const totalSelectedCount = Object.values(selectedWorkloads).reduce(
    (acc, list) => acc + (list?.length || 0),
    0
  );

  // 4. 提交导入
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (totalSelectedCount === 0) {
        message.warning('请至少选择一个要导入的工作负载！');
        return;
      }

      // 过滤掉空的类别
      const cleanWorkloadsMap: Record<string, string[]> = {};
      Object.entries(selectedWorkloads).forEach(([kind, list]) => {
        if (list && list.length > 0) {
          cleanWorkloadsMap[kind] = list;
        }
      });

      setSubmitting(true);
      await serviceApi.loadKubeWorkloadsYaml(
        projectName,
        {
          product_name: projectName,
          visibility: values.visibility || 'private',
          type: 'k8s',
          cluster_id: values.cluster_id,
          namespace: values.namespace,
          services: [
            {
              name: values.service_name.trim(),
              workloads_map: cleanWorkloadsMap,
            },
          ],
        },
        isProduction
      );

      message.success(`成功从 Kubernetes 工作负载导入服务 [${values.service_name.trim()}]！`);
      onSuccess(values.service_name.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '从集群工作负载载入服务失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const workloadKinds = Object.keys(workloadsMap);

  return (
    <Modal
      title={
        <Space>
          <ClusterOutlined style={{ color: '#0066ff' }} />
          <span>从 Kubernetes 集群工作负载导入服务</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="确认载入并生成服务"
      cancelText="取消"
      width={780}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="工作负载导入模式"
        description="选择目标 Kubernetes 集群和命名空间后，系统将自动发现工作负载，提取其原生 YAML 配置并组装为 Zadig 标准服务模板。"
      />

      <Form form={form} layout="vertical" initialValues={{ visibility: 'private' }}>
        <Form.Item
          label="服务名称"
          name="service_name"
          rules={[
            { required: true, message: '请输入服务名称' },
            { pattern: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/, message: '只支持小写字母、数字和连字符' },
          ]}
        >
          <Input placeholder="输入或勾选工作负载后自动填入" />
        </Form.Item>

        <Space orientation="horizontal" style={{ width: '100%' }} size="middle">
          <Form.Item
            label="所属集群"
            name="cluster_id"
            style={{ width: 340 }}
            rules={[{ required: true, message: '请选择集群' }]}
          >
            <Select
              loading={loadingClusters}
              placeholder="请选择 Kubernetes 集群"
              options={clusters.map((c) => ({
                label: `${c.name} (${c.production ? '生产' : '通用'})`,
                value: c.id,
              }))}
              onChange={(val) => {
                setSelectedClusterId(val);
                form.setFieldValue('namespace', undefined);
                setSelectedNamespace('');
              }}
            />
          </Form.Item>

          <Form.Item
            label="命名空间"
            name="namespace"
            style={{ width: 340 }}
            rules={[{ required: true, message: '请选择命名空间' }]}
          >
            <Select
              loading={loadingNamespaces}
              placeholder="请选择命名空间"
              options={namespaces.map((ns) => ({
                label: ns.name,
                value: ns.name,
              }))}
              onChange={(val) => setSelectedNamespace(val)}
            />
          </Form.Item>
        </Space>

        <Form.Item label="服务可见范围" name="visibility">
          <Select
            options={[
              { label: '仅项目内私有 (private)', value: 'private' },
              { label: '跨项目共享公开 (public)', value: 'public' },
            ]}
          />
        </Form.Item>
      </Form>

      <Divider titlePlacement="start" style={{ margin: '16px 0 12px' }}>
        <Space>
          <DeploymentUnitOutlined />
          <span>可选工作负载列表 (已选择 {totalSelectedCount} 项)</span>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            loading={loadingWorkloads}
            onClick={fetchWorkloads}
          >
            刷新资源
          </Button>
        </Space>
      </Divider>

      {loadingWorkloads ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin description="正在从集群探索资源工作负载..." />
        </div>
      ) : workloadKinds.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            !selectedClusterId || !selectedNamespace
              ? '请先指定集群与命名空间'
              : '所选命名空间下未发现可载入的工作负载资源'
          }
        />
      ) : (
        <Tabs
          type="card"
          size="small"
          items={workloadKinds.map((kind) => {
            const items = workloadsMap[kind] || [];
            const selectedInKind = selectedWorkloads[kind] || [];
            const isAllSelected = items.length > 0 && selectedInKind.length === items.length;

            return {
              key: kind,
              label: (
                <span>
                  {WORKLOAD_LABELS[kind] || kind}{' '}
                  <Tag color={selectedInKind.length > 0 ? 'blue' : 'default'} style={{ marginLeft: 4 }}>
                    {selectedInKind.length}/{items.length}
                  </Tag>
                </span>
              ),
              children: (
                <div style={{ minHeight: 140, maxHeight: 220, overflowY: 'auto', padding: '8px 12px' }}>
                  {items.length === 0 ? (
                    <Text type="secondary">暂无此类资源</Text>
                  ) : (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Checkbox
                          checked={isAllSelected}
                          indeterminate={selectedInKind.length > 0 && !isAllSelected}
                          onChange={(e) => handleSelectAllInKind(kind, items, e.target.checked)}
                        >
                          全选此类所有资源 ({items.length})
                        </Checkbox>
                      </div>
                      <Space wrap size={[12, 8]}>
                        {items.map((name) => {
                          const checked = selectedInKind.includes(name);
                          return (
                            <Checkbox
                              key={name}
                              checked={checked}
                              onChange={(e) => handleToggleWorkload(kind, name, e.target.checked)}
                            >
                              <Text code={checked}>{name}</Text>
                            </Checkbox>
                          );
                        })}
                      </Space>
                    </div>
                  )}
                </div>
              ),
            };
          })}
        />
      )}
    </Modal>
  );
};

export default ImportFromKubeWorkloadsModal;
