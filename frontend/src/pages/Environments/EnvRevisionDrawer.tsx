import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Tabs,
  Card,
  Tag,
  Button,
  Space,
  Typography,
  Badge,
  Alert,
  Spin,
  Modal,
  InputNumber,
  App,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  EyeOutlined,
  RollbackOutlined,
  ReloadOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CameraOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import MonacoEditor from '@monaco-editor/react';
import environmentApi, {
  EnvProductRevision,
  EnvSvcRevision,
  EnvServiceVersionYaml,
} from '../../api/environment';

const { Text } = Typography;

export interface EnvRevisionDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  production?: boolean;
  onSuccess?: () => void;
}

export const EnvRevisionDrawer: React.FC<EnvRevisionDrawerProps> = ({
  open,
  onClose,
  projectName,
  envName,
  production = false,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'revisions' | 'snaps'>('revisions');
  const [revisions, setRevisions] = useState<EnvProductRevision[]>([]);
  const [snaps, setSnaps] = useState<EnvProductRevision[]>([]);

  // YAML Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailService, setDetailService] = useState<string>('');
  const [detailRevision, setDetailRevision] = useState<number>(0);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [activeYamlKey, setActiveYamlKey] = useState<'rendered' | 'variable'>('rendered');
  const [versionYamlData, setVersionYamlData] = useState<EnvServiceVersionYaml | null>(null);

  // Rollback state
  const [rollbackModalOpen, setRollbackModalOpen] = useState<boolean>(false);
  const [rollbackService, setRollbackService] = useState<string>('');
  const [rollbackCurrentRev, setRollbackCurrentRev] = useState<number>(1);
  const [targetRevision, setTargetRevision] = useState<number>(1);
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);

  const fetchRevisionData = useCallback(async () => {
    if (!projectName || !envName) return;
    setLoading(true);
    try {
      const [revRes, snapRes] = await Promise.all([
        environmentApi.getProductsRevision(projectName, envName, production),
        environmentApi.getProductsRevisionSnaps(projectName, envName, production),
      ]);
      setRevisions(revRes);
      setSnaps(snapRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取环境版本记录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectName, envName, production, message]);

  useEffect(() => {
    if (open) {
      fetchRevisionData();
    } else {
      setRevisions([]);
      setSnaps([]);
    }
  }, [open, fetchRevisionData]);

  // View YAML handler
  const handleViewYaml = async (serviceName: string, rev: number) => {
    setDetailService(serviceName);
    setDetailRevision(rev);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await environmentApi.getServiceVersionYaml(
        projectName,
        envName,
        serviceName,
        rev,
        false,
        production
      );
      setVersionYamlData(res);
      setYamlContent(res.yaml || '# 暂无渲染配置 YAML');
    } catch {
      setVersionYamlData(null);
      setYamlContent('# 加载 YAML 详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Rollback Modal
  const handleOpenRollback = (serviceName: string, currentRev: number) => {
    setRollbackService(serviceName);
    setRollbackCurrentRev(currentRev);
    setTargetRevision(Math.max(1, currentRev - 1));
    setRollbackModalOpen(true);
  };

  // Execute Rollback
  const handleExecuteRollback = async () => {
    if (!targetRevision || targetRevision <= 0) {
      message.error('请输入有效的回滚目标版本号');
      return;
    }
    setRollbackLoading(true);
    try {
      await environmentApi.rollbackServiceVersion(
        projectName,
        envName,
        rollbackService,
        targetRevision,
        '',
        false,
        production
      );
      message.success(`服务 [${rollbackService}] 已成功发起回滚至版本 #${targetRevision}`);
      setRollbackModalOpen(false);
      fetchRevisionData();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '回滚失败，请检查服务状态';
      message.error(msg);
    } finally {
      setRollbackLoading(false);
    }
  };

  const currentProdRev = revisions.find((r) => r.env_name === envName) || revisions[0];
  const serviceList: EnvSvcRevision[] = currentProdRev?.services || [];

  const serviceColumns: ColumnsType<EnvSvcRevision> = [
    {
      title: '服务名称',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (text, record) => (
        <Space>
          <DeploymentUnitOutlined style={{ color: '#0066ff' }} />
          <Text strong>{text}</Text>
          {record.new && <Tag color="green">新服务</Tag>}
          {record.deleted && <Tag color="red">已下线</Tag>}
        </Space>
      ),
    },
    {
      title: '服务类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t) => <Tag color={t === 'helm' ? 'purple' : 'geekblue'}>{t || 'k8s'}</Tag>,
    },
    {
      title: '当前版本',
      dataIndex: 'current_revision',
      key: 'current_revision',
      width: 110,
      render: (rev) => <Tag color="blue">#{rev ?? '-'}</Tag>,
    },
    {
      title: '更新后版本',
      dataIndex: 'next_revision',
      key: 'next_revision',
      width: 110,
      render: (rev) => <Tag color="cyan">#{rev ?? '-'}</Tag>,
    },
    {
      title: '更新状态',
      dataIndex: 'updatable',
      key: 'updatable',
      width: 110,
      render: (updatable) =>
        updatable ? (
          <Badge status="processing" text="有新版本" />
        ) : (
          <Badge status="success" text="已是最新" />
        ),
    },
    {
      title: '部署策略',
      dataIndex: 'deploy_strategy',
      key: 'deploy_strategy',
      width: 110,
      render: (strategy) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {strategy || 'deploy'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewYaml(record.service_name, record.current_revision)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<RollbackOutlined />}
            disabled={record.current_revision <= 1}
            onClick={() => handleOpenRollback(record.service_name, record.current_revision)}
          >
            回滚
          </Button>
        </Space>
      ),
    },
  ];

  const snapColumns: ColumnsType<EnvProductRevision> = [
    {
      title: '环境名称',
      dataIndex: 'env_name',
      key: 'env_name',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '当前版本',
      dataIndex: 'current_revision',
      key: 'current_revision',
      render: (rev) => <Tag color="blue">#{rev ?? 0}</Tag>,
    },
    {
      title: '包含服务数量',
      key: 'service_count',
      render: (_, record) => (
        <Badge count={record.services?.length || 0} showZero color="#108ee9" />
      ),
    },
    {
      title: '服务清单',
      key: 'services',
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {(record.services || []).map((s) => (
            <Tag key={s.service_name}>
              {s.service_name} (#{s.current_revision})
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#0066ff' }} />
            <span>环境版本与快照记录: {envName}</span>
          </Space>
        }
        open={open}
        onClose={onClose}
        destroyOnHidden
        size={860}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchRevisionData} loading={loading}>
            刷新
          </Button>
        }
      >
        <Spin spinning={loading}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Environment Revision Header Banner */}
            <Card
              variant="borderless"
              style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
            >
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="当前环境">
                  <Text strong>{envName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="环境当前 Revision">
                  <Tag color="blue">#{currentProdRev?.current_revision ?? 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="环境最新 Revision">
                  <Tag color="cyan">#{currentProdRev?.next_revision ?? 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="归属项目">
                  <Text>{projectName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="环境更新就绪">
                  {currentProdRev?.updatable ? (
                    <Tag color="warning" icon={<SyncOutlined spin />}>
                      存在待更新服务
                    </Tag>
                  ) : (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      所有服务已对齐最新配置
                    </Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs
              activeKey={activeTab}
              onChange={(k) => setActiveTab(k as 'revisions' | 'snaps')}
              items={[
                {
                  key: 'revisions',
                  label: (
                    <Space>
                      <ClusterOutlined />
                      <span>服务版本清单 ({serviceList.length})</span>
                    </Space>
                  ),
                  children: (
                    <Table
                      rowKey="service_name"
                      columns={serviceColumns}
                      dataSource={serviceList}
                      pagination={false}
                      size="middle"
                    />
                  ),
                },
                {
                  key: 'snaps',
                  label: (
                    <Space>
                      <CameraOutlined />
                      <span>版本快照记录 ({snaps.length})</span>
                    </Space>
                  ),
                  children: (
                    <Table
                      rowKey={(r, idx) => r.id || `${r.env_name}-${idx}`}
                      columns={snapColumns}
                      dataSource={snaps}
                      pagination={{ pageSize: 5 }}
                      size="middle"
                    />
                  ),
                },
              ]}
            />
          </div>
        </Spin>
      </Drawer>

      {/* Service Revision YAML Details Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#0066ff' }} />
            <span>
              服务配置详情: {detailService} (版本 #{detailRevision})
            </span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        destroyOnHidden
        width={780}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <Spin spinning={detailLoading}>
          <Tabs
            activeKey={activeYamlKey}
            onChange={(k) => {
              const tab = k as 'rendered' | 'variable';
              setActiveYamlKey(tab);
              if (tab === 'rendered') {
                setYamlContent(versionYamlData?.yaml || '# 暂无渲染后 YAML');
              } else {
                setYamlContent(versionYamlData?.variable_yaml || '# 暂无环境变量配置 YAML');
              }
            }}
            items={[
              { key: 'rendered', label: '渲染后部署 YAML (Rendered)' },
              { key: 'variable', label: '环境变量与参数 YAML (Variable)' },
            ]}
          />
          <div
            style={{
              marginTop: 12,
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <MonacoEditor
              height="440px"
              language="yaml"
              theme="light"
              value={yamlContent}
              options={{ readOnly: true, minimap: { enabled: false } }}
              loading={<ReloadOutlined spin />}
            />
          </div>
        </Spin>
      </Modal>

      {/* Service Rollback Modal */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#fa8c16' }} />
            <span>回滚服务版本: {rollbackService}</span>
          </Space>
        }
        open={rollbackModalOpen}
        onCancel={() => setRollbackModalOpen(false)}
        destroyOnHidden
        confirmLoading={rollbackLoading}
        onOk={handleExecuteRollback}
        okText="确认回滚"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <Alert
            type="warning"
            showIcon
            title="版本回滚确认"
            description={`回滚操作将重置服务 [${rollbackService}] 至指定的历史版本配置并重新部署，请确认目标版本是否可用。`}
          />

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              当前运行版本:
            </Text>
            <Tag color="blue">#{rollbackCurrentRev}</Tag>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              回滚目标版本 (Revision):
            </Text>
            <InputNumber
              min={1}
              max={Math.max(1, rollbackCurrentRev - 1)}
              value={targetRevision}
              onChange={(v) => setTargetRevision(v || 1)}
              style={{ width: '100%' }}
              placeholder="请输入目标版本号"
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EnvRevisionDrawer;
