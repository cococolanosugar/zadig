import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer,
  Tree,
  Input,
  Space,
  Button,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Empty,
} from 'antd';
import {
  ApartmentOutlined,
  ProjectOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  SearchOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { projectApi, type ProjectTemplateHierarchyInfo } from '../../api/project';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

interface ProjectHierarchyDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectHierarchyDrawer: React.FC<ProjectHierarchyDrawerProps> = ({
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [hierarchyData, setHierarchyData] = useState<ProjectTemplateHierarchyInfo[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectApi.getTemplatesHierarchyInfo();
      setHierarchyData(data);
      // 默认展开所有一级项目
      setExpandedKeys(data.map((p) => `p-${p.value}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目模板拓扑失败';
      feedback.message.error(msg);
      setHierarchyData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchHierarchy();
    }
  }, [open, fetchHierarchy]);

  // 计算统计指标
  const totalProjects = hierarchyData.length;
  let totalServices = 0;
  let totalContainers = 0;
  hierarchyData.forEach((p) => {
    totalServices += p.service_info?.length || 0;
    p.service_info?.forEach((s) => {
      totalContainers += s.container_info?.length || 0;
    });
  });

  // 转换为 Tree 组件支持的 DataNode 树
  const treeData = useMemo<DataNode[]>(() => {
    return hierarchyData.map((project) => {
      const pKey = `p-${project.value}`;
      const services = project.service_info || [];

      const pTitle = (
        <Space orientation="horizontal" size={6}>
          <ProjectOutlined style={{ color: '#0066ff' }} />
          <Text strong style={{ fontSize: 13 }}>
            {project.label || project.value}
          </Text>
          <Tag color="blue">{services.length} 服务</Tag>
        </Space>
      );

      const serviceNodes: DataNode[] = services.map((service) => {
        const sKey = `s-${project.value}-${service.value}`;
        const containers = service.container_info || [];

        const sTitle = (
          <Space orientation="horizontal" size={6}>
            <CloudServerOutlined style={{ color: '#52c41a' }} />
            <Text style={{ fontSize: 13 }}>{service.label || service.value}</Text>
            {containers.length > 0 && <Tag color="green">{containers.length} 模块</Tag>}
          </Space>
        );

        const containerNodes: DataNode[] = containers.map((container) => {
          const cKey = `c-${project.value}-${service.value}-${container.value}`;
          return {
            key: cKey,
            title: (
              <Space orientation="horizontal" size={6}>
                <DeploymentUnitOutlined style={{ color: '#722ed1' }} />
                <Text code style={{ fontSize: 12 }}>
                  {container.label || container.value}
                </Text>
              </Space>
            ),
            isLeaf: true,
          };
        });

        return {
          key: sKey,
          title: sTitle,
          children: containerNodes,
        };
      });

      return {
        key: pKey,
        title: pTitle,
        children: serviceNodes,
      };
    });
  }, [hierarchyData]);

  // 搜索过滤匹配节点 Keys
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSearchValue(value);
    if (!value) {
      setExpandedKeys(hierarchyData.map((p) => `p-${p.value}`));
      setAutoExpandParent(false);
      return;
    }

    const matchedKeys: string[] = [];
    hierarchyData.forEach((project) => {
      const pKey = `p-${project.value}`;
      let pMatched = project.label?.toLowerCase().includes(value.toLowerCase()) ||
        project.value.toLowerCase().includes(value.toLowerCase());

      project.service_info?.forEach((service) => {
        const sKey = `s-${project.value}-${service.value}`;
        let sMatched = service.label?.toLowerCase().includes(value.toLowerCase()) ||
          service.value.toLowerCase().includes(value.toLowerCase());

        service.container_info?.forEach((container) => {
          const cMatched = container.label?.toLowerCase().includes(value.toLowerCase()) ||
            container.value.toLowerCase().includes(value.toLowerCase());
          if (cMatched) {
            sMatched = true;
          }
        });

        if (sMatched) {
          matchedKeys.push(sKey);
          pMatched = true;
        }
      });

      if (pMatched) {
        matchedKeys.push(pKey);
      }
    });

    setExpandedKeys(matchedKeys);
    setAutoExpandParent(true);
  };

  const handleExpandAll = () => {
    const allKeys: string[] = [];
    hierarchyData.forEach((p) => {
      allKeys.push(`p-${p.value}`);
      p.service_info?.forEach((s) => {
        allKeys.push(`s-${p.value}-${s.value}`);
      });
    });
    setExpandedKeys(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  return (
    <Drawer
      title={
        <Space>
          <ApartmentOutlined style={{ color: '#0066ff' }} />
          <span>项目模板资源层级拓扑 (Project → Service → Container)</span>
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchHierarchy} loading={loading}>
            刷新
          </Button>
          <Button icon={<FolderOpenOutlined />} onClick={handleExpandAll}>
            展开全部
          </Button>
          <Button icon={<FolderOutlined />} onClick={handleCollapseAll}>
            收起全部
          </Button>
        </Space>
      }
    >
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '14px 18px', background: '#f8fafc' } }}>
            <Statistic
              title="项目模板"
              value={totalProjects}
              prefix={<ProjectOutlined style={{ color: '#0066ff' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '14px 18px', background: '#f8fafc' } }}>
            <Statistic
              title="微服务模板"
              value={totalServices}
              prefix={<CloudServerOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" styles={{ body: { padding: '14px 18px', background: '#f8fafc' } }}>
            <Statistic
              title="容器/服务模块"
              value={totalContainers}
              prefix={<DeploymentUnitOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索项目、服务或容器模块名称..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchValue}
          onChange={handleSearchChange}
          allowClear
        />
      </div>

      {/* 拓扑树展示 */}
      <Spin spinning={loading}>
        {treeData.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无项目模板数据"
          />
        ) : (
          <div
            style={{
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: 16,
              minHeight: 400,
            }}
          >
            <Tree
              showLine={{ showLeafIcon: false }}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onExpand={(keys) => {
                setExpandedKeys(keys);
                setAutoExpandParent(false);
              }}
              treeData={treeData}
            />
          </div>
        )}
      </Spin>
    </Drawer>
  );
};

export default ProjectHierarchyDrawer;
