import React, { useRef } from 'react';
import {
  ProTable,
  ModalForm,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Typography } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ProjectOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../../api/project';
import { useProjectStore, type ProjectItem } from '../../stores/project';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export const ProjectsPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const navigate = useNavigate();
  const { setCurrentProject, setProjects } = useProjectStore();

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await projectApi.createProject({
        project_name: values.project_name as string,
        alias: values.alias as string,
        desc: values.desc as string,
      });
      feedback.message.success('项目创建成功！');
      actionRef.current?.reload();
      return true;
    } catch {
      return false;
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await projectApi.deleteProject(name);
      feedback.message.success(`项目 ${name} 已删除`);
      actionRef.current?.reload();
    } catch {
      // Handled
    }
  };

  const handleEnterProject = (project: ProjectItem) => {
    const projectName = project.name || project.product_name || '';
    setCurrentProject(projectName);
    feedback.message.info(`已进入项目: ${projectName}`);
    navigate('/v1/services');
  };

  const columns: ProColumns<ProjectItem>[] = [
    {
      title: '项目标识 (Name)',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => {
        const name = record.name || record.product_name || '-';
        return (
          <Space orientation="horizontal">
            <ProjectOutlined style={{ color: '#0066ff' }} />
            <Button
              type="link"
              style={{ padding: 0, fontWeight: 600 }}
              onClick={() => handleEnterProject(record)}
            >
              {name}
            </Button>
          </Space>
        );
      },
    },
    {
      title: '显示别名',
      dataIndex: 'alias',
      key: 'alias',
      render: (text) => (
        <Text>{text ? String(text) : '-'}</Text>
      ),
    },
    {
      title: '项目描述',
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
      render: (text) => <Text type="secondary">{String(text || '无描述')}</Text>,
    },
    {
      title: '状态',
      key: 'status',
      render: () => <Tag color="success">正常可用</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => {
        const name = record.name || record.product_name || '';
        return [
          <Button
            key="enter"
            type="link"
            icon={<ArrowRightOutlined />}
            onClick={() => handleEnterProject(record)}
          >
            进入项目
          </Button>,
          <Popconfirm
            key="delete"
            title={`确定删除项目 ${name}？`}
            description="删除项目将一并清除其所属的服务配置与工作流。"
            onConfirm={() => handleDelete(name)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  return (
    <div>
      <ProTable<ProjectItem>
        headerTitle="云原生项目工作区 (Projects)"
        actionRef={actionRef}
        rowKey={(r) => r.name || r.product_name || Math.random().toString()}
        search={false}
        cardBordered={false}
        options={{ density: false, fullScreen: true, reload: true, setting: false }}
        request={async () => {
          const list = await projectApi.getProjects({ ungrouped: true });
          setProjects(list);
          return {
            data: list,
            success: true,
            total: list.length,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <ModalForm
            key="add-project"
            title="新建云原生项目"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建项目
              </Button>
            }
            width={520}
            onFinish={handleCreate}
          >
            <ProFormText
              name="project_name"
              label="项目标识名称 (DNS 命名规范)"
              placeholder="例如: demo-microservices"
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
          </ModalForm>,
        ]}
      />
    </div>
  );
};

export default ProjectsPage;
