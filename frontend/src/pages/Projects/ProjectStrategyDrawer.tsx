import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Switch,
  Tabs,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Spin,
  Divider,
  Popconfirm,
  App,
} from 'antd';
import {
  SlidersOutlined,
  SaveOutlined,
  UndoOutlined,
  PlusOutlined,
  DeleteOutlined,
  TagsOutlined,
  DeploymentUnitOutlined,
  HistoryOutlined,
  SearchOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import projectApi, {
  ProjectProductDetail,
  CustomRule,
} from '../../api/project';

const { Text } = Typography;

export interface ProjectStrategyDrawerProps {
  open: boolean;
  projectName: string;
  onClose: () => void;
}

const DEFAULT_IMAGE_RULE: CustomRule = {
  branch_rule: '{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}',
  pr_rule: '{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-pr-{{.REPO_PR}}',
  pr_and_branch_rule: '{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}-pr-{{.REPO_PR}}',
  tag_rule: '{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.REPO_TAG}}',
  commit_rule: '{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.REPO_COMMIT_ID}}',
};

const DEFAULT_TAR_RULE: CustomRule = {
  branch_rule: '{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}',
  pr_rule: '{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-pr-{{.REPO_PR}}',
  pr_and_branch_rule: '{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}-pr-{{.REPO_PR}}',
  tag_rule: '{{.SERVICE}}-{{.TIMESTAMP}}-{{.REPO_TAG}}',
  commit_rule: '{{.SERVICE}}-{{.TIMESTAMP}}-{{.REPO_COMMIT_ID}}',
};

const VARIABLE_TAGS = [
  { label: '{{.IMAGE_NAME}}', desc: '镜像名称' },
  { label: '{{.SERVICE}}', desc: '服务名称' },
  { label: '{{.TIMESTAMP}}', desc: '时间戳 (YYYYMMDDHHmmss)' },
  { label: '{{.TASK_ID}}', desc: '任务 ID' },
  { label: '{{.REPO_BRANCH}}', desc: 'Git 分支名' },
  { label: '{{.REPO_PR}}', desc: 'Pull Request ID' },
  { label: '{{.REPO_TAG}}', desc: 'Git 标签名' },
  { label: '{{.REPO_COMMIT_ID}}', desc: 'Git 短 Commit ID' },
];

export const ProjectStrategyDrawer: React.FC<ProjectStrategyDrawerProps> = ({
  open,
  projectName,
  onClose,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [rawProduct, setRawProduct] = useState<ProjectProductDetail | null>(null);

  const fetchProjectStrategy = async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const res = await projectApi.getProjectDetail(projectName);
      setRawProduct(res);

      form.setFieldsValue({
        release_max_history: res.release_max_history ?? 10,
        auto_deploy_enable: res.auto_deploy?.enable ?? false,
        custom_image_rule: {
          branch_rule: res.custom_image_rule?.branch_rule || DEFAULT_IMAGE_RULE.branch_rule,
          pr_rule: res.custom_image_rule?.pr_rule || DEFAULT_IMAGE_RULE.pr_rule,
          pr_and_branch_rule: res.custom_image_rule?.pr_and_branch_rule || DEFAULT_IMAGE_RULE.pr_and_branch_rule,
          tag_rule: res.custom_image_rule?.tag_rule || DEFAULT_IMAGE_RULE.tag_rule,
          commit_rule: res.custom_image_rule?.commit_rule || DEFAULT_IMAGE_RULE.commit_rule,
        },
        custom_tar_rule: {
          branch_rule: res.custom_tar_rule?.branch_rule || DEFAULT_TAR_RULE.branch_rule,
          pr_rule: res.custom_tar_rule?.pr_rule || DEFAULT_TAR_RULE.pr_rule,
          pr_and_branch_rule: res.custom_tar_rule?.pr_and_branch_rule || DEFAULT_TAR_RULE.pr_and_branch_rule,
          tag_rule: res.custom_tar_rule?.tag_rule || DEFAULT_TAR_RULE.tag_rule,
          commit_rule: res.custom_tar_rule?.commit_rule || DEFAULT_TAR_RULE.commit_rule,
        },
        image_searching_rules: res.image_searching_rules || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取项目策略配置失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && projectName) {
      fetchProjectStrategy();
    } else {
      form.resetFields();
      setRawProduct(null);
    }
  }, [open, projectName]);

  const handleResetImageRules = () => {
    form.setFieldsValue({ custom_image_rule: DEFAULT_IMAGE_RULE });
    message.success('已恢复容器镜像默认命名规则');
  };

  const handleResetTarRules = () => {
    form.setFieldsValue({ custom_tar_rule: DEFAULT_TAR_RULE });
    message.success('已恢复 TAR 包默认命名规则');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!rawProduct) return;

      setSaving(true);
      const payload: ProjectProductDetail = {
        ...rawProduct,
        release_max_history: Number(values.release_max_history) || 10,
        auto_deploy: {
          enable: !!values.auto_deploy_enable,
        },
        custom_image_rule: values.custom_image_rule,
        custom_tar_rule: values.custom_tar_rule,
        image_searching_rules: values.image_searching_rules || [],
      };

      await projectApi.updateProjectProduct(projectName, payload);
      message.success('项目策略与交付物配置已更新');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存配置失败，请检查规则格式';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderRuleVariablesHint = () => (
    <div style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        支持点击快速参考 Go 模板变量：
      </Text>
      <Space wrap size={[6, 6]}>
        {VARIABLE_TAGS.map((v) => (
          <Tag
            key={v.label}
            color="blue"
            style={{ cursor: 'pointer', fontFamily: 'monospace' }}
            title={v.desc}
          >
            {v.label} <span style={{ opacity: 0.75 }}>({v.desc})</span>
          </Tag>
        ))}
      </Space>
    </div>
  );

  return (
    <Drawer
      title={
        <Space>
          <SlidersOutlined style={{ color: '#0066ff' }} />
          <span>项目策略与交付物配置 ({projectName})</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      destroyOnHidden
      size={720}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSubmit}
          >
            保存配置
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Tabs
            defaultActiveKey="artifacts"
            items={[
              {
                key: 'artifacts',
                label: (
                  <Space>
                    <TagsOutlined />
                    <span>交付物命名规则</span>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Alert
                      type="info"
                      showIcon
                      title="交付物命名规则说明 (Artifact Naming Rules)"
                      description="构建产生镜像或 TAR 交付物时，系统将根据触发来源与参数渲染命名模板。镜像模板必须包含冒号(:)，变量请采用 Go 模板格式 {{.VARIABLE}}。"
                    />

                    {renderRuleVariablesHint()}

                    {/* Container Image Naming Rules */}
                    <Card
                      variant="borderless"
                      style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
                      title="容器镜像命名规则 (custom_image_rule)"
                      extra={
                        <Button
                          type="link"
                          size="small"
                          icon={<UndoOutlined />}
                          onClick={handleResetImageRules}
                        >
                          恢复默认
                        </Button>
                      }
                    >
                      <Form.Item
                        label="分支构建规则 (branch_rule)"
                        name={['custom_image_rule', 'branch_rule']}
                        rules={[{ required: true, message: '请输入分支构建规则' }]}
                        tooltip="执行分支构建时使用的镜像 Tag 模板"
                      >
                        <Input placeholder="{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}" />
                      </Form.Item>

                      <Form.Item
                        label="PR 构建规则 (pr_rule)"
                        name={['custom_image_rule', 'pr_rule']}
                        rules={[{ required: true, message: '请输入 PR 构建规则' }]}
                        tooltip="执行仅 Pull Request 构建时使用的镜像 Tag 模板"
                      >
                        <Input placeholder="{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-pr-{{.REPO_PR}}" />
                      </Form.Item>

                      <Form.Item
                        label="分支与 PR 联合规则 (pr_and_branch_rule)"
                        name={['custom_image_rule', 'pr_and_branch_rule']}
                        rules={[{ required: true, message: '请输入分支与 PR 规则' }]}
                        tooltip="同时指定分支与 PR 时使用的镜像 Tag 模板"
                      >
                        <Input placeholder="{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}-pr-{{.REPO_PR}}" />
                      </Form.Item>

                      <Form.Item
                        label="Git Tag 规则 (tag_rule)"
                        name={['custom_image_rule', 'tag_rule']}
                        rules={[{ required: true, message: '请输入 Tag 规则' }]}
                        tooltip="基于 Git Tag 构建时使用的镜像 Tag 模板"
                      >
                        <Input placeholder="{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.REPO_TAG}}" />
                      </Form.Item>

                      <Form.Item
                        label="Commit ID 规则 (commit_rule)"
                        name={['custom_image_rule', 'commit_rule']}
                        tooltip="可选，基于特定 Commit 构建时使用的镜像 Tag 模板"
                      >
                        <Input placeholder="{{.IMAGE_NAME}}:{{.TIMESTAMP}}-{{.REPO_COMMIT_ID}}" />
                      </Form.Item>
                    </Card>

                    {/* TAR Package Naming Rules */}
                    <Card
                      variant="borderless"
                      style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
                      title="TAR 压缩包命名规则 (custom_tar_rule)"
                      extra={
                        <Button
                          type="link"
                          size="small"
                          icon={<UndoOutlined />}
                          onClick={handleResetTarRules}
                        >
                          恢复默认
                        </Button>
                      }
                    >
                      <Form.Item
                        label="分支构建规则 (branch_rule)"
                        name={['custom_tar_rule', 'branch_rule']}
                        rules={[{ required: true, message: '请输入分支构建规则' }]}
                      >
                        <Input placeholder="{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}" />
                      </Form.Item>

                      <Form.Item
                        label="PR 构建规则 (pr_rule)"
                        name={['custom_tar_rule', 'pr_rule']}
                        rules={[{ required: true, message: '请输入 PR 构建规则' }]}
                      >
                        <Input placeholder="{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-pr-{{.REPO_PR}}" />
                      </Form.Item>

                      <Form.Item
                        label="分支与 PR 联合规则 (pr_and_branch_rule)"
                        name={['custom_tar_rule', 'pr_and_branch_rule']}
                        rules={[{ required: true, message: '请输入分支与 PR 规则' }]}
                      >
                        <Input placeholder="{{.SERVICE}}-{{.TIMESTAMP}}-{{.TASK_ID}}-{{.REPO_BRANCH}}-pr-{{.REPO_PR}}" />
                      </Form.Item>

                      <Form.Item
                        label="Git Tag 规则 (tag_rule)"
                        name={['custom_tar_rule', 'tag_rule']}
                        rules={[{ required: true, message: '请输入 Tag 规则' }]}
                      >
                        <Input placeholder="{{.SERVICE}}-{{.TIMESTAMP}}-{{.REPO_TAG}}" />
                      </Form.Item>

                      <Form.Item
                        label="Commit ID 规则 (commit_rule)"
                        name={['custom_tar_rule', 'commit_rule']}
                      >
                        <Input placeholder="{{.SERVICE}}-{{.TIMESTAMP}}-{{.REPO_COMMIT_ID}}" />
                      </Form.Item>
                    </Card>
                  </div>
                ),
              },
              {
                key: 'policy',
                label: (
                  <Space>
                    <HistoryOutlined />
                    <span>发布与更新策略</span>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card
                      variant="borderless"
                      style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
                    >
                      <Form.Item
                        label={
                          <Space>
                            <span style={{ fontWeight: 600 }}>最大历史版本保留数量 (releaseMaxHistory)</span>
                            <InfoCircleOutlined style={{ color: '#0066ff' }} />
                          </Space>
                        }
                        name="release_max_history"
                        rules={[
                          { required: true, message: '请输入最大历史版本数量' },
                          { type: 'number', min: 1, max: 100, message: '保留数量范围为 1 ~ 100' },
                        ]}
                        extra="适用于 Helm 发布版本保留数量限制，超出该数量的历史版本将被系统自动回收与清理（默认 10）。"
                      >
                        <InputNumber min={1} max={100} style={{ width: 200 }} />
                      </Form.Item>

                      <Divider style={{ margin: '16px 0' }} />

                      <Form.Item
                        label={
                          <Space>
                            <span style={{ fontWeight: 600 }}>服务自动更新 (autoDeploy)</span>
                            <DeploymentUnitOutlined style={{ color: '#52c41a' }} />
                          </Space>
                        }
                        name="auto_deploy_enable"
                        valuePropName="checked"
                        extra="开启后，当服务构建或交付物生成成功时，系统将自动触发关联测试与开发环境的服务更新部署。"
                      >
                        <Switch checkedChildren="已开启" unCheckedChildren="已关闭" />
                      </Form.Item>
                    </Card>
                  </div>
                ),
              },
              {
                key: 'searching',
                label: (
                  <Space>
                    <SearchOutlined />
                    <span>镜像检索规则</span>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Alert
                      type="info"
                      showIcon
                      title="镜像检索匹配规则 (Image Searching Rules)"
                      description="配置服务交付物在外部镜像仓库中的自动查找规则，帮助工作流精准定位产物镜像版本。"
                    />

                    <Form.List name="image_searching_rules">
                      {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {fields.map(({ key, name, ...restField }, idx) => (
                            <Card
                              key={key}
                              size="small"
                              variant="borderless"
                              style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
                              title={<Text strong>规则 #{idx + 1}</Text>}
                              extra={
                                <Popconfirm
                                  title="确认移除该检索规则？"
                                  onConfirm={() => remove(name)}
                                >
                                  <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                </Popconfirm>
                              }
                            >
                              <Space wrap style={{ width: '100%' }}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'repo']}
                                  label="镜像仓库"
                                  style={{ marginBottom: 8, minWidth: 160 }}
                                >
                                  <Input placeholder="docker.io" />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, 'namespace']}
                                  label="命名空间"
                                  style={{ marginBottom: 8, minWidth: 140 }}
                                >
                                  <Input placeholder="library" />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, 'image']}
                                  label="镜像名称"
                                  style={{ marginBottom: 8, minWidth: 160 }}
                                >
                                  <Input placeholder="demo-service" />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, 'tag']}
                                  label="Tag 规则"
                                  style={{ marginBottom: 8, minWidth: 140 }}
                                >
                                  <Input placeholder="^v[0-9]+.*$" />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, 'in_use']}
                                  label="启用"
                                  valuePropName="checked"
                                  style={{ marginBottom: 8 }}
                                >
                                  <Switch size="small" />
                                </Form.Item>
                              </Space>
                            </Card>
                          ))}

                          <Button
                            type="dashed"
                            onClick={() => add({ in_use: true })}
                            block
                            icon={<PlusOutlined />}
                          >
                            添加镜像检索规则
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Spin>
    </Drawer>
  );
};

export default ProjectStrategyDrawer;
