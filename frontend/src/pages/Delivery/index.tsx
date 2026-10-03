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
} from 'antd';
import {
  HistoryOutlined,
  SearchOutlined,
  PlusOutlined,
  DropboxOutlined,
  BranchesOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  ReloadOutlined,
  DownOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { useProjectStore } from '../../stores/project';
import { deliveryApi, DeliveryVersionItem } from '../../api/delivery';
import CreateHelmReleaseModal from './CreateHelmReleaseModal';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ArtifactItem {
  id?: string;
  name: string;
  image?: string;
  image_tag?: string;
  image_digest?: string;
  project_name?: string;
  workflow_name?: string;
  size?: string;
  created_at?: string;
  commit_id?: string;
  branch?: string;
  author?: string;
}

interface ReleaseVersionItem {
  id?: string;
  version: string;
  product_name: string;
  created_at?: string | number;
  create_by?: string;
  desc?: string;
  status?: string;
  type?: 'k8s' | 'helm' | string;
  services?: Array<{ service_name: string; chart_name?: string; chart_version?: string; image?: string }>;
}

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
    } catch {
      setServiceImages([]);
    } finally {
      setServiceImagesLoading(false);
    }
  };

  // Version detail drawer state (GET /api/aslan/delivery/releases/:id?projectName=)
  const [versionDetailOpen, setVersionDetailOpen] = useState(false);
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [versionDetail, setVersionDetail] = useState<DeliveryVersionItem | null>(null);
  const [versionDetailImages, setVersionDetailImages] = useState<Array<{ service: string; image: string }>>([]);

  const openVersionDetail = async (record: ReleaseVersionItem) => {
    setVersionDetailOpen(true);
    setVersionDetailLoading(true);
    setVersionDetail(null);
    setVersionDetailImages([]);
    try {
      const proj = record.product_name;
      const res = await deliveryApi.getDeliveryVersion(record.id || '', proj);
      setVersionDetail(res || null);
      const list: Array<{ service: string; image: string }> = [];
      (res?.services || []).forEach((svc) => {
        (svc.images || []).forEach((img) => {
          list.push({ service: svc.service_name, image: img.target_image || img.source_image || img.image_name || '' });
        });
      });
      setVersionDetailImages(list);
    } catch {
      setVersionDetail(null);
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
    } catch {
      if (activeTab === 'artifacts') setArtifacts([]);
      else setReleases([]);
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

  const handleCreateRelease = async () => {
    try {
      const values = await form.validateFields();
      setCreatingRelease(true);
      await deliveryApi.createK8sDeliveryVersion({
        version: values.version,
        project_name: values.product_name,
        desc: values.desc || '',
      });
      feedback.message.success(`版本 [${values.version}] 创建成功！`);
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
          {record.commit_id && (
            <Text type="secondary" code style={{ fontSize: 12 }}>
              commit: {record.commit_id.slice(0, 7)}
            </Text>
          )}
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
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (s) => s || '142 MB',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t) => t || '刚刚',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedArtifact(record);
            setLineageDrawerVisible(true);
          }}
        >
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
        return <Badge status="processing" text="已就绪" />;
      },
    },
    {
      title: '创建人',
      dataIndex: 'create_by',
      key: 'create_by',
      width: 120,
      render: (by) => by || 'admin',
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 160,
      render: (t) => {
        if (!t) return '刚刚';
        const num = Number(t);
        if (!isNaN(num) && num > 0) {
          const date = num > 1e11 ? new Date(num) : new Date(num * 1000);
          return date.toLocaleString();
        }
        return String(t);
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleShowServiceImages(record)}>
            镜像清单
          </Button>
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
              <Descriptions.Item label="交付物名称">{selectedArtifact.name}</Descriptions.Item>
              <Descriptions.Item label="镜像">
                <Text code style={{ fontSize: 12 }}>{selectedArtifact.image || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="镜像 Digest">
                <Text code style={{ fontSize: 12 }}>{selectedArtifact.image_digest || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{selectedArtifact.project_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedArtifact.created_at || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 20 }}>
              完整产物上下游流向链条 (End-to-End Lineage Flow)
            </Title>

            <Timeline
              items={[
                {
                  color: 'blue',
                  dot: <BranchesOutlined style={{ fontSize: 16 }} />,
                  children: (
                    <div>
                      <Text strong>1. 代码仓库提交 (Git Commit)</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        分支: {selectedArtifact.branch || '-'} | 提交人: {selectedArtifact.author || '-'}
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  color: 'cyan',
                  dot: <CloudUploadOutlined style={{ fontSize: 16 }} />,
                  children: (
                    <div>
                      <Text strong>2. 容器编译与构建归档 (Pipeline Build)</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        流水线任务完成二进制打包并生成 OCI 规范镜像产物
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  color: 'green',
                  dot: <CheckCircleOutlined style={{ fontSize: 16 }} />,
                  children: (
                    <div>
                      <Text strong>3. 镜像仓库验签分发 (Registry Storage)</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        已推送至企业私有 Harbor 镜像中心并完成 CVE 静态漏洞扫描
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  color: 'purple',
                  dot: <ClusterOutlined style={{ fontSize: 16 }} />,
                  children: (
                    <div>
                      <Text strong>4. 集群环境上线部署 (Workload Deployment)</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        就绪分发至集成测试 (qa) 与预发布环境 Kubernetes 工作负载
                      </Paragraph>
                    </div>
                  ),
                },
              ]}
            />
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
              rowKey="service"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
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
                emptyText: <Empty description="版本未包含服务镜像信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到版本详情" />
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
        width={540}
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
            <TextArea rows={3} placeholder="简述本次发布的特性功能或 Bug 修复" />
          </Form.Item>
        </Form>
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
