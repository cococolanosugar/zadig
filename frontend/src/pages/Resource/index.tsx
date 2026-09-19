import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  HddOutlined,
  BranchesOutlined,
  ContainerOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import ClustersPage from '../Settings/Clusters';
import CodeHostsPage from '../Settings/CodeHosts';
import RegistriesPage from '../Settings/Registries';
import StoragePage from '../Settings/Storage';

const { Title, Text } = Typography;

export const ResourcePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cluster');

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
      key: 'codehost',
      label: (
        <span>
          <BranchesOutlined /> 代码源集成
        </span>
      ),
      children: <CodeHostsPage />,
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
      key: 'storage',
      label: (
        <span>
          <CloudUploadOutlined /> 对象存储
        </span>
      ),
      children: <StoragePage />,
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          资源配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          统一纳管与调度计算集群、代码托管平台、容器镜像仓库以及文件/制品存储
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
          onChange={(k) => setActiveTab(k)}
          tabBarStyle={{ marginBottom: 20 }}
        />
      </Card>
    </div>
  );
};

export default ResourcePage;
