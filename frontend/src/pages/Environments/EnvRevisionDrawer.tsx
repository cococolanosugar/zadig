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
  App,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  EyeOutlined,
  ReloadOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  SyncOutlined,
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
}) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState<boolean>(false);
  const [revisions, setRevisions] = useState<EnvProductRevision[]>([]);

  // YAML Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailService, setDetailService] = useState<string>('');
  const [detailRevision, setDetailRevision] = useState<number>(0);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [activeYamlKey, setActiveYamlKey] = useState<'rendered' | 'variable'>('rendered');
  const [versionYamlData, setVersionYamlData] = useState<EnvServiceVersionYaml | null>(null);

  const fetchRevisionData = useCallback(async () => {
    if (!projectName || !envName) return;
    setLoading(true);
    try {
      // CC-Loop02 P0-6: 仅使用项目鉴权的 getProductsRevision，禁止 cron 内部 snaps 接口
      const revRes = await environmentApi.getProductsRevision(projectName, envName, production);
      setRevisions(revRes);
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
    }
  }, [open, fetchRevisionData]);

  // View YAML handler — isHelmChart 按服务类型动态判断
  const handleViewYaml = async (serviceName: string, rev: number, serviceType?: string) => {
    setDetailService(serviceName);
    setDetailRevision(rev);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      // CC-Loop02 P0-6 / P0-5: 禁止硬编码 false，仅 helm_chart 为 true
      const isHelmChart = serviceType === 'helm_chart';
      const res = await environmentApi.getServiceVersionYaml(
        projectName,
        envName,
        serviceName,
        rev,
        isHelmChart,
        production
      );
      setVersionYamlData(res);
      setYamlContent(res.yaml || res.variable_yaml || '# 暂无渲染配置 YAML');
    } catch {
      setVersionYamlData(null);
      setYamlContent('# 加载 YAML 详情失败');
    } finally {
      setDetailLoading(false);
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
      width: 120,
      render: (t) => (
        <Tag color={t === 'helm_chart' || t === 'helm' ? 'purple' : 'geekblue'}>{t || 'k8s'}</Tag>
      ),
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
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() =>
            handleViewYaml(record.service_name, record.current_revision, record.type)
          }
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#0066ff' }} />
            <span>环境服务版本清单: {envName}</span>
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
            {/* CC-Loop02 P0-6: 引导通过服务版本历史安全回滚 */}
            <Alert
              type="info"
              showIcon
              title="安全回滚说明"
              description="本抽屉仅展示各服务当前/待更新版本。如需回滚，请到对应服务的「版本历史」抽屉中选择历史 revision 执行安全回滚，勿使用未鉴权的内部快照接口。"
            />

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
    </>
  );
};

export default EnvRevisionDrawer;
