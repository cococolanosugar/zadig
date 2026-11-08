import React, { useEffect, useMemo, useState } from 'react';
import {
  App,
  Modal,
  Form,
  Input,
  Select,
  Radio,
  Space,
  Typography,
  Row,
  Col,
  Card,
  Tag,
  Button,
} from 'antd';
import {
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  DesktopOutlined,
  RobotOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { pinyin } from 'pinyin-pro';
import {
  projectApi,
  type AppType,
  type ProductFeature,
  type ProjectCardType,
} from '../../api/project';
import { settingsApi, type UserManagementItem } from '../../api/settings';
import { useAuthStore } from '../../stores/auth';

const { Text, Paragraph } = Typography;

export interface ProjectCreateWizardProps {
  open: boolean;
  onClose: () => void;
  groupName?: string;
  onCreated: (productName: string, type: ProjectCardType, appType?: AppType | '') => void;
}

interface CardMeta {
  type: ProjectCardType;
  title: string;
  firstDesc: string;
  secondDesc: string;
  icon: React.ReactNode;
  color: string;
}

const CARD_LIST: CardMeta[] = [
  {
    type: 'k8s',
    title: 'K8s YAML 项目',
    firstDesc: '基于原生 Kubernetes YAML 管理服务与环境',
    secondDesc: '适合已有 YAML 清单、需要精细编排的云原生交付',
    icon: <CloudServerOutlined />,
    color: '#1677ff',
  },
  {
    type: 'helm',
    title: 'K8s Helm Chart 项目',
    firstDesc: '基于 Helm Chart 管理服务版本与环境渲染',
    secondDesc: '适合 Chart 仓库驱动、多环境差异化配置场景',
    icon: <DeploymentUnitOutlined />,
    color: '#13c2c2',
  },
  {
    type: 'external',
    title: 'K8s 托管项目',
    firstDesc: '接入已有集群命名空间，托管外部运行中的服务',
    secondDesc: '适合存量环境纳管、渐进式迁移到 Zadig',
    icon: <ClusterOutlined />,
    color: '#722ed1',
  },
  {
    type: 'host',
    title: '自由项目',
    firstDesc: '面向主机或端侧应用的自由交付场景',
    secondDesc: '支持主机应用与移动端应用两种交付形态',
    icon: <DesktopOutlined />,
    color: '#fa8c16',
  },
  {
    type: 'agent',
    title: '智能体项目',
    firstDesc: '面向 Agent / 智能体交付的 5.0 核心能力',
    secondDesc: '适合 Agent 编排、工具链与运行时一体化管理',
    icon: <RobotOutlined />,
    color: '#eb2f96',
  },
];

/** 禁止任何卡片走默认兜底 */
export function resolveProductFeature(
  type: ProjectCardType,
  appType: AppType | '' = ''
): ProductFeature {
  switch (type) {
    case 'k8s':
      return {
        basic_facility: 'kubernetes',
        deploy_type: 'k8s',
        create_env_type: 'system',
        app_type: '',
      };
    case 'helm':
      return {
        basic_facility: 'kubernetes',
        deploy_type: 'helm',
        create_env_type: 'system',
        app_type: '',
      };
    case 'external':
      return {
        basic_facility: 'kubernetes',
        deploy_type: 'k8s',
        create_env_type: 'external',
        app_type: '',
      };
    case 'host':
      return {
        basic_facility: 'cloud_host',
        deploy_type: '',
        create_env_type: 'system',
        app_type: appType === 'mobile' ? 'mobile' : 'host',
      };
    case 'agent':
      return {
        basic_facility: 'agent',
        deploy_type: 'agent',
        create_env_type: 'system',
        app_type: '',
      };
    default: {
      const _exhaustive: never = type;
      throw new Error(`unsupported project card type: ${String(_exhaustive)}`);
    }
  }
}

export function getPostCreateRoute(
  projectName: string,
  type: ProjectCardType,
  appType: AppType | '' = ''
): string {
  switch (type) {
    case 'k8s':
      return `/v1/projects/create/${projectName}/k8s/info?rightbar=step`;
    case 'helm':
      return `/v1/projects/create/${projectName}/helm/info?rightbar=step`;
    case 'external':
      return `/v1/projects/create/${projectName}/host/config?step=1`;
    case 'host':
      return appType === 'mobile'
        ? `/v1/projects/create/${projectName}/app/info`
        : `/v1/projects/create/${projectName}/pm/info`;
    case 'agent':
      return `/v1/projects/detail/${projectName}/agents`;
    default: {
      const _exhaustive: never = type;
      throw new Error(`unsupported project card type: ${String(_exhaustive)}`);
    }
  }
}

function deriveProductName(displayName: string): string {
  const raw = pinyin(displayName, { toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32);
  return raw;
}

export const ProjectCreateWizard: React.FC<ProjectCreateWizardProps> = ({
  open,
  onClose,
  groupName,
  onCreated,
}) => {
  const { message } = App.useApp();
  const { userInfo } = useAuthStore();
  const [form] = Form.useForm();
  const [cardType, setCardType] = useState<ProjectCardType>('k8s');
  const [appType, setAppType] = useState<AppType>('host');
  const [productNameLocked, setProductNameLocked] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<UserManagementItem[]>([]);

  const currentUid = userInfo?.uid || '';

  useEffect(() => {
    if (!open) return;
    setCardType('k8s');
    setAppType('host');
    setProductNameLocked(true);
    form.resetFields();
    form.setFieldsValue({
      project_name: '',
      product_name: '',
      desc: '',
      public: false,
      admins: currentUid ? [currentUid] : [],
      group_name: groupName || undefined,
    });

    settingsApi
      .getUsersBrief()
      .then((list) => setUsers(list))
      .catch(() => setUsers([]));
  }, [open, form, currentUid, groupName]);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.uid,
        label: `${u.name || u.account || u.uid}${u.account && u.name ? ` (${u.account})` : ''}`,
      })),
    [users]
  );

  const handleDisplayNameChange = (value: string) => {
    form.setFieldValue('project_name', value);
    if (productNameLocked) {
      form.setFieldValue('product_name', deriveProductName(value));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const productName = String(values.product_name || '').trim();
      const feature = resolveProductFeature(cardType, cardType === 'host' ? appType : '');
      await projectApi.createProject({
        project_name: String(values.project_name || '').trim(),
        product_name: productName,
        desc: values.desc || '',
        enabled: true,
        public: Boolean(values.public),
        admins: Array.isArray(values.admins) ? values.admins : [],
        group_name: values.group_name || groupName || '',
        product_feature: feature,
      });
      message.success('项目创建成功');
      onCreated(productName, cardType, cardType === 'host' ? appType : '');
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '项目创建失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新建项目"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnHidden
      width={920}
      okText="创建并继续"
      cancelText="取消"
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">选择项目类型后填写基础信息与高级配置</Text>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {CARD_LIST.map((card) => {
          const selected = cardType === card.type;
          return (
            <Col xs={24} sm={12} md={8} key={card.type}>
              <Card
                hoverable
                variant={selected ? 'outlined' : 'borderless'}
                onClick={() => setCardType(card.type)}
                style={{
                  borderRadius: 8,
                  border: selected ? `2px solid ${card.color}` : '1px solid #f0f0f0',
                  background: selected ? `${card.color}08` : '#fafafa',
                  height: '100%',
                }}
                styles={{ body: { padding: 14 } }}
              >
                <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                  <Space>
                    <span style={{ color: card.color, fontSize: 20 }}>{card.icon}</span>
                    <Text strong>{card.title}</Text>
                    {selected && <Tag color="blue">已选</Tag>}
                  </Space>
                  <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                    {card.firstDesc}
                  </Paragraph>
                  <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                    {card.secondDesc}
                  </Paragraph>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      {cardType === 'host' && (
        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginRight: 12 }}>应用类型</Text>
          <Radio.Group
            value={appType}
            onChange={(e) => setAppType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: '主机应用', value: 'host' },
              { label: '端侧应用', value: 'mobile' },
            ]}
          />
        </div>
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          name="project_name"
          label="项目显示名称"
          rules={[{ required: true, message: '请输入项目显示名称' }]}
        >
          <Input
            placeholder="例如：业务中台"
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </Form.Item>

        <Form.Item
          label="项目标识"
          required
          extra="默认由显示名拼音自动推导；点击锁图标可手动编辑"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="product_name"
              noStyle
              rules={[
                { required: true, message: '请输入项目标识' },
                {
                  pattern: /^[a-z0-9][a-z0-9-]{0,31}$/,
                  message: '以小写字母或数字开头，仅含 a-z / 0-9 / -，最长 32',
                },
              ]}
            >
              <Input
                readOnly={productNameLocked}
                placeholder="例如：yewuzhongtai"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Button
              icon={productNameLocked ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => setProductNameLocked((v) => !v)}
            />
          </Space.Compact>
        </Form.Item>

        <Form.Item name="desc" label="项目描述">
          <Input.TextArea rows={2} placeholder="业务场景、所属团队及交付目标说明" />
        </Form.Item>

        <Form.Item
          name="public"
          label="访问权限"
          rules={[{ required: true, message: '请选择访问权限' }]}
        >
          <Radio.Group
            options={[
              { label: '私有', value: false },
              { label: '公开', value: true },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="admins"
          label="项目管理员"
          rules={[{ required: true, message: '请至少选择一名项目管理员' }]}
          extra="必须选择用户 uid，默认填入当前登录用户"
        >
          <Select
            mode="multiple"
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="搜索并选择管理员"
            options={userOptions}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item name="group_name" label="归属分组">
          <Input placeholder="可选，默认继承当前分组 Tab" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectCreateWizard;
