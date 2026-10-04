import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Input,
  InputNumber,
  Select,
  Button,
  Table,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  GlobalOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import environmentApi, { PortalServerConfig } from '../../api/environment';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface PortalServiceModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  serviceName?: string;
  availableServices?: string[];
  isGrayscale?: boolean;
  onSuccess?: () => void;
}

export const PortalServiceModal: React.FC<PortalServiceModalProps> = ({
  open,
  onClose,
  projectName,
  envName,
  serviceName: initialServiceName,
  availableServices = [],
  isGrayscale = false,
  onSuccess,
}) => {
  const [selectedService, setSelectedService] = useState<string>(initialServiceName || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [defaultGatewayAddress, setDefaultGatewayAddress] = useState<string>('');
  const [servers, setServers] = useState<PortalServerConfig[]>([]);

  // Update selected service if prop changes
  useEffect(() => {
    if (initialServiceName) {
      setSelectedService(initialServiceName);
    } else if (availableServices.length > 0 && !selectedService) {
      setSelectedService(availableServices[0]);
    }
  }, [initialServiceName, availableServices, selectedService]);

  // Load gateway config
  const loadConfig = useCallback(async (svcName: string) => {
    if (!svcName || !projectName || !envName) return;
    setLoading(true);
    try {
      const res = isGrayscale
        ? await environmentApi.getIstioGrayscalePortalService(projectName, envName, svcName)
        : await environmentApi.getPortalService(projectName, envName, svcName);

      setDefaultGatewayAddress(res?.default_gateway_address || '');
      setServers(res?.servers || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '获取入口服务网关配置失败';
      feedback.message.error(msg);
      setDefaultGatewayAddress('');
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [isGrayscale, projectName, envName]);

  useEffect(() => {
    if (open && selectedService) {
      loadConfig(selectedService);
    }
  }, [open, selectedService, loadConfig]);

  const handleAddRow = () => {
    setServers((prev) => [
      ...prev,
      {
        host: '',
        port_number: 80,
        port_protocol: 'HTTP',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setServers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = <K extends keyof PortalServerConfig>(
    index: number,
    field: K,
    val: PortalServerConfig[K]
  ) => {
    setServers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedService) {
      feedback.message.warning('请选择需要配置网关的入口服务');
      return;
    }

    // Validate server rows
    for (let i = 0; i < servers.length; i++) {
      const item = servers[i];
      if (!item.host || !item.host.trim()) {
        feedback.message.error(`第 ${i + 1} 条规则的主机名 (Host) 不能为空`);
        return;
      }
      if (!item.port_number || item.port_number < 1 || item.port_number > 65535) {
        feedback.message.error(`第 ${i + 1} 条规则的端口号必须在 1 - 65535 之间`);
        return;
      }
    }

    setSaving(true);
    try {
      if (isGrayscale) {
        await environmentApi.setupIstioGrayscalePortalService(
          projectName,
          envName,
          selectedService,
          servers
        );
      } else {
        await environmentApi.setupPortalService(projectName, envName, selectedService, servers);
      }

      feedback.message.success(
        servers.length > 0
          ? `服务 [${selectedService}] 入口网关配置已生效！`
          : `已清空服务 [${selectedService}] 的入口网关！`
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '保存网关配置失败';
      feedback.message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '主机名 / 域名 (Host)',
      dataIndex: 'host',
      key: 'host',
      render: (_: unknown, record: PortalServerConfig, index: number) => (
        <Input
          placeholder="如 example.koderover.com 或 *"
          value={record.host}
          onChange={(e) => handleRowChange(index, 'host', e.target.value)}
        />
      ),
    },
    {
      title: '端口号 (Port)',
      dataIndex: 'port_number',
      key: 'port_number',
      width: 140,
      render: (_: unknown, record: PortalServerConfig, index: number) => (
        <InputNumber
          min={1}
          max={65535}
          style={{ width: '100%' }}
          value={record.port_number}
          onChange={(val) => handleRowChange(index, 'port_number', Number(val) || 80)}
        />
      ),
    },
    {
      title: '协议 (Protocol)',
      dataIndex: 'port_protocol',
      key: 'port_protocol',
      width: 140,
      render: (_: unknown, record: PortalServerConfig, index: number) => (
        <Select
          style={{ width: '100%' }}
          value={record.port_protocol || 'HTTP'}
          onChange={(val) => handleRowChange(index, 'port_protocol', val)}
          options={[
            { label: 'HTTP', value: 'HTTP' },
            { label: 'HTTPS', value: 'HTTPS' },
            { label: 'GRPC', value: 'GRPC' },
          ]}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, __: unknown, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveRow(index)}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <GlobalOutlined style={{ color: '#1677ff' }} />
          <span>{isGrayscale ? '灰度发布入口网关配置' : '自测模式入口服务网关配置'}</span>
        </Space>
      }
      width={720}
      footer={
        <Space>
          <Button onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存网关配置
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert
          title="入口服务 (Portal Service) 概念与访问机制"
          description="入口服务为外部流量进入集群微服务的第一站。配置后系统将在 Istio IngressGateway 下发对应的 Gateway 与 VirtualService 路由绑定，使外部流量可携带流量标头精准路由到对应环境。"
          type="info"
          showIcon
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong>选择入口服务：</Text>
          {initialServiceName ? (
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px' }}>
              {initialServiceName}
            </Tag>
          ) : (
            <Select
              style={{ width: 260 }}
              value={selectedService}
              onChange={(val) => {
                setSelectedService(val);
                loadConfig(val);
              }}
              options={availableServices.map((svc) => ({
                label: svc,
                value: svc,
              }))}
              placeholder="请选择入口服务"
            />
          )}
        </div>

        {defaultGatewayAddress && (
          <div style={{ padding: '8px 12px', background: '#f6f8fa', borderRadius: 6 }}>
            <Text type="secondary" style={{ marginRight: 8 }}>
              集群 Istio IngressGateway 地址:
            </Text>
            <Text copyable code strong>
              {defaultGatewayAddress}
            </Text>
          </div>
        )}

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text strong>监听域名与端口映射 (Servers)</Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
            >
              添加规则
            </Button>
          </div>

          <Spin spinning={loading}>
            <Table
              size="small"
              columns={columns}
              dataSource={servers}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              locale={{ emptyText: '暂无网关映射规则，点击右上角添加' }}
            />
          </Spin>
        </div>
      </div>
    </Modal>
  );
};

export default PortalServiceModal;
