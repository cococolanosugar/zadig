import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tooltip,
  Empty,
  Drawer,
  Descriptions,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import workflowApi from '../../api/workflow';
import { feedback } from '../../utils/feedback';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export interface BuildTarget {
  service_name: string;
  service_module: string;
}

export interface BuildRepo {
  codehost_id?: number;
  repo_owner?: string;
  repo_name?: string;
  branch?: string;
}

export interface BuildItem {
  name: string;
  desc?: string;
  product_name?: string;
  targets?: BuildTarget[];
  repos?: BuildRepo[];
  update_time?: number;
  update_by?: string;
  pre_build?: {
    image_id?: string;
    image_from?: string;
  };
  scripts?: string;
}

export const BuildsPage: React.FC = () => {
  const { projectName, buildName: routeBuildName } = useParams<{ projectName: string; buildName?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [executingBuild, setExecutingBuild] = useState<BuildItem | null>(null);
  const [editingBuild, setEditingBuild] = useState<BuildItem | null>(null);
  const [form] = Form.useForm();
  const [execForm] = Form.useForm();

  // 路由 /builds/create → 自动打开新建弹窗
  useEffect(() => {
    if (location.pathname.endsWith('/create')) {
      setEditingBuild(null);
      form.resetFields();
      setModalVisible(true);
    }
  }, [location.pathname, form]);

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingBuild(null);
    if (location.pathname.endsWith('/create')) {
      navigate(`/v1/projects/detail/${projectName}/builds`);
    }
  };

  // 构建详情抽屉
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailBuild, setDetailBuild] = useState<Record<string, unknown> | null>(null);

  const [triggering, setTriggering] = useState<boolean>(false);

  const fetchBuilds = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const [buildsRes, servicesRes] = await Promise.all([
        http.get<BuildItem[]>(`/api/aslan/build/build?projectName=${projectName}`),
        http.get<{ service_name: string }[]>(
          `/api/aslan/build/build/serviceModule?projectName=${projectName}`
        ),
      ]);

      const list = Array.isArray(buildsRes) ? buildsRes : [];
      setBuilds(list);

      if (Array.isArray(servicesRes)) {
        setServices(servicesRes.map((s) => s.service_name));
      } else {
        setServices([]);
      }
    } catch (err: unknown) {
      setBuilds([]);
      setServices([]);
      const msg = err instanceof Error ? err.message : '获取构建模块列表失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

  const openBuildDetail = useCallback(async (name: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await http.get<Record<string, unknown>>(
        `/api/aslan/build/build/${encodeURIComponent(name)}?projectName=${projectName}`,
        { skipErrorHandler: true }
      );
      setDetailBuild(res || null);
    } catch {
      setDetailBuild(null);
    } finally {
      setDetailLoading(false);
    }
  }, [projectName]);

  // 路由 /builds/detail/:buildName → 自动打开详情
  useEffect(() => {
    if (routeBuildName) {
      openBuildDetail(routeBuildName);
    }
  }, [routeBuildName, openBuildDetail]);

  const handleSaveBuild = async () => {
    try {
      const values = await form.validateFields();
      const payload: BuildItem = {
        name: values.name,
        desc: values.desc,
        product_name: projectName,
        targets: (values.services || []).map((s: string) => ({
          service_name: s,
          service_module: s,
        })),
        repos: [
          {
            repo_name: values.repo_name || 'main-repo',
            branch: values.branch || 'main',
          },
        ],
        pre_build: {
          image_id: values.image_id,
        },
        scripts: values.scripts,
      };

      await http.post(`/api/aslan/build/build?projectName=${projectName}`, payload);
      feedback.message.success('构建配置保存成功');
      setModalVisible(false);
      form.resetFields();
      fetchBuilds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存构建配置失败，请检查配置参数';
      feedback.message.error(msg);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await http.delete(`/api/aslan/build/build?name=${name}&version=1&projectName=${projectName}`);
      feedback.message.success(`构建模块 [${name}] 已删除`);
      fetchBuilds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除构建模块失败';
      feedback.message.error(msg);
    }
  };

  const handleExecute = (build: BuildItem) => {
    setExecutingBuild(build);
    execForm.setFieldsValue({
      branch: build.repos?.[0]?.branch || 'main',
    });
  };

  const handleConfirmExecute = async () => {
    if (!execExecutingBuildName || !projectName) return;
    setTriggering(true);
    try {
      const values = await execForm.validateFields();
      const workflows = await workflowApi.getWorkflows(projectName);
      const matchingWorkflow =
        workflows.find((wf) =>
          wf.stages?.some((s) =>
            s.jobs?.some(
              (j) =>
                j.name === executingBuild?.name ||
                j.spec?.service_name === executingBuild?.targets?.[0]?.service_name
            )
          )
        ) || workflows[0];

      if (matchingWorkflow) {
        // 以 preset 为触发 body（后端要求完整 WorkflowV4 结构），修改构建分支参数
        const preset = await workflowApi.getWorkflowPreset(matchingWorkflow.name);
        const presetParams = (preset.params || []).map((p) =>
          p.type === 'repo' && values.branch ? { ...p, repo: { ...(p as any).repo, branch: values.branch } } : p
        );
        const res = await workflowApi.triggerWorkflow({
          ...preset,
          params: presetParams,
        });
        feedback.message.success(
          `构建任务已通过工作流 [${matchingWorkflow.name}] 成功触发启动 (任务 #${res.task_id || 1})！`
        );
        setExecutingBuild(null);
      } else {
        feedback.message.warning(
          `未检测到项目 [${projectName}] 的工作流，请前往“工作流”页面配置包含 [${execExecutingBuildName}] 的任务编排`
        );
        setExecutingBuild(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '触发构建任务失败，请检查 Runner 或网络状态';
      feedback.message.error(msg);
    } finally {
      setTriggering(false);
    }
  };

  const execExecutingBuildName = executingBuild?.name || '';

  const filteredBuilds = builds.filter(
    (b) =>
      b.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (b.desc && b.desc.toLowerCase().includes(searchText.toLowerCase())) ||
      (b.targets &&
        b.targets.some((t) => t.service_name.toLowerCase().includes(searchText.toLowerCase())))
  );

  const columns: ColumnsType<BuildItem> = [
    {
      title: '构建名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <Space orientation="horizontal" size={8}>
            <ToolOutlined style={{ color: '#0066ff' }} />
            <Text
              strong
              style={{ fontSize: 14, cursor: 'pointer' }}
              onClick={() => openBuildDetail(text)}
            >
              {text}
            </Text>
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
      title: '服务组件',
      key: 'targets',
      render: (_, record) => {
        const targets = record.targets || [];
        if (targets.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space wrap size={4}>
            {targets.map((t, idx) => (
              <Tag key={idx} color="blue">
                {t.service_name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '代码源与分支',
      key: 'repos',
      width: 220,
      render: (_, record) => {
        const repo = record.repos?.[0];
        if (!repo) return <Text type="secondary">-</Text>;
        return (
          <Space size={6}>
            <CodeOutlined style={{ color: '#595959' }} />
            <Text style={{ fontSize: 13 }}>
              {repo.repo_name ? `${repo.repo_name}:${repo.branch || 'main'}` : '默认代码源'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '基础构建环境',
      key: 'env',
      width: 180,
      render: (_, record) => {
        const img = record.pre_build?.image_id || 'alpine:latest';
        return (
          <Tooltip title={img}>
            <Tag color="purple">{img.split('/').pop()}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '更新信息',
      key: 'update_time',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {record.update_time
              ? dayjs.unix(record.update_time).format('YYYY-MM-DD HH:mm')
              : '刚刚'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.update_by || 'admin'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            style={{ color: '#52c41a' }}
            onClick={() => handleExecute(record)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingBuild(record);
              form.setFieldsValue({
                name: record.name,
                desc: record.desc,
                image_id: record.pre_build?.image_id,
                scripts: record.scripts,
                services: record.targets?.map((t) => t.service_name),
              });
              setModalVisible(true);
            }}
          >
            配置
          </Button>
          <Popconfirm
            title="确认删除该构建配置？"
            description="删除后依赖此构建模块的工作流任务可能无法正常执行。"
            onConfirm={() => handleDelete(record.name)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metric Cards */}
      <Row gutter={16}>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="构建模块总数"
              value={builds.length}
              prefix={<ToolOutlined style={{ color: '#0066ff' }} />}
              styles={{ content: { fontSize: 24, fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="覆盖服务组件"
              value={
                new Set(
                  builds.flatMap((b) => (b.targets || []).map((t) => t.service_name))
                ).size
              }
              prefix={<CloudUploadOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { fontSize: 24, fontWeight: 600, color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="构建语言栈"
              value="Go / Node / Java / Py"
              prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 20, fontWeight: 600, color: '#722ed1' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table */}
      <Card variant="borderless" styles={{ body: { padding: '20px 24px' } }}>
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
          <Input
            placeholder="搜索构建名称、服务组件或描述..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />

          <Space size="middle">
            <Button icon={<ReloadOutlined />} onClick={fetchBuilds} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingBuild(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建构建
            </Button>
          </Space>
        </div>

        <Table
          rowKey="name"
          columns={columns}
          dataSource={filteredBuilds}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个构建模块` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无构建模块，可点击右上角「新建构建」创建首个构建任务"
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingBuild(null);
                    form.resetFields();
                    setModalVisible(true);
                  }}
                >
                  新建构建
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create / Edit Build Modal */}
      <Modal
        title={editingBuild ? '编辑构建模块配置' : '新建构建模块'}
        open={modalVisible}
        onOk={handleSaveBuild}
        onCancel={handleCloseModal}
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            image_id: 'golang:1.20-alpine',
            scripts: '# 在此输入构建Shell脚本\nmake build',
          }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="构建名称"
            rules={[
              { required: true, message: '请输入构建名称' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符(-)' },
            ]}
          >
            <Input placeholder="例如：user-service-build" disabled={!!editingBuild} />
          </Form.Item>

          <Form.Item name="desc" label="构建描述">
            <Input placeholder="说明该构建模块的职责与镜像规范" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="services"
                label="关联服务组件"
                rules={[{ required: true, message: '请选择关联服务' }]}
              >
                <Select mode="multiple" placeholder="选择服务组件" allowClear>
                  {services.map((s) => (
                    <Option key={s} value={s}>
                      {s}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="image_id"
                label="基础构建镜像"
                rules={[{ required: true, message: '请选择构建基础镜像' }]}
              >
                <Select placeholder="选择构建环境">
                  <Option value="golang:1.20-alpine">Golang 1.20 (Alpine)</Option>
                  <Option value="node:18.19-alpine">Node.js 18.x (Alpine)</Option>
                  <Option value="openjdk:17-alpine">Java OpenJDK 17</Option>
                  <Option value="python:3.10-slim">Python 3.10</Option>
                  <Option value="docker:24.0-dind">Docker in Docker</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="scripts"
            label="构建脚本 (Shell)"
            rules={[{ required: true, message: '请输入构建脚本' }]}
          >
            <TextArea
              rows={6}
              style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}
              placeholder="go build -v -o $WORKSPACE/dist/app main.go"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Execute Build Dialog */}
      <Modal
        title={`执行构建任务: ${execExecutingBuildName}`}
        open={!!executingBuild}
        confirmLoading={triggering}
        onOk={handleConfirmExecute}
        onCancel={() => setExecutingBuild(null)}
        okText="立即触发构建"
      >
        <Form form={execForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="branch" label="构建分支 / 代码版本">
            <Input placeholder="main" />
          </Form.Item>
          <Text type="secondary">
            触发后构建系统将分配专属 Runner 容器拉取代码并执行镜像打包流程。
          </Text>
        </Form>
      </Modal>

      {/* Build Detail Drawer (GET /api/aslan/build/build/:name?projectName=) */}
      <Drawer
        title={`构建详情: ${String((detailBuild as { name?: string })?.name || routeBuildName || '')}`}
        placement="right"
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailBuild(null);
          if (routeBuildName) {
            navigate(`/v1/projects/detail/${projectName}/builds`);
          }
        }}
        size="large"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailBuild ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="构建名称">
                <Text strong>{String(detailBuild.name || '-')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{String(detailBuild.desc || '-')}</Descriptions.Item>
              <Descriptions.Item label="超时时间 (分钟)">{String(detailBuild.timeout ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="构建基础镜像">
                {String((detailBuild.pre_build as { image_id?: string })?.image_id || '-')}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {detailBuild.update_time
                  ? `${dayjs(Number(detailBuild.update_time) * 1000).format('YYYY-MM-DD HH:mm')} · ${String(detailBuild.update_by || '-')}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              构建目标 (服务模块)
            </Title>
            <Table
              dataSource={(detailBuild.targets as Array<{ service_name?: string; service_module?: string }>) || []}
              rowKey={(r) => `${r.service_name}-${r.service_module}`}
              pagination={false}
              size="small"
              columns={[
                { title: '服务', dataIndex: 'service_name', key: 'service_name', render: (s) => <Text strong>{String(s || '-')}</Text> },
                { title: '模块', dataIndex: 'service_module', key: 'service_module', render: (m) => <Text code>{String(m || '-')}</Text> },
              ]}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构建目标" /> }}
            />

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              代码仓库
            </Title>
            <Table
              dataSource={(detailBuild.repos as BuildRepo[]) || []}
              rowKey={(r, i) => `${r.repo_name}-${i}`}
              pagination={false}
              size="small"
              columns={[
                { title: '代码源', dataIndex: 'codehost_id', key: 'codehost_id', render: (id) => <Tag color="geekblue">#{String(id ?? '-')}</Tag> },
                { title: '仓库', key: 'repo', render: (_, r) => <Text code style={{ fontSize: 12 }}>{`${r.repo_owner || '-'}/${r.repo_name || '-'}`}</Text> },
                { title: '默认分支', dataIndex: 'branch', key: 'branch', render: (b) => <Tag color="blue">{String(b || '-')}</Tag> },
              ]}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无代码仓库配置" /> }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到构建详情" />
        )}
      </Drawer>
    </div>
  );
};

export default BuildsPage;
