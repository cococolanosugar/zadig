import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Badge,
  Alert,
  Spin,
  Empty,
} from 'antd';
import {
  ApartmentOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import http from '../../api/client';

const { Title, Text } = Typography;

export interface EnvironmentSummary {
  name: string;
  alias?: string;
  namespace?: string;
  cluster_name?: string;
  share_env_enable?: boolean;
  share_env_is_base?: boolean;
  share_env_base_env?: string;
  status?: string;
  services?: Array<{ service_name: string; type?: string; status?: string }>;
}

export interface CollaborationTopologyDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  environments: Array<{
    name: string;
    alias?: string;
    namespace?: string;
    cluster_name?: string;
    share_env_enable?: boolean;
    share_env_is_base?: boolean;
    share_env_base_env?: string;
    status?: string;
  }>;
  onConfigureShareEnv?: (envName: string, mode: 'enable' | 'disable') => void;
}

export const CollaborationTopologyDrawer: React.FC<CollaborationTopologyDrawerProps> = ({
  open,
  onClose,
  projectName,
  environments,
  onConfigureShareEnv,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [envServicesMap, setEnvServicesMap] = useState<Record<string, string[]>>({});

  // 区分基准环境与子环境
  const baseEnvs = environments.filter((e) => e.share_env_is_base);
  const defaultBase = baseEnvs[0] || environments[0];
  const [selectedBaseEnv, setSelectedBaseEnv] = useState<string>(defaultBase?.name || '');

  const subEnvs = environments.filter(
    (e) => e.share_env_enable && !e.share_env_is_base && (!selectedBaseEnv || e.share_env_base_env === selectedBaseEnv)
  );

  // 加载各环境下的服务列表
  const fetchEnvServices = useCallback(async () => {
    if (!projectName || environments.length === 0) return;
    setLoading(true);
    try {
      const results: Record<string, string[]> = {};
      const envNamesToFetch = [selectedBaseEnv, ...subEnvs.map((s) => s.name)].filter(Boolean);

      await Promise.all(
        envNamesToFetch.map(async (envName) => {
          try {
            const res = await http.get<Array<{ service_name: string }>>(
              `/api/aslan/environment/environments/${encodeURIComponent(envName)}/services?projectName=${encodeURIComponent(projectName)}`,
              { skipErrorHandler: true }
            );
            results[envName] = Array.isArray(res) ? res.map((s) => s.service_name) : [];
          } catch {
            results[envName] = [];
          }
        })
      );
      setEnvServicesMap(results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectName, environments, selectedBaseEnv, subEnvs]);

  useEffect(() => {
    if (open) {
      if (defaultBase && !selectedBaseEnv) {
        setSelectedBaseEnv(defaultBase.name);
      }
      fetchEnvServices();
    }
  }, [open, defaultBase, selectedBaseEnv, fetchEnvServices]);

  const envDetailPath = (envName: string) =>
    `/v1/projects/detail/${projectName}/envs?envName=${encodeURIComponent(envName)}`;

  const baseServices = envServicesMap[selectedBaseEnv] || [];

  return (
    <Drawer
      title={
        <Space orientation="horizontal" size={8}>
          <ApartmentOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            自测模式环境拓扑 (ShareEnv Istio 流量路由)
          </Title>
        </Space>
      }
      open={open}
      onClose={onClose}
      size="large"
      style={{ minWidth: 920 }}
      extra={
        <Space orientation="horizontal">
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchEnvServices}>
            刷新拓扑
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Description Alert */}
          <Alert
            title="自测模式环境拓扑说明"
            description={
              <div>
                在 ShareEnv 自测模式下，每个开发者可拉起仅包含受测服务的轻量级<strong>「子环境」</strong>。
                基于服务清单与流量 Header (<code>x-env</code>)，Istio VirtualService 将未覆盖服务的请求回落至
                <strong>「基准环境 (Base)」</strong>公共链路；「独占」指子环境本地覆盖部署的服务，「回落」指走基准环境路由解析。
              </div>
            }
            type="info"
            showIcon
          />

          {/* Base Environment Card */}
          <Card
            variant="borderless"
            style={{
              backgroundColor: '#fafafa',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
            title={
              <Space orientation="horizontal" size={10}>
                <DeploymentUnitOutlined style={{ color: '#faad14', fontSize: 18 }} />
                <span>
                  基准环境 (Base Environment):{' '}
                  <strong style={{ color: '#1f2d3d' }}>{selectedBaseEnv || '未指定'}</strong>
                </span>
                <Tag color="gold">公共基础环境</Tag>
              </Space>
            }
            extra={
              <Space orientation="horizontal">
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(envDetailPath(selectedBaseEnv))}
                >
                  进入基准环境
                </Button>
                {onConfigureShareEnv && (
                  <Button
                    size="small"
                    onClick={() => onConfigureShareEnv(selectedBaseEnv, 'disable')}
                  >
                    调整自测协作模式
                  </Button>
                )}
              </Space>
            }
          >
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                公共兜底服务列表 (共 {baseServices.length} 个服务组件，提供全量链路回落):
              </Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {baseServices.length > 0 ? (
                baseServices.map((svc) => (
                  <Tag
                    key={svc}
                    color="blue"
                    style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
                  >
                    {svc}
                  </Tag>
                ))
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  暂无服务数据或服务正在初始化
                </Text>
              )}
            </div>
          </Card>

          {/* Sub Environments Topology Nodes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, fontSize: 14 }}>
                关联子环境拓扑分支 (共 {subEnvs.length} 个活跃子环境)
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                流量规则: HTTP Header <code>x-env: &lt;子环境名称&gt;</code>
              </Text>
            </div>

            {subEnvs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前基准环境下暂无接入的协作子环境"
              >
                {onConfigureShareEnv && (
                  <Button
                    type="primary"
                    icon={<ShareAltOutlined />}
                    onClick={() => onConfigureShareEnv(selectedBaseEnv, 'enable')}
                  >
                    为基准环境开启协作自测模式
                  </Button>
                )}
              </Empty>
            ) : (
              <Row gutter={[16, 16]}>
                {subEnvs.map((sub) => {
                  const subServices = envServicesMap[sub.name] || [];
                  const privateServices = subServices;
                  const sharedFallbackServices = baseServices.filter((s) => !subServices.includes(s));

                  return (
                    <Col span={24} key={sub.name}>
                      <Card
                        variant="borderless"
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 8,
                          borderLeft: '4px solid #1677ff',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        }}
                        styles={{ body: { padding: 16 } }}
                      >
                        <Row gutter={16} align="middle">
                          {/* Sub Env Meta */}
                          <Col xs={24} sm={8}>
                            <Space orientation="vertical" size={4}>
                              <Space orientation="horizontal" size={6}>
                                <Badge status="processing" color="#52c41a" />
                                <Text strong style={{ fontSize: 15 }}>
                                  {sub.name}
                                </Text>
                                {sub.alias && <Text type="secondary">({sub.alias})</Text>}
                              </Space>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                命名空间: {sub.namespace || sub.name} · 集群: {sub.cluster_name || '默认'}
                              </div>
                              <Space size={6} style={{ marginTop: 6 }}>
                                <Button
                                  size="small"
                                  type="primary"
                                  ghost
                                  onClick={() => navigate(envDetailPath(sub.name))}
                                >
                                  进入环境
                                </Button>
                              </Space>
                            </Space>
                          </Col>

                          {/* Private & Shared Service Mapping */}
                          <Col xs={24} sm={16}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Private overrides */}
                              <div>
                                <span style={{ fontSize: 12, color: '#52c41a', fontWeight: 600, marginRight: 8 }}>
                                  [独占覆盖] 子环境本地服务 ({privateServices.length}):
                                </span>
                                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {privateServices.length > 0 ? (
                                    privateServices.map((svc) => (
                                      <Tag key={svc} color="success" style={{ borderRadius: 3 }}>
                                        {svc} (专用)
                                      </Tag>
                                    ))
                                  ) : (
                                    <Tag color="default">无专属变更服务</Tag>
                                  )}
                                </div>
                              </div>

                              {/* Fallback to base */}
                              <div>
                                <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500, marginRight: 8 }}>
                                  [回落] 经 x-env 路由至基准环境 ({sharedFallbackServices.length}):
                                </span>
                                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {sharedFallbackServices.slice(0, 8).map((svc) => (
                                    <Tag key={svc} style={{ borderRadius: 3, opacity: 0.75 }}>
                                      {svc}
                                    </Tag>
                                  ))}
                                  {sharedFallbackServices.length > 8 && (
                                    <Tag style={{ borderRadius: 3 }}>+{sharedFallbackServices.length - 8} 更多回落</Tag>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        </div>
      </Spin>
    </Drawer>
  );
};

export default CollaborationTopologyDrawer;
