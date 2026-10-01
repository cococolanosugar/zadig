import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Tabs, Table, Typography, Tag, Empty, Space, Button, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

// /api/aslan/environment/configmaps — service.ListConfigMapRes
interface ConfigMapItem {
  cm_name: string;
  immutable?: boolean;
  cm_data?: Record<string, string>;
  yaml_data?: string;
  services?: string[];
  update_username?: string;
}

// secrets — service.ListSecretsResponse
interface SecretItem {
  secret_name: string;
  secret_type?: string;
  yaml_data?: string;
  update_username?: string;
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
              <Table
                dataSource={ingresses}
                columns={ingressColumns}
                rowKey="ingress_name"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Ingress" /> }}
              />
            ),
          },
          {
            key: 'pvc',
            label: `PVC (${pvcs.length})`,
            children: (
              <Table
                dataSource={pvcs}
                columns={pvcColumns}
                rowKey="pvc_name"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 PVC" /> }}
              />
            ),
          },
        ]}
      />
    </Drawer>
  );
};

export default EnvConfigDrawer;
