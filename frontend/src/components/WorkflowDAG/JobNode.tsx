import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tag, Typography, Button, Space } from 'antd';
import {
  BuildOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  SettingOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { JobType } from '../../api/workflow';

const { Text } = Typography;

export interface JobNodeData {
  jobName: string;
  jobType: JobType;
  stageName: string;
  status?: string;
  onConfigure?: (jobName: string) => void;
  onDelete?: (jobName: string) => void;
  [key: string]: unknown;
}

export const JobNode = memo(({ data }: { data: JobNodeData }) => {
  const renderJobIcon = (type: JobType) => {
    switch (type) {
      case 'zadig-build':
        return <BuildOutlined style={{ color: '#0066ff' }} />;
      case 'zadig-deploy':
      case 'zadig-helm-chart-deploy':
      case 'zadig-vm-deploy':
        return <CloudUploadOutlined style={{ color: '#52c41a' }} />;
      case 'freestyle':
        return <CodeOutlined style={{ color: '#722ed1' }} />;
      case 'sql':
        return <DatabaseOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#13c2c2' }} />;
    }
  };

  const renderStatus = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'passed':
      case 'success':
        return <Tag color="success">成功</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">运行中</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
      default:
        return <Tag color="default">排队</Tag>;
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 200,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#0066ff', width: 8, height: 8 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space orientation="horizontal" size="small">
          {renderJobIcon(data.jobType)}
          <Text strong style={{ fontSize: 13 }}>
            {data.jobName}
          </Text>
        </Space>
        {renderStatus(data.status)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
          {data.jobType}
        </Tag>
        <Space orientation="horizontal" size={4}>
          {data.onConfigure && (
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => data.onConfigure?.(data.jobName)}
            />
          )}
          {data.onDelete && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => data.onDelete?.(data.jobName)}
            />
          )}
        </Space>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#0066ff', width: 8, height: 8 }}
      />
    </div>
  );
});

export default JobNode;
