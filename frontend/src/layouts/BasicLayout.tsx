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
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth';
import { useProjectStore } from '../stores/project';
import { projectApi } from '../api/project';
import { feedback } from '../utils/feedback';
import ZadigLogo from '../components/Brand/ZadigLogo';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export const BasicLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo, logout } = useAuthStore();
  const { projects, setProjects, setLoading } = useProjectStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
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
      onOk: () => {
        logout();
        navigate('/login');
      },
    });
  };

  // Determine active menu item key
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/v1/dashboard')) return '/v1/dashboard';
    if (path.startsWith('/v1/status')) return '/v1/status';
    if (path.startsWith('/v1/projects')) return '/v1/projects';
    if (path.startsWith('/v1/pipelines')) return '/v1/pipelines';
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

  // Sidebar Menu Items conforming to live Zadig 4-Domain structure
  const menuItems: MenuProps['items'] = [
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
          key: '/v1/pipelines',
          label: <Link to="/v1/pipelines">工作流</Link>,
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
          label: <Link to="/v1/template">模板库</Link>,
        },
        {
          key: '/v1/tests',
          label: <Link to="/v1/tests">质量中心</Link>,
        },
        {
          key: '/v1/delivery',
          label: <Link to="/v1/delivery">制品管理</Link>,
        },
        {
          key: '/v1/resource',
          label: <Link to="/v1/resource">资源配置</Link>,
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
          label: <Link to="/v1/insight">效能洞察</Link>,
        },
      ],
    },
  ];

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
      onClick: () => navigate('/v1/pipelines'),
    },
    {
      key: 'new-cluster',
      icon: <SettingOutlined />,
      label: '接入 Kubernetes 集群',
      onClick: () => navigate('/v1/system/clusters'),
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
      key: 'system-integration',
      icon: <ApiOutlined />,
      label: '系统集成',
      onClick: () => navigate('/v1/system/integration'),
    },
    {
      key: 'enterprise',
      icon: <SafetyCertificateOutlined />,
      label: '企业管理',
      onClick: () => navigate('/v1/enterprise'),
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
    if (path.startsWith('/v1/pipelines')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>发布管理</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>工作流</span> },
          ]}
        />
      );
    }
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
    if (path.startsWith('/v1/system')) {
      return (
        <Breadcrumb
          items={[
            { title: <span style={{ color: '#606266' }}>系统设置</span> },
            { title: <span style={{ color: '#303133', fontWeight: 600 }}>基础设施</span> },
          ]}
        />
      );
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
          {/* Sider Brand & Quick Action Header */}
          <div
            style={{
              padding: collapsed ? '16px 8px 12px' : '16px 16px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: collapsed ? 'center' : 'flex-start',
            }}
          >
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
          </div>

          {/* Sider 4-Domain Accordion Menu */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
            <Menu
              mode="inline"
              selectedKeys={[getSelectedKey()]}
              openKeys={collapsed ? [] : openKeys}
              onOpenChange={(keys) => setOpenKeys(keys as string[])}
              items={menuItems}
              style={{ borderRight: 'none' }}
            />
          </div>

          {/* Sider Pinned Bottom Entries: 系统设置 & 企业管理 */}
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
                color: location.pathname.startsWith('/v1/system') ? '#0066ff' : '#4a5568',
                fontWeight: location.pathname.startsWith('/v1/system') ? 600 : 400,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
              className="hover:bg-gray-50"
            >
              <SettingOutlined style={{ fontSize: 16 }} />
              {!collapsed && <span>系统设置</span>}
            </div>

            <div
              onClick={() => navigate('/v1/enterprise')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                cursor: 'pointer',
                color: location.pathname.startsWith('/v1/enterprise') ? '#0066ff' : '#4a5568',
                fontWeight: location.pathname.startsWith('/v1/enterprise') ? 600 : 400,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
              className="hover:bg-gray-50"
            >
              <SafetyCertificateOutlined style={{ fontSize: 16 }} />
              {!collapsed && <span>企业管理</span>}
            </div>
          </div>
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

            {/* 5. Notifications */}
            <Badge dot offset={[-2, 2]}>
              <BellOutlined
                style={{ fontSize: 16, color: '#606266', cursor: 'pointer' }}
                onClick={() => feedback.message.info('暂无新系统通知')}
                title="系统通知"
              />
            </Badge>

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
