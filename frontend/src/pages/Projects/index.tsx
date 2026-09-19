import React, { useState, useEffect, useCallback } from 'react';
import {
  ModalForm,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Button,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Input,
  Radio,
  Tabs,
  Card,
  Row,
  Col,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  UserOutlined,
  ClockCircleOutlined,
  DeploymentUnitOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { projectApi } from '../../api/project';
import { useProjectStore, type ProjectItem } from '../../stores/project';
import { feedback } from '../../utils/feedback';

const { Title, Text } = Typography;

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentProject, setProjects } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [projectList, setProjectList] = useState<ProjectItem[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [searchText, setSearchText] = useState('');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [projects, groupList] = await Promise.all([
        projectApi.getProjects({
          filter: searchText,
          ungrouped: activeGroup === 'ungrouped',
          group_name: activeGroup !== 'all' && activeGroup !== 'ungrouped' ? activeGroup : '',
        }),
        projectApi.getProjectGroups(),
      ]);
      setProjectList(projects);
      setProjects(projects);
      setGroups(groupList);
    } catch {
      feedback.message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchText, activeGroup, setProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await projectApi.createProject({
        project_name: values.project_name as string,
        alias: values.alias as string,
        desc: values.desc as string,
      });
      feedback.message.success('项目创建成功！');
      fetchProjects();
      return true;
    } catch {
      return false;
    }
  };

  const handleDelete = async (name: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await projectApi.deleteProject(name);
      feedback.message.success(`项目 ${name} 已删除`);
      fetchProjects();
    } catch {
      // Handled
    }
  };

  const handleEnterProject = (project: ProjectItem) => {
    const projectName = project.name || project.product_name || '';
    setCurrentProject(projectName);
    feedback.message.info(`已进入项目: ${projectName}`);
    navigate(`/v1/projects/detail/${projectName}/pipelines`);
  };

  const filteredProjects = projectList.filter((p) => {
    const name = p.name || p.product_name || '';
    const alias = p.alias || '';
    if (!searchText) return true;
    return (
      name.toLowerCase().includes(searchText.toLowerCase()) ||
      alias.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const tabItems = [
    { key: 'all', label: '所有' },
    { key: 'ungrouped', label: '未分组' },
    ...groups.map((g) => ({ key: g.name, label: g.name })),
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      {/* Top Header & Action Controls matching live Zadig */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
            项目
          </Title>
          <Input
            placeholder="搜索项目"
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240, borderRadius: 4 }}
          />
        </div>

        <Space orientation="horizontal" size={12}>
          {/* Dual View Switcher (Card / Table) */}
          <Radio.Group
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            buttonStyle="solid"
          >
            <Tooltip title="卡片视图">
              <Radio.Button value="card">
                <AppstoreOutlined />
              </Radio.Button>
            </Tooltip>
            <Tooltip title="列表视图">
              <Radio.Button value="table">
                <UnorderedListOutlined />
              </Radio.Button>
            </Tooltip>
          </Radio.Group>

          {/* Create Project Modal */}
          <ModalForm
            title="新建云原生项目"
            trigger={
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 4 }}>
                新建项目
              </Button>
            }
            width={520}
            onFinish={handleCreate}
          >
            <ProFormText
              name="project_name"
              label="项目标识名称 (DNS 命名规范)"
              placeholder="例如: demo-k8s"
              rules={[
                { required: true, message: '请输入项目英文标识' },
                { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和中划线' },
              ]}
            />

            <ProFormText
              name="alias"
              label="项目显示别名"
              placeholder="例如: 业务中台微服务体系"
            />

            <ProFormTextArea
              name="desc"
              label="项目详细描述"
              placeholder="业务场景、所属团队及交付目标说明"
            />
          </ModalForm>
        </Space>
      </div>

      {/* Group Tabs */}
      <div style={{ marginBottom: 16, borderBottom: '1px solid #e4e7ed' }}>
        <Tabs
          activeKey={activeGroup}
          items={tabItems}
          onChange={(key) => setActiveGroup(key)}
          tabBarStyle={{ marginBottom: 0 }}
        />
      </div>

      {/* Main View: Card View vs Table View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card variant="borderless" style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0' }}>
          <Empty description="暂无匹配的项目" />
        </Card>
      ) : viewMode === 'card' ? (
        <>
          <Row gutter={[16, 16]}>
            {filteredProjects.map((project) => {
              const name = project.name || project.product_name || '';
              const alias = project.alias || '';
              const updatedBy = project.updatedBy || 'admin@qq.com';
              const updateTime = project.updatedAt
                ? dayjs(project.updatedAt * 1000).format('YYYY-MM-DD HH:mm')
                : dayjs().format('YYYY-MM-DD HH:mm');

              return (
                <Col xs={24} sm={12} md={8} lg={6} key={name}>
                  <Card
                    hoverable
                    variant="borderless"
                    onClick={() => handleEnterProject(project)}
                    style={{
                      borderRadius: 8,
                      border: '1px solid #ebeef5',
                      boxShadow: '0 1px 4px rgba(0, 21, 41, 0.04)',
                      transition: 'all 0.2s',
                    }}
                    styles={{
                      body: { padding: '20px' },
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: '#e6f4ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <DeploymentUnitOutlined style={{ fontSize: 24, color: '#0066ff' }} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <Tooltip title={name}>
                            <Text
                              strong
                              style={{
                                fontSize: 16,
                                color: '#1f2d3d',
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {name}
                            </Text>
                          </Tooltip>
                          {alias && (
                            <Text
                              type="secondary"
                              style={{
                                fontSize: 12,
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {alias}
                            </Text>
                          )}
                        </div>
                      </div>

                      <Popconfirm
                        title={`确定删除项目 ${name}？`}
                        description="删除项目将一并清除其所属的服务配置与工作流。"
                        onConfirm={(e) => handleDelete(name, e)}
                        okText="删除"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                          style={{ opacity: 0.6 }}
                        />
                      </Popconfirm>
                    </div>

                    <div
                      style={{
                        marginTop: 20,
                        paddingTop: 12,
                        borderTop: '1px solid #f0f2f5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        color: '#909399',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UserOutlined />
                        <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {updatedBy}
                        </span>
                      </span>

                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ClockCircleOutlined />
                        <span>{updateTime}</span>
                      </span>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* Bottom message matching live Zadig */}
          <div style={{ textAlign: 'center', color: '#909399', padding: '28px 0', fontSize: 13 }}>
            项目已全部加载完毕
          </div>
        </>
      ) : (
        /* Table View */
        <Card variant="borderless" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
            共 {filteredProjects.length} 个项目
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>项目标识 (Name)</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>显示别名</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>创建/更新人</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>更新时间</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>状态</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((record) => {
                  const name = record.name || record.product_name || '';
                  const updateTime = record.updatedAt
                    ? dayjs(record.updatedAt * 1000).format('YYYY-MM-DD HH:mm')
                    : '-';

                  return (
                    <tr
                      key={name}
                      style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                      onClick={() => handleEnterProject(record)}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <Space orientation="horizontal">
                          <DeploymentUnitOutlined style={{ color: '#0066ff' }} />
                          <Button type="link" style={{ padding: 0, fontWeight: 600 }}>
                            {name}
                          </Button>
                        </Space>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#595959' }}>
                        {record.alias || '-'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#595959' }}>
                        {record.updatedBy || 'admin@qq.com'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#8c8c8c' }}>
                        {updateTime}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <Tag color="success">正常可用</Tag>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <Space orientation="horizontal" size={8} onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="link"
                            icon={<ArrowRightOutlined />}
                            onClick={() => handleEnterProject(record)}
                          >
                            进入项目
                          </Button>
                          <Popconfirm
                            title={`确定删除项目 ${name}？`}
                            description="删除项目将一并清除其所属的服务配置与工作流。"
                            onConfirm={() => handleDelete(name)}
                            okText="删除"
                            cancelText="取消"
                          >
                            <Button type="link" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProjectsPage;
