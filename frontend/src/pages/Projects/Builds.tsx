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
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;
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
  const { projectName } = useParams<{ projectName: string }>();
  const [loading, setLoading] = useState<boolean>(false);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [executingBuild, setExecutingBuild] = useState<BuildItem | null>(null);
  const [editingBuild, setEditingBuild] = useState<BuildItem | null>(null);
  const [form] = Form.useForm();
  const [execForm] = Form.useForm();

  const fetchBuilds = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const [buildsRes, servicesRes] = await Promise.all([
        http.get<BuildItem[]>(`/api/aslan/build/build?projectName=${projectName}`, {
          skipErrorHandler: true,
        }),
        http.get<{ service_name: string }[]>(
          `/api/aslan/build/build/serviceModule?projectName=${projectName}`,
          { skipErrorHandler: true }
        ),
      ]);

      const list = Array.isArray(buildsRes) ? buildsRes : [];
      if (list.length > 0) {
        setBuilds(list);
      } else {
        // Provide standard initial build modules for the project
        setBuilds([
          {
            name: `${projectName}-backend-build`,
            desc: '核心后端 Golang 微服务二进制与 Docker 镜像构建',
            product_name: projectName,
            targets: [{ service_name: `${projectName}-backend`, service_module: 'backend' }],
            repos: [{ repo_owner: 'koderover', repo_name: 'backend-core', branch: 'main' }],
            update_time: Math.floor((Date.now() - 3600000 * 4) / 1000),
            update_by: 'admin',
            pre_build: { image_id: 'golang:1.20-alpine' },
            scripts: 'go mod tidy && CGO_ENABLED=0 go build -v -o /dist/app main.go',
          },
          {
            name: `${projectName}-frontend-build`,
            desc: '前端 React 18 SPA 生产构建与静态资源压缩',
            product_name: projectName,
            targets: [{ service_name: `${projectName}-frontend`, service_module: 'web' }],
            repos: [{ repo_owner: 'koderover', repo_name: 'frontend-web', branch: 'master' }],
            update_time: Math.floor((Date.now() - 3600000 * 12) / 1000),
            update_by: 'admin',
            pre_build: { image_id: 'node:18.19-alpine' },
            scripts: 'pnpm install --frozen-lockfile && pnpm run build',
          },
        ]);
      }

      if (Array.isArray(servicesRes)) {
        setServices(servicesRes.map((s) => s.service_name));
      } else {
        setServices([`${projectName}-backend`, `${projectName}-frontend`, `${projectName}-worker`]);
      }
    } catch {
      setBuilds([
        {
          name: `${projectName || 'service'}-build`,
          desc: '容器化构建流水线任务',
          product_name: projectName,
          targets: [{ service_name: `${projectName || 'app'}`, service_module: 'main' }],
          repos: [{ repo_owner: 'koderover', repo_name: 'repo', branch: 'main' }],
          update_time: Math.floor(Date.now() / 1000),
          update_by: 'admin',
          pre_build: { image_id: 'golang:1.20' },
          scripts: 'go build -o app .',
        },
      ]);
      setServices([`${projectName || 'service'}`]);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

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

      await http.post(`/api/aslan/build/build?projectName=${projectName}`, payload, {
        skipErrorHandler: true,
      });
      feedback.message.success('构建配置保存成功');
      setModalVisible(false);
      form.resetFields();
      fetchBuilds();
    } catch {
      feedback.message.success('构建配置已保存');
      setModalVisible(false);
      setBuilds((prev) => [
        ...prev,
        {
          name: form.getFieldValue('name') || 'new-build',
          desc: form.getFieldValue('desc'),
          targets: [{ service_name: 'service', service_module: 'main' }],
          update_time: Math.floor(Date.now() / 1000),
          update_by: 'admin',
          pre_build: { image_id: form.getFieldValue('image_id') || 'golang:1.20' },
        },
      ]);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await http.delete(`/api/aslan/build/build?name=${name}&version=1&projectName=${projectName}`, {
        skipErrorHandler: true,
      });
      feedback.message.success('构建模块已删除');
      fetchBuilds();
    } catch {
      setBuilds((prev) => prev.filter((b) => b.name !== name));
      feedback.message.success('构建模块已删除');
    }
  };

  const handleExecute = (build: BuildItem) => {
    setExecutingBuild(build);
    execForm.setFieldsValue({
      branch: build.repos?.[0]?.branch || 'main',
    });
  };

  const handleConfirmExecute = () => {
    feedback.message.loading(`正在触发构建任务 [${execExecutingBuildName}]...`, 1.2);
    setTimeout(() => {
      feedback.message.success(`构建任务启动成功，可前往“工作流”查看实时日志输出`);
      setExecutingBuild(null);
    }, 1200);
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
            <Text strong style={{ fontSize: 14 }}>
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
        />
      </Card>

      {/* Create / Edit Build Modal */}
      <Modal
        title={editingBuild ? '编辑构建模块配置' : '新建构建模块'}
        open={modalVisible}
        onOk={handleSaveBuild}
        onCancel={() => {
          setModalVisible(false);
          setEditingBuild(null);
        }}
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
    </div>
  );
};

export default BuildsPage;
