import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Tabs, Table, Typography, Tag, Empty, Space, Button, Tooltip, Modal, Input, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, SyncOutlined } from '@ant-design/icons';
import http from '../../api/client';
import environmentApi from '../../api/environment';
import { feedback } from '../../utils/feedback';
import EnvConfigHistoryModal from './EnvConfigHistoryModal';

const { Text } = Typography;

// commonEnvCfgType 值（backend config.CommonEnvCfgType）
const TAB_TYPE_MAP: Record<ResourceTab, string> = {
  configmap: 'ConfigMap',
  secret: 'Secret',
  ingress: 'Ingress',
  pvc: 'PVC',
};

// /api/aslan/environment/configmaps — service.ListConfigMapRes
interface ConfigMapItem {
  cm_name: string;
  immutable?: boolean;
  cm_data?: Record<string, string>;
  yaml_data?: string;
  services?: string[];
  update_username?: string;
  auto_sync?: boolean;
}

// secrets — service.ListSecretsResponse
interface SecretItem {
  secret_name: string;
  secret_type?: string;
  yaml_data?: string;
  update_username?: string;
  auto_sync?: boolean;
}

// ingresses — service.ListIngressesResponse
interface IngressItem {
  ingress_name: string;
  host_info?: string;
  address?: string;
  ports?: string;
  error_reason?: string;
  yaml_data?: string;
}

// pvcs — service.ListPvcsResponse
interface PvcItem {
  pvc_name: string;
  status?: string;
  volume?: string;
  access_modes?: string;
  storageclass?: string;
  capacity?: string;
  yaml_data?: string;
}

type ResourceTab = 'configmap' | 'secret' | 'ingress' | 'pvc';

/**
 * 环境配置管理抽屉（对齐旧版环境内 ConfigMap/Secret/Ingress/PVC 视图）
 * 数据源: GET /api/aslan/environment/{configmaps|secrets|ingresses|pvcs}/:envName?projectName=&production=
 */
export const EnvConfigDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  envName: string;
  projectName: string;
  production?: boolean;
}> = ({ open, onClose, envName, projectName, production = false }) => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('configmap');
  const [loading, setLoading] = useState(false);
  const [configMaps, setConfigMaps] = useState<ConfigMapItem[]>([]);
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [ingresses, setIngresses] = useState<IngressItem[]>([]);
  const [pvcs, setPvcs] = useState<PvcItem[]>([]);

  const loadResources = useCallback(async () => {
    if (!envName || !projectName) return;
    setLoading(true);
    const prodQuery = `projectName=${encodeURIComponent(projectName)}&production=${production}`;
    try {
      const [cmRes, secRes, ingRes, pvcRes] = await Promise.allSettled([
        http.get<ConfigMapItem[]>(`/api/aslan/environment/configmaps/${envName}?${prodQuery}`, { skipErrorHandler: true }),
        http.get<SecretItem[]>(`/api/aslan/environment/secrets/${envName}?${prodQuery}`, { skipErrorHandler: true }),
        http.get<IngressItem[]>(`/api/aslan/environment/ingresses/${envName}?${prodQuery}`, { skipErrorHandler: true }),
        http.get<PvcItem[]>(`/api/aslan/environment/pvcs/${envName}?${prodQuery}`, { skipErrorHandler: true }),
      ]);
      setConfigMaps(cmRes.status === 'fulfilled' && Array.isArray(cmRes.value) ? cmRes.value : []);
      setSecrets(secRes.status === 'fulfilled' && Array.isArray(secRes.value) ? secRes.value : []);
      setIngresses(ingRes.status === 'fulfilled' && Array.isArray(ingRes.value) ? ingRes.value : []);
      setPvcs(pvcRes.status === 'fulfilled' && Array.isArray(pvcRes.value) ? pvcRes.value : []);
    } finally {
      setLoading(false);
    }
  }, [envName, projectName, production]);

  useEffect(() => {
    if (open) {
      loadResources();
    }
  }, [open, loadResources]);

  // 创建/编辑/删除环境配置（对齐旧版环境配置写操作）
  const [cfgModalOpen, setCfgModalOpen] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgName, setCfgName] = useState('');
  const [cfgYaml, setCfgYaml] = useState('');
  const [cfgMode, setCfgMode] = useState<'create' | 'edit'>('create');
  const [cfgType, setCfgType] = useState<ResourceTab>('configmap');
  const [cfgEditingName, setCfgEditingName] = useState<string>('');

  // 配置版本历史与回滚状态
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    name: string;
    type: string;
    yaml?: string;
  } | null>(null);

  const openCfgHistory = (objectName: string, type: string, currentYaml?: string) => {
    setHistoryTarget({
      name: objectName,
      type,
      yaml: currentYaml,
    });
    setHistoryModalOpen(true);
  };

  // 同步环境资源配置到集群（R3-A2：PUT /envcfgs/:name/:type/:objectName/sync）
  const [syncingCfg, setSyncingCfg] = useState<string | null>(null);
  const handleSyncCfg = async (objectName: string, tabType: ResourceTab) => {
    if (!envName || !projectName) return;
    setSyncingCfg(`${tabType}-${objectName}`);
    try {
      await environmentApi.syncEnvResource(projectName, envName, TAB_TYPE_MAP[tabType], objectName, production);
      feedback.message.success(`配置 [${objectName}] 已同步到集群`);
      loadResources();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '同步到集群失败');
      feedback.message.error(msg);
    } finally {
      setSyncingCfg(null);
    }
  };

  const openCfgCreate = () => {
    setCfgMode('create');
    setCfgType(activeTab);
    setCfgName('');
    setCfgYaml('');
    setCfgModalOpen(true);
  };

  const openCfgEdit = (itemName: string, yaml: string | undefined) => {
    setCfgMode('edit');
    setCfgType(activeTab);
    setCfgEditingName(itemName);
    setCfgName(itemName);
    setCfgYaml(yaml || '');
    setCfgModalOpen(true);
  };

  const handleSaveCfg = async () => {
    if (!cfgName.trim() || !cfgYaml.trim()) {
      feedback.message.warning('请填写名称与 YAML 内容');
      return;
    }
    setCfgSaving(true);
    try {
      const body = {
        env_name: envName,
        product_name: projectName,
        name: cfgName.trim(),
        yaml_data: cfgYaml,
        common_env_cfg_type: TAB_TYPE_MAP[cfgType],
        services: [],
        production,
      };
      if (cfgMode === 'edit') {
        await http.put(
          `/api/aslan/environment/envcfgs/${envName}?projectName=${encodeURIComponent(projectName)}&production=${production}`,
          { ...body, name: cfgEditingName }
        );
        feedback.message.success(`配置 [${cfgEditingName}] 已更新`);
      } else {
        await http.post(
          `/api/aslan/environment/envcfgs/${envName}?projectName=${encodeURIComponent(projectName)}&production=${production}`,
          body
        );
        feedback.message.success(`配置 [${cfgName.trim()}] 已创建`);
      }
      setCfgModalOpen(false);
      loadResources();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { message?: string })?.message || '配置保存失败';
      feedback.message.error(msg);
    } finally {
      setCfgSaving(false);
    }
  };

  const handleDeleteCfg = async (objectName: string, tabType: ResourceTab) => {
    try {
      const cfgTypeStr = TAB_TYPE_MAP[tabType];
      await http.delete(
        `/api/aslan/environment/envcfgs/${envName}/cfg/${encodeURIComponent(objectName)}?projectName=${encodeURIComponent(projectName)}&commonEnvCfgType=${cfgTypeStr}&production=${production}`,
        { skipErrorHandler: true }
      );
      feedback.message.success(`配置 [${objectName}] 已删除`);
      loadResources();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除失败';
      feedback.message.error(msg);
    }
  };

  const updatedAt = (r: { update_username?: string }) =>
    r.update_username ? <Text type="secondary" style={{ fontSize: 12 }}>{r.update_username}</Text> : <Text type="secondary">-</Text>;

  const configMapColumns: ColumnsType<ConfigMapItem> = [
    {
      title: 'ConfigMap 名称',
      dataIndex: 'cm_name',
      key: 'cm_name',
      render: (n) => <Text strong copyable>{n}</Text>,
    },
    {
      title: '数据条目',
      key: 'data',
      render: (_, r) => {
        const keys = Object.keys(r.cm_data || {});
        return keys.length > 0 ? (
          <Space orientation="horizontal" size={4} wrap>
            {keys.slice(0, 3).map((k) => (
              <Tag key={k} color="geekblue">{k}</Tag>
            ))}
            {keys.length > 3 && <Text type="secondary" style={{ fontSize: 12 }}>+{keys.length - 3}</Text>}
          </Space>
        ) : (
          <Text type="secondary">空</Text>
        );
      },
    },
    {
      title: '关联服务',
      dataIndex: 'services',
      key: 'services',
      render: (svcs: string[] | undefined) =>
        svcs && svcs.length > 0 ? (
          <Space orientation="horizontal" size={4} wrap>
            {svcs.map((s) => <Tag key={s} color="blue">{s}</Tag>)}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    { title: '更新人', key: 'updated', render: (_, r) => updatedAt(r) },
    {
      title: '操作',
      key: 'cfg_action',
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openCfgHistory(r.cm_name, 'ConfigMap', r.yaml_data)}
          >
            历史
          </Button>
          <Tooltip title="同步到集群">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={syncingCfg === `configmap-${r.cm_name}`} />}
              onClick={() => handleSyncCfg(r.cm_name, 'configmap')}
            >
              同步
            </Button>
          </Tooltip>
          <Button type="link" size="small" icon={<EditOutlined />} disabled={r.auto_sync === true} onClick={() => openCfgEdit(r.cm_name, r.yaml_data)}>
            编辑
          </Button>
          <Popconfirm title={`确定删除 ConfigMap [${r.cm_name}]？`} onConfirm={() => handleDeleteCfg(r.cm_name, 'configmap')} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const secretColumns: ColumnsType<SecretItem> = [
    { title: 'Secret 名称', dataIndex: 'secret_name', key: 'secret_name', render: (n) => <Text strong copyable>{n}</Text> },
    {
      title: '类型',
      dataIndex: 'secret_type',
      key: 'secret_type',
      render: (t) => <Tag color="geekblue">{String(t || 'Opaque')}</Tag>,
    },
    { title: '更新人', key: 'updated', render: (_, r) => updatedAt(r) },
    {
      title: '操作',
      key: 'cfg_action',
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openCfgHistory(r.secret_name, 'Secret', r.yaml_data)}
          >
            历史
          </Button>
          <Tooltip title="同步到集群">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={syncingCfg === `secret-${r.secret_name}`} />}
              onClick={() => handleSyncCfg(r.secret_name, 'secret')}
            >
              同步
            </Button>
          </Tooltip>
          <Popconfirm title={`确定删除 Secret [${r.secret_name}]？`} onConfirm={() => handleDeleteCfg(r.secret_name, 'secret')} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ingressColumns: ColumnsType<IngressItem> = [
    { title: 'Ingress 名称', dataIndex: 'ingress_name', key: 'ingress_name', render: (n) => <Text strong copyable>{n}</Text> },
    { title: 'Host', dataIndex: 'host_info', key: 'host_info', render: (h) => <Text code style={{ fontSize: 12 }}>{String(h || '-')}</Text> },
    { title: '地址', dataIndex: 'address', key: 'address', render: (a) => <Text type="secondary">{String(a || '-')}</Text> },
    { title: '端口', dataIndex: 'ports', key: 'ports', render: (p) => <Text type="secondary">{String(p || '-')}</Text> },
    {
      title: '异常原因',
      dataIndex: 'error_reason',
      key: 'error_reason',
      render: (e) => (e ? <Tooltip title={e}><Tag color="error">异常</Tag></Tooltip> : <Tag color="success">正常</Tag>),
    },
    {
      title: '操作',
      key: 'cfg_action',
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openCfgHistory(r.ingress_name, 'Ingress', r.yaml_data)}
          >
            历史
          </Button>
          <Tooltip title="同步到集群">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={syncingCfg === `ingress-${r.ingress_name}`} />}
              onClick={() => handleSyncCfg(r.ingress_name, 'ingress')}
            >
              同步
            </Button>
          </Tooltip>
          <Popconfirm title={`确定删除 Ingress [${r.ingress_name}]？`} onConfirm={() => handleDeleteCfg(r.ingress_name, 'ingress')} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pvcColumns: ColumnsType<PvcItem> = [
    { title: 'PVC 名称', dataIndex: 'pvc_name', key: 'pvc_name', render: (n) => <Text strong copyable>{n}</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={String(s) === 'Bound' ? 'success' : 'warning'}>{String(s || '未知')}</Tag>,
    },
    { title: '容量', dataIndex: 'capacity', key: 'capacity', render: (c) => <Text type="secondary">{String(c || '-')}</Text> },
    { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', render: (m) => <Text type="secondary">{String(m || '-')}</Text> },
    { title: '存储类', dataIndex: 'storageclass', key: 'storageclass', render: (s) => <Text type="secondary">{String(s || '-')}</Text> },
    {
      title: '操作',
      key: 'cfg_action',
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openCfgHistory(r.pvc_name, 'PVC', r.yaml_data)}
          >
            历史
          </Button>
          <Tooltip title="同步到集群">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={syncingCfg === `pvc-${r.pvc_name}`} />}
              onClick={() => handleSyncCfg(r.pvc_name, 'pvc')}
            >
              同步
            </Button>
          </Tooltip>
          <Popconfirm title={`确定删除 PVC [${r.pvc_name}]？`} onConfirm={() => handleDeleteCfg(r.pvc_name, 'pvc')} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderYamlToggle = (yaml: string | undefined) =>
    yaml ? (
      <Button
        type="link"
        size="small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(yaml);
            feedback.message.success('YAML 已复制到剪贴板');
          } catch {
            feedback.message.warning('复制失败，请手动复制');
          }
        }}
      >
        复制 YAML
      </Button>
    ) : null;

  return (
    <Drawer
      title={`环境配置管理: ${envName}`}
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={loadResources}>
          刷新
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as ResourceTab)}
        items={[
          {
            key: 'configmap',
            label: `ConfigMap (${configMaps.length})`,
            children: (
              <div>
                {!production && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <Button size="small" icon={<PlusOutlined />} onClick={openCfgCreate}>
                      新建 ConfigMap
                    </Button>
                  </div>
                )}
              <Table
                dataSource={configMaps}
                columns={configMapColumns}
                rowKey="cm_name"
                loading={loading}
                pagination={false}
                size="small"
                expandable={{
                  expandedRowRender: (r) =>
                    r.cm_data ? (
                      <div>
                        {Object.entries(r.cm_data).map(([k, v]) => (
                          <div key={k} style={{ marginBottom: 4 }}>
                            <Text strong>{k}</Text>:{' '}
                            <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>{v}</Text>
                          </div>
                        ))}
                        {renderYamlToggle(r.yaml_data || '')}
                      </div>
                    ) : null,
                }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 ConfigMap" /> }}
              />
              </div>
            ),
          },
          {
            key: 'secret',
            label: `Secret (${secrets.length})`,
            children: (
              <Table
                dataSource={secrets}
                columns={secretColumns}
                rowKey="secret_name"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Secret" /> }}
              />
            ),
          },
          {
            key: 'ingress',
            label: `Ingress (${ingresses.length})`,
            children: (
              <div>
              {!production && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={openCfgCreate}>
                    新建 Ingress
                  </Button>
                </div>
              )}
              <Table
                dataSource={ingresses}
                columns={ingressColumns}
                rowKey="ingress_name"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Ingress" /> }}
              />
              </div>
            ),
          },
          {
            key: 'pvc',
            label: `PVC (${pvcs.length})`,
            children: (
              <div>
              {!production && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={openCfgCreate}>
                    新建 PVC
                  </Button>
                </div>
              )}
              <Table
                dataSource={pvcs}
                columns={pvcColumns}
                rowKey="pvc_name"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 PVC" /> }}
              />
              </div>
            ),
          },
        ]}
      />

      {/* Create/Edit Cfg Modal */}
      <Modal
        title={`${cfgMode === 'edit' ? '编辑' : '新建'} ${TAB_TYPE_MAP[cfgType]}: ${cfgMode === 'edit' ? cfgEditingName : cfgName || ''}`}
        open={cfgModalOpen}
        onCancel={() => setCfgModalOpen(false)}
        onOk={handleSaveCfg}
        confirmLoading={cfgSaving}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <div style={{ marginBottom: 10 }}>
          <Text strong style={{ fontSize: 13 }}>名称</Text>
          <Input
            style={{ marginTop: 4 }}
            value={cfgName}
            disabled={cfgMode === 'edit'}
            onChange={(e) => setCfgName(e.target.value)}
            placeholder="例如: my-config"
          />
        </div>
        <div>
          <Text strong style={{ fontSize: 13 }}>YAML 内容</Text>
          <Input.TextArea
            style={{ marginTop: 4 }}
            rows={14}
            value={cfgYaml}
            onChange={(e) => setCfgYaml(e.target.value)}
            placeholder={
              cfgType === 'configmap'
                ? 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-config\ndata:\n  key: value'
                : cfgType === 'ingress'
                  ? 'apiVersion: networking.k8s.io/v1\nkind: Ingress\n...'
                  : 'apiVersion: v1\nkind: PersistentVolumeClaim\n...'
            }
          />
        </div>
      </Modal>

      {historyTarget && (
        <EnvConfigHistoryModal
          open={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setHistoryTarget(null);
          }}
          projectName={projectName}
          envName={envName}
          objectName={historyTarget.name}
          commonEnvCfgType={historyTarget.type}
          currentYaml={historyTarget.yaml}
          production={production}
          onRollbackSuccess={loadResources}
        />
      )}
    </Drawer>
  );
};

export default EnvConfigDrawer;
