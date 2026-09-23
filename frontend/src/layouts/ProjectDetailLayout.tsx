import React from 'react';
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, Dropdown, Button, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  BranchesOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  ScheduleOutlined,
  ProjectOutlined,
  SettingOutlined,
  CodeOutlined,
  KeyOutlined,
  TeamOutlined,
  ApiOutlined,
  EditOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../stores/project';

export const ProjectDetailLayout: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  React.useEffect(() => {
    if (projectName) {
      setCurrentProject(projectName);
    }
  }, [projectName, setCurrentProject]);

  // URL pattern: /v1/projects/detail/:projectName/:subTab
  const pathSegments = location.pathname.split('/');
  const currentTab = pathSegments[5] || 'pipelines';

  const baseTabItems = [
    {
      key: 'detail',
      label: (
        <span>
          <ProjectOutlined /> 项目概览
        </span>
      ),
    },
    {
      key: 'sprints',
      label: (
        <span>
          <ScheduleOutlined /> 迭代管理
        </span>
      ),
    },
    {
      key: 'pipelines',
      label: (
        <span>
          <BranchesOutlined /> 工作流
        </span>
      ),
    },
    {
      key: 'envs',
      label: (
        <span>
          <ClusterOutlined /> 环境
        </span>
      ),
    },
    {
      key: 'services',
      label: (
        <span>
          <CloudServerOutlined /> 服务配置
        </span>
      ),
    },
    {
      key: 'builds',
      label: (
        <span>
          <ToolOutlined /> 构建
        </span>
      ),
    },
    {
      key: 'test',
      label: (
        <span>
          <CheckCircleOutlined /> 测试
        </span>
      ),
    },
    {
      key: 'scanner',
      label: (
        <span>
          <SafetyCertificateOutlined /> 代码审查
        </span>
      ),
    },
    {
      key: 'version',
      label: (
        <span>
          <HistoryOutlined /> 版本管理
        </span>
      ),
    },
  ];

  // Extra tabs if navigated into project configuration sub-views
  const configTabs: Record<string, { label: React.ReactNode }> = {
    group: {
      label: (
        <span>
          <CodeOutlined /> 变量组
        </span>
      ),
    },
    secrets: {
      label: (
        <span>
          <KeyOutlined /> 共享变量
        </span>
      ),
    },
    rbac: {
      label: (
        <span>
          <TeamOutlined /> 成员权限
        </span>
      ),
    },
    integration: {
      label: (
        <span>
          <ApiOutlined /> 项目集成
        </span>
      ),
    },
  };

  const isConfigTab = Object.keys(configTabs).includes(currentTab);
  const tabItems = isConfigTab
    ? [...baseTabItems, { key: currentTab, label: configTabs[currentTab].label }]
    : baseTabItems;

  const handleTabChange = (key: string) => {
    navigate(`/v1/projects/detail/${projectName}/${key}`);
  };

  // Project configuration dropdown menu matching live Zadig subTopbarMenu.projectConfig
  const configMenuItems: MenuProps['items'] = [
    {
      key: 'group',
      icon: <CodeOutlined />,
      label: '变量组',
      onClick: () => navigate(`/v1/projects/detail/${projectName}/group`),
    },
    {
      key: 'secrets',
      icon: <KeyOutlined />,
      label: '共享变量',
      onClick: () => navigate(`/v1/projects/detail/${projectName}/secrets`),
    },
    {
      key: 'rbac',
      icon: <TeamOutlined />,
      label: '项目权限',
      onClick: () => navigate(`/v1/projects/detail/${projectName}/rbac`),
    },
    {
      key: 'integration',
      icon: <ApiOutlined />,
      label: '系统集成',
      onClick: () => navigate(`/v1/projects/detail/${projectName}/integration`),
    },
    { type: 'divider' },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '修改项目',
      onClick: () => navigate(`/v1/projects/edit/${projectName}`),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%' }}>
      {/* Horizontal Secondary Sub-Navigation Tab Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #ebeef5',
          padding: '0 24px',
        }}
      >
        <Tabs
          activeKey={currentTab}
          items={tabItems}
          onChange={handleTabChange}
          style={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Dropdown menu={{ items: configMenuItems }} placement="bottomRight">
              <Button type="text" icon={<SettingOutlined />} style={{ color: '#4b5563' }}>
                <Space orientation="horizontal" size={4}>
                  项目配置
                  <DownOutlined style={{ fontSize: 10 }} />
                </Space>
              </Button>
            </Dropdown>
          }
        />
      </div>

      {/* Project Tab Workspace Content */}
      <div style={{ padding: '16px 24px', flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default ProjectDetailLayout;
