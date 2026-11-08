import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Card,
  Alert,
  Tag,
  Row,
  Col,
  Table,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CloudDownloadOutlined,
  MergeCellsOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import YamlEditor from '../../components/Editor/YamlEditor';
import { feedback } from '../../utils/feedback';
import {
  deliveryApi,
  DeliveryVersionService,
  CreateDeliveryVersionRequest,
} from '../../api/delivery';
import { useProjectStore } from '../../stores/project';
import { settingsApi, type HelmRepoItem, type RegistryItem } from '../../api/settings';

const { Text } = Typography;

interface CreateHelmReleaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProjectName?: string;
}

export const CreateHelmReleaseModal: React.FC<CreateHelmReleaseModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialProjectName,
}) => {
  const { projects } = useProjectStore();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [applyingGlobalVars, setApplyingGlobalVars] = useState(false);
  const [fetchingChartVersion, setFetchingChartVersion] = useState<Record<number, boolean>>({});

  const [chartRepos, setChartRepos] = useState<HelmRepoItem[]>([]);
  const [registries, setRegistries] = useState<RegistryItem[]>([]);
  const [services, setServices] = useState<DeliveryVersionService[]>([
    {
      service_name: '',
      chart_name: '',
      chart_version: '',
      yaml_content: '# values.yaml 配置\nreplicaCount: 1\n',
    },
  ]);

  const [globalVariables, setGlobalVariables] = useState<string>('global:\n  env: production\n');
  const [editingYamlIndex, setEditingYamlIndex] = useState<number | null>(null);

  // 加载 Helm 仓库 + 镜像仓列表
  useEffect(() => {
    if (open) {
      settingsApi.getHelmRepos()
        .then((res) => {
          setChartRepos(Array.isArray(res) ? res : []);
        })
        .catch(() => setChartRepos([]));

      // CC-Loop01 P0-2: 目标镜像仓列表
      settingsApi
        .getRegistries()
        .then((res) => {
          setRegistries(Array.isArray(res) ? res : []);
        })
        .catch(() => setRegistries([]));

      form.resetFields();
      form.setFieldsValue({
        project_name: initialProjectName || projects[0]?.name,
        chart_repo_name: '',
        image_registry_id: undefined,
      });
      setServices([
        {
          service_name: '',
          chart_name: '',
          chart_version: '',
          yaml_content: '# values.yaml 配置\nreplicaCount: 1\n',
        },
      ]);
      setGlobalVariables('global:\n  env: production\n');
      setEditingYamlIndex(null);
    }
  }, [open, initialProjectName, projects, form]);

  // 获取 Chart 最新版本 (调用 GET /api/aslan/delivery/releases/helm/charts/version)
  const handleFetchChartVersion = async (index: number) => {
    const item = services[index];
    const chartRepoName = form.getFieldValue('chart_repo_name');
    if (!item.chart_name) {
      feedback.message.warning('请先输入 Chart 名称');
      return;
    }
    if (!chartRepoName) {
      feedback.message.warning('请先选择目标 Chart 仓库');
      return;
    }

    setFetchingChartVersion((prev) => ({ ...prev, [index]: true }));
    try {
      // CC-Loop01 P0-3: 从对象数组读取 nextChartVersion || chartVersion，杜绝 [object Object]
      const res = await deliveryApi.getChartVersionFromRepo(item.chart_name, chartRepoName);
      let latestVersion = '';
      if (Array.isArray(res) && res.length > 0) {
        const found =
          res.find((r) => r.chartName === item.chart_name) || res[0];
        latestVersion = String(found?.nextChartVersion || found?.chartVersion || '');
      }

      if (latestVersion) {
        const next = [...services];
        next[index] = { ...next[index], chart_version: latestVersion, original_chart_version: latestVersion };
        setServices(next);
        feedback.message.success(`已获取 Chart [${item.chart_name}] 最新版本: ${latestVersion}`);
      } else {
        feedback.message.info(`未在仓库 [${chartRepoName}] 中检索到 Chart [${item.chart_name}] 的版本`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取 Chart 版本失败';
      feedback.message.error(msg);
    } finally {
      setFetchingChartVersion((prev) => ({ ...prev, [index]: false }));
    }
  };

  // 合并全局变量 (调用 POST /api/aslan/delivery/releases/helm/global-variables)
  const handleApplyGlobalVariables = async () => {
    const projectName = form.getFieldValue('project_name');
    if (!projectName) {
      feedback.message.warning('请先选择归属项目');
      return;
    }
    if (!globalVariables.trim()) {
      feedback.message.warning('请输入待合并的全局变量 YAML');
      return;
    }

    setApplyingGlobalVars(true);
    try {
      const res = await deliveryApi.applyDeliveryGlobalVariables(projectName, {
        globalVariables,
        services,
      });
      if (res && Array.isArray(res.services)) {
        setServices(res.services);
        feedback.message.success('全局变量已成功合并至所有服务 Chart values.yaml');
      } else {
        feedback.message.success('全局变量合并处理完成');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '合并全局变量失败';
      feedback.message.error(msg);
    } finally {
      setApplyingGlobalVars(false);
    }
  };

  // 添加服务行
  const handleAddService = () => {
    setServices((prev) => [
      ...prev,
      {
        service_name: '',
        chart_name: '',
        chart_version: '',
        yaml_content: '# values.yaml\n',
      },
    ]);
  };

  // 删除服务行
  const handleRemoveService = (index: number) => {
    if (services.length <= 1) {
      feedback.message.warning('至少需要保留一个 Chart 服务');
      return;
    }
    setServices((prev) => prev.filter((_, i) => i !== index));
    if (editingYamlIndex === index) {
      setEditingYamlIndex(null);
    }
  };

  // 提交创建 Helm 发布版本 (调用 POST /api/aslan/delivery/releases/helm)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 验证 services
      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        if (!s.service_name || !s.chart_name || !s.chart_version) {
          feedback.message.error(`请完整填写服务 #${i + 1} 的服务名称、Chart 名称与版本号`);
          return;
        }
      }

      setSubmitting(true);

      // 预先校验版本名称唯一性 (GET /releases/check)
      try {
        await deliveryApi.checkDeliveryVersion(values.project_name, values.version);
      } catch {
        // 如果校验不通过，提示可能重复
      }

      const payload: CreateDeliveryVersionRequest = {
        version: values.version,
        project_name: values.project_name,
        desc: values.desc || '',
        labels: values.labels ? values.labels.split(',').map((l: string) => l.trim()).filter(Boolean) : [],
        chart_repo_name: values.chart_repo_name || '',
        original_chart_repo_name: values.chart_repo_name || '',
        // CC-Loop01 P0-2: 必填目标镜像仓
        image_registry_id: values.image_registry_id,
        services,
      };

      await deliveryApi.createHelmDeliveryVersion(payload);
      feedback.message.success(`Helm 交付版本 [${values.version}] 创建成功！`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建 Helm 交付版本失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <span>创建 Helm 交付版本 (New Helm Delivery Release)</span>
          <Tag color="blue">Helm Chart</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={800}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            创建 Helm 版本发布
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {/* 基本信息 */}
        <Card
          variant="borderless"
          title="版本基本信息"
          size="small"
          style={{ background: '#fafafa', marginBottom: 16, borderRadius: 8 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="project_name"
                label="归属项目"
                rules={[{ required: true, message: '请选择归属项目' }]}
              >
                <Select
                  placeholder="选择关联项目"
                  options={projects.map((p) => ({ value: p.name, label: p.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="version"
                label="交付版本号 (Semantic Version)"
                rules={[
                  { required: true, message: '请输入版本号' },
                  { pattern: /^v?[0-9.]+/, message: '建议采用类似 v1.0.0 规范格式' },
                ]}
              >
                <Input placeholder="例如: v2.1.0 或 2026.10-helm" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chart_repo_name" label="目标 Chart 仓库">
                <Select
                  placeholder="选择 Chart 仓库 (选填)"
                  allowClear
                  options={chartRepos.map((repo) => ({
                    value: repo.repo_name,
                    label: `${repo.repo_name} (${repo.url})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* CC-Loop01 P0-2: 目标镜像仓必填 */}
              <Form.Item
                name="image_registry_id"
                label="目标镜像仓（image_registry_id）"
                rules={[{ required: true, message: '请选择目标镜像仓' }]}
              >
                <Select
                  placeholder="选择镜像推送目标仓库"
                  showSearch={{ optionFilterProp: 'label' }}
                  options={registries.map((r) => ({
                    value: r.id,
                    label: `${r.reg_addr}${r.namespace ? ` / ${r.namespace}` : ''}${r.is_default ? ' (默认)' : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="labels" label="版本标签 (逗号分隔)">
                <Input placeholder="例如: release, stable, prod" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="desc" label="发布变更描述" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} placeholder="简述本次发布的特性功能或 Chart 变更清单" />
          </Form.Item>
        </Card>

        {/* Chart 服务列表与版本配置 */}
        <Card
          variant="borderless"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Chart 服务列表 ({services.length})</Text>
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddService}>
                添加 Chart 服务
              </Button>
            </div>
          }
          size="small"
          style={{ background: '#fafafa', marginBottom: 16, borderRadius: 8 }}
        >
          <Table
            dataSource={services}
            rowKey={(_, idx) => String(idx)}
            pagination={false}
            size="small"
            columns={[
              {
                title: '服务名称',
                dataIndex: 'service_name',
                key: 'service_name',
                width: 160,
                render: (_, __, idx) => (
                  <Input
                    size="small"
                    placeholder="服务名 (如 order-svc)"
                    value={services[idx].service_name}
                    onChange={(e) => {
                      const next = [...services];
                      next[idx] = { ...next[idx], service_name: e.target.value };
                      setServices(next);
                    }}
                  />
                ),
              },
              {
                title: 'Chart 名称',
                dataIndex: 'chart_name',
                key: 'chart_name',
                width: 160,
                render: (_, __, idx) => (
                  <Input
                    size="small"
                    placeholder="Chart 包名"
                    value={services[idx].chart_name}
                    onChange={(e) => {
                      const next = [...services];
                      next[idx] = { ...next[idx], chart_name: e.target.value };
                      setServices(next);
                    }}
                  />
                ),
              },
              {
                title: 'Chart 版本',
                dataIndex: 'chart_version',
                key: 'chart_version',
                width: 220,
                render: (_, __, idx) => (
                  <Space size={4}>
                    <Input
                      size="small"
                      placeholder="版本 (如 1.0.0)"
                      value={services[idx].chart_version}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx] = { ...next[idx], chart_version: e.target.value };
                        setServices(next);
                      }}
                      style={{ width: 110 }}
                    />
                    <Button
                      size="small"
                      icon={<CloudDownloadOutlined />}
                      loading={fetchingChartVersion[idx]}
                      onClick={() => handleFetchChartVersion(idx)}
                      title="从仓库查询最新版本"
                    >
                      拉取版本
                    </Button>
                  </Space>
                ),
              },
              {
                title: 'values.yaml',
                key: 'yaml',
                width: 100,
                render: (_, __, idx) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setEditingYamlIndex(editingYamlIndex === idx ? null : idx)}
                  >
                    {editingYamlIndex === idx ? '收起配置' : '配置参数'}
                  </Button>
                ),
              },
              {
                title: '操作',
                key: 'action',
                width: 60,
                render: (_, __, idx) => (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveService(idx)}
                  />
                ),
              },
            ]}
          />

          {editingYamlIndex !== null && services[editingYamlIndex] && (
            <div style={{ marginTop: 12, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12 }}>
                  编辑服务 [{services[editingYamlIndex].service_name || `#${editingYamlIndex + 1}`}] 的 values.yaml:
                </Text>
                <Button size="small" type="text" onClick={() => setEditingYamlIndex(null)}>
                  关闭编辑器
                </Button>
              </div>
              <YamlEditor
                value={services[editingYamlIndex].yaml_content || ''}
                onChange={(val) => {
                  const next = [...services];
                  next[editingYamlIndex] = { ...next[editingYamlIndex], yaml_content: val };
                  setServices(next);
                }}
                height={200}
                theme="light"
              />
            </div>
          )}
        </Card>

        {/* 全局变量工具 (POST /releases/helm/global-variables) */}
        <Card
          variant="borderless"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <MergeCellsOutlined style={{ color: '#0066ff' }} />
                <span>全局变量合并 (Global Variables Tool)</span>
              </Space>
              <Button
                type="primary"
                size="small"
                ghost
                icon={<MergeCellsOutlined />}
                loading={applyingGlobalVars}
                onClick={handleApplyGlobalVariables}
              >
                合并应用全局变量
              </Button>
            </div>
          }
          size="small"
          style={{ background: '#fafafa', borderRadius: 8 }}
        >
          <Alert
            title="工具链说明"
            description="调用后端 /api/aslan/delivery/releases/helm/global-variables 将通用全局配置一键 Merge 进所有已添加服务的 values.yaml 中，提高发布效率。"
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <YamlEditor
            value={globalVariables}
            onChange={setGlobalVariables}
            height={140}
            theme="light"
          />
        </Card>
      </Form>
    </Modal>
  );
};

export default CreateHelmReleaseModal;
