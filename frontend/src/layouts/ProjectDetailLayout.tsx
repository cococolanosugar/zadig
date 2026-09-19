import React from 'react';
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, Button } from 'antd';
import {
  PlusOutlined,
  BranchesOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  ScheduleOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { feedback } from '../utils/feedback';

export const ProjectDetailLayout: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // URL pattern: /v1/projects/detail/:projectName/:subTab
  const pathSegments = location.pathname.split('/');
  const currentTab = pathSegments[5] || 'pipelines';

  const tabItems = [
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

  const handleTabChange = (key: string) => {
    navigate(`/v1/projects/detail/${projectName}/${key}`);
  };

  const renderTabExtra = () => {
    if (currentTab === 'pipelines') {
      return (
        <Button
          type="primary"
          ghost
          icon={<PlusOutlined />}
          style={{ borderColor: '#0066ff', color: '#0066ff' }}
          onClick={() => feedback.message.info('新建工作流向导')}
        >
          新建工作流
        </Button>
      );
    }
    if (currentTab === 'envs') {
      return (
        <Button
          type="primary"
          ghost
          icon={<PlusOutlined />}
          style={{ borderColor: '#0066ff', color: '#0066ff' }}
          onClick={() => feedback.message.info('创建环境向导')}
        >
          创建环境
        </Button>
      );
    }
    if (currentTab === 'services') {
      return (
        <Button
          type="primary"
          ghost
          icon={<PlusOutlined />}
          style={{ borderColor: '#0066ff', color: '#0066ff' }}
          onClick={() => feedback.message.info('新建服务向导')}
        >
          新建服务
        </Button>
      );
    }
    return null;
  };

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
          tabBarExtraContent={renderTabExtra()}
          style={{ marginBottom: 0 }}
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
