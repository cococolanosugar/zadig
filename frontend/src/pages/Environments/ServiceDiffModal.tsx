import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Space,
  Tag,
  Typography,
  Empty,
  Button,
  Alert,
  Spin,
  App,
} from 'antd';
import {
  DiffOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import environmentApi, { type SvcDiffResult } from '../../api/environment';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';

const { Text } = Typography;

export interface ServiceDiffModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  serviceName: string;
  production?: boolean;
}

/**
 * 环境服务与模板库最新定义差异对比弹窗 (Service Diff)
 * 后端契约: GET /api/aslan/environment/diff/products/:productName/service/:serviceName?envName=&production=
 * 语义: 对比当前环境渲染结果 (Current) 与项目服务模板库最新渲染结果 (Latest)
 */
export const ServiceDiffModal: React.FC<ServiceDiffModalProps> = ({
  open,
  onClose,
  projectName,
  envName,
  serviceName,
  production = false,
}) => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<SvcDiffResult | null>(null);

  const fetchDiff = useCallback(async () => {
    if (!open || !projectName || !envName || !serviceName) return;
    setLoading(true);
    try {
      const res = await environmentApi.getServiceDiff(projectName, envName, serviceName, production);
      setDiffResult(res);
    } catch (err: unknown) {
      setDiffResult(null);
      const errObj = err as { response?: { data?: { message?: string } } };
      message.error(errObj.response?.data?.message || '获取服务差异信息失败');
    } finally {
      setLoading(false);
    }
  }, [open, projectName, envName, serviceName, production, message]);

  useEffect(() => {
    if (open) {
      fetchDiff();
    } else {
      setDiffResult(null);
    }
  }, [open, fetchDiff]);

  const hasDiff =
    diffResult &&
    (diffResult.current?.yaml !== diffResult.latest?.yaml ||
      diffResult.current?.revision !== diffResult.latest?.revision);

  return (
    <Modal
      title={
        <Space>
          <DiffOutlined style={{ color: '#1677ff' }} />
          <span>服务模板差异对比: {serviceName}</span>
          <Tag color="cyan">环境: {envName}</Tag>
          {diffResult && (
            hasDiff ? (
              <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                存在配置差异
              </Tag>
            ) : (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                配置与模板一致
              </Tag>
            )
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button
          key="copy"
          icon={<CopyOutlined />}
          disabled={!diffResult?.latest?.yaml}
          onClick={() => {
            if (diffResult?.latest?.yaml) {
              navigator.clipboard.writeText(diffResult.latest.yaml);
              message.success('模板最新 YAML 已复制');
            }
          }}
        >
          复制最新 YAML
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={1060}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <Alert
          type="info"
          showIcon
          title="配置对比说明"
          description="左侧为当前环境已渲染生效的 K8s YAML 配置；右侧为模板库最新版本在当前环境变量下重新估算渲染后的 YAML 配置。通过对比可快速识别服务是否有未同步的模板变更。"
        />
      </div>

      {loading ? (
        <div style={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : diffResult ? (
        <div>
          {diffResult.error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              title="模板渲染提示"
              description={diffResult.error}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              padding: '6px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: 6,
            }}
          >
            <Space>
              <Text strong style={{ color: '#fa8c16' }}>
                当前环境运行配置
              </Text>
              <Tag color="gold">Rev #{diffResult.current?.revision ?? '-'}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                更新人: {diffResult.current?.update_by || '-'}
              </Text>
            </Space>
            <Space>
              <Text strong style={{ color: '#52c41a' }}>
                模板库最新配置 (待同步)
              </Text>
              <Tag color="green">Rev #{diffResult.latest?.revision ?? '-'}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                更新人: {diffResult.latest?.update_by || '-'}
              </Text>
              <Button size="small" icon={<ReloadOutlined spin={loading} />} onClick={fetchDiff}>
                重新对比
              </Button>
            </Space>
          </div>

          <YamlDiffEditor
            original={diffResult.current?.yaml || '# 当前环境暂无渲染配置'}
            modified={diffResult.latest?.yaml || '# 模板库暂无最新配置'}
            height="500px"
            theme="light"
          />
        </div>
      ) : (
        <Empty description="暂无差异数据" />
      )}
    </Modal>
  );
};

export default ServiceDiffModal;
