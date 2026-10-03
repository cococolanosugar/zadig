import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Typography, Space, Tag, Alert, Button } from 'antd';
import { App } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import environmentApi, { UpdateContainerImagePayload } from '../../api/environment';

const { Text } = Typography;

export interface ContainerInfo {
  name: string;
  image: string;
}

export interface UpdateImageModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectName: string;
  envName: string;
  serviceName?: string;
  workloadType?: string; // 'Deployment' | 'DaemonSet' | 'StatefulSet' | 'Job' | 'CronJob'
  workloadName?: string;
  containers?: ContainerInfo[];
  production?: boolean;
}

export const UpdateImageModal: React.FC<UpdateImageModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectName,
  envName,
  serviceName = '',
  workloadType = 'Deployment',
  workloadName = '',
  containers = [],
  production = false,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>('');

  // 格式化规范的工作负载类型名称（首字母大写）
  const canonicalType = React.useMemo(() => {
    const lower = (workloadType || 'deployment').toLowerCase();
    switch (lower) {
      case 'daemonset':
      case 'daemonsets':
        return 'DaemonSet';
      case 'statefulset':
      case 'statefulsets':
        return 'StatefulSet';
      case 'job':
      case 'jobs':
        return 'Job';
      case 'cronjob':
      case 'cronjobs':
        return 'CronJob';
      case 'deployment':
      case 'deployments':
      default:
        return 'Deployment';
    }
  }, [workloadType]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      const defaultContainer = containers[0]?.name || workloadName || serviceName || '';
      const defaultImg = containers.find((c) => c.name === defaultContainer)?.image || containers[0]?.image || '';
      setCurrentImage(defaultImg);
      form.setFieldsValue({
        container_name: defaultContainer,
        current_image: defaultImg,
        new_image: '',
      });
    }
  }, [open, containers, workloadName, serviceName, form]);

  const handleContainerChange = (val: string) => {
    const matched = containers.find((c) => c.name === val);
    const img = matched?.image || '';
    setCurrentImage(img);
    form.setFieldsValue({ current_image: img });
  };

  const handleFinish = async (values: { container_name: string; new_image: string }) => {
    if (!values.new_image?.trim()) {
      message.warning('请输入新的镜像名称或 Tag');
      return;
    }

    setSubmitting(true);
    try {
      const payload: UpdateContainerImagePayload = {
        type: canonicalType,
        product_name: projectName,
        env_name: envName,
        service_name: serviceName || workloadName,
        name: workloadName || serviceName,
        container_name: values.container_name.trim(),
        image: values.new_image.trim(),
        production,
      };

      await environmentApi.updateContainerImage(canonicalType, envName, payload, production);
      message.success('更新镜像成功，若服务未自动重启请手动重启');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
          ?.description ||
        (err as { message?: string })?.message ||
        '更新镜像失败';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space orientation="horizontal" size="small">
          <RocketOutlined style={{ color: '#1677ff' }} />
          <span>更新工作负载镜像</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={() => form.submit()}
        >
          确定更新
        </Button>,
      ]}
    >
      <Alert
        title="镜像更新说明"
        description="系统将直接更新集群工作负载中对应容器的镜像。若工作负载启用了滚动更新，Pod 将自动平滑重启。"
        type="info"
        showIcon
        style={{ marginBottom: 20, marginTop: 12 }}
      />

      <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 6 }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">所属环境: </Text>
            <Tag color={production ? 'red' : 'blue'}>{envName}</Tag>
            {serviceName && (
              <>
                <Text type="secondary" style={{ marginLeft: 8 }}>服务名: </Text>
                <Tag color="cyan">{serviceName}</Tag>
              </>
            )}
          </div>
          <div>
            <Text type="secondary">工作负载: </Text>
            <Tag color="purple">{canonicalType}</Tag>
            <Text strong>{workloadName || serviceName}</Text>
          </div>
        </Space>
      </div>

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="container_name"
          label="目标容器 (Container)"
          rules={[{ required: true, message: '请选择或输入目标容器名' }]}
        >
          {containers.length > 0 ? (
            <Select
              placeholder="选择容器"
              onChange={handleContainerChange}
              options={containers.map((c) => ({
                label: `${c.name} (${c.image.split('/').pop() || c.image})`,
                value: c.name,
              }))}
            />
          ) : (
            <Input
              placeholder="输入容器名称，如 nginx"
            />
          )}
        </Form.Item>

        {currentImage && (
          <Form.Item label="当前镜像 (Current Image)">
            <Text code copyable style={{ fontSize: 13, wordBreak: 'break-all' }}>
              {currentImage}
            </Text>
          </Form.Item>
        )}

        <Form.Item
          name="new_image"
          label="新镜像 (New Image)"
          rules={[{ required: true, message: '请输入目标镜像完整地址或 Tag' }]}
          extra="例如: nginx:alpine、koderover.com/library/service:v1.0.0"
        >
          <Input.TextArea
            rows={2}
            placeholder="请输入完整镜像路径与版本 Tag"
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UpdateImageModal;
