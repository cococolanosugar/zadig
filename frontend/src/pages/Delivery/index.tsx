import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Typography,
  Button,
  Space,
  Input,
  Tag,
  Empty,
  Drawer,
  Timeline,
  Descriptions,
  Modal,
  Form,
  Select,
  Badge,
  Spin,
  Dropdown,
  Row,
  Col,
  Divider,
  Popconfirm,
} from 'antd';
import {
  HistoryOutlined,
  SearchOutlined,
  PlusOutlined,
  DropboxOutlined,
  BranchesOutlined,
  ClusterOutlined,
  ReloadOutlined,
  DownOutlined,
  CloudDownloadOutlined,
  FileTextOutlined,
  RocketOutlined,
  DeleteOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { useProjectStore } from '../../stores/project';
import { deliveryApi, DeliveryVersionItem } from '../../api/delivery';
import CreateHelmReleaseModal from './CreateHelmReleaseModal';
import { LogViewer } from '../../components/Terminal/LogViewer';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ArtifactItem {
  id?: string;
  name: string;
  image?: string;
  image_tag?: string;
  image_digest?: string;
  image_size?: number;
  project_name?: string;
  workflow_name?: string;
  size?: string;
  created_at?: string;
  created_time?: number | string;
  created_by?: string;
  commit_id?: string;
  branch?: string;
  author?: string;
}

interface ArtifactActivity {
  type?: string;
  content?: string;
  created_by?: string;
  created_time?: number;
  start_time?: number;
  end_time?: number;
  url?: string;
  env_name?: string;
  namespace?: string;
}

interface ReleaseVersionItem {
  id?: string;
  version: string;
  product_name: string;
  projectName?: string;
  created_at?: string | number;
  create_by?: string;
  create_time?: string | number;
  desc?: string;
  status?: string;
  type?: 'k8s' | 'helm' | string;
  services?: Array<{ service_name: string; chart_name?: string; chart_version?: string; image?: string }>;
}

/** CC-Loop01 P0-4: 字节格式化为 KB/MB */
const formatImageSize = (bytes?: number | string | null): string => {
  if (bytes == null || bytes === '') return '-';
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUnixOrMs = (t?: number | string | null): string => {
  if (t == null || t === '') return '-';
  const num = Number(t);
  if (!Number.isFinite(num) || num <= 0) return String(t);
  const date = num > 1e11 ? new Date(num) : new Date(num * 1000);
  return date.toLocaleString('zh-CN');
};

export const DeliveryPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isVersionPath = location.pathname.includes('/version');
  const initialTab = tab || (isVersionPath ? 'version' : 'artifacts') || searchParams.get('tab') || 'artifacts';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { projects } = useProjectStore();

  useEffect(() => {
    if (location.pathname.includes('/version')) {
      setActiveTab('version');
    } else if (location.pathname.includes('/artifacts')) {
      setActiveTab('artifacts');
    }
  }, [location.pathname]);

  const handleTabChange = (k: string) => {
    setActiveTab(k);
    navigate(`/v1/delivery/${k}`);
  };

  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [releases, setReleases] = useState<ReleaseVersionItem[]>([]);
  const [searchText, setSearchText] = useState('');

  // Lineage Drawer state
  const [lineageDrawerVisible, setLineageDrawerVisible] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  // CC-Loop01 P0-5: 真实 activities
  const [artifactDetailLoading, setArtifactDetailLoading] = useState(false);
  const [artifactActivities, setArtifactActivities] = useState<ArtifactActivity[]>([]);

  // Service image list modal state
  const [serviceImagesOpen, setServiceImagesOpen] = useState(false);
  const [serviceImages, setServiceImages] = useState<Array<{ service: string; image: string }>>([]);
  const [serviceImagesLoading, setServiceImagesLoading] = useState(false);
  const [selectedReleaseVersion, setSelectedReleaseVersion] = useState<string>('');

  const handleShowServiceImages = async (record: ReleaseVersionItem) => {
    setSelectedReleaseVersion(record.version);
    setServiceImagesOpen(true);
    setServiceImagesLoading(true);
    setServiceImages([]);
    try {
      const proj = record.product_name;
      const res = await deliveryApi.getDeliveryVersion(record.id || '', proj);
      const list: Array<{ service: string; image: string }> = [];
      (res?.services || []).forEach((svc) => {
        (svc.images || []).forEach((img) => {
          list.push({ service: svc.service_name, image: img.target_image || img.source_image || img.image_name || '' });
        });
      });
      setServiceImages(list);
    } catch (err: unknown) {
      setServiceImages([]);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '版本镜像清单获取失败';
      feedback.message.error(msg);
    } finally {
      setServiceImagesLoading(false);
    }
  };

  // Version detail drawer state (GET /api/aslan/delivery/releases/:id?projectName=)
  const [versionDetailOpen, setVersionDetailOpen] = useState(false);
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [versionDetail, setVersionDetail] = useState<DeliveryVersionItem | null>(null);
  const [versionDetailImages, setVersionDetailImages] = useState<
    Array<{ key: string; service: string; serviceModule: string; image: string }>
  >([]);

  // Delivery distribution log SSE drawer state (/api/aslan/logs/sse/delivery/:lines)
  const [distLogDrawer, setDistLogDrawer] = useState<{
    open: boolean;
    projectName: string;
    version: string;
    serviceName: string;
    serviceModule: string;
  }>({
    open: false,
    projectName: '',
    version: '',
    serviceName: '',
    serviceModule: '',
  });

  const openVersionDetail = async (record: ReleaseVersionItem) => {
    setVersionDetailOpen(true);
    setVersionDetailLoading(true);
    setVersionDetail(null);
    setVersionDetailImages([]);
    try {
      const proj = record.product_name;
      const res = await deliveryApi.getDeliveryVersion(record.id || '', proj);
      setVersionDetail(res || null);
      http
        .get<Array<{ name: string; alias?: string }>>(
          `/api/aslan/environment/environments?projectName=${encodeURIComponent(proj)}`,
          { skipErrorHandler: true }
        )
        .then((envList) => {
          if (Array.isArray(envList)) {
            setTargetEnvs(
              envList.map((e) => ({ label: e.alias ? `${e.name} (${e.alias})` : e.name, value: e.name }))
            );
          }
        })
        .catch(() => setTargetEnvs([]));
      const list: Array<{ key: string; service: string; serviceModule: string; image: string }> = [];
      (res?.services || []).forEach((svc) => {
        if (svc.images && svc.images.length > 0) {
          svc.images.forEach((img, idx) => {
            list.push({
              key: `${svc.service_name}-${img.container_name || idx}`,
              service: svc.service_name,
              serviceModule: img.container_name || svc.service_name,
              image: img.target_image || img.source_image || img.image_name || '',
            });
          });
        } else {
          list.push({
            key: svc.service_name,
            service: svc.service_name,
            serviceModule: svc.service_name,
            image: '-',
          });
        }
      });
      setVersionDetailImages(list);
    } catch (err: unknown) {
      setVersionDetail(null);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || '版本详情获取失败';
      feedback.message.error(msg);
    } finally {
      setVersionDetailLoading(false);
    }
  };

  // Helm Release Modal state
  const [createHelmModalVisible, setCreateHelmModalVisible] = useState(false);

  // Download Chart Selection Modal state
  const [downloadChartModalVisible, setDownloadChartModalVisible] = useState(false);
  const [downloadChartOptions, setDownloadChartOptions] = useState<{
    projectName: string;
    version: string;
    charts: string[];
  } | null>(null);

  const handleDownloadChart = async (record: ReleaseVersionItem) => {
    try {
      feedback.message.loading({ content: `正在获取版本 [${record.version}] Chart 信息...`, key: 'downloadChart' });
      const detail = await deliveryApi.getDeliveryVersion(record.id || '', record.product_name);
      const charts = (detail.services || []).filter((s) => s.chart_name);
      if (charts.length === 1 && charts[0].chart_name) {
        feedback.message.loading({ content: `正在下载 Chart [${charts[0].chart_name}]...`, key: 'downloadChart' });
        await deliveryApi.downloadDeliveryChart(record.product_name, record.version, charts[0].chart_name);
        feedback.message.success({ content: `Chart [${charts[0].chart_name}] 下载已触发`, key: 'downloadChart' });
      } else if (charts.length > 1) {
        feedback.message.destroy('downloadChart');
        setDownloadChartOptions({
          projectName: record.product_name,
          version: record.version,
          charts: charts.map((c) => c.chart_name),
        });
        setDownloadChartModalVisible(true);
      } else {
        const defaultChart = record.services?.[0]?.chart_name || record.services?.[0]?.service_name || record.product_name;
        await deliveryApi.downloadDeliveryChart(record.product_name, record.version, defaultChart);
        feedback.message.success({ content: `Chart [${defaultChart}] 下载已触发`, key: 'downloadChart' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下载 Chart 失败';
      feedback.message.error({ content: msg, key: 'downloadChart' });
    }
  };

  const handleRetryDelivery = async (record: ReleaseVersionItem) => {
    const projectName = record.product_name || record.projectName || '';
    if (!record.id || !projectName) return;
    try {
      // CC-Loop01 P0-1: query 传参 id + projectName
      await deliveryApi.retryDeliveryVersion(record.id, projectName);
      feedback.message.success(`已下发版本 [${record.version}] 的重新交付与构建调度任务！`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '重试交付失败，请检查网络或权限');
      feedback.message.error(msg);
    }
  };

  // CC-Loop01 P0-5: 打开详情并拉取真实 activities
  const openArtifactDetail = async (record: ArtifactItem) => {
    setSelectedArtifact(record);
    setLineageDrawerVisible(true);
    setArtifactActivities([]);
    if (!record.id) return;
    setArtifactDetailLoading(true);
    try {
      const detail = await deliveryApi.getDeliveryArtifactDetail(record.id);
      const activities = Array.isArray(detail?.activities) ? detail.activities : [];
      setArtifactActivities(activities);
      // 用详情中的真实字段补全展示
      if (detail) {
        setSelectedArtifact((prev) =>
          prev
            ? {
                ...prev,
                image_tag: detail.image_tag ?? prev.image_tag,
                image_size: detail.image_size ?? prev.image_size,
                image_digest: detail.image_digest ?? prev.image_digest,
                created_by: detail.created_by ?? prev.created_by,
                created_time: detail.created_time ?? prev.created_time,
                image: detail.image ?? prev.image,
                name: detail.name ?? prev.name,
              }
            : prev
        );
      }
    } catch {
      setArtifactActivities([]);
      feedback.message.error('加载交付物详情失败');
    } finally {
      setArtifactDetailLoading(false);
    }
  };

  // Create Release Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingRelease, setCreatingRelease] = useState(false);
  const [form] = Form.useForm();
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'artifacts') {
        const res = await http.get<ArtifactItem[]>('/api/aslan/delivery/artifacts', {
          skipErrorHandler: true,
        });
        setArtifacts(Array.isArray(res) ? res : []);
      } else {
        const res = await deliveryApi.listDeliveryVersions();
        const list = Array.isArray(res)
          ? res.map((r) => ({
              id: r.id,
              version: r.version,
              product_name: r.project_name || '',
              create_by: r.created_by || '',
              create_time: r.created_at || '',
              desc: r.desc || '',
              status: r.status || '',
              type: r.type || 'k8s',
              services: r.services || [],
            }))
          : [];
        setReleases(list);
      }
    } catch (err: unknown) {
      if (activeTab === 'artifacts') setArtifacts([]);
      else setReleases([]);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '')
        || (activeTab === 'artifacts' ? '交付物列表获取失败' : '发布版本列表获取失败');
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createReleaseMenu = {
    items: [
      {
        key: 'k8s',
        label: '创建 Kubernetes 版本',
        icon: <ClusterOutlined />,
        onClick: () => {
          form.resetFields();
          setCreateModalVisible(true);
        },
      },
      {
        key: 'helm',
        label: '创建 Helm Chart 版本',
        icon: <DropboxOutlined />,
        onClick: () => {
          setCreateHelmModalVisible(true);
        },
      },
    ],
  };

  // 批量发布到环境状态
  const [batchDeployModalOpen, setBatchDeployModalOpen] = useState(false);
  const [batchDeployEnv, setBatchDeployEnv] = useState<string>('');
  const [targetEnvs, setTargetEnvs] = useState<Array<{ label: string; value: string }>>([]);

  const handleBatchDeploy = () => {
    if (!batchDeployEnv || !versionDetail) {
      feedback.message.warning('请选择目标部署环境');
      return;
    }
    // R10 任务四: 后端 aslan 未提供 /delivery/releases/:id/deploy 路由，
    // 不再发起必然 404 的请求，改为明确引导用户经工作流/发布计划编排下发
    feedback.message.info(
      `交付版本 [${versionDetail.version}] 已就绪，请在「工作流」或「发布计划」中选定该版本编排下发到环境 [${batchDeployEnv}]。`
    );
    setBatchDeployModalOpen(false);
  };

  const handleCreateRelease = async () => {
    try {
      const values = await form.validateFields();
      setCreatingRelease(true);
      const rawServices = Array.isArray(values.services) ? values.services : [];
      const formattedServices = rawServices.map((s: { service_name: string; image: string }) => ({
        service_name: s.service_name,
        chart_name: s.service_name,
        chart_version: values.version,
        images: [
          {
            container_name: s.service_name,
            target_image: s.image,
            source_image: s.image,
          },
        ],
      }));

      await deliveryApi.createK8sDeliveryVersion({
        version: values.version,
        project_name: values.product_name,
        desc: values.desc || '',
        services: formattedServices,
      });
      feedback.message.success(`版本 [${values.version}] 创建成功，已打包 ${formattedServices.length} 个服务快照！`);
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      feedback.message.error(err?.message || '创建发布版本失败，请检查参数');
    } finally {
      setCreatingRelease(false);
    }
  };

  const filteredArtifacts = artifacts.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      a.project_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      a.workflow_name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredReleases = releases.filter(
    (r) =>
      r.version?.toLowerCase().includes(searchText.toLowerCase()) ||
      r.product_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      (r.desc && r.desc.toLowerCase().includes(searchText.toLowerCase()))
  );

  const artifactColumns: ColumnsType<ArtifactItem> = [
    {
      title: '制品名称 / 镜像 Tag',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <Space size={6}>
            <DropboxOutlined style={{ color: '#0066ff' }} />
            <Text strong>{text || record.image || '-'}</Text>
          </Space>
          {/* CC-Loop01 P0-4: 真实 image_tag */}
          <Text type="secondary" code style={{ fontSize: 12 }}>
            tag: {record.image_tag || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '归属项目',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 160,
      render: (proj) => (proj ? <Tag color="blue">{proj}</Tag> : '-'),
    },
    {
      title: '产生工作流',
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      width: 180,
      render: (wf) =>
        wf ? (
          <Space size={4}>
            <BranchesOutlined style={{ color: '#8c8c8c' }} />
            <Text>{wf}</Text>
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '产物大小',
      dataIndex: 'image_size',
      key: 'image_size',
      width: 120,
      // CC-Loop01 P0-4: 剔除 142 MB 假兜底
      render: (s, record) => formatImageSize(s ?? record.size),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
      render: (by) => by || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_time',
      key: 'created_time',
      width: 160,
      // CC-Loop01 P0-4: 剔除「刚刚」假兜底
      render: (t, record) => formatUnixOrMs(t ?? record.created_at),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openArtifactDetail(record)}>
          查看流向图
        </Button>
      ),
    },
  ];

  const releaseColumns: ColumnsType<ReleaseVersionItem> = [
    {
      title: '版本号 (Version)',
      dataIndex: 'version',
      key: 'version',
      render: (v, record) => (
        <Space orientation="vertical" size={2}>
          <Space size={6}>
            <HistoryOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openVersionDetail(record)}>
              {v}
            </Text>
            {record.type === 'helm' ? (
              <Tag color="blue" style={{ fontSize: 10 }}>Helm</Tag>
            ) : (
              <Tag color="cyan" style={{ fontSize: 10 }}>K8s</Tag>
            )}
          </Space>
          {record.desc && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.desc}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '归属项目',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 160,
      render: (p) => <Tag color="geekblue">{p}</Tag>,
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        if (status === 'success') {
          return <Badge status="success" text="已发布" />;
        }
        if (status === 'failed' || status === 'fail' || status === 'error') {
          return <Badge status="error" text="交付失败" />;
        }
        // CC-Loop01 P0-4: 剔除「已就绪」假兜底
        if (!status) return <Badge status="default" text="-" />;
        return <Badge status="processing" text={status} />;
      },
    },
    {
      title: '创建人',
      dataIndex: 'create_by',
      key: 'create_by',
      width: 120,
      render: (by) => by || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 160,
      render: (t) => formatUnixOrMs(t),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleShowServiceImages(record)}>
            镜像清单
          </Button>
          {/* CC-Loop01 P0-1: 仅 fail/failed 显示重试 */}
          {(record.status === 'fail' || record.status === 'failed') && (
            <Popconfirm
              title="确定重新触发版本交付？"
              description="将重新执行版本镜像打包与分发调度流水线。"
              onConfirm={() => handleRetryDelivery(record)}
              okText="重试"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<RedoOutlined />}>
                重试交付
              </Button>
            </Popconfirm>
          )}
          {(record.type === 'helm' || (record.services && record.services.some((s) => s.chart_name))) && (
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleDownloadChart(record)}
            >
              下载 Chart
            </Button>
          )}
          <Popconfirm
            title={`确定删除发布版本 [${record.version}]？`}
            description="删除后该版本快照与镜像清单记录将不可恢复。"
            onConfirm={async () => {
              try {
                await deliveryApi.deleteDeliveryVersion(record.id || '', record.product_name);
                feedback.message.success(`发布版本 [${record.version}] 已删除`);
                fetchData();
              } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                  || (err instanceof Error ? err.message : '删除发布版本失败');
                feedback.message.error(msg);
              }
            }}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除版本
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'artifacts',
      label: (
        <span>
          <DropboxOutlined /> 交付物追踪
        </span>
      ),
    },
    {
      key: 'version',
      label: (
        <span>
          <HistoryOutlined /> 发布版本管理
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Header */}
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
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            制品与版本管理 (Delivery & Releases)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            端到端追踪产物镜像、发布版本快照、关联代码提交以及各集群环境上线流向
          </Text>
        </div>

        <Space orientation="horizontal" size={12}>
          <Input
            placeholder="搜索制品名称 / Tag / 版本"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 4 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
          <Dropdown menu={createReleaseMenu}>
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }}>
              创建版本发布 <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={handleTabChange}
          tabBarStyle={{ marginBottom: 20 }}
        />

        {activeTab === 'artifacts' ? (
          <Table
            rowKey={(r) => r.name || String(r.id)}
            dataSource={filteredArtifacts}
            columns={artifactColumns}
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个交付物` }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无交付物记录，运行构建流水线将自动生成归档镜像"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        ) : (
          <Table
            rowKey={(r) => r.version || String(r.id)}
            dataSource={filteredReleases}
            columns={releaseColumns}
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个版本发布` }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无发布版本快照，点击上方“创建版本发布”生成新版本"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Dropdown menu={createReleaseMenu}>
                    <Button type="primary" icon={<PlusOutlined />}>
                      创建版本发布 <DownOutlined />
                    </Button>
                  </Dropdown>
                </Empty>
              ),
            }}
          />
        )}
      </Card>

      {/* Interactive Lineage Drawer */}
      <Drawer
        title={
          <Space>
            <DropboxOutlined style={{ color: '#0066ff' }} />
            <span>制品流向追踪 (Artifact Lineage): {selectedArtifact?.name}</span>
          </Space>
        }
        open={lineageDrawerVisible}
        onClose={() => setLineageDrawerVisible(false)}
        size="large"
      >
        {selectedArtifact && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 28 }}>
              <Descriptions.Item label="交付物名称">{selectedArtifact.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="镜像 Tag">{selectedArtifact.image_tag || '-'}</Descriptions.Item>
              <Descriptions.Item label="镜像">
                <Text code style={{ fontSize: 12 }}>{selectedArtifact.image || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="镜像 Digest">
                <Text code style={{ fontSize: 12 }}>{selectedArtifact.image_digest || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="产物大小">
                {formatImageSize(selectedArtifact.image_size ?? selectedArtifact.size)}
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{selectedArtifact.project_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedArtifact.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatUnixOrMs(selectedArtifact.created_time ?? selectedArtifact.created_at)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 20 }}>
              交付活动记录 (Activities)
            </Title>

            {/* CC-Loop01 P0-5: 真实 activities，剔除伪造 CVE Timeline */}
            {artifactDetailLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : artifactActivities.length > 0 ? (
              <Timeline
                items={artifactActivities.map((act, idx) => ({
                  color: 'blue',
                  children: (
                    <div key={idx}>
                      <Text strong>
                        {act.type || 'activity'}
                        {act.content ? ` · ${act.content}` : ''}
                      </Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        时间: {formatUnixOrMs(act.created_time || act.start_time)}
                        {' | '}
                        触发人: {act.created_by || '-'}
                        {act.env_name ? ` | 环境: ${act.env_name}` : ''}
                        {act.namespace ? ` | NS: ${act.namespace}` : ''}
                      </Paragraph>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="暂无交付活动记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        )}
      </Drawer>

      {/* Service Image List Modal */}
      <Modal
        title={`服务镜像清单: ${selectedReleaseVersion}`}
        open={serviceImagesOpen}
        onCancel={() => setServiceImagesOpen(false)}
        footer={null}
        width={680}
      >
        <Table
          dataSource={serviceImages}
          rowKey="service"
          loading={serviceImagesLoading}
          pagination={false}
          size="small"
          columns={[
            { title: '服务名称', dataIndex: 'service', key: 'service', render: (s) => <Text strong>{s}</Text> },
            {
              title: '镜像地址',
              dataIndex: 'image',
              key: 'image',
              render: (img) => <Text code style={{ fontSize: 12 }}>{img || '-'}</Text>,
            },
          ]}
          locale={{
            emptyText: <Empty description="版本详情中未包含服务镜像信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Modal>

      {/* Version Detail Drawer */}
      <Drawer
        title={`版本详情: ${versionDetail?.version || ''}`}
        placement="right"
        open={versionDetailOpen}
        onClose={() => {
          setVersionDetailOpen(false);
          setVersionDetail(null);
        }}
        size="large"
        extra={
          versionDetail && (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => {
                setBatchDeployEnv(targetEnvs[0]?.value || '');
                setBatchDeployModalOpen(true);
              }}
            >
              批量发布到环境
            </Button>
          )
        }
      >
        {versionDetailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : versionDetail ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="版本号">
                <Text strong>{versionDetail.version || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{versionDetail.project_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本类型">
                <Tag color="geekblue">{versionDetail.type || 'k8s'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源工作流">
                {versionDetail.workflow_name || '-'}
                {versionDetail.task_id ? <Text type="secondary"> (Task #{versionDetail.task_id})</Text> : null}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {versionDetail.status === 'success' || versionDetail.status === 'passed' ? (
                  <Tag color="success">{versionDetail.status}</Tag>
                ) : (
                  <Tag color="default">{versionDetail.status || '-'}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <Space orientation="horizontal" size={4} wrap>
                  {versionDetail.labels?.length
                    ? versionDetail.labels.map((l) => <Tag key={l} color="orange">{l}</Tag>)
                    : '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{versionDetail.desc || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建">
                {versionDetail.created_at
                  ? `${new Date(Number(versionDetail.created_at) * 1000).toLocaleString()} · ${versionDetail.created_by || '-'}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Helm Chart 清单 */}
            {versionDetail.services && versionDetail.services.some((s) => s.chart_name) && (
              <div style={{ marginTop: 20 }}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  Chart 清单 ({versionDetail.services.filter((s) => s.chart_name).length})
                </Title>
                <Table
                  dataSource={versionDetail.services.filter((s) => s.chart_name)}
                  rowKey="service_name"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '服务名',
                      dataIndex: 'service_name',
                      key: 'service_name',
                      render: (s) => <Text strong>{s}</Text>,
                    },
                    {
                      title: 'Chart 包名',
                      dataIndex: 'chart_name',
                      key: 'chart_name',
                    },
                    {
                      title: '版本号',
                      dataIndex: 'chart_version',
                      key: 'chart_version',
                      render: (v) => <Tag color="blue">{v}</Tag>,
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 100,
                      render: (_, svc) => (
                        <Button
                          type="link"
                          size="small"
                          icon={<CloudDownloadOutlined />}
                          onClick={() => {
                            if (versionDetail.project_name && versionDetail.version && svc.chart_name) {
                              deliveryApi.downloadDeliveryChart(
                                versionDetail.project_name,
                                versionDetail.version,
                                svc.chart_name
                              );
                            }
                          }}
                        >
                          下载
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              服务镜像清单 ({versionDetailImages.length})
            </Title>
            <Table
              dataSource={versionDetailImages}
              rowKey="key"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              columns={[
                { title: '服务名称', dataIndex: 'service', key: 'service', render: (s) => <Text strong>{s}</Text> },
                {
                  title: '组件名称',
                  dataIndex: 'serviceModule',
                  key: 'serviceModule',
                  render: (m) => <Tag color="blue">{m}</Tag>,
                },
                {
                  title: '镜像地址',
                  dataIndex: 'image',
                  key: 'image',
                  render: (img) => <Text code style={{ fontSize: 12 }}>{img || '-'}</Text>,
                },
                {
                  title: '分发日志',
                  key: 'action',
                  width: 110,
                  render: (_, row) => (
                    <Button
                      type="link"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        if (!versionDetail) return;
                        setDistLogDrawer({
                          open: true,
                          projectName: versionDetail.project_name,
                          version: versionDetail.version,
                          serviceName: row.service,
                          serviceModule: row.serviceModule,
                        });
                      }}
                    >
                      分发日志
                    </Button>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="版本未包含服务镜像信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到版本详情" />
        )}
      </Drawer>

      {/* Delivery Distribution Log Drawer */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: '#0066ff' }} />
            <span>分发日志: {distLogDrawer.serviceName} ({distLogDrawer.serviceModule})</span>
            <Tag color="processing">实时日志流</Tag>
          </Space>
        }
        open={distLogDrawer.open}
        onClose={() => setDistLogDrawer((prev) => ({ ...prev, open: false }))}
        size="large"
      >
        {distLogDrawer.open && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                项目: <Text strong>{distLogDrawer.projectName}</Text> · 版本: <Text strong>{distLogDrawer.version}</Text> · 组件: <Text strong>{distLogDrawer.serviceModule}</Text>
              </Text>
            </div>
            <LogViewer
              streamUrl={`/api/aslan/logs/sse/delivery/500?projectName=${encodeURIComponent(distLogDrawer.projectName)}&version=${encodeURIComponent(distLogDrawer.version)}&serviceName=${encodeURIComponent(distLogDrawer.serviceName)}&serviceModule=${encodeURIComponent(distLogDrawer.serviceModule)}`}
              height="calc(100vh - 180px)"
            />
          </div>
        )}
      </Drawer>

      {/* Create Release Modal */}
      <Modal
        title="创建新发布版本 (New Release)"
        open={createModalVisible}
        onOk={handleCreateRelease}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={creatingRelease}
        okText="创建版本"
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="product_name"
            label="目标项目"
            rules={[{ required: true, message: '请选择归属项目' }]}
            initialValue={projects[0]?.name}
          >
            <Select
              placeholder="选择关联项目"
              options={projects.map((p) => ({ value: p.name, label: p.name }))}
            />
          </Form.Item>

          <Form.Item
            name="version"
            label="发布版本号 (Semantic Version)"
            rules={[
              { required: true, message: '请输入版本号' },
              { pattern: /^v?[0-9.]+/, message: '建议采用类似 v1.0.0 规范格式' },
            ]}
          >
            <Input placeholder="例如: v1.3.0 或 2026.09.20-release" />
          </Form.Item>

          <Form.Item name="desc" label="版本变更描述">
            <TextArea rows={2} placeholder="简述本次发布的特性功能或 Bug 修复" />
          </Form.Item>

          <Divider style={{ margin: '16px 0 12px 0' }}>服务镜像版本快照 (Service Snapshot)</Divider>

          <Form.List name="services">
            {(fields, { add, remove }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle">
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'service_name']}
                        rules={[{ required: true, message: '请输入服务名' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="服务名称 (如 order-api)" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'image']}
                        rules={[{ required: true, message: '请输入镜像' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="镜像地址 (如 repo/image:v1.0)" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ service_name: '', image: '' })}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginTop: 6 }}
                >
                  添加服务镜像快照
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Batch Deploy to Environment Modal */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#1677ff' }} />
            <span>批量交付版本部署: {versionDetail?.version}</span>
          </Space>
        }
        open={batchDeployModalOpen}
        onOk={handleBatchDeploy}
        onCancel={() => setBatchDeployModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <div style={{ margin: '16px 0 20px 0' }}>
          <Text type="secondary">
            将把发布版本 <strong>{versionDetail?.version}</strong> 中包含的全部服务镜像（共 {versionDetailImages.length} 个服务模块）批量分发部署至目标集群环境。
          </Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            选择发布目标环境:
          </Text>
          <Select
            placeholder="请选择目标环境"
            value={batchDeployEnv}
            onChange={(val) => setBatchDeployEnv(val)}
            options={targetEnvs}
            style={{ width: '100%' }}
            notFoundContent="当前项目下暂无可用环境"
          />
        </div>
      </Modal>

      {/* Create Helm Release Modal */}
      <CreateHelmReleaseModal
        open={createHelmModalVisible}
        onClose={() => setCreateHelmModalVisible(false)}
        onSuccess={fetchData}
        initialProjectName={projects[0]?.name}
      />

      {/* Download Chart Selection Modal */}
      <Modal
        title={`选择要下载的 Helm Chart (${downloadChartOptions?.version || ''})`}
        open={downloadChartModalVisible}
        onCancel={() => {
          setDownloadChartModalVisible(false);
          setDownloadChartOptions(null);
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">该版本包含多个 Helm Chart 组件包，请选择需要下载导出的 Chart：</Text>
        </div>
        <Table
          dataSource={downloadChartOptions?.charts.map((c) => ({ chartName: c })) || []}
          rowKey="chartName"
          size="small"
          pagination={false}
          columns={[
            {
              title: 'Chart 名称',
              dataIndex: 'chartName',
              key: 'chartName',
              render: (name) => <Text strong>{name}</Text>,
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_, item) => (
                <Button
                  type="primary"
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  onClick={() => {
                    if (downloadChartOptions) {
                      deliveryApi.downloadDeliveryChart(
                        downloadChartOptions.projectName,
                        downloadChartOptions.version,
                        item.chartName
                      );
                    }
                  }}
                >
                  下载
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default DeliveryPage;
