import React from 'react';
import { Space, Typography, Tag, Badge, Avatar, Tooltip, Button } from 'antd';
import {
  SyncOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth';

const { Text } = Typography;

export interface CollaborationAwarenessBarProps {
  serviceName: string;
  onSyncRemote: () => void;
  syncing?: boolean;
}

/**
 * P1-8/P1-9: 仅展示当前登录用户与协同编辑状态提示，
 * 不伪造多人头像，不提供未与后端通信的独占编辑锁。
 */
export const CollaborationAwarenessBar: React.FC<CollaborationAwarenessBarProps> = ({
  serviceName,
  onSyncRemote,
  syncing = false,
}) => {
  const { userInfo } = useAuthStore();
  const currentUserName = userInfo?.name || userInfo?.account || '当前用户';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        marginBottom: 12,
        borderRadius: 6,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
      }}
    >
      <Space orientation="horizontal" size={12}>
        <Space orientation="horizontal" size={6}>
          <Badge status="processing" color="#52c41a" />
          <Text strong style={{ fontSize: 13 }}>
            协同编辑状态:
          </Text>
        </Space>

        <Tooltip title={`当前编辑者: ${currentUserName}`}>
          <Avatar
            size="small"
            style={{ backgroundColor: '#1677ff' }}
            icon={<UserOutlined />}
          >
            {currentUserName.slice(0, 1)}
          </Avatar>
        </Tooltip>

        <Tag icon={<TeamOutlined />} color="processing">
          {currentUserName} · 可协同编辑（请及时拉取远端最新配置以防冲突）
        </Tag>

        <Text type="secondary" style={{ fontSize: 12 }}>
          服务: <Text code>{serviceName}</Text>
        </Text>
      </Space>

      <Space orientation="horizontal" size={8}>
        <Tooltip title="与远端配置中心对比并拉取最新 YAML，防止版本冲突">
          <Button
            size="small"
            icon={<SyncOutlined spin={syncing} />}
            loading={syncing}
            onClick={onSyncRemote}
          >
            拉取远端最新
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default CollaborationAwarenessBar;
