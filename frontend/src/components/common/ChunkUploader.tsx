import React, { useState, useRef } from 'react';
import { Upload, Button, Progress, Typography, Space, Tag } from 'antd';
import {
  InboxOutlined,
  FileDoneOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import tempFileApi, {
  type CompleteUploadResponse,
} from '../../api/tempFile';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;
const { Dragger } = Upload;

export interface ChunkUploaderValue {
  file_id: string;
  file_name: string;
  file_size?: number;
}

export interface ChunkUploaderProps {
  value?: ChunkUploaderValue;
  onChange?: (val: ChunkUploaderValue | undefined) => void;
  disabled?: boolean;
  maxSizeMB?: number;
  accept?: string;
  extraPrompt?: string;
}

export const ChunkUploader: React.FC<ChunkUploaderProps> = ({
  value,
  onChange,
  disabled = false,
  maxSizeMB = 500,
  accept,
  extraPrompt,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [partInfo, setPartInfo] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);

  const handleCustomRequest = async (options: { file: unknown }) => {
    const rawFile = options.file as File;
    if (!rawFile) return;

    if (rawFile.size > maxSizeMB * 1024 * 1024) {
      feedback.message.error(`文件大小超出限制，当前最大支持 ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setPartInfo(null);
    abortRef.current = false;

    try {
      const res: CompleteUploadResponse = await tempFileApi.uploadFileMultipart(
        rawFile,
        (percent, currentPart, totalParts) => {
          if (abortRef.current) return;
          setProgress(percent);
          setPartInfo({ current: currentPart, total: totalParts });
        }
      );

      feedback.message.success(`大文件 "${rawFile.name}" 分片上传并合并成功`);
      onChange?.({
        file_id: res.file_id,
        file_name: res.file_name,
        file_size: res.file_size,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        '分片上传失败';
      feedback.message.error(msg);
    } finally {
      setUploading(false);
      setPartInfo(null);
    }
  };

  const handleRemove = () => {
    onChange?.(undefined);
    setProgress(0);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (value && value.file_id) {
    return (
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          padding: '12px 16px',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space size={12}>
          <FileDoneOutlined style={{ fontSize: 24, color: '#52c41a' }} />
          <div>
            <Space size={8}>
              <Text strong>{value.file_name}</Text>
              {value.file_size ? <Tag>{formatFileSize(value.file_size)}</Tag> : null}
              <Tag color="green">已完成分片合并</Tag>
            </Space>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2, fontFamily: 'monospace' }}>
              File ID: {value.file_id}
            </div>
          </div>
        </Space>

        <Space size={8}>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={tempFileApi.getDownloadUrl(value.file_id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            下载
          </Button>
          {!disabled && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleRemove}
            >
              移除
            </Button>
          )}
        </Space>
      </div>
    );
  }

  return (
    <div>
      <Dragger
        customRequest={handleCustomRequest}
        showUploadList={false}
        disabled={disabled || uploading}
        accept={accept}
        multiple={false}
        style={{ borderRadius: 8 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: '#1677ff', fontSize: 36 }} />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 500 }}>
          点击或拖拽文件到此区域进行分片上传
        </p>
        <p className="ant-upload-hint" style={{ fontSize: 12, color: '#8c8c8c' }}>
          {extraPrompt ||
            `支持超大文件分块上传与断点保护（每片 5MB，最大支持 ${maxSizeMB}MB）。合并后生成临时资源用于任务流水线。`}
        </p>
      </Dragger>

      {uploading && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Space size={6}>
              <PaperClipOutlined spin />
              <Text style={{ fontSize: 12 }}>分片传输中...</Text>
            </Space>
            {partInfo && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                分片: {partInfo.current} / {partInfo.total}
              </Text>
            )}
          </div>
          <Progress percent={progress} size="small" status="active" />
        </div>
      )}
    </div>
  );
};

export default ChunkUploader;
