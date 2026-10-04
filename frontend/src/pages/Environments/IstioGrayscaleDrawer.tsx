import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Drawer,
  Space,
  Button,
  Radio,
  Slider,
  InputNumber,
  Input,
  Select,
  Table,
  Typography,
  Alert,
  Card,
  Tag,
  Spin,
  Row,
  Col,
  Descriptions,
  Divider,
  Empty,
} from 'antd';
import {
  RocketOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  GlobalOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import environmentApi, {
  EnvironmentItem,
  IstioGrayscaleConfig,
  IstioWeightConfig,
  IstioHeaderMatch,
  IstioHeaderMatchConfig,
  CanaryDeploymentServiceInfo,
  IstioGrayscaleReadyResponse,
} from '../../api/environment';
import { PortalServiceModal } from './PortalServiceModal';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

export interface IstioGrayscaleDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  clusterId?: string;
  namespace?: string;
  isBase?: boolean;
  isGrayscaleEnabled?: boolean;
  environments: EnvironmentItem[];
  availableServices?: string[];
  onSuccess: () => void;
}

export const IstioGrayscaleDrawer: React.FC<IstioGrayscaleDrawerProps> = ({
  open,
  onClose,
  projectName,
  envName,
  clusterId,
  namespace,
  isBase,
  isGrayscaleEnabled,
  environments,
  availableServices = [],
  onSuccess,
}) => {
  // Preflight check for enabling
  const [checkingIstio, setCheckingIstio] = useState<boolean>(false);
  const [istioInstalled, setIstioInstalled] = useState<boolean | null>(null);

  // Ready polling state
  const [processing, setProcessing] = useState<boolean>(false);
  const [readyStatus, setReadyStatus] = useState<IstioGrayscaleReadyResponse | null>(null);
  const [pollError, setPollError] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grayscale configuration state
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [strategy, setStrategy] = useState<'weight' | 'header_match'>('weight');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [headerMatches, setHeaderMatches] = useState<Record<string, IstioHeaderMatch[]>>({});

  // Portal gateway modal
  const [portalModalOpen, setPortalModalOpen] = useState<boolean>(false);

  // Canary services state
  const [loadingCanary, setLoadingCanary] = useState<boolean>(false);
  const [canaryServices, setCanaryServices] = useState<CanaryDeploymentServiceInfo[]>([]);
  const [showCanary, setShowCanary] = useState<boolean>(false);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  // Filter associated gray environments
  const grayEnvs = environments.filter(
    (e) => e.istio_grayscale_base_env === envName && e.name !== envName
  );
  const allRelatedEnvNames = [envName, ...grayEnvs.map((e) => e.name)];

  // Check Istio status on open if not yet enabled
  useEffect(() => {
    if (open && !isGrayscaleEnabled && clusterId) {
      setCheckingIstio(true);
      environmentApi
        .checkClusterIstio(clusterId)
        .then((res) => setIstioInstalled(res))
        .catch(() => setIstioInstalled(false))
        .finally(() => setCheckingIstio(false));
    }
  }, [open, isGrayscaleEnabled, clusterId]);

  // Load Grayscale Config if enabled and isBase
  const loadGrayscaleConfig = useCallback(async () => {
    if (!open || !isGrayscaleEnabled || !isBase) return;
    setLoadingConfig(true);
    try {
      const cfg: IstioGrayscaleConfig = await environmentApi.getIstioGrayscaleConfig(
        projectName,
        envName
      );
      if (cfg) {
        setStrategy(cfg.grayscale_strategy || 'weight');

        // Init weights
        const weightMap: Record<string, number> = {};
        allRelatedEnvNames.forEach((name) => {
          weightMap[name] = 0;
        });
        if (Array.isArray(cfg.weight_configs) && cfg.weight_configs.length > 0) {
          cfg.weight_configs.forEach((w) => {
            weightMap[w.env] = w.weight;
          });
        } else {
          // Default: 100% to base env
          weightMap[envName] = 100;
        }
        setWeights(weightMap);

        // Init header match configs
        const matchMap: Record<string, IstioHeaderMatch[]> = {};
        grayEnvs.forEach((ge) => {
          matchMap[ge.name] = [];
        });
        if (Array.isArray(cfg.header_match_configs)) {
          cfg.header_match_configs.forEach((hmc) => {
            matchMap[hmc.env] = hmc.header_match || [];
          });
        }
        setHeaderMatches(matchMap);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '获取灰度配置失败';
      feedback.message.error(msg);
    } finally {
      setLoadingConfig(false);
    }
  }, [open, isGrayscaleEnabled, isBase, projectName, envName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && isGrayscaleEnabled && isBase) {
      loadGrayscaleConfig();
    }
  }, [open, isGrayscaleEnabled, isBase, loadGrayscaleConfig]);

  // Polling helper
  const pollReadyStatus = useCallback(
    async (targetOp: 'enable' | 'disable', attempts = 0) => {
      if (attempts > 30) {
        setProcessing(false);
        setPollError('等待就绪超时，系统可能仍在后台下发配置，请稍后刷新环境查看');
        return;
      }

      try {
        const res = await environmentApi.checkIstioGrayscaleReady(
          projectName,
          envName,
          targetOp
        );
        setReadyStatus(res);
        if (res.is_ready) {
          setProcessing(false);
          feedback.message.success(
            targetOp === 'enable'
              ? `灰度发布已成功开启，[${envName}] 已设为灰度基准环境！`
              : `灰度发布已成功关闭！`
          );
          onSuccess();
          return;
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (msg) setPollError(msg);
      }

      pollingRef.current = setTimeout(() => {
        pollReadyStatus(targetOp, attempts + 1);
      }, 2000);
    },
    [projectName, envName, onSuccess]
  );

  // Enable grayscale
  const handleEnable = async () => {
    setProcessing(true);
    setPollError('');
    try {
      await environmentApi.enableIstioGrayscale(projectName, envName);
      pollReadyStatus('enable');
    } catch (err: unknown) {
      setProcessing(false);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '开启灰度发布失败';
      setPollError(msg);
      feedback.message.error(msg);
    }
  };

  // Disable grayscale
  const handleDisable = () => {
    feedback.modal?.confirm({
      title: `确认关闭环境 [${envName}] 的灰度发布？`,
      content:
        '关闭后系统将自动删除关联的灰度环境、VirtualService 与 EnvoyFilter 规则，微服务将重启以恢复原始网络架构。此操作不可逆！',
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setProcessing(true);
        setPollError('');
        try {
          await environmentApi.disableIstioGrayscale(projectName, envName);
          pollReadyStatus('disable');
        } catch (err: unknown) {
          setProcessing(false);
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            '关闭灰度发布失败';
          setPollError(msg);
          feedback.message.error(msg);
        }
      },
    });
  };

  // Save Grayscale Config
  const handleSaveConfig = async () => {
    // Validate
    if (strategy === 'weight') {
      const sum = Object.values(weights).reduce((acc, v) => acc + (v || 0), 0);
      if (sum !== 100) {
        feedback.message.error(`权重配置总和必须等于 100%，当前总和为: ${sum}%`);
        return;
      }
    } else if (strategy === 'header_match') {
      for (const [env, rules] of Object.entries(headerMatches)) {
        for (let i = 0; i < rules.length; i++) {
          const r = rules[i];
          if (!r.key || !r.key.trim()) {
            feedback.message.error(`环境 [${env}] 第 ${i + 1} 条规则的 Header 键名不能为空`);
            return;
          }
          if (!r.value || !r.value.trim()) {
            feedback.message.error(`环境 [${env}] 第 ${i + 1} 条规则的匹配值不能为空`);
            return;
          }
        }
      }
    }

    setSavingConfig(true);
    try {
      const weightConfigs: IstioWeightConfig[] = Object.entries(weights).map(([e, w]) => ({
        env: e,
        weight: w || 0,
      }));

      const headerMatchConfigs: IstioHeaderMatchConfig[] = Object.entries(headerMatches).map(
        ([e, hms]) => ({
          env: e,
          header_match: hms,
        })
      );

      await environmentApi.setIstioGrayscaleConfig(projectName, envName, {
        grayscale_strategy: strategy,
        weight_configs: strategy === 'weight' ? weightConfigs : [],
        header_match_configs: strategy === 'header_match' ? headerMatchConfigs : [],
      });

      feedback.message.success('灰度发布规则已成功更新并生效！');
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '保存灰度配置失败';
      feedback.message.error(msg);
    } finally {
      setSavingConfig(false);
    }
  };

  // Canary services fetch
  const handleFetchCanary = async () => {
    if (!clusterId || !namespace) {
      feedback.message.warning('缺少集群 ID 或命名空间信息');
      return;
    }
    setLoadingCanary(true);
    setShowCanary(true);
    try {
      const res = await environmentApi.getCanaryServices(clusterId, namespace);
      setCanaryServices(res || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '获取金丝雀服务候选失败';
      feedback.message.error(msg);
      setCanaryServices([]);
    } finally {
      setLoadingCanary(false);
    }
  };

  // Calculate sum of weights
  const totalWeight = Object.values(weights).reduce((acc, v) => acc + (v || 0), 0);

  // Equalize weights
  const handleEqualizeWeights = () => {
    const count = allRelatedEnvNames.length;
    if (count === 0) return;
    const baseVal = Math.floor(100 / count);
    const remainder = 100 - baseVal * count;
    const newWeights: Record<string, number> = {};
    allRelatedEnvNames.forEach((name, idx) => {
      newWeights[name] = baseVal + (idx === 0 ? remainder : 0);
    });
    setWeights(newWeights);
  };

  // Header Match row operations
  const handleAddHeaderMatch = (targetEnv: string) => {
    setHeaderMatches((prev) => ({
      ...prev,
      [targetEnv]: [
        ...(prev[targetEnv] || []),
        { key: 'x-env', match: 'exact', value: targetEnv },
      ],
    }));
  };

  const handleRemoveHeaderMatch = (targetEnv: string, index: number) => {
    setHeaderMatches((prev) => ({
      ...prev,
      [targetEnv]: (prev[targetEnv] || []).filter((_, i) => i !== index),
    }));
  };

  const handleHeaderMatchChange = <K extends keyof IstioHeaderMatch>(
    targetEnv: string,
    index: number,
    field: K,
    val: IstioHeaderMatch[K]
  ) => {
    setHeaderMatches((prev) => {
      const nextList = [...(prev[targetEnv] || [])];
      nextList[index] = { ...nextList[index], [field]: val };
      return {
        ...prev,
        [targetEnv]: nextList,
      };
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <Space>
          <RocketOutlined style={{ color: '#1677ff' }} />
          <span>Istio 灰度发布管理 - [环境: {envName}]</span>
        </Space>
      }
      size={780}
      extra={
        isGrayscaleEnabled && isBase ? (
          <Space>
            <Button
              icon={<GlobalOutlined />}
              onClick={() => setPortalModalOpen(true)}
            >
              入口网关配置
            </Button>
            <Button danger onClick={handleDisable} disabled={processing}>
              关闭灰度
            </Button>
          </Space>
        ) : null
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Not enabled yet */}
        {!isGrayscaleEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              title="生产环境 Istio 灰度发布能力"
              description="通过注入 Kubernetes 原生 Istio 流量管理组件，支持在生产环境下将基准流量按精确百分比分流至候选灰度微服务，或基于 HTTP Request Header / Cookie 等特征进行精准流量隔离路由。"
              type="info"
              showIcon
            />

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="当前生产环境">
                <Space>
                  <Tag color="gold">生产环境</Tag>
                  <Text strong>{envName}</Text>
                  {namespace && <Text type="secondary">(Namespace: {namespace})</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="集群 Istio 检测状态">
                {checkingIstio ? (
                  <Space>
                    <Spin indicator={<LoadingOutlined spin />} size="small" />
                    <Text type="secondary">正在检测集群 Istio 组件...</Text>
                  </Space>
                ) : istioInstalled === true ? (
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text type="success">集群已安装 Istio，满足开启前置条件</Text>
                  </Space>
                ) : istioInstalled === false ? (
                  <Space>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    <Text type="danger">当前集群未检测到 Istio 组件，无法开启灰度发布</Text>
                  </Space>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              title="服务重启提醒"
              description="开启灰度发布过程中，所属命名空间将打上 istio-injection=enabled 标签并注入 istio-proxy 容器，微服务工作负载会依次平滑滚动更新。"
              type="warning"
              showIcon
            />

            {processing && (
              <div
                style={{
                  padding: '16px',
                  background: '#e6f4ff',
                  borderRadius: 6,
                  border: '1px solid #91caff',
                }}
              >
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Space>
                    <LoadingOutlined style={{ color: '#1677ff' }} spin />
                    <Text strong style={{ color: '#1677ff' }}>
                      正在开启灰度发布并下发 Istio 网格规则，请稍候...
                    </Text>
                  </Space>
                  {readyStatus?.checks && (
                    <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
                      <Descriptions.Item label="Istio 命名空间打标">
                        {readyStatus.checks.namespace_has_istio_label ? (
                          <Tag color="success">已完成</Tag>
                        ) : (
                          <Tag color="processing">配置中</Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="istio-proxy 注入">
                        {readyStatus.checks.pods_have_istio_proxy ? (
                          <Tag color="success">已注入</Tag>
                        ) : (
                          <Tag color="processing">注入中</Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="工作负载状态">
                        {readyStatus.checks.workloads_ready ? (
                          <Tag color="success">已就绪</Tag>
                        ) : (
                          <Tag color="processing">滚动更新中</Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                </Space>
              </div>
            )}

            {pollError && (
              <Alert title="提示" description={pollError} type="warning" showIcon />
            )}

            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleEnable}
              loading={processing}
              disabled={checkingIstio || istioInstalled === false}
              size="large"
              style={{ alignSelf: 'flex-start' }}
            >
              立即开启灰度发布
            </Button>
          </div>
        ) : (
          /* Enabled Grayscale Config Management */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card
              variant="borderless"
              styles={{ body: { padding: '16px' } }}
              style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <Text strong style={{ fontSize: 15 }}>
                      当前环境为【灰度基准环境】
                    </Text>
                    <Tag color="cyan">关联灰度环境: {grayEnvs.length} 个</Tag>
                  </Space>
                </Col>
              </Row>
            </Card>

            <Spin spinning={loadingConfig}>
              {/* Grayscale Strategy Switcher */}
              <Card
                title="灰度发布路由策略"
                variant="borderless"
                styles={{ body: { padding: '16px' } }}
                style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Radio.Group
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="weight">基于流量权重 (Weight)</Radio.Button>
                    <Radio.Button value="header_match">基于请求头匹配 (Header Match)</Radio.Button>
                  </Radio.Group>
                </div>

                {/* Weight Strategy UI */}
                {strategy === 'weight' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Paragraph type="secondary" style={{ margin: 0 }}>
                        配置各环境接收外部及服务间网格流量的百分比。所有环境权重之和必须等于 100%。
                      </Paragraph>
                      <Button size="small" onClick={handleEqualizeWeights}>
                        一键均分权重
                      </Button>
                    </div>

                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 6,
                        background: totalWeight === 100 ? '#f6ffed' : '#fffbe6',
                        border: totalWeight === 100 ? '1px solid #b7eb8f' : '1px solid #ffe58f',
                      }}
                    >
                      <Space>
                        <Text strong>当前权重总和：</Text>
                        <Tag color={totalWeight === 100 ? 'success' : 'warning'} style={{ fontSize: 14 }}>
                          {totalWeight}%
                        </Tag>
                        {totalWeight !== 100 && (
                          <Text type="warning" style={{ fontSize: 13 }}>
                            (需要调整至 100% 才能保存)
                          </Text>
                        )}
                      </Space>
                    </div>

                    {allRelatedEnvNames.map((name) => {
                      const isThisBase = name === envName;
                      const val = weights[name] || 0;
                      return (
                        <div
                          key={name}
                          style={{
                            padding: '12px 16px',
                            background: '#fafafa',
                            borderRadius: 6,
                            border: '1px solid #f0f0f0',
                          }}
                        >
                          <Row align="middle" gutter={16}>
                            <Col span={6}>
                              <Space>
                                <Text strong>{name}</Text>
                                {isThisBase ? (
                                  <Tag color="purple">基准环境</Tag>
                                ) : (
                                  <Tag color="blue">灰度环境</Tag>
                                )}
                              </Space>
                            </Col>
                            <Col span={14}>
                              <Slider
                                min={0}
                                max={100}
                                value={val}
                                onChange={(newVal) =>
                                  setWeights((prev) => ({ ...prev, [name]: newVal }))
                                }
                              />
                            </Col>
                            <Col span={4}>
                              <InputNumber
                                min={0}
                                max={100}
                                value={val}
                                formatter={(value) => `${value}%`}
                                parser={(value) => (value ? Number(value.replace('%', '')) : 0)}
                                onChange={(newVal) =>
                                  setWeights((prev) => ({
                                    ...prev,
                                    [name]: Number(newVal) || 0,
                                  }))
                                }
                                style={{ width: '100%' }}
                              />
                            </Col>
                          </Row>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Header Match Strategy UI */}
                {strategy === 'header_match' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      配置 HTTP 请求头匹配规则。匹配成功的流量将自动路由至对应的灰度环境，未匹配流量默认回流至基准环境。
                    </Paragraph>

                    {grayEnvs.length === 0 ? (
                      <Empty description="当前基准环境尚无关联灰度子环境，请在创建环境时指定基准环境" />
                    ) : (
                      grayEnvs.map((ge) => {
                        const rules = headerMatches[ge.name] || [];
                        return (
                          <Card
                            key={ge.name}
                            size="small"
                            title={
                              <Space>
                                <Tag color="blue">灰度环境: {ge.name}</Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  (规则数: {rules.length})
                                </Text>
                              </Space>
                            }
                            extra={
                              <Button
                                type="dashed"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => handleAddHeaderMatch(ge.name)}
                              >
                                添加匹配规则
                              </Button>
                            }
                            style={{ borderRadius: 6 }}
                          >
                            {rules.length === 0 ? (
                              <Text type="secondary">
                                暂无匹配规则，点击右上角「添加匹配规则」配置 Header 路由条件
                              </Text>
                            ) : (
                              <Table
                                size="small"
                                pagination={false}
                                rowKey={(_, idx) => String(idx)}
                                dataSource={rules}
                                columns={[
                                  {
                                    title: 'Header 键名 (Key)',
                                    dataIndex: 'key',
                                    render: (_: unknown, record: IstioHeaderMatch, idx: number) => (
                                      <Input
                                        placeholder="如 x-env, user-id"
                                        value={record.key}
                                        onChange={(e) =>
                                          handleHeaderMatchChange(
                                            ge.name,
                                            idx,
                                            'key',
                                            e.target.value
                                          )
                                        }
                                      />
                                    ),
                                  },
                                  {
                                    title: '匹配类型 (Match)',
                                    dataIndex: 'match',
                                    width: 140,
                                    render: (_: unknown, record: IstioHeaderMatch, idx: number) => (
                                      <Select
                                        style={{ width: '100%' }}
                                        value={record.match || 'exact'}
                                        onChange={(val) =>
                                          handleHeaderMatchChange(ge.name, idx, 'match', val)
                                        }
                                        options={[
                                          { label: '精确匹配 (exact)', value: 'exact' },
                                          { label: '前缀匹配 (prefix)', value: 'prefix' },
                                          { label: '正则匹配 (regex)', value: 'regex' },
                                        ]}
                                      />
                                    ),
                                  },
                                  {
                                    title: '匹配值 (Value)',
                                    dataIndex: 'value',
                                    render: (_: unknown, record: IstioHeaderMatch, idx: number) => (
                                      <Input
                                        placeholder="如 gray, beta"
                                        value={record.value}
                                        onChange={(e) =>
                                          handleHeaderMatchChange(
                                            ge.name,
                                            idx,
                                            'value',
                                            e.target.value
                                          )
                                        }
                                      />
                                    ),
                                  },
                                  {
                                    title: '操作',
                                    key: 'action',
                                    width: 70,
                                    render: (_: unknown, __: unknown, idx: number) => (
                                      <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemoveHeaderMatch(ge.name, idx)}
                                      />
                                    ),
                                  },
                                ]}
                              />
                            )}
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}

                <Divider style={{ margin: '16px 0' }} />

                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveConfig}
                  loading={savingConfig}
                >
                  保存灰度规则并应用
                </Button>
              </Card>
            </Spin>

            {/* Canary Deployment Discovery Section */}
            <Card
              title={
                <Space>
                  <AppstoreOutlined style={{ color: '#1677ff' }} />
                  <span>集群金丝雀候选服务探测 (Canary Services)</span>
                </Space>
              }
              variant="borderless"
              styles={{ body: { padding: '16px' } }}
              style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
            >
              <Paragraph type="secondary">
                检测当前集群和命名空间下具备单一 Deployment 绑定的标准金丝雀服务候选列表。
              </Paragraph>
              {!showCanary ? (
                <Button onClick={handleFetchCanary} loading={loadingCanary}>
                  开始探测金丝雀服务
                </Button>
              ) : (
                <Spin spinning={loadingCanary}>
                  {canaryServices.length === 0 ? (
                    <Text type="secondary">未发现金丝雀候选服务</Text>
                  ) : (
                    <Table
                      size="small"
                      dataSource={canaryServices}
                      rowKey="service_name"
                      pagination={{ pageSize: 5 }}
                      columns={[
                        {
                          title: '服务名称',
                          dataIndex: 'service_name',
                          key: 'service_name',
                          render: (t: string) => <Tag color="blue">{t}</Tag>,
                        },
                        {
                          title: '匹配 Deployment',
                          dataIndex: ['deployment', 'deployment_name'],
                          key: 'deployment_name',
                          render: (t: string) => <Text code>{t || '-'}</Text>,
                        },
                        {
                          title: '容器模块',
                          dataIndex: ['deployment', 'container_names'],
                          key: 'container_names',
                          render: (names: string[]) => (
                            <Space size={4}>
                              {(names || []).map((cn) => (
                                <Tag key={cn}>{cn}</Tag>
                              ))}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  )}
                </Spin>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Portal Service Gateway Configuration Modal */}
      {portalModalOpen && (
        <PortalServiceModal
          open={portalModalOpen}
          onClose={() => setPortalModalOpen(false)}
          projectName={projectName}
          envName={envName}
          availableServices={availableServices}
          isGrayscale={true}
          onSuccess={() => {
            loadGrayscaleConfig();
          }}
        />
      )}
    </Drawer>
  );
};

export default IstioGrayscaleDrawer;
