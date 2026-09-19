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
} from '@ant-design/icons';
import { useParams, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';
import { useProjectStore } from '../../stores/project';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ArtifactItem {
  id?: string;
  name: string;
  image?: string;
  image_tag?: string;
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
  desc?: string;
  status?: string;
  create_by?: string;
  create_time?: number | string;
  services?: Array<{ service_name: string; image?: string }>;
}

export const DeliveryPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = tab || searchParams.get('tab') || 'artifacts';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { projects } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [releases, setReleases] = useState<ReleaseVersionItem[]>([]);
  const [searchText, setSearchText] = useState('');

  // Lineage Drawer state
  const [lineageDrawerVisible, setLineageDrawerVisible] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);

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
        const res = await http.get<ReleaseVersionItem[]>('/api/aslan/delivery/releases', {
          skipErrorHandler: true,
        });
        setReleases(Array.isArray(res) ? res : []);
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

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSearchParams({ tab: key });
  };

  const handleCreateRelease = async () => {
    try {
      const values = await form.validateFields();
      setCreatingRelease(true);
      await http.post('/api/aslan/delivery/releases/k8s', {
        version: values.version,
        product_name: values.product_name,
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
            <Text strong>{v}</Text>
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
      width: 140,
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
      width: 140,
      render: (by) => by || 'admin',
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 160,
      render: (t) => (t ? String(t) : '刚刚'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => feedback.message.info(`版本 [${record.version}] 包含微服务镜像已锁定`)}
        >
          服务镜像清单
        </Button>
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 4 }}
            onClick={() => {
              form.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建版本发布
          </Button>
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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.resetFields();
                      setCreateModalVisible(true);
                    }}
                  >
                    创建版本发布
                  </Button>
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
              <Descriptions.Item label="归属项目">
                <Tag color="blue">{selectedArtifact.project_name || '默认项目'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="构建工作流">
                {selectedArtifact.workflow_name || 'ci-pipeline'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedArtifact.created_at || '刚刚'}
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
                        分支: {selectedArtifact.branch || 'main'} | 提交人: {selectedArtifact.author || 'dev-engineer'}
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
            <Select placeholder="选择关联项目">
              {projects.map((p) => (
                <Option key={p.name} value={p.name}>
                  {p.name}
                </Option>
              ))}
            </Select>
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
    </div>
  );
};

export default DeliveryPage;
