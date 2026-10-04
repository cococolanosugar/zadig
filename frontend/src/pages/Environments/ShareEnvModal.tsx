import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  Alert,
  Space,
  Typography,
  Button,
  Spin,
  Tag,
  Input,
  Descriptions,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import environmentApi, { ShareEnvReadyResponse } from '../../api/environment';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

export interface ShareEnvModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  clusterId?: string;
  mode: 'enable' | 'disable';
  onSuccess: () => void;
}

export const ShareEnvModal: React.FC<ShareEnvModalProps> = ({
  open,
  onClose,
  projectName,
  envName,
  clusterId,
  mode,
  onSuccess,
}) => {
  // Preflight check states (for enable mode)
  const [checking, setChecking] = useState<boolean>(false);
  const [istioInstalled, setIstioInstalled] = useState<boolean | null>(null);
  const [workloadsWithoutService, setWorkloadsWithoutService] = useState<string[]>([]);
  const [preflightError, setPreflightError] = useState<string>('');

  // Processing & Polling states
  const [processing, setProcessing] = useState<boolean>(false);
  const [readyStatus, setReadyStatus] = useState<ShareEnvReadyResponse | null>(null);
  const [pollError, setPollError] = useState<string>('');

  // Disable confirmation input
  const [confirmName, setConfirmName] = useState<string>('');

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  // Run preflight check when modal opens in enable mode
  const runPreflight = useCallback(async () => {
    if (!open || mode !== 'enable') return;
    setChecking(true);
    setPreflightError('');
    setReadyStatus(null);
    setPollError('');

    try {
      const [istioRes, workloadsRes] = await Promise.all([
        clusterId ? environmentApi.checkClusterIstio(clusterId) : Promise.resolve(false),
        environmentApi.checkWorkloadsK8sServices(projectName, envName, false),
      ]);
      setIstioInstalled(istioRes);
      setWorkloadsWithoutService(workloadsRes);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '前置条件检查失败，请确认集群与网络连接状态';
      setPreflightError(msg);
    } finally {
      setChecking(false);
    }
  }, [open, mode, clusterId, projectName, envName]);

  useEffect(() => {
    if (open) {
      setConfirmName('');
      setProcessing(false);
      setReadyStatus(null);
      setPollError('');
      if (mode === 'enable') {
        runPreflight();
      }
    }
  }, [open, mode, runPreflight]);

  // Polling helper
  const pollReadyStatus = useCallback(
    async (targetOp: 'enable' | 'disable', attempts = 0) => {
      if (attempts > 30) {
        setProcessing(false);
        setPollError('等待就绪超时，服务可能仍在后台配置中，请稍后刷新环境列表查看');
        return;
      }

      try {
        const res = await environmentApi.checkShareEnvReady(projectName, envName, targetOp);
        setReadyStatus(res);
        if (res.is_ready) {
          setProcessing(false);
          feedback.message.success(
            targetOp === 'enable'
              ? `自测模式已成功开启，[${envName}] 已设为基准环境！`
              : `自测模式已成功关闭！`
          );
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
          return;
        }
      } catch (err: unknown) {
        // Continue polling even if a single check fails temporarily
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (msg) setPollError(msg);
      }

      pollingRef.current = setTimeout(() => {
        pollReadyStatus(targetOp, attempts + 1);
      }, 2000);
    },
    [projectName, envName, onSuccess, onClose]
  );

  // Trigger Enable
  const handleEnable = async () => {
    setProcessing(true);
    setPollError('');
    try {
      await environmentApi.enableShareEnv(projectName, envName);
      pollReadyStatus('enable');
    } catch (err: unknown) {
      setProcessing(false);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '开启自测模式请求失败';
      setPollError(msg);
      feedback.message.error(msg);
    }
  };

  // Trigger Disable
  const handleDisable = async () => {
    setProcessing(true);
    setPollError('');
    try {
      await environmentApi.disableShareEnv(projectName, envName);
      pollReadyStatus('disable');
    } catch (err: unknown) {
      setProcessing(false);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '关闭自测模式请求失败';
      setPollError(msg);
      feedback.message.error(msg);
    }
  };

  const isDisableConfirmed = confirmName.trim() === envName;

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!processing) onClose();
      }}
      title={
        <Space>
          <ControlOutlined style={{ color: mode === 'enable' ? '#722ed1' : '#ff4d4f' }} />
          <span>{mode === 'enable' ? `开启自测模式 - [${envName}]` : `关闭自测模式 - [${envName}]`}</span>
        </Space>
      }
      footer={
        mode === 'enable' ? (
          <Space>
            <Button onClick={onClose} disabled={processing}>
              取消
            </Button>
            <Button
              type="primary"
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
              onClick={handleEnable}
              loading={processing}
              disabled={checking || istioInstalled === false || Boolean(preflightError)}
            >
              确认开启
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={onClose} disabled={processing}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              onClick={handleDisable}
              loading={processing}
              disabled={!isDisableConfirmed}
            >
              确认关闭
            </Button>
          </Space>
        )
      }
      width={640}
    >
      {mode === 'enable' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            title="自测模式（基准/共享环境）说明"
            description="开启自测模式后，当前环境将作为项目的基准环境。开发者可在不重复部署整套微服务的前提下按需创建子环境，仅部署待测试服务，其余流量通过 Istio 智能透明回流至基准环境。"
            type="info"
            showIcon
          />

          <Alert
            title="服务重启与访问影响提示"
            description="开启自测模式过程中，环境所属命名空间将注入 istio-proxy 边车容器，微服务工作负载会依次重启，短时间内可能会影响外部网络访问。"
            type="warning"
            showIcon
          />

          <Typography.Title level={5} style={{ margin: '8px 0 4px 0' }}>
            前置条件检测情况
          </Typography.Title>

          {checking ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <Paragraph style={{ marginTop: 8 }} type="secondary">
                正在检测集群 Istio 组件与工作负载 Service 绑定关系...
              </Paragraph>
            </div>
          ) : (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="链路追踪与 Header 透传">
                <Space>
                  <Tag color="warning">需自行确保</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    服务间调用需透传流量识别标（x-env），系统无法自动静态分析业务代码，请确保已接入 Tracing 或网关透传。
                  </Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="集群 Istio 安装情况">
                {istioInstalled === true ? (
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text type="success">集群已安装 Istio</Text>
                  </Space>
                ) : istioInstalled === false ? (
                  <Space>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    <Text type="danger">集群未检测到 Istio 组件，无法开启自测模式，请先在集群部署 Istio</Text>
                  </Space>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="工作负载 K8s Service 绑定">
                {workloadsWithoutService.length === 0 ? (
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text type="success">所有工作负载均已关联 K8s Service</Text>
                  </Space>
                ) : (
                  <div>
                    <Space style={{ marginBottom: 4 }}>
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      <Text type="warning">部分工作负载未检测到 K8s Service，自测模式下可能无法被子环境路由：</Text>
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      {workloadsWithoutService.map((svc) => (
                        <Tag color="orange" key={svc} style={{ marginBottom: 4 }}>
                          {svc}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          {preflightError && (
            <Alert title="检测错误" description={preflightError} type="error" showIcon />
          )}

          {processing && (
            <div
              style={{
                marginTop: 8,
                padding: '12px 16px',
                background: '#f9f0ff',
                borderRadius: 6,
                border: '1px solid #d3adf7',
              }}
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Space>
                  <LoadingOutlined style={{ color: '#722ed1' }} spin />
                  <Text strong style={{ color: '#722ed1' }}>
                    正在开启自测模式并配置 Istio 网格规则，请稍候...
                  </Text>
                </Space>
                {readyStatus?.checks && (
                  <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
                    <Descriptions.Item label="Namespace Istio 标签">
                      {readyStatus.checks.namespace_has_istio_label ? (
                        <Tag color="success">已打标</Tag>
                      ) : (
                        <Tag color="processing">配置中</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="VirtualService">
                      {readyStatus.checks.virtualservice_deployed ? (
                        <Tag color="success">已部署</Tag>
                      ) : (
                        <Tag color="processing">部署中</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="istio-proxy 边车">
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
                        <Tag color="processing">重启中</Tag>
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
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            title="高危操作警告"
            description="关闭自测模式后，当前基准环境关联的所有自测子环境将被系统批量强行删除！同时，环境中的 Pod 将被重启以清除 istio-proxy 边车容器。请务必确认无正在进行的调试测试任务。"
            type="error"
            showIcon
          />

          <div>
            <Paragraph>
              请输入环境名称 <Text strong code>{envName}</Text> 以确认关闭：
            </Paragraph>
            <Input
              placeholder={`输入 ${envName} 确认`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={processing}
            />
          </div>

          {processing && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fff1f0',
                borderRadius: 6,
                border: '1px solid #ffa39e',
              }}
            >
              <Space>
                <LoadingOutlined style={{ color: '#ff4d4f' }} spin />
                <Text strong style={{ color: '#ff4d4f' }}>
                  正在删除关联子环境并清理 Istio 配置，请稍候...
                </Text>
              </Space>
            </div>
          )}

          {pollError && (
            <Alert title="提示" description={pollError} type="warning" showIcon />
          )}
        </div>
      )}
    </Modal>
  );
};

export default ShareEnvModal;
