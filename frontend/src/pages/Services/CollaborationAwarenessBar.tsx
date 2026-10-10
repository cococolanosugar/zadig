import React from 'react';
import { Space, Typography, Tag, Badge, Avatar, Tooltip, Button, Popconfirm } from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth';

const { Text } = Typography;

export interface Collaborator {
  name: string;
  avatar?: string;
  isCurrent?: boolean;
  status: 'active' | 'idle';
}

export interface CollaborationAwarenessBarProps {
  serviceName: string;
  isLocked: boolean;
  lockedBy?: string | null;
  onToggleLock: (nextLock: boolean) => void;
  onSyncRemote: () => void;
  syncing?: boolean;
}

export const CollaborationAwarenessBar: React.FC<CollaborationAwarenessBarProps> = ({
  serviceName,
  isLocked,
  lockedBy,
  onToggleLock,
  onSyncRemote,
  syncing = false,
}) => {
  const { userInfo } = useAuthStore();
  const currentUserName = userInfo?.name || userInfo?.account || '当前用户';

  // 协同列表：当前用户 + 示例协同成员
  const collaborators: Collaborator[] = [
    {
      name: `${currentUserName} (我)`,
      isCurrent: true,
      status: 'active',
    },
  ];

  const isLockedByMe = isLocked && (!lockedBy || lockedBy === currentUserName);
  const isLockedByOther = isLocked && Boolean(lockedBy && lockedBy !== currentUserName);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        marginBottom: 12,
        borderRadius: 6,
        background: isLockedByOther ? '#fffbe6' : '#fafafa',
        border: `1px solid ${isLockedByOther ? '#ffe58f' : '#f0f0f0'}`,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Left: Collaboration status and presence avatars */}
      <Space orientation="horizontal" size={12}>
        <Space orientation="horizontal" size={6}>
          <Badge status="processing" color="#52c41a" />
          <Text strong style={{ fontSize: 13 }}>
            协同编辑感知:
          </Text>
        </Space>

        <Avatar.Group
          max={{
            count: 3,
            style: { color: '#f56a00', backgroundColor: '#fde3cf' },
          }}
          size="small"
        >
          {collaborators.map((c) => (
            <Tooltip key={c.name} title={`在线协作者: ${c.name}`}>
              <Avatar
                size="small"
                style={{ backgroundColor: c.isCurrent ? '#1677ff' : '#87d068' }}
                icon={!c.avatar ? <UserOutlined /> : undefined}
                src={c.avatar}
              >
                {c.name.slice(0, 1)}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>

        {isLockedByOther ? (
          <Tag icon={<LockOutlined />} color="error">
            已被 {lockedBy} 独占锁定（当前只读）
          </Tag>
        ) : isLockedByMe ? (
          <Tag icon={<LockOutlined />} color="warning">
            您已启用独占编辑锁（防并发覆盖保护）
          </Tag>
        ) : (
          <Tag icon={<UnlockOutlined />} color="success">
            多协作者共享编辑中
          </Tag>
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          服务: <Text code>{serviceName}</Text>
        </Text>
      </Space>

      {/* Right: Actions */}
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

        {isLockedByOther ? (
          <Popconfirm
            title="强制抢占编辑锁？"
            description={`当前编辑锁由 ${lockedBy} 持有，强行接管可能导致对方正在编辑的未保存改动失效。`}
            onConfirm={() => onToggleLock(true)}
            okText="强制接管"
            cancelText="取消"
          >
            <Button size="small" danger icon={<LockOutlined />}>
              强制接管编辑锁
            </Button>
          </Popconfirm>
        ) : isLockedByMe ? (
          <Button
            size="small"
            icon={<UnlockOutlined />}
            onClick={() => onToggleLock(false)}
          >
            释放独占锁
          </Button>
        ) : (
          <Button
            size="small"
            type="dashed"
            icon={<LockOutlined />}
            onClick={() => onToggleLock(true)}
          >
            锁定编辑权
          </Button>
        )}
      </Space>
    </div>
  );
};

export default CollaborationAwarenessBar;
