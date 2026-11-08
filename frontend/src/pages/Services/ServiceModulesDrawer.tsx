import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Tabs,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Popconfirm,
  Alert,
  Modal,
  Form,
  Input,
  AutoComplete,
  App,
} from 'antd';
import {
  AppstoreOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { serviceApi, ServiceModule } from '../../api/service';

const { Text } = Typography;

interface ServiceModulesDrawerProps {
  open: boolean;
  onClose: () => void;
  serviceName: string;
  projectName: string;
  isProduction?: boolean;
  containers?: Array<{ name?: string }>;
}

export const ServiceModulesDrawer: React.FC<ServiceModulesDrawerProps> = ({
  open,
  onClose,
  serviceName,
  projectName,
  isProduction = false,
  containers,
}) => {
  const { message } = App.useApp();

  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');

  // 自动模块
  const [autoModules, setAutoModules] = useState<ServiceModule[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  // 手工模块
  const [manualModules, setManualModules] = useState<ServiceModule[]>([]);
  const [loadingManual, setLoadingManual] = useState(false);

  // 手工模块创建/编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModule, setEditingModule] = useState<ServiceModule | null>(null);
  const [submittingModule, setSubmittingModule] = useState(false);
  const [form] = Form.useForm();

  // 加载自动模块
  const loadAutoModules = useCallback(async () => {
    if (!serviceName || !projectName) return;
    setLoadingAuto(true);
    try {
      const list = await serviceApi.listAutoModules(serviceName, projectName, isProduction);
      setAutoModules(list);
    } catch {
      setAutoModules([]);
    } finally {
      setLoadingAuto(false);
    }
  }, [serviceName, projectName, isProduction]);

  // 加载手工模块
  const loadManualModules = useCallback(async () => {
    if (!serviceName || !projectName) return;
    setLoadingManual(true);
    try {
      const list = await serviceApi.listManualModules(serviceName, projectName, isProduction);
      setManualModules(list);
    } catch {
      setManualModules([]);
    } finally {
      setLoadingManual(false);
    }
  }, [serviceName, projectName, isProduction]);

  useEffect(() => {
    if (open && serviceName && projectName) {
      loadAutoModules();
      loadManualModules();
    }
  }, [open, serviceName, projectName, loadAutoModules, loadManualModules]);

  // 重新识别自动模块
  const handleRecognize = async () => {
    setRecognizing(true);
    try {
      const list = await serviceApi.recognizeAutoModules(serviceName, projectName, isProduction);
      setAutoModules(list);
      message.success('已重新识别 YAML 中的服务组件模块');
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '重新识别失败';
      message.error(errMsg);
    } finally {
      setRecognizing(false);
    }
  };

  // 删除自动模块
  const handleDeleteAuto = async (id?: string) => {
    if (!id) return;
    try {
      await serviceApi.deleteAutoModule(id, projectName, isProduction);
      message.success('已隐藏该自动识别模块');
      loadAutoModules();
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '删除失败';
      message.error(errMsg);
    }
  };

  // 打开创建手工模块
  const handleOpenCreateManual = () => {
    setEditingModule(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑手工模块
  const handleOpenEditManual = (record: ServiceModule) => {
    setEditingModule(record);
    form.setFieldsValue({
      name: record.name,
      image: record.image,
      image_name: record.image_name,
    });
    setModalVisible(true);
  };

  // 提交手工模块保存
  const handleSubmitManual = async () => {
    try {
      const values = await form.validateFields();
      setSubmittingModule(true);

      if (editingModule && editingModule.id) {
        // 更新
        await serviceApi.updateManualModule(
          editingModule.id,
          projectName,
          isProduction,
          {
            image: values.image.trim(),
            image_name: values.image_name ? values.image_name.trim() : undefined,
          }
        );
        message.success(`手动模块 [${editingModule.name}] 更新成功`);
      } else {
        // 创建
        await serviceApi.createManualModule(projectName, isProduction, {
          service_name: serviceName,
          name: values.name.trim(),
          image: values.image.trim(),
          image_name: values.image_name ? values.image_name.trim() : undefined,
        });
        message.success(`手动模块 [${values.name.trim()}] 创建成功`);
      }

      setModalVisible(false);
      loadManualModules();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || (err as Error)?.message || '操作失败';
      message.error(errMsg);
    } finally {
      setSubmittingModule(false);
    }
  };

  // 删除手工模块
  const handleDeleteManual = async (id?: string) => {
    if (!id) return;
    try {
      await serviceApi.deleteManualModule(id, projectName, isProduction);
      message.success('已删除手动声明模块');
      loadManualModules();
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '删除失败';
      message.error(errMsg);
    }
  };

  const autoColumns = [
    {
      title: '组件标识 (Name)',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <Text strong>{name}</Text>
          <Tag color="blue">自动识别</Tag>
        </Space>
      ),
    },
    {
      title: '容器镜像 (Image)',
      dataIndex: 'image',
      key: 'image',
      render: (img: string) => <Text code>{img || '-'}</Text>,
    },
    {
      title: '镜像标识 (Image Name)',
      dataIndex: 'image_name',
      key: 'image_name',
      render: (inName: string) => <Text type="secondary">{inName || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: ServiceModule) => (
        <Popconfirm
          title="确定隐藏/移除该组件模块？"
          description="该操作会在当前版本标记隐藏该自动模块，后续保存变量不会被重新引入。可通过「重新识别」恢复。"
          onConfirm={() => handleDeleteAuto(record.id)}
          okText="移除"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const manualColumns = [
    {
      title: '组件标识 (Name)',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <Text strong>{name}</Text>
          <Tag color="purple">手动声明</Tag>
        </Space>
      ),
    },
    {
      title: '容器镜像 (Image)',
      dataIndex: 'image',
      key: 'image',
      render: (img: string) => <Text code>{img || '-'}</Text>,
    },
    {
      title: '镜像标识 (Image Name)',
      dataIndex: 'image_name',
      key: 'image_name',
      render: (inName: string) => <Text type="secondary">{inName || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: ServiceModule) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditManual(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定删除手动模块 [${record.name}]？`}
            onConfirm={() => handleDeleteManual(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <AppstoreOutlined style={{ color: '#1677ff' }} />
          <span>服务组件模块管理: {serviceName}</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      size={780}
      destroyOnHidden
      extra={
        <Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              loadAutoModules();
              loadManualModules();
            }}
          >
            刷新
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'auto' | 'manual')}
        items={[
          {
            key: 'auto',
            label: `自动识别模块 (${autoModules.length})`,
            children: (
              <div>
                <Alert
                  title="由服务 Manifest YAML 自动解析发现的容器组件。若某组件不需要构建或工作流部署，可将其移除隐藏；点击「重新识别」可重新从 YAML 发现所有容器。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    ghost
                    icon={<ReloadOutlined />}
                    loading={recognizing}
                    onClick={handleRecognize}
                  >
                    重新从 YAML 识别模块
                  </Button>
                </div>
                <Table
                  dataSource={autoModules}
                  rowKey={(r) => r.id || r.name}
                  columns={autoColumns}
                  loading={loadingAuto}
                  size="small"
                  pagination={false}
                />
              </div>
            ),
          },
          {
            key: 'manual',
            label: `手动声明模块 (${manualModules.length})`,
            children: (
              <div>
                <Alert
                  title="针对 CRD、DaemonSet 或自定义非标准工作负载，可手动声明服务组件模块。手动模块跨版本通用，可在构建与工作流中关联并支持 $<name>-image$ 变量替换。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenCreateManual}
                  >
                    声明手动模块
                  </Button>
                </div>
                <Table
                  dataSource={manualModules}
                  rowKey={(r) => r.id || r.name}
                  columns={manualColumns}
                  loading={loadingManual}
                  size="small"
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />

      {/* 手工模块添加/编辑弹窗 */}
      <Modal
        title={editingModule ? `编辑手动模块 [${editingModule.name}]` : '声明新的手动组件模块'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmitManual}
        confirmLoading={submittingModule}
        destroyOnHidden
        okText={editingModule ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="组件模块标识 (Name)"
            rules={[{ required: true, message: '请输入模块标识' }]}
            extra="命名后不可更改。在 YAML 中可通过 $<name>-image$ 变量引用。"
          >
            {editingModule ? (
              <Input disabled />
            ) : (
              <AutoComplete
                placeholder="例如: fluentd, sidecar-proxy"
                options={(containers || [])
                  .map((c) => ({ value: c.name || '' }))
                  .filter((opt) => opt.value)}
              />
            )}
          </Form.Item>

          <Form.Item
            name="image"
            label="容器镜像地址 (Image)"
            rules={[{ required: true, message: '请输入容器镜像地址' }]}
          >
            <Input placeholder="例如: fluent/fluentd:v1.14 或 nginx:alpine" />
          </Form.Item>

          <Form.Item
            name="image_name"
            label="镜像友好名称 (Image Name)"
            extra="选填。用于镜像 Webhook 匹配和构建产物追踪，默认从镜像地址解析。"
          >
            <Input placeholder="例如: fluentd 或 nginx" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

export default ServiceModulesDrawer;
