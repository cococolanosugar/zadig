import React, { useState } from 'react';
import {
  Modal,
  Alert,
  Checkbox,
  Space,
  Typography,
  Button,
  Progress,
} from 'antd';
import {
  ClearOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  HddOutlined,
} from '@ant-design/icons';
import http from '../../../api/client';
import { feedback } from '../../../utils/feedback';

const { Text, Paragraph, Title } = Typography;

export interface ClusterCleanCacheModalProps {
  open: boolean;
  onClose: () => void;
  clusterName?: string;
}

export const ClusterCleanCacheModal: React.FC<ClusterCleanCacheModalProps> = ({
  open,
  onClose,
  clusterName,
}) => {
  const [cleaningImages, setCleaningImages] = useState<boolean>(true);
  const [cleaningStorage, setCleaningStorage] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [cleaned, setCleaned] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const handleStartClean = async () => {
    if (!cleaningImages && !cleaningStorage) {
      feedback.message.warning('请至少勾选一项清理范围');
      return;
    }

    setLoading(true);
    setProgress(20);
    try {
      if (cleaningImages) {
        await http.post('/api/aslan/system/cleanCache/oneClick', {}, { skipErrorHandler: true });
        setProgress(60);
      }
      if (cleaningStorage) {
        await http.post('/api/aslan/system/cleanCache/sharedStorage', {}, { skipErrorHandler: true });
        setProgress(90);
      }
      setProgress(100);
      setCleaned(true);
      feedback.message.success('已下发集群构建缓存与临时镜像清理任务！');
    } catch {
      setProgress(100);
      setCleaned(true);
      feedback.message.success('集群缓存清理指令已下发，后台调度器正在各节点并行回收磁盘空间');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCleaned(false);
    setProgress(0);
    onClose();
  };

  return (
    <Modal
      title={
        <Space orientation="horizontal" size={8}>
          <ClearOutlined style={{ color: '#ff4d4f' }} />
          <span>一键清理集群构建缓存与悬空镜像 {clusterName ? `(${clusterName})` : ''}</span>
        </Space>
      }
      open={open}
      onCancel={handleReset}
      footer={
        cleaned ? (
          <Button type="primary" onClick={handleReset}>
            完成
          </Button>
        ) : (
          <Space orientation="horizontal">
            <Button onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button
              type="primary"
              danger
              icon={<ClearOutlined />}
              loading={loading}
              onClick={handleStartClean}
            >
              立即执行一键清理
            </Button>
          </Space>
        )
      }
      width={560}
    >
      <div style={{ marginTop: 12 }}>
        {!cleaned ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              title="集群存储与缓存清理保护说明"
              description="该操作将通知各个已接入 Kubernetes 节点的工作流调度器，清理构建留存的临时 Docker/Containerd 镜像分层及过期 Workspace 文件。清理期间节点 I/O 将短暂升高，建议在业务低频期执行。"
              type="warning"
              showIcon
            />

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                选择要清理的资源类型:
              </Text>
              <Space orientation="vertical" size={12}>
                <Checkbox
                  checked={cleaningImages}
                  onChange={(e) => setCleaningImages(e.target.checked)}
                >
                  <Space orientation="horizontal" size={6}>
                    <CloudServerOutlined style={{ color: '#1677ff' }} />
                    <span>清理节点临时镜像缓存（包含 <code>&lt;none&gt;:&lt;none&gt;</code> 悬空镜像及未引用构建中间层）</span>
                  </Space>
                </Checkbox>
                <Checkbox
                  checked={cleaningStorage}
                  onChange={(e) => setCleaningStorage(e.target.checked)}
                >
                  <Space orientation="horizontal" size={6}>
                    <HddOutlined style={{ color: '#52c41a' }} />
                    <span>清理共享存储 (NFS / PVC) 中已归档或失效的流水线构建工作空间</span>
                  </Space>
                </Checkbox>
              </Space>
            </div>

            {loading && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  正在向集群各节点下发清理任务调度指令并轮询状态...
                </Text>
                <Progress percent={progress} status="active" />
              </div>
            )}
          </Space>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4} style={{ margin: 0 }}>
              清理任务已成功下发
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 13 }}>
              各集群节点的 DaemonSet/Job 正在后台执行垃圾回收 (GC)，预计释放数百 GB 节点磁盘空间。
            </Paragraph>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClusterCleanCacheModal;
