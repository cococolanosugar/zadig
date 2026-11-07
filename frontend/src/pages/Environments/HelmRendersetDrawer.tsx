import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Input,
  Alert,
  Spin,
  Card,
  Row,
  Col,
  App,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CodeOutlined,
  GlobalOutlined,
  SettingOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import environmentApi, {
  type HelmRenderChartArg,
  type K8sServiceVariableItem,
} from '../../api/environment';
import MonacoEditor from '@monaco-editor/react';

const { Text } = Typography;

export interface HelmRendersetDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  production?: boolean;
}

/**
 * Helm 渲染工具与配置抽屉 (Rendersets)
 * 后端契约:
 *  - 渲染 Chart: POST /api/aslan/environment/rendersets/renderchart
 *  - 默认变量: GET /api/aslan/environment/rendersets/default-values
 *  - 全局变量: GET /api/aslan/environment/rendersets/globalVariables
 *  - 服务变量: GET /api/aslan/environment/rendersets/variables
 *  - 外部 Git YAML 提取: GET /api/aslan/environment/rendersets/yamlContent
 */
export const HelmRendersetDrawer: React.FC<HelmRendersetDrawerProps> = ({
  open,
  onClose,
  projectName,
  envName,
  production = false,
}) => {
  const { message } = App.useApp();

  const [activeTab, setActiveTab] = useState<'renderchart' | 'default-values' | 'globalVariables' | 'variables'>('renderchart');

  // Tab 1: Render Charts
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderCharts, setRenderCharts] = useState<HelmRenderChartArg[]>([]);
  const [selectedChartYaml, setSelectedChartYaml] = useState<string>('');
  const [selectedChartTitle, setSelectedChartTitle] = useState<string>('');

  // Tab 2: Default Values
  const [defaultValLoading, setDefaultValLoading] = useState(false);
  const [defaultValuesYaml, setDefaultValuesYaml] = useState<string>('');
  const [savingDefaultValues, setSavingDefaultValues] = useState(false);

  // Tab 3: Global Variables
  const [gvLoading, setGvLoading] = useState(false);
  const [globalVars, setGlobalVars] = useState<Array<{ key: string; value: string; type?: string; desc?: string }>>([]);
  const [gvRevision, setGvRevision] = useState<number>(0);

  // Tab 4: Service Variables
  const [svcVarLoading, setSvcVarLoading] = useState(false);
  const [searchServiceName, setSearchServiceName] = useState<string>('');
  const [serviceVars, setServiceVars] = useState<K8sServiceVariableItem[]>([]);

  // 1. 加载 Render Charts
  const fetchRenderCharts = useCallback(async () => {
    if (!projectName || !envName) return;
    setRenderLoading(true);
    try {
      const res = await environmentApi.getRenderCharts(projectName, envName, [], production);
      const list = Array.isArray(res) ? res : [];
      setRenderCharts(list);
      if (list.length > 0 && !selectedChartYaml) {
        const first = list[0];
        setSelectedChartTitle(first.serviceName || first.release_name || '服务 Values');
        setSelectedChartYaml(
          first.yaml_data?.yaml_content || first.variable_yaml || first.overrideYaml || '# 暂无合并 Values'
        );
      }
    } catch {
      setRenderCharts([]);
      message.error('获取 Helm Chart 渲染配置失败');
    } finally {
      setRenderLoading(false);
    }
  }, [projectName, envName, production, selectedChartYaml, message]);

  // 2. 加载默认变量 (Default Values)
  const fetchDefaultValues = useCallback(async () => {
    if (!projectName || !envName) return;
    setDefaultValLoading(true);
    try {
      const res = await environmentApi.getProductDefaultValues(projectName, envName, production);
      setDefaultValuesYaml(res?.default_variable || '# 当前环境暂无默认 Values');
    } catch {
      setDefaultValuesYaml('# 获取默认变量失败');
    } finally {
      setDefaultValLoading(false);
    }
  }, [projectName, envName, production]);

  // 保存环境基准默认配置 (R3-A3：PUT /environments/:name/helm/default-values)
  const handleSaveDefaultValues = async () => {
    if (!projectName || !envName) return;
    setSavingDefaultValues(true);
    try {
      await environmentApi.updateHelmProductDefaultValues(projectName, envName, defaultValuesYaml, production);
      message.success('环境默认配置已保存，后续部署/同步将以此为基准 Values');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : '默认配置保存失败');
      message.error(msg);
    } finally {
      setSavingDefaultValues(false);
    }
  };

  // 3. 加载全局变量 (Global Variables)
  const fetchGlobalVariables = useCallback(async () => {
    if (!projectName || !envName) return;
    setGvLoading(true);
    try {
      const res = await environmentApi.getGlobalVariables(projectName, envName, production);
      setGlobalVars(res?.global_variables || []);
      setGvRevision(res?.revision || 0);
    } catch {
      setGlobalVars([]);
    } finally {
      setGvLoading(false);
    }
  }, [projectName, envName, production]);

  // 4. 加载服务变量 (Service Variables)
  const fetchServiceVariables = useCallback(async (svcName: string) => {
    if (!projectName || !envName || !svcName) return;
    setSvcVarLoading(true);
    try {
      const res = await environmentApi.getServiceVariables(projectName, envName, svcName, production);
      setServiceVars(Array.isArray(res) ? res : []);
    } catch {
      setServiceVars([]);
    } finally {
      setSvcVarLoading(false);
    }
  }, [projectName, envName, production]);

  useEffect(() => {
    if (open) {
      if (activeTab === 'renderchart') fetchRenderCharts();
      else if (activeTab === 'default-values') fetchDefaultValues();
      else if (activeTab === 'globalVariables') fetchGlobalVariables();
      else if (activeTab === 'variables' && searchServiceName) fetchServiceVariables(searchServiceName);
    }
  }, [open, activeTab, fetchRenderCharts, fetchDefaultValues, fetchGlobalVariables, fetchServiceVariables, searchServiceName]);

  // 当 renderCharts 变化且 searchServiceName 为空时，默认选择第一个
  useEffect(() => {
    if (renderCharts.length > 0 && !searchServiceName) {
      const firstSvc = renderCharts[0].serviceName;
      if (firstSvc) {
        setSearchServiceName(firstSvc);
        fetchServiceVariables(firstSvc);
      }
    }
  }, [renderCharts, searchServiceName, fetchServiceVariables]);

  const chartColumns: ColumnsType<HelmRenderChartArg> = [
    {
      title: '服务名',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 140,
      render: (name: string, r) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{name || r.release_name || '-'}</Text>
          {r.release_name && r.release_name !== name && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Release: {r.release_name}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Chart 信息',
      key: 'chart',
      render: (_, r) => (
        <Space orientation="vertical" size={2}>
          <Text style={{ fontSize: 12 }}>
            {r.chart_repo ? `${r.chart_repo}/` : ''}{r.chart_name || '-'}
          </Text>
          {r.chartVersion && <Tag color="geekblue" style={{ fontSize: 11 }}>v{r.chartVersion}</Tag>}
        </Space>
      ),
    },
    {
      title: '部署策略',
      dataIndex: 'deploy_strategy',
      key: 'deploy_strategy',
      width: 100,
      render: (s: string) => <Tag color="cyan">{s || 'deploy'}</Tag>,
    },
    {
      title: 'Values 来源',
      key: 'source',
      width: 120,
      render: (_, r) => <Tag color="purple">{r.yaml_data?.source || 'default'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => {
            setSelectedChartTitle(r.serviceName || r.release_name || '服务 Values');
            setSelectedChartYaml(
              r.yaml_data?.yaml_content || r.variable_yaml || r.overrideYaml || '# 暂无 Values 内容'
            );
          }}
        >
          查看 Values
        </Button>
      ),
    },
  ];

  const gvColumns: ColumnsType<{ key: string; value: string; type?: string; desc?: string }> = [
    {
      title: '变量键名 (Key)',
      dataIndex: 'key',
      key: 'key',
      render: (k: string) => <Text code strong>{k}</Text>,
    },
    {
      title: '变量值 (Value)',
      dataIndex: 'value',
      key: 'value',
      render: (v: string) => <Text>{v ?? '-'}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t: string) => <Tag color="blue">{t || 'string'}</Tag>,
    },
    {
      title: '描述说明',
      dataIndex: 'desc',
      key: 'desc',
      render: (d: string) => d || '-',
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <AppstoreOutlined style={{ color: '#1677ff' }} />
          <span>Helm 环境渲染工具 (Rendersets)</span>
          <Tag color="cyan">{envName}</Tag>
          <Tag color="geekblue">{projectName}</Tag>
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size={1000}
      extra={
        <Button
          icon={<ReloadOutlined spin={renderLoading || defaultValLoading || gvLoading || svcVarLoading} />}
          onClick={() => {
            if (activeTab === 'renderchart') fetchRenderCharts();
            else if (activeTab === 'default-values') fetchDefaultValues();
            else if (activeTab === 'globalVariables') fetchGlobalVariables();
            else if (activeTab === 'variables' && searchServiceName) fetchServiceVariables(searchServiceName);
          }}
        >
          刷新
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as typeof activeTab)}
        items={[
          {
            key: 'renderchart',
            label: (
              <Space size={4}>
                <CodeOutlined />
                <span>Chart 渲染预览 ({renderCharts.length})</span>
              </Space>
            ),
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title="多层 Values 合并机制"
                  description="Zadig 在部署 Helm 环境服务时，会将 Chart 默认值、环境级全局变量、服务自定义 Values 及 Git 仓库提取配置自动合并为最终运行态 Values。"
                />
                <Row gutter={16}>
                  <Col span={11}>
                    <Card
                      title="环境内 Helm 服务列表"
                      size="small"
                      variant="borderless"
                      style={{ border: '1px solid #f0f0f0' }}
                    >
                      <Table
                        dataSource={renderCharts}
                        columns={chartColumns}
                        rowKey={(r) => `${r.serviceName}-${r.release_name}`}
                        loading={renderLoading}
                        pagination={false}
                        size="small"
                        locale={{
                          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前环境未发现 Helm 服务" />,
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={13}>
                    <Card
                      title={
                        <Space>
                          <FileTextOutlined style={{ color: '#1677ff' }} />
                          <span>已合并 Values: {selectedChartTitle || '未选择'}</span>
                        </Space>
                      }
                      size="small"
                      variant="borderless"
                      style={{ border: '1px solid #f0f0f0' }}
                      extra={
                        <Button
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedChartYaml);
                            message.success('Values 已复制到剪贴板');
                          }}
                        >
                          复制 YAML
                        </Button>
                      }
                    >
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                        <MonacoEditor
                          height="480px"
                          language="yaml"
                          theme="light"
                          value={selectedChartYaml || '# 请从左侧选择服务查看合并 Values'}
                          options={{ readOnly: true, minimap: { enabled: false } }}
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'default-values',
            label: (
              <Space size={4}>
                <SettingOutlined />
                <span>环境默认变量 (Default Values)</span>
              </Space>
            ),
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title="环境基准默认配置 (default-values)"
                  description="环境初始创建或批量同步时应用的统一基准 Values 配置，当服务未单独定制时将继承此配置。"
                />
                <Card
                  title={`环境 [${envName}] 默认 Values YAML`}
                  variant="borderless"
                  style={{ border: '1px solid #f0f0f0' }}
                  extra={
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(defaultValuesYaml);
                          message.success('默认配置已复制');
                        }}
                      >
                        复制配置
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<SaveOutlined />}
                        loading={savingDefaultValues}
                        onClick={handleSaveDefaultValues}
                      >
                        保存配置
                      </Button>
                    </Space>
                  }
                >
                  {defaultValLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <Spin />
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                      <MonacoEditor
                        height="480px"
                        language="yaml"
                        theme="light"
                        value={defaultValuesYaml}
                        onChange={(val) => setDefaultValuesYaml(val ?? '')}
                        options={{ readOnly: false, minimap: { enabled: false } }}
                      />
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'globalVariables',
            label: (
              <Space size={4}>
                <GlobalOutlined />
                <span>环境全局变量 ({globalVars.length})</span>
              </Space>
            ),
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title="跨服务环境变量组"
                  description={
                    <span>
                      环境当前的全局变量集合（当前 Revision: <Tag color="blue">#{gvRevision}</Tag>
                      ）。可通过统一模板注入到各个 Helm 服务的 values.yaml 中。
                    </span>
                  }
                />
                <Table
                  dataSource={globalVars}
                  columns={gvColumns}
                  rowKey="key"
                  loading={gvLoading}
                  pagination={false}
                  size="middle"
                  locale={{
                    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前环境未配置全局变量" />,
                  }}
                />
              </div>
            ),
          },
          {
            key: 'variables',
            label: (
              <Space size={4}>
                <FileTextOutlined />
                <span>服务变量渲染 (Service Variables)</span>
              </Space>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Text strong>选择或输入服务名:</Text>
                  {renderCharts.length > 0 ? (
                    <Select
                      style={{ width: 220 }}
                      placeholder="选择环境内的服务"
                      value={searchServiceName || undefined}
                      onChange={(val) => {
                        setSearchServiceName(val);
                        fetchServiceVariables(val);
                      }}
                      options={renderCharts.map((c) => ({
                        value: c.serviceName || c.release_name || '',
                        label: c.serviceName || c.release_name || '',
                      }))}
                    />
                  ) : (
                    <Input.Search
                      style={{ width: 260 }}
                      placeholder="输入服务名查询变量"
                      enterButton="查询"
                      value={searchServiceName}
                      onChange={(e) => setSearchServiceName(e.target.value)}
                      onSearch={(val) => fetchServiceVariables(val)}
                    />
                  )}
                </Space>

                {svcVarLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin />
                  </div>
                ) : serviceVars.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {serviceVars.map((sv, idx) => (
                      <Card
                        key={idx}
                        title={`服务变量: ${sv.service_name}`}
                        variant="borderless"
                        style={{ border: '1px solid #f0f0f0' }}
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Text strong style={{ color: '#1677ff', display: 'block', marginBottom: 8 }}>
                              当前环境生效变量 YAML
                            </Text>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                              <MonacoEditor
                                height="360px"
                                language="yaml"
                                theme="light"
                                value={sv.variable_yaml || '# 空变量配置'}
                                options={{ readOnly: true, minimap: { enabled: false } }}
                              />
                            </div>
                          </Col>
                          <Col span={12}>
                            <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: 8 }}>
                              模板库最新变量 YAML
                            </Text>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                              <MonacoEditor
                                height="360px"
                                language="yaml"
                                theme="light"
                                value={sv.latest_variable_yaml || '# 空变量配置'}
                                options={{ readOnly: true, minimap: { enabled: false } }}
                              />
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={searchServiceName ? `服务 [${searchServiceName}] 暂无变量渲染记录` : '请先选择或输入服务名'}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};

export default HelmRendersetDrawer;
