import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  Breadcrumb,
  Popover,
  Badge,
  Typography,
  Space,
  Tag,
  Tooltip,
  Spin,
  Empty,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  FolderOpenOutlined,
  BarChartOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  CloseOutlined,
  InfoCircleFilled,
  DownloadOutlined,
  GlobalOutlined,
  ShareAltOutlined,
  BookOutlined,
  BellOutlined,
  LogoutOutlined,
  TeamOutlined,
  MoreOutlined,
  ApiOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  AppstoreAddOutlined,
  CloudServerOutlined,
  KeyOutlined,
  RobotOutlined,
  NotificationOutlined,
  FileTextOutlined,
  BankOutlined,
  BgColorsOutlined,
  ControlOutlined,
  SafetyOutlined,
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth';
import authApi from '../api/auth';
import { useProjectStore } from '../stores/project';
import { projectApi } from '../api/project';
import notificationApi, { type NotificationItem } from '../api/notification';
import { feedback } from '../utils/feedback';
import ZadigLogo from '../components/Brand/ZadigLogo';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export const BasicLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo, logout } = useAuthStore();
  const { projects, setProjects, setLoading, currentProject } = useProjectStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationPopoverOpen, setNotificationPopoverOpen] = useState(false);

  // 拉取系统通知 (PullNotify: GET /api/aslan/system/notification)
  const fetchNotifications = async () => {
    setNotificationLoading(true);
    try {
      const list = await notificationApi.getNotifications();
      setNotifications(list);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationApi.markAsRead([id]);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      feedback.message.success('已标记为已读');
    } catch {
      feedback.message.error('操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await notificationApi.markAsRead(unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      feedback.message.success('全部通知已标记为已读');
    } catch {
      feedback.message.error('操作失败');
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationApi.deleteNotifications([id]);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      feedback.message.success('通知已删除');
    } catch {
      feedback.message.error('操作失败');
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const unreadCount = unreadNotifications.length;

  const renderTaskStatusTag = (status?: string) => {
    switch (status) {
      case 'passed':
      case 'success':
        return <Tag color="success">成功</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
      case 'running':
        return <Tag color="processing">运行中</Tag>;
      case 'timeout':
        return <Tag color="warning">超时</Tag>;
      case 'cancelled':
        return <Tag color="default">已取消</Tag>;
      default:
        return status ? <Tag>{status}</Tag> : null;
    }
  };

  const getTaskLink = (n: NotificationItem) => {
    const prod = n.content?.product_name || currentProject || 'default';
    if (n.type === 2) {
      const pType = n.content?.type === 'single' ? 'single' : 'multi';
      const pName = n.content?.pipeline_name || '';
      const taskId = n.content?.task_id || '';
      return `/v1/projects/detail/${prod}/pipelines/${pType}/${pName}/${taskId}?status=${n.content?.status || ''}`;
    }
    if (n.type === 4) {
      const wfName = n.content?.workflow_name || '';
      const taskId = n.content?.task_id || '';
      return `/v1/projects/detail/${prod}/pipelines/custom/${wfName}/${taskId}`;
    }
    return '';
  };
  const [openKeys, setOpenKeys] = useState<string[]>([
    'product-delivery',
    'release-management',
    'asset-management',
    'data-view',
  ]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const list = await projectApi.getProjects({ ungrouped: true });
        setProjects(list);
      } catch (err) {
        console.error('Failed to load projects', err);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [setProjects, setLoading]);

  const handleLogout = () => {
    feedback.modal?.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新输入凭据登录。',
      okText: '退出',
      cancelText: '取消',
      onOk: async () => {
        try {
          await authApi.logout();
        } catch {
          // 容忍网络或服务端异常，确保本地会话彻底注销
        } finally {
          logout();
          navigate('/signin');
        }
      },
    });
  };

  // Determine current sidebar mode based on route
  type SidebarMode = 'main' | 'system' | 'enterprise' | 'profile';
  const sidebarMode: SidebarMode = (() => {
    const p = location.pathname;
    if (p.startsWith('/v1/system')) return 'system';
    if (p.startsWith('/v1/enterprise')) return 'enterprise';
    if (p.startsWith('/v1/profile')) return 'profile';
    return 'main';
  })();

  // Determine active menu item key
  const getSelectedKey = () => {
    const path = location.pathname;

    // System mode keys
    if (sidebarMode === 'system') {
      if (path.startsWith('/v1/system/integration')) return '/v1/system/integration';
      if (path.startsWith('/v1/system/workflowTasks')) return '/v1/system/workflowTasks';
      if (path.startsWith('/v1/system/plugins')) return '/v1/system/plugins';
      if (path.startsWith('/v1/system/apps')) return '/v1/system/apps';
      if (path.startsWith('/v1/system/imgs')) return '/v1/system/imgs';
      if (path.startsWith('/v1/system/secrets')) return '/v1/system/secrets';
      if (path.startsWith('/v1/system/aiCodeReview')) return '/v1/system/aiCodeReview';
      if (path.startsWith('/v1/system/config')) return '/v1/system/config';
      if (path.startsWith('/v1/system/users')) return '/v1/system/users';
      if (path.startsWith('/v1/system/announcement')) return '/v1/system/announcement';
      if (path.startsWith('/v1/system/auditlog')) return '/v1/system/auditlog';
      return '/v1/system/integration';
    }

    // Enterprise mode keys
    if (sidebarMode === 'enterprise') {
      if (path.startsWith('/v1/enterprise/info')) return '/v1/enterprise/info';
      if (path.startsWith('/v1/enterprise/license')) return '/v1/enterprise/license';
      if (path.startsWith('/v1/enterprise/theme')) return '/v1/enterprise/theme';
      if (path.startsWith('/v1/enterprise/language')) return '/v1/enterprise/language';
      return '/v1/enterprise/info';
    }

    // Profile mode keys
    if (sidebarMode === 'profile') {
      if (path.startsWith('/v1/profile/info')) return '/v1/profile/info';
      if (path.startsWith('/v1/profile/mcp')) return '/v1/profile/mcp';
      if (path.startsWith('/v1/profile/security')) return '/v1/profile/security';
      if (path.startsWith('/v1/profile/preference')) return '/v1/profile/preference';
      return '/v1/profile/info';
    }

    // Main mode keys
    if (path.startsWith('/v1/dashboard')) return '/v1/dashboard';
    if (path.startsWith('/v1/status')) return '/v1/status';
    if (path.startsWith('/v1/projects')) return '/v1/projects';
    if (path.startsWith('/v1/releaseWorkflow') || path.startsWith('/v1/pipelines')) return '/v1/releaseWorkflow';
    if (path.startsWith('/v1/releasePlan')) return '/v1/releasePlan';
    if (path.startsWith('/v1/plutus')) return '/v1/plutus';
    if (path.startsWith('/v1/directory')) return '/v1/directory';
    if (path.startsWith('/v1/template')) return '/v1/template';
    if (path.startsWith('/v1/tests')) return '/v1/tests';
    if (path.startsWith('/v1/delivery')) return '/v1/delivery';
    if (path.startsWith('/v1/resource')) return '/v1/resource';
    if (path.startsWith('/v1/statistics')) return '/v1/statistics';
    if (path.startsWith('/v1/insight')) return '/v1/insight';
    return path;
  };

  // Main navigation menu items
  const mainMenuItems: MenuProps['items'] = [
    {
      key: '/v1/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/v1/dashboard">工作台</Link>,
    },
    {
      key: 'product-delivery',
      icon: <AppstoreOutlined />,
      label: '产品交付',
      children: [
        {
          key: '/v1/status',
          label: <Link to="/v1/status">运行状态</Link>,
        },
        {
          key: '/v1/projects',
          label: <Link to="/v1/projects">项目</Link>,
        },
      ],
    },
    {
      key: 'release-management',
      icon: <BranchesOutlined />,
      label: '发布管理',
      children: [
        {
          key: '/v1/releaseWorkflow',
          label: <Link to="/v1/releaseWorkflow">工作流</Link>,
        },
        {
          key: '/v1/releasePlan',
          label: <Link to="/v1/releasePlan">发布计划</Link>,
        },
        {
          key: '/v1/plutus',
          label: <Link to="/v1/plutus">客户交付</Link>,
        },
      ],
    },
    {
      key: 'asset-management',
      icon: <FolderOpenOutlined />,
      label: '资产管理',
      children: [
        {
          key: '/v1/directory',
          label: <Link to="/v1/directory">业务目录</Link>,
        },
        {
          key: '/v1/template',
          label: <Link to="/v1/template/k8s-yamls">模板库</Link>,
        },
        {
          key: '/v1/tests',
          label: <Link to="/v1/tests">质量中心</Link>,
        },
        {
          key: '/v1/delivery',
          label: <Link to="/v1/delivery/version">制品管理</Link>,
        },
        {
          key: '/v1/resource',
          label: <Link to="/v1/resource/cluster">资源配置</Link>,
        },
      ],
    },
    {
      key: 'data-view',
      icon: <BarChartOutlined />,
      label: '数据视图',
      children: [
        {
          key: '/v1/statistics',
          label: <Link to="/v1/statistics">数据概览</Link>,
        },
        {
          key: '/v1/insight',
          label: <Link to="/v1/insight/view">效能洞察</Link>,
        },
      ],
    },
  ];

  // System settings secondary menu items
  const systemMenuItems: MenuProps['items'] = [
    {
      key: 'grp-integration',
      type: 'group',
      label: '集成管理',
      children: [
        {
          key: '/v1/system/integration',
          icon: <ApiOutlined />,
          label: <Link to="/v1/system/integration">系统集成</Link>,
        },
        {
          key: '/v1/system/workflowTasks',
          icon: <BranchesOutlined />,
          label: <Link to="/v1/system/workflowTasks">工作流任务</Link>,
        },
        {
          key: '/v1/system/plugins',
          icon: <AppstoreAddOutlined />,
          label: <Link to="/v1/system/plugins">插件管理</Link>,
        },
      ],
    },
    {
      key: 'grp-resources',
      type: 'group',
      label: '公共资源',
      children: [
        {
          key: '/v1/system/apps',
          icon: <AppstoreOutlined />,
          label: <Link to="/v1/system/apps">软件包管理</Link>,
        },
        {
          key: '/v1/system/imgs',
          icon: <CloudServerOutlined />,
          label: <Link to="/v1/system/imgs">自定义镜像</Link>,
        },
        {
          key: '/v1/system/secrets',
          icon: <KeyOutlined />,
          label: <Link to="/v1/system/secrets">共享变量</Link>,
        },
      ],
    },
    {
      key: 'grp-ai',
      type: 'group',
      label: 'AI 能力',
      children: [
        {
          key: '/v1/system/aiCodeReview',
          icon: <RobotOutlined />,
          label: <Link to="/v1/system/aiCodeReview">AI 代码审查</Link>,
        },
      ],
    },
    {
      key: 'grp-system',
      type: 'group',
      label: '系统管理',
      children: [
        {
          key: '/v1/system/config',
          icon: <SettingOutlined />,
          label: <Link to="/v1/system/config">系统配置</Link>,
        },
        {
          key: '/v1/system/users',
          icon: <TeamOutlined />,
          label: <Link to="/v1/system/users">用户管理</Link>,
        },
        {
          key: '/v1/system/announcement',
          icon: <NotificationOutlined />,
          label: <Link to="/v1/system/announcement">公告管理</Link>,
        },
        {
          key: '/v1/system/auditlog',
          icon: <FileTextOutlined />,
          label: <Link to="/v1/system/auditlog">操作日志</Link>,
        },
      ],
    },
  ];

  // Enterprise management secondary menu items
  const enterpriseMenuItems: MenuProps['items'] = [
    {
      key: 'grp-enterprise',
      type: 'group',
      label: '企业管理',
      children: [
        {
          key: '/v1/enterprise/info',
          icon: <BankOutlined />,
          label: <Link to="/v1/enterprise/info">企业信息</Link>,
        },
        {
          key: '/v1/enterprise/license',
          icon: <SafetyCertificateOutlined />,
          label: <Link to="/v1/enterprise/license">许可证</Link>,
        },
        {
          key: '/v1/enterprise/theme',
          icon: <BgColorsOutlined />,
          label: <Link to="/v1/enterprise/theme">主题设置</Link>,
        },
        {
          key: '/v1/enterprise/language',
          icon: <GlobalOutlined />,
          label: <Link to="/v1/enterprise/language">系统语言</Link>,
        },
      ],
    },
  ];

  // User profile secondary menu items
  const profileMenuItems: MenuProps['items'] = [
    {
      key: 'grp-profile',
      type: 'group',
      label: '账号设置',
      children: [
        {
          key: '/v1/profile/info',
          icon: <UserOutlined />,
          label: <Link to="/v1/profile/info">账号设置</Link>,
        },
        {
          key: '/v1/profile/mcp',
          icon: <ApiOutlined />,
          label: <Link to="/v1/profile/mcp">配置 MCP</Link>,
        },
        {
          key: '/v1/profile/security',
          icon: <SafetyOutlined />,
          label: <Link to="/v1/profile/security">安全设置</Link>,
        },
        {
          key: '/v1/profile/preference',
          icon: <ControlOutlined />,
          label: <Link to="/v1/profile/preference">偏好设置</Link>,
        },
      ],
    },
  ];

  const currentMenuItems =
    sidebarMode === 'system'
      ? systemMenuItems
      : sidebarMode === 'enterprise'
      ? enterpriseMenuItems
      : sidebarMode === 'profile'
      ? profileMenuItems
      : mainMenuItems;

  // Quick Action menu items for "+ 添加" button
  const quickActionItems: MenuProps['items'] = [
    {
      key: 'new-project',
      icon: <AppstoreOutlined />,
      label: '新建项目',
      onClick: () => navigate('/v1/projects'),
    },
    {
      key: 'new-pipeline',
      icon: <BranchesOutlined />,
      label: '新建工作流',
      onClick: () => navigate('/v1/releaseWorkflow'),
    },
    {
      key: 'new-cluster',
      icon: <SettingOutlined />,
      label: '接入 Kubernetes 集群',
      onClick: () => navigate('/v1/resource/cluster'),
    },
  ];

  // User Dropdown Menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-header',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>
            {userInfo?.name || userInfo?.account || '管理员'}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{userInfo?.email || userInfo?.account}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'user-mgmt',
      icon: <TeamOutlined />,
      label: '用户管理',
      onClick: () => navigate('/v1/system/users'),
    },
    {
      key: 'system-settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/v1/system/integration'),
    },
    {
      key: 'enterprise',
      icon: <SafetyCertificateOutlined />,
      label: '企业管理',
      onClick: () => navigate('/v1/enterprise/info'),
    },
    {
      key: 'mcp-config',
      icon: <ApiOutlined />,
      label: '配置 MCP',
      onClick: () => navigate('/v1/profile/mcp'),
    },
    {
      key: 'account-settings',
      icon: <UserOutlined />,
      label: '账号设置',
      onClick: () => navigate('/v1/profile/info'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Breadcrumb generation matching live Zadig exactly
  const renderBreadcrumbs = () => {
    const path = location.pathname;

    if (path.startsWith('/v1/projects/detail/')) {
      const parts = path.split('/');
      const currentProjName = parts[4] || '';
      const subTabKey = parts[5] || 'pipelines';

      const tabTitleMap: Record<string, string> = {
        detail: '项目概览',
        sprints: '迭代管理',
        pipelines: '工作流',
        envs: '环境',
        services: '服务配置',
        builds: '构建',
        test: '测试',
        scanner: '代码审查',
        version: '版本管理',
      };

      const projectMenuItems: MenuProps['items'] = projects.map((p) => {
        const pName = p.name || p.product_name || 'project';
        const pLabel = p.alias ? `${p.alias} (${pName})` : pName;
        return {
          key: pName,
          label: pLabel,
          onClick: () => navigate(`/v1/projects/detail/${pName}/${subTabKey}`),
        };
      });

      return (
        <Breadcrumb
          items={[
            {
              title: (
                <a onClick={() => navigate('/v1/projects')} style={{ color: '#606266' }}>
                  项目
                </a>
              ),
            },
            {
              title: (
                <Dropdown menu={{ items: projectMenuItems }} trigger={['click']}>
                  <span
                    style={{
                      cursor: 'pointer',
                      color: '#303133',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {currentProjName} <DownOutlined style={{ fontSize: 10, color: '#909399' }} />
                  </span>
                </Dropdown>
              ),
            },
            {
              title: <span style={{ color: '#303133' }}>{tabTitleMap[subTabKey] || '工作流'}</span>,
            },
          ]}
        />
      );
    }

    if (path.startsWith('/v1/dashboard')) {
      return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>工作台</span> }]} />;
    }
    if (path.startsWith('/v1/projects')) {
      return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>项目</span> }]} />;
    }
    if (path.startsWith('/v1/status')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>产品交付</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>运行状态</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/releaseWorkflow') || path.startsWith('/v1/pipelines')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>发布管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>工作流</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/releasePlan')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>发布管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>发布计划</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/plutus')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>发布管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>客户交付</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/directory')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>资产管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>业务目录</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/template')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>资产管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>模板库</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/tests')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>资产管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>质量中心</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/delivery')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>资产管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>制品管理</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/resource')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>资产管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>资源配置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/statistics')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>数据视图</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>数据概览</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/insight')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>数据视图</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>效能洞察</span> },
          ]}
        />
      );
    }

    // System Settings breadcrumbs
    if (path.startsWith('/v1/system/integration')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>系统集成</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/workflowTasks')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>工作流任务</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/plugins')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>插件管理</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/apps')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>软件包管理</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/imgs')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>自定义镜像</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/secrets')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>共享变量</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/aiCodeReview')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>AI 代码审查</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/config')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>系统配置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/users')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>用户管理</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/announcement')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>公告管理</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system/auditlog')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>操作日志</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/system')) {
      return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>系统设置</span> }]} />;
    }

    // Enterprise breadcrumbs
    if (path.startsWith('/v1/enterprise/info')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>企业管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>企业信息</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/enterprise/license')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>企业管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>许可证</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/enterprise/theme')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>企业管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>主题设置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/enterprise/language')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>企业管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>系统语言</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/enterprise')) {
      return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>企业管理</span> }]} />;
    }

    // Profile breadcrumbs
    if (path.startsWith('/v1/profile/info')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>账号设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>账号设置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/profile/mcp')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>账号设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>配置 MCP</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/profile/security')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>账号设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>安全设置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/profile/preference')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>账号设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>偏好设置</span> },
          ]}
        />
      );
    }
    if (path.startsWith('/v1/profile')) {
      return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>账号设置</span> }]} />;
    }

    return <Breadcrumb items={[{ title: <span style={{ color: '#303133', fontWeight: 600 }}>Zadig 持续交付平台</span> }]} />;
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row' }}>
      {/* 1. Global Left Sidebar */}
      <Sider
        width={210}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="light"
        style={{
          borderRight: '1px solid #ebeef5',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 100,
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sider Brand & Quick Action Header OR Secondary Return Header */}
          <div
            style={{
              padding: collapsed ? '16px 8px 12px' : '16px 16px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: collapsed ? 'center' : 'flex-start',
            }}
          >
            {sidebarMode === 'main' ? (
              <>
                <div
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => navigate('/v1/dashboard')}
                >
                  {collapsed ? (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: '#fd2968',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                    >
                      Z
                    </div>
                  ) : (
                    <ZadigLogo height={28} mode="light" />
                  )}
                </div>

                {/* Quick "+ 添加" Button */}
                <Dropdown menu={{ items: quickActionItems }} trigger={['click']} placement="bottomLeft">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{
                      width: '100%',
                      height: 36,
                      marginTop: 12,
                      borderRadius: 6,
                      backgroundColor: '#0066ff',
                      fontWeight: 500,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!collapsed && '添加'}
                  </Button>
                </Dropdown>
              </>
            ) : (
              <div
                onClick={() => navigate('/v1/dashboard')}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: collapsed ? '8px 4px' : '8px 10px',
                  borderRadius: 6,
                  backgroundColor: '#f5f7fa',
                  color: '#303133',
                  fontWeight: 600,
                  fontSize: 14,
                  width: '100%',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'all 0.2s',
                }}
                className="hover:bg-blue-50"
                title="返回工作台"
              >
                <ArrowLeftOutlined style={{ fontSize: 14, color: '#0066ff' }} />
                {!collapsed && (
                  <span>
                    {sidebarMode === 'system'
                      ? '系统设置'
                      : sidebarMode === 'enterprise'
                      ? '企业管理'
                      : '账号设置'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sider Menu */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
            <Menu
              mode="inline"
              selectedKeys={[getSelectedKey()]}
              openKeys={collapsed || sidebarMode !== 'main' ? [] : openKeys}
              onOpenChange={(keys) => {
                if (sidebarMode === 'main') setOpenKeys(keys as string[]);
              }}
              items={currentMenuItems}
              style={{ borderRight: 'none' }}
            />
          </div>

          {/* Sider Pinned Bottom Entries: shown in main mode */}
          {sidebarMode === 'main' && (
            <div
              style={{
                borderTop: '1px solid #f0f0f0',
                padding: '6px 0',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                onClick={() => navigate('/v1/system/integration')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '10px 0' : '10px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  cursor: 'pointer',
                  color: '#4a5568',
                  fontWeight: 400,
                  fontSize: 14,
                  transition: 'background 0.2s',
                }}
                className="hover:bg-gray-50"
              >
                <SettingOutlined style={{ fontSize: 16 }} />
                {!collapsed && <span>系统设置</span>}
              </div>

              <div
                onClick={() => navigate('/v1/enterprise/info')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '10px 0' : '10px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  cursor: 'pointer',
                  color: '#4a5568',
                  fontWeight: 400,
                  fontSize: 14,
                  transition: 'background 0.2s',
                }}
                className="hover:bg-gray-50"
              >
                <SafetyCertificateOutlined style={{ fontSize: 16 }} />
                {!collapsed && <span>企业管理</span>}
              </div>
            </div>
          )}
        </div>
      </Sider>

      {/* Floating Capsule Sidebar Collapse Button */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'fixed',
          left: collapsed ? 55 : 201,
          top: '55%',
          transform: 'translateY(-50%)',
          zIndex: 1002,
          width: 18,
          height: 48,
          backgroundColor: '#ffffff',
          border: '1px solid #dcdfe6',
          borderLeft: 'none',
          borderRadius: '0 6px 6px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '2px 0 6px rgba(0,0,0,0.06)',
          transition: 'left 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
        }}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? (
          <RightOutlined style={{ fontSize: 10, color: '#909399' }} />
        ) : (
          <LeftOutlined style={{ fontSize: 10, color: '#909399' }} />
        )}
      </div>

      {/* 2. Right Main Layout */}
      <Layout style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f5f7fa' }}>
        {/* Top Dismissible System Broadcast Banner */}
        {showBanner && (
          <div
            style={{
              backgroundColor: '#526075',
              color: '#ffffff',
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
              fontSize: 13,
              position: 'relative',
              zIndex: 99,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <InfoCircleFilled style={{ color: '#0066ff', fontSize: 14 }} />
              <span>
                系统提示：管理员请及时配置{' '}
                <a
                  onClick={() => navigate('/v1/system/config')}
                  style={{
                    color: '#00c1de',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  SMTP 邮箱服务器
                </a>{' '}
                以便于用户密码丢失找回
              </span>
            </div>
            <CloseOutlined
              onClick={() => setShowBanner(false)}
              style={{
                position: 'absolute',
                right: 16,
                fontSize: 12,
                color: '#d1d5db',
                cursor: 'pointer',
              }}
            />
          </div>
        )}

        {/* Top Header Bar */}
        <Header
          style={{
            height: 50,
            lineHeight: '50px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #ebeef5',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 98,
          }}
        >
          {/* Left: Dynamic Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {renderBreadcrumbs()}
          </div>

          {/* Right: 6 Developer Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* 1. Download CLI */}
            <Popover
              title="Zadig 工具下载"
              trigger="hover"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                  <Text strong>git-zadig CLI</Text>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    macOS (Arm64 / Intel)
                  </a>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    Linux (Amd64 / Arm64)
                  </a>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    Windows (Amd64)
                  </a>
                </div>
              }
            >
              <DownloadOutlined style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }} />
            </Popover>

            {/* 2. Language Switcher */}
            <GlobalOutlined
              style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }}
              onClick={() => feedback.message.info('当前语言为：简体中文')}
              title="语言切换"
            />

            {/* 3. Community / Links */}
            <ShareAltOutlined
              style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }}
              onClick={() => feedback.message.info('开源社区与用户群已连接')}
              title="快捷链接与社区"
            />

            {/* 4. Documentation */}
            <Popover
              title="官方文档快速入口"
              trigger="hover"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    <strong>文档站</strong> - 官方核心能力与概念
                  </a>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    <strong>入门指南</strong> - 快速跑通首条工作流
                  </a>
                  <a href="https://docs.koderover.com" target="_blank" rel="noreferrer">
                    <strong>最佳实践</strong> - 生产级微服务持续交付
                  </a>
                </div>
              }
            >
              <BookOutlined style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }} />
            </Popover>

            {/* 5. Notifications (系统通知: /api/aslan/system/notification) */}
            <Popover
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <Space size={6}>
                    <Text strong style={{ fontSize: 14 }}>系统通知</Text>
                    {unreadCount > 0 && (
                      <Tag color="processing" style={{ marginInlineEnd: 0 }}>{unreadCount} 条未读</Tag>
                    )}
                  </Space>
                  <Space size={4}>
                    <Tooltip title="全部设为已读">
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        disabled={unreadCount === 0}
                        onClick={handleMarkAllAsRead}
                      />
                    </Tooltip>
                    <Tooltip title="通知设置">
                      <Link to="/v1/profile/preference">
                        <Button type="text" size="small" icon={<SettingOutlined />} />
                      </Link>
                    </Tooltip>
                    <Tooltip title="刷新">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={notificationLoading}
                        onClick={fetchNotifications}
                      />
                    </Tooltip>
                  </Space>
                </div>
              }
              trigger="click"
              open={notificationPopoverOpen}
              onOpenChange={setNotificationPopoverOpen}
              placement="bottomRight"
              content={
                <div style={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
                  {notificationLoading && notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <Spin size="small" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无系统通知"
                      style={{ margin: '16px 0' }}
                    />
                  ) : (
                    notifications.map((n) => {
                      const isTask = n.type === 2 || n.type === 4;
                      const taskLink = isTask ? getTaskLink(n) : '';
                      return (
                        <div
                          key={n.id}
                          style={{
                            padding: '10px 12px',
                            borderBottom: '1px solid #f0f0f0',
                            backgroundColor: n.is_read ? 'transparent' : '#f9fbfd',
                            borderLeft: n.is_read ? '3px solid transparent' : '3px solid #1677ff',
                            marginBottom: 2,
                          }}
                        >
                          {/* Type 2 / 4 Task Notification */}
                          {isTask && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Space size={4}>
                                  {renderTaskStatusTag(n.content?.status)}
                                  {taskLink ? (
                                    <Link
                                      to={taskLink}
                                      onClick={() => {
                                        if (!n.is_read) handleMarkAsRead(n.id);
                                        setNotificationPopoverOpen(false);
                                      }}
                                      style={{ fontWeight: 500 }}
                                    >
                                      #{n.content?.task_id}
                                    </Link>
                                  ) : (
                                    <Text strong>#{n.content?.task_id}</Text>
                                  )}
                                </Space>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {n.content?.executor ? `执行人: ${n.content.executor}` : ''}
                                </Text>
                              </div>
                              <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                                {n.content?.workflow_display_name || n.content?.workflow_name || n.content?.pipeline_name || '-'}
                              </div>
                            </div>
                          )}

                          {/* Type 3 Message / Type 1 Announcement */}
                          {!isTask && (
                            <div>
                              <div style={{ marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 13 }}>
                                  {n.content?.title || (n.type === 1 ? '系统公告' : '系统消息')}
                                </Text>
                                {n.content?.req_id && (
                                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                    ({n.content.req_id})
                                  </Text>
                                )}
                              </div>
                              {n.content?.content && (
                                <div style={{ fontSize: 12, color: '#595959', marginBottom: 4, lineHeight: 1.5 }}>
                                  {n.content.content}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Bottom footer: timestamp + action buttons */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Space size={6}>
                              <Tag
                                color={n.is_read ? 'default' : 'geekblue'}
                                style={{ fontSize: 11, marginInlineEnd: 0, padding: '0 4px', lineHeight: '18px' }}
                              >
                                {n.is_read ? '已读' : '未读'}
                              </Tag>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {n.create_time ? new Date(n.create_time * 1000).toLocaleString() : ''}
                              </Text>
                            </Space>
                            <Space size={2}>
                              {!n.is_read && (
                                <Tooltip title="标为已读">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CheckOutlined style={{ fontSize: 12 }} />}
                                    onClick={(e) => handleMarkAsRead(n.id, e)}
                                    style={{ padding: '0 4px', height: 22 }}
                                  />
                                </Tooltip>
                              )}
                              <Tooltip title="删除该通知">
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                                  onClick={(e) => handleDeleteNotification(n.id, e)}
                                  style={{ padding: '0 4px', height: 22 }}
                                />
                              </Tooltip>
                            </Space>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              }
            >
              <Badge count={unreadCount} overflowCount={99} offset={[-2, 2]}>
                <BellOutlined
                  style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }}
                  title="系统通知"
                />
              </Badge>
            </Popover>

            {/* 6. User Avatar & Menu */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 6px',
                  borderRadius: 4,
                  userSelect: 'none',
                }}
              >
                <Avatar
                  size={28}
                  style={{
                    backgroundColor: '#0066ff',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {(userInfo?.name || userInfo?.account || 'A').charAt(0).toUpperCase()}
                </Avatar>
                <span
                  style={{
                    fontSize: 13,
                    color: '#303133',
                    maxWidth: 240,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {userInfo?.account
                    ? `${userInfo.account}(${userInfo.name || userInfo.account})`
                    : 'admin@qq.com(admin@qq.com)'}
                </span>
                <MoreOutlined style={{ fontSize: 14, color: '#909399', transform: 'rotate(90deg)' }} />
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 3. Content Viewport */}
        <Content
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#f5f7fa',
            minHeight: 'calc(100vh - 86px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
