import React, { useState, useEffect } from 'react';
import { Card, Tabs, Typography } from 'antd';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  HddOutlined,
  BranchesOutlined,
  ContainerOutlined,
  CloudUploadOutlined,
  DesktopOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import ClustersPage from '../Settings/Clusters';
import CodeHostsPage from '../Settings/CodeHosts';
import RegistriesPage from '../Settings/Registries';
import StoragePage from '../Settings/Storage';
import VMsPage from '../Settings/VMs';
import ChartReposPage from '../Settings/ChartRepos';
import DBInstancesPage from '../Settings/DBInstances';

const { Title, Text } = Typography;

export const ResourcePage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract tab from URL path (e.g. /v1/resource/cluster) or params
  const pathSegment = location.pathname.split('/')[3];
  const initialTab = tab || pathSegment || searchParams.get('tab') || 'cluster';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const current = tab || pathSegment || searchParams.get('tab');
    if (current) {
      setActiveTab(current);
    }
  }, [tab, pathSegment, searchParams]);

  const handleTabChange = (k: string) => {
    setActiveTab(k);
    navigate(`/v1/resource/${k}`);
  };

  // Order conforming strictly to live Zadig 6-resource tabs
  const tabItems = [
    {
      key: 'cluster',
      label: (
        <span>
          <HddOutlined /> Kubernetes 集群
        </span>
      ),
      children: <ClustersPage />,
    },
    {
      key: 'host',
      label: (
        <span>
          <DesktopOutlined /> 主机管理
        </span>
      ),
      children: <VMsPage />,
    },
    {
      key: 'registry',
      label: (
        <span>
          <ContainerOutlined /> 镜像仓库
        </span>
      ),
      children: <RegistriesPage />,
    },
    {
      key: 'helmChartRepo',
      label: (
        <span>
          <AppstoreOutlined /> Chart 仓库
        </span>
      ),
      children: <ChartReposPage />,
    },
    {
      key: 'storage',
      label: (
        <span>
          <CloudUploadOutlined /> 对象存储
        </span>
      ),
      children: <StoragePage />,
    },
    {
      key: 'database',
      label: (
        <span>
          <DatabaseOutlined /> 数据库
        </span>
      ),
      children: <DBInstancesPage />,
    },
    {
      key: 'codehost',
      label: (
        <span>
          <BranchesOutlined /> 代码源集成
        </span>
      ),
      children: <CodeHostsPage />,
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          资源配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          统一纳管与调度计算集群、主机节点、容器镜像仓库、Chart 仓库以及对象存储与数据库
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={handleTabChange}
          tabBarStyle={{ marginBottom: 20 }}
        />
      </Card>
    </div>
  );
};

export default ResourcePage;
