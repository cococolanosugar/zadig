import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Table,
  Button,
  Space,
  Select,
  Popconfirm,
  Tag,
  Typography,
  Card,
} from 'antd';
import {
  UserAddOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  settingsApi,
  type UserGroupItem,
  type UserManagementItem,
} from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Text } = Typography;

interface GroupMembersDrawerProps {
  open: boolean;
  onClose: () => void;
  group: UserGroupItem | null;
  onSuccess?: () => void;
}

export const GroupMembersDrawer: React.FC<GroupMembersDrawerProps> = ({
  open,
  onClose,
  group,
  onSuccess,
}) => {
  const [allUsers, setAllUsers] = useState<UserManagementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUidsToAdd, setSelectedUidsToAdd] = useState<string[]>([]);
  const [adding, setAdding] = useState<boolean>(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Group detailed members
  const [memberUids, setMemberUids] = useState<string[]>([]);

  const loadData = async (groupId: string) => {
    setLoading(true);
    try {
      const [users, detail] = await Promise.all([
        settingsApi.getUsersBrief(),
        settingsApi.getUserGroupDetail(groupId).catch(() => null),
      ]);
      setAllUsers(users);
      if (detail && Array.isArray(detail.uids)) {
        setMemberUids(detail.uids);
      } else {
        // Fallback: 如果详情端点未返回 uids，使用默认全部用户（如果是 all-users）
        if (group?.name === 'all-users') {
          setMemberUids(users.map((u) => u.uid));
        } else {
          setMemberUids([]);
        }
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && group) {
      loadData(group.id);
      setSelectedUidsToAdd([]);
    } else {
      setMemberUids([]);
    }
  }, [open, group]);

  const handleAddMembers = async () => {
    if (!group || selectedUidsToAdd.length === 0) return;
    setAdding(true);
    try {
      await settingsApi.bulkAddUsersToGroup(group.id, selectedUidsToAdd);
      feedback.message.success('已成功添加成员到用户组');
      setSelectedUidsToAdd([]);
      await loadData(group.id);
      onSuccess?.();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '添加成员失败');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!group) return;
    setRemovingUid(uid);
    try {
      await settingsApi.bulkRemoveUsersFromGroup(group.id, [uid]);
      feedback.message.success('已从用户组移出该成员');
      await loadData(group.id);
      onSuccess?.();
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '移出成员失败');
    } finally {
      setRemovingUid(null);
    }
  };

  // Group members table
  const groupMembers = allUsers.filter((u) => memberUids.includes(u.uid));
  // Candidate users to add
  const candidateUsers = allUsers.filter((u) => !memberUids.includes(u.uid));

  const columns: ColumnsType<UserManagementItem> = [
    {
      title: '用户名 / 姓名',
      key: 'name',
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#0066ff' }} />
          <Text strong>{r.name || r.account}</Text>
          <Text type="secondary">({r.account})</Text>
        </Space>
      ),
    },
    {
      title: '工作邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (v) => v || '-',
    },
    {
      title: '账号类型',
      dataIndex: 'identity_type',
      key: 'identity_type',
      width: 110,
      render: (t) => <Tag>{t || 'local'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, r) =>
        group?.type !== 'system' ? (
          <Popconfirm
            title="确定将此成员移出用户组？"
            onConfirm={() => handleRemoveMember(r.uid)}
            okText="移出"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              loading={removingUid === r.uid}
              icon={<DeleteOutlined />}
            >
              移出
            </Button>
          </Popconfirm>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>系统锁定</Text>
        ),
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <TeamOutlined style={{ color: '#52c41a' }} />
          <span>用户组成员管理</span>
          {group && <Tag color="blue">{group.name}</Tag>}
        </Space>
      }
      open={open}
      onClose={onClose}
      size={640}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {group?.type !== 'system' && (
          <Card
            variant="borderless"
            style={{ background: '#f8fafc', borderRadius: 6 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <Space style={{ width: '100%' }} orientation="vertical" size={8}>
              <Text strong>批量添加新成员</Text>
              <Space style={{ width: '100%' }}>
                <Select
                  mode="multiple"
                  style={{ minWidth: 380, flex: 1 }}
                  placeholder="选择要加入用户组的成员"
                  value={selectedUidsToAdd}
                  onChange={setSelectedUidsToAdd}
                  options={candidateUsers.map((u) => ({
                    label: `${u.name || u.account} (${u.account})`,
                    value: u.uid,
                  }))}
                  allowClear
                  maxTagCount="responsive"
                />
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  loading={adding}
                  disabled={selectedUidsToAdd.length === 0}
                  onClick={handleAddMembers}
                >
                  添加至用户组
                </Button>
              </Space>
            </Space>
          </Card>
        )}

        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>组成员清单 (共 {groupMembers.length} 人)</Text>
            {group?.type === 'system' && (
              <Tag color="cyan">全员系统组（自动同步全部注册用户）</Tag>
            )}
          </div>
          <Table
            rowKey="uid"
            columns={columns}
            dataSource={groupMembers}
            loading={loading}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            size="small"
          />
        </div>
      </div>
    </Drawer>
  );
};

export default GroupMembersDrawer;
