import React from 'react';
import { Drawer, Space, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { LogViewer, LogViewerProps } from './LogViewer';

const { Text } = Typography;

export interface LogDrawerProps extends Omit<LogViewerProps, 'height'> {
  open: boolean;
  onClose: () => void;
  size?: 'default' | 'large';
  subtitle?: string;
  extra?: React.ReactNode;
}

export const LogDrawer: React.FC<LogDrawerProps> = ({
  open,
  onClose,
  title = '控制台实时日志',
  subtitle,
  size = 'large',
  extra,
  logs,
  streamUrl,
  onDownloadArchive,
}) => {
  return (
    <Drawer
      title={
        <Space size="middle">
          <CodeOutlined style={{ color: '#1677ff' }} />
          <span>{title}</span>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
              ({subtitle})
            </Text>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      size={size}
      destroyOnHidden
      extra={extra}
      styles={{
        body: {
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: '#141414',
        },
      }}
    >
      <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
        <LogViewer
          title={title}
          logs={logs}
          streamUrl={streamUrl}
          height="100%"
          onDownloadArchive={onDownloadArchive}
        />
      </div>
    </Drawer>
  );
};

export default LogDrawer;
