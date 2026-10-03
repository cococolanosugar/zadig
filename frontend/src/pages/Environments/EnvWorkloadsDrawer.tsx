import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Typography,
  Tag,
  Empty,
  Button,
  Space,
  Tabs,
  Spin,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, FileTextOutlined, RocketOutlined } from '@ant-design/icons';
import environmentApi, {
  type WorkloadType,
  type ResourceType,
  type K8sResourceCommon,
} from '../../api/environment';
import YamlEditor from '../../components/Editor/YamlEditor';
import { feedback } from '../../utils/feedback';
import UpdateImageModal from './UpdateImageModal';

const { Text } = Typography;

export interface EnvWorkloadsDrawerProps {
  open: boolean;
  onClose: () => void;
  envName: string;
  projectName: string;
  production?: boolean;
}

type CategoryType = WorkloadType | ResourceType;

interface CategoryConfig {
  key: CategoryType;
  label: string;
  isWorkload: boolean;
  singularType: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'deployments', label: 'Deployments', isWorkload: true, singularType: 'deployment' },
  { key: 'statefulsets', label: 'StatefulSets', isWorkload: true, singularType: 'statefulset' },
  { key: 'daemonsets', label: 'DaemonSets', isWorkload: true, singularType: 'daemonset' },
  { key: 'cronjobs', label: 'CronJobs', isWorkload: true, singularType: 'cronjob' },
  { key: 'jobs', label: 'Jobs', isWorkload: true, singularType: 'job' },
  { key: 'services', label: 'Services', isWorkload: false, singularType: 'service' },
  { key: 'ingresses', label: 'Ingresses', isWorkload: false, singularType: 'ingress' },
  { key: 'configmaps', label: 'ConfigMaps', isWorkload: false, singularType: 'configmap' },
  { key: 'secrets', label: 'Secrets', isWorkload: false, singularType: 'secret' },
  { key: 'pvcs', label: 'PVCs', isWorkload: false, singularType: 'pvc' },
];

/**
 * 环境工作负载与资源浏览抽屉
 * 数据源:
 *  - 工作负载: GET /api/aslan/environment/kube/workloads/:workloadType
 *  - 基础资源: GET /api/aslan/environment/kube/resources/:resourceType
 *  - 实时 YAML: GET /api/aslan/environment/kube/yaml
 */
export const EnvWorkloadsDrawer: React.FC<EnvWorkloadsDrawerProps> = ({
  open,
  onClose,
  envName,
  projectName,
  production = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('deployments');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<K8sResourceCommon[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // 实时 YAML 查看弹层状态
  const [yamlDrawerOpen, setYamlDrawerOpen] = useState(false);
  const [yamlLoading, setYamlLoading] = useState(false);
  const [currentYaml, setCurrentYaml] = useState('');
  const [currentResourceName, setCurrentResourceName] = useState('');

  // 镜像更新弹层状态
  const [updateImageModalOpen, setUpdateImageModalOpen] = useState(false);
  const [targetWorkload, setTargetWorkload] = useState<{
    name: string;
    type: string;
    images?: Array<{ name: string; image: string }>;
  } | null>(null);

  const handleOpenUpdateImage = (record: K8sResourceCommon) => {
    setTargetWorkload({
      name: record.name,
      type: currentCategoryConfig.singularType,
      images: record.images || [],
    });
    setUpdateImageModalOpen(true);
  };

  const currentCategoryConfig =
    CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  const loadData = useCallback(async () => {
    if (!envName || !projectName) return;
    setLoading(true);
    try {
      let res;
      if (currentCategoryConfig.isWorkload) {
        res = await environmentApi.getK8sWorkloads(
          projectName,
          envName,
          activeCategory as WorkloadType,
          page,
          pageSize,
          production
        );
      } else {
        res = await environmentApi.getK8sResources(
          projectName,
          envName,
          activeCategory as ResourceType,
          page,
          pageSize,
          production
        );
      }

      const list = res?.workloads || res?.resources || [];
      setItems(list);
      setTotalCount(res?.count ?? list.length);
    } catch (err: unknown) {
      console.warn(`Failed to fetch ${activeCategory}:`, err);
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [envName, projectName, activeCategory, currentCategoryConfig.isWorkload, page, pageSize, production]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // 打开实时 YAML 查看
  const handleViewLiveYaml = async (record: K8sResourceCommon) => {
    setCurrentResourceName(record.name);
    setCurrentYaml('');
    setYamlDrawerOpen(true);
    setYamlLoading(true);
    try {
      const yaml = await environmentApi.getK8sResourceYaml(
        projectName,
        envName,
        currentCategoryConfig.singularType,
        record.name,
        production
      );
      setCurrentYaml(yaml || '// 未获取到资源 YAML 内容');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '获取实时 YAML 失败';
      feedback.message.error(msg);
      setCurrentYaml(`// 获取实时 YAML 失败: ${msg}`);
    } finally {
      setYamlLoading(false);
    }
  };

  // 根据当前类型动态生成表格列
  const getColumns = (): ColumnsType<K8sResourceCommon> => {
    const baseColumns: ColumnsType<K8sResourceCommon> = [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record) => {
          const images = record.images as Array<{ name?: string; image?: string }> | undefined;
          return (
            <div>
              <Text strong copyable>
                {name}
              </Text>
              {images && images.length > 0 && (
                <div style={{ marginTop: 2 }}>
                  {images.map((img, idx) => (
                    <Text
                      key={idx}
                      type="secondary"
                      style={{ fontSize: 12, display: 'block' }}
                      ellipsis={{ tooltip: img.image || img.name }}
                    >
                      {img.image || img.name}
                    </Text>
                  ))}
                </div>
              )}
            </div>
          );
        },
      },
    ];

    if (activeCategory === 'deployments' || activeCategory === 'statefulsets') {
      baseColumns.push({
        title: 'Ready 状态',
        dataIndex: 'ready',
        key: 'ready',
        width: 130,
        render: (ready: string) => {
          const isReady = ready && !ready.startsWith('0/');
          return (
            <Tag color={isReady ? 'success' : 'warning'}>
              {ready || '-'}
            </Tag>
          );
        },
      });
    }

    if (activeCategory === 'daemonsets') {
      baseColumns.push(
        {
          title: 'Desired / Current / Ready',
          key: 'ds_status',
          width: 220,
          render: (_, record: Record<string, unknown>) => (
            <Space orientation="horizontal" size={4}>
              <Tag color="default">期望: {String(record.desired ?? 0)}</Tag>
              <Tag color="processing">当前: {String(record.current ?? 0)}</Tag>
              <Tag color="success">就绪: {String(record.ready ?? 0)}</Tag>
            </Space>
          ),
        }
      );
    }

    if (activeCategory === 'cronjobs') {
      baseColumns.push(
        {
          title: '调度规则 (Schedule)',
          dataIndex: 'schedule',
          key: 'schedule',
          width: 160,
          render: (s: string) => <Tag color="blue">{s || '-'}</Tag>,
        },
        {
          title: '活跃任务',
          dataIndex: 'active',
          key: 'active',
          width: 100,
          render: (a: number) => <Text>{a ?? 0}</Text>,
        },
        {
          title: '上次调度',
          dataIndex: 'last_schedule',
          key: 'last_schedule',
          width: 180,
          render: (ls: string) => <Text type="secondary">{ls || '-'}</Text>,
        }
      );
    }

    if (activeCategory === 'jobs') {
      baseColumns.push(
        {
          title: '完成数 (Completions)',
          dataIndex: 'completions',
          key: 'completions',
          width: 160,
          render: (c: string) => <Tag color="purple">{c || '-'}</Tag>,
        },
        {
          title: '耗时 (Duration)',
          dataIndex: 'duration',
          key: 'duration',
          width: 140,
          render: (d: string) => <Text>{d || '-'}</Text>,
        }
      );
    }

    if (activeCategory === 'services') {
      baseColumns.push(
        {
          title: '类型',
          dataIndex: 'service_type',
          key: 'service_type',
          width: 120,
          render: (t: string) => <Tag color="blue">{t || 'ClusterIP'}</Tag>,
        },
        {
          title: 'Cluster IP',
          dataIndex: 'cluster_ip',
          key: 'cluster_ip',
          width: 150,
          render: (ip: string) => <Text code>{ip || '-'}</Text>,
        },
        {
          title: '端口 (Ports)',
          dataIndex: 'ports',
          key: 'ports',
          ellipsis: true,
          render: (p: string) => <Text>{p || '-'}</Text>,
        }
      );
    }

    if (activeCategory === 'ingresses') {
      baseColumns.push(
        {
          title: 'Hosts',
          dataIndex: 'hosts',
          key: 'hosts',
          render: (h: string) => <Text code>{h || '-'}</Text>,
        },
        {
          title: 'Address',
          dataIndex: 'address',
          key: 'address',
          width: 160,
          render: (addr: string) => <Text>{addr || '-'}</Text>,
        }
      );
    }

    if (activeCategory === 'configmaps' || activeCategory === 'secrets') {
      baseColumns.push({
        title: 'Keys 键值项',
        dataIndex: 'keys',
        key: 'keys',
        render: (keys: string[]) => {
          const list = Array.isArray(keys) ? keys : [];
          if (list.length === 0) return <Text type="secondary">-</Text>;
          return (
            <Space wrap size={[4, 4]}>
              {list.map((k) => (
                <Tag key={k} color="geekblue">
                  {k}
                </Tag>
              ))}
            </Space>
          );
        },
      });
    }

    if (activeCategory === 'pvcs') {
      baseColumns.push(
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (s: string) => (
            <Tag color={s === 'Bound' ? 'success' : 'default'}>{s || '-'}</Tag>
          ),
        },
        {
          title: '容量',
          dataIndex: 'capacity',
          key: 'capacity',
          width: 120,
          render: (cap: string) => <Text>{cap || '-'}</Text>,
        },
        {
          title: 'StorageClass',
          dataIndex: 'storage_class',
          key: 'storage_class',
          width: 160,
          render: (sc: string) => <Text type="secondary">{sc || '-'}</Text>,
        }
      );
    }

    baseColumns.push(
      {
        title: '创建时间',
        dataIndex: 'creation_time',
        key: 'creation_time',
        width: 170,
        render: (ct: string, record: Record<string, unknown>) => (
          <Text type="secondary">{ct || (record.age as string) || '-'}</Text>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: currentCategoryConfig.isWorkload ? 180 : 110,
        align: 'center',
        render: (_, record) => (
          <Space size={0}>
            {currentCategoryConfig.isWorkload && (
              <Tooltip title="更新容器镜像">
                <Button
                  type="link"
                  size="small"
                  icon={<RocketOutlined />}
                  onClick={() => handleOpenUpdateImage(record)}
                >
                  更新镜像
                </Button>
              </Tooltip>
            )}
            <Tooltip title="查看从集群实时读取的 Kubernetes 资源 YAML">
              <Button
                type="link"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => handleViewLiveYaml(record)}
              >
                实时 YAML
              </Button>
            </Tooltip>
          </Space>
        ),
      }
    );

    return baseColumns;
  };

  return (
    <>
      <Drawer
        title={
          <Space orientation="horizontal" size="middle">
            <span>环境资源视图: {envName}</span>
            <Tag color={production ? 'red' : 'blue'}>
              {production ? '生产环境' : '测试环境'}
            </Tag>
          </Space>
        }
        placement="right"
        open={open}
        onClose={onClose}
        size={1000}
        extra={
          <Button icon={<ReloadOutlined spin={loading} />} size="small" onClick={loadData}>
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeCategory}
          onChange={(k) => {
            setActiveCategory(k as CategoryType);
            setPage(1);
          }}
          items={CATEGORIES.map((cat) => ({
            key: cat.key,
            label: `${cat.label}`,
          }))}
        />

        <Table
          dataSource={items}
          columns={getColumns()}
          rowKey={(r) => `${r.name}-${r.type || activeCategory}`}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showTotal: (total) => `共 ${total} 项资源`,
            onChange: (p) => setPage(p),
            size: 'small',
          }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`当前环境未发现 ${currentCategoryConfig.label} 资源`}
              />
            ),
          }}
        />
      </Drawer>

      {/* 实时 YAML 查看子抽屉 */}
      <Drawer
        title={
          <Space orientation="horizontal">
            <FileTextOutlined style={{ color: '#0066ff' }} />
            <span>
              实时 K8s YAML: {currentResourceName} ({currentCategoryConfig.singularType})
            </span>
          </Space>
        }
        open={yamlDrawerOpen}
        onClose={() => setYamlDrawerOpen(false)}
        size={780}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined spin={yamlLoading} />}
            onClick={() => handleViewLiveYaml({ name: currentResourceName, type: currentCategoryConfig.singularType })}
          >
            刷新实时状态
          </Button>
        }
      >
        {yamlLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#64748b' }}>
              正在从 Kubernetes 集群实时提取资源对象定义...
            </div>
          </div>
        ) : (
          <YamlEditor
            value={currentYaml}
            readOnly
            theme="light"
            height={680}
          />
        )}
      </Drawer>

      {targetWorkload && (
        <UpdateImageModal
          open={updateImageModalOpen}
          onClose={() => {
            setUpdateImageModalOpen(false);
            setTargetWorkload(null);
          }}
          onSuccess={loadData}
          projectName={projectName}
          envName={envName}
          workloadType={targetWorkload.type}
          workloadName={targetWorkload.name}
          containers={targetWorkload.images}
          production={production}
        />
      )}
    </>
  );
};

export default EnvWorkloadsDrawer;
