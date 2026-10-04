import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Radio,
  Switch,
  Card,
  Row,
  Col,
  InputNumber,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { workflowApi, type WorkflowJob } from '../../api/workflow';
import { feedback } from '../../utils/feedback';
import YamlEditor from '../Editor/YamlEditor';
import http from '../../api/client';

const { Title } = Typography;

export interface JobConfigDrawerProps {
  visible: boolean;
  job: WorkflowJob | null;
  onClose: () => void;
  onSave: (updatedJob: WorkflowJob) => void;
}

export const JobConfigDrawer: React.FC<JobConfigDrawerProps> = ({
  visible,
  job,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [envOptions, setEnvOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [testOptions, setTestOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [scanOptions, setScanOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [clusterOptions, setClusterOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [customDeploySource, setCustomDeploySource] = useState<'runtime' | 'fromjob'>('runtime');
  const [notificationWebhookType, setNotificationWebhookType] = useState<string>('dingding');
  const [deployType, setDeployType] = useState<'k8s' | 'helm'>('k8s');
  const [vmDeploySource, setVmDeploySource] = useState<'runtime' | 'fromjob'>('runtime');
  const [mergingImage, setMergingImage] = useState(false);
  const [validatingSQL, setValidatingSQL] = useState(false);

  useEffect(() => {
    if (job) {
      const isHelm = job.type === 'zadig-deploy' && job.spec?.deploy_type === 'helm';
      setDeployType(isHelm ? 'helm' : 'k8s');
      const vmSrc = (job.spec?.source as 'runtime' | 'fromjob') || 'runtime';
      setVmDeploySource(vmSrc);
      const cdSrc = (job.spec?.source as 'runtime' | 'fromjob') || 'runtime';
      setCustomDeploySource(cdSrc);
      const notifType = (job.spec?.webhook_type as string) || 'dingding';
      setNotificationWebhookType(notifType);

      form.setFieldsValue({
        name: job.name,
        type: job.type,
        deploy_type: isHelm ? 'helm' : (job.spec?.deploy_type || 'k8s'),
        service_name: job.spec?.service_name || '',
        env: job.spec?.env || 'dev',
        image: job.spec?.image || '',
        values_yaml: (job.spec?.values_yaml as string) || (job.spec?.variable_yaml as string) || '',
        update_service_revision: !!job.spec?.update_service_revision,
        branch: job.spec?.branch || 'main',
        dockerfile: job.spec?.dockerfile || 'Dockerfile',
        script: job.spec?.script || '#!/bin/bash\necho "Executing custom task..."\nmake test',
        test_name: job.spec?.test_name || '',
        scanning_id: job.spec?.scanning_id || '',
        target_env: job.spec?.target_env || '',
        sql_type: (job.spec?.type as string) || 'mysql',
        sql: (job.spec?.sql as string) || 'CREATE TABLE example (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  name VARCHAR(64) NOT NULL\n);',
        db_instance_id: (job.spec?.id as string) || '',
        // zadig-helm-chart-deploy
        skip_check_run_status: !!job.spec?.skip_check_run_status,
        deploy_helm_charts: Array.isArray(job.spec?.deploy_helm_charts) && job.spec.deploy_helm_charts.length > 0
          ? job.spec.deploy_helm_charts
          : [{ release_name: '', chart_repo: '', chart_name: '', chart_version: '', values_yaml: '' }],
        // zadig-vm-deploy
        source: vmSrc,
        job_name: job.spec?.job_name || '',
        service_and_vm_deploys: Array.isArray(job.spec?.service_and_vm_deploys) && job.spec.service_and_vm_deploys.length > 0
          ? job.spec.service_and_vm_deploys
          : [{ service_name: '', service_module: '', deploy_name: '', deploy_artifact_type: 'file', file_name: '', artifact_url: '', image: '' }],
        // custom-deploy
        cluster_id: job.spec?.cluster_id || '',
        namespace: job.spec?.namespace || '',
        timeout: job.spec?.timeout || 60,
        cd_skip_check_run_status: !!job.spec?.skip_check_run_status,
        cd_source: cdSrc,
        cd_job_name: job.spec?.job_name || '',
        targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ target: '', image: '' }],
        // k8s-resource-patch
        patch_items: Array.isArray(job.spec?.patch_items) && job.spec.patch_items.length > 0
          ? job.spec.patch_items
          : [{ resource_kind: 'Deployment', resource_name: '', patch_strategy: 'strategic-merge', patch_content: '' }],
        // offline-service
        env_type: (job.spec?.env_type as string) || 'zadig',
        env_name: (job.spec?.env_name as string) || '',
        offline_source: (job.spec?.source as string) || 'fixed',
        services: Array.isArray(job.spec?.services) ? job.spec.services : [],
        // notification
        webhook_type: notifType,
        title: (job.spec?.title as string) || '',
        content: (job.spec?.content as string) || '',
        webhook_url:
          job.spec?.dingding_notification_config?.webhook ||
          job.spec?.wechat_notification_config?.webhook ||
          job.spec?.feishu_notification_config?.webhook ||
          job.spec?.webhook_notification_config?.webhook ||
          '',
        is_at_all: !!job.spec?.dingding_notification_config?.is_at_all,
        // workflow-trigger
        trigger_type: (job.spec?.trigger_type as string) || 'fixed',
        is_enable_check: !!job.spec?.is_enable_check,
        fixed_workflow_list: Array.isArray(job.spec?.fixed_workflow_list) && job.spec.fixed_workflow_list.length > 0
          ? job.spec.fixed_workflow_list
          : [{ project_name: (job.spec?.project_name as string) || '', workflow_name: '', service_name: '' }],
      });
    }
  }, [job, form]);

  // 按需加载环境/测试/扫描/集群列表
  useEffect(() => {
    if (!visible || !job) return;
    const projectName = job.spec?.project_name as string | undefined;
    // 环境列表
    if (
      job.type === 'zadig-deploy' ||
      job.type === 'zadig-helm-chart-deploy' ||
      job.type === 'zadig-vm-deploy' ||
      job.type === 'zadig-restart' ||
      job.type === 'offline-service'
    ) {
      http
        .get<Array<{ name: string; alias?: string }>>(`/api/aslan/environment/environments?projectName=${projectName || ''}`, {
          skipErrorHandler: true,
        })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setEnvOptions(list.map((e) => ({ label: e.alias ? `${e.name} (${e.alias})` : e.name, value: e.name })));
        })
        .catch(() => setEnvOptions([]));
    }
    // 集群列表
    if (job.type === 'custom-deploy' || job.type === 'k8s-resource-patch') {
      http
        .get<Array<{ id?: string; _id?: string; name?: string }>>(`/api/aslan/cluster/clusters?projectName=${projectName || ''}`, {
          skipErrorHandler: true,
        })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setClusterOptions(
            list.map((c) => ({
              label: c.name || c.id || c._id || 'Cluster',
              value: (c.id || c._id || '') as string,
            }))
          );
        })
        .catch(() => setClusterOptions([]));
    }
    if (job.type === 'zadig-test') {
      http
        .get<Array<{ name: string }>>('/api/aslan/testing/test', { skipErrorHandler: true })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setTestOptions(list.map((t) => ({ label: t.name, value: t.name })));
        })
        .catch(() => setTestOptions([]));
    }
    if (job.type === 'zadig-scanning') {
      http
        .get<Array<{ id: string; name: string }>>('/api/aslan/testing/scanning', { skipErrorHandler: true })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setScanOptions(list.map((s) => ({ label: s.name, value: s.id })));
        })
        .catch(() => setScanOptions([]));
    }
  }, [visible, job]);

  const handleMergeImage = async (overrideImage?: string) => {
    const targetImage = overrideImage !== undefined ? overrideImage : form.getFieldValue('image');
    if (!targetImage || !targetImage.trim()) {
      return;
    }
    const env = form.getFieldValue('env') || job?.spec?.env;
    const serviceName = form.getFieldValue('service_name') || job?.spec?.service_name;
    const currentValues = form.getFieldValue('values_yaml') || '';
    const updateRevision = !!form.getFieldValue('update_service_revision');
    const projectName = (job?.spec?.project_name as string) || '';

    if (!projectName || !env || !serviceName) {
      return;
    }

    try {
      setMergingImage(true);
      const res = await workflowApi.mergeHelmDeployImage(projectName, {
        service_name: serviceName,
        env_name: env,
        production: false,
        update_service_revision: updateRevision,
        values_yaml: currentValues,
        service_modules: [
          {
            name: serviceName,
            image: targetImage.trim(),
          },
        ],
      });
      if (res && typeof res.values === 'string') {
        form.setFieldsValue({ values_yaml: res.values });
        feedback.message.success('已自动将镜像地址合并至 Helm Values YAML');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data?.description ||
        (err as { message?: string })?.message;
      if (msg) {
        feedback.message.warning(`合并镜像提示: ${msg}`);
      }
    } finally {
      setMergingImage(false);
    }
  };

  const handleValidateSQL = async () => {
    const sqlType = (form.getFieldValue('sql_type') as 'mysql' | 'mariadb') || 'mysql';
    const sqlText = form.getFieldValue('sql') || '';
    if (!sqlText.trim()) {
      feedback.message.warning('请输入待校验的 SQL 脚本语句');
      return;
    }
    setValidatingSQL(true);
    try {
      const errs = await workflowApi.validateSQL({
        type: sqlType,
        sql: sqlText,
      });
      if (errs.length === 0) {
        feedback.message.success('SQL 语法校验通过，未发现语法错误');
      } else {
        feedback.message.error(`SQL 语法校验失败: ${errs.map((e) => e.message).join('; ')}`);
      }
    } finally {
      setValidatingSQL(false);
    }
  };

  const handleFinish = (values: Record<string, unknown>) => {
    if (!job) return;
    const isHelm = job.type === 'zadig-deploy' && values.deploy_type === 'helm';
    const updated: WorkflowJob = {
      ...job,
      name: values.name as string,
      spec: {
        ...job.spec,
        service_name: values.service_name as string,
        env: values.env as string,
        deploy_type: isHelm ? 'helm' : (values.deploy_type as string) || 'k8s',
        image: values.image as string,
        values_yaml: values.values_yaml as string,
        variable_yaml: values.values_yaml as string,
        update_service_revision: values.update_service_revision as boolean,
        branch: values.branch as string,
        dockerfile: values.dockerfile as string,
        script: values.script as string,
        test_name: values.test_name as string,
        scanning_id: values.scanning_id as string,
        target_env: values.target_env as string,
        sql: values.sql as string,
        type: (values.sql_type as string) || (job.spec?.type as string) || 'mysql',
        id: values.db_instance_id as string,
        // zadig-helm-chart-deploy
        skip_check_run_status: values.skip_check_run_status as boolean,
        deploy_helm_charts: values.deploy_helm_charts as any[],
        // zadig-vm-deploy
        source: values.source as string,
        job_name: values.source === 'fromjob' ? (values.job_name as string) : undefined,
        service_and_vm_deploys: values.service_and_vm_deploys as any[],
        // custom-deploy
        ...(job.type === 'custom-deploy'
          ? {
              cluster_id: (values.cluster_id as string) || '',
              namespace: (values.namespace as string) || '',
              timeout: Number(values.timeout) || 60,
              skip_check_run_status: !!values.cd_skip_check_run_status,
              source: (values.cd_source as string) || 'runtime',
              job_name: values.cd_source === 'fromjob' ? (values.cd_job_name as string) : undefined,
              targets: Array.isArray(values.targets) ? values.targets : [],
            }
          : {}),
        // k8s-resource-patch
        ...(job.type === 'k8s-resource-patch'
          ? {
              cluster_id: (values.cluster_id as string) || '',
              namespace: (values.namespace as string) || '',
              patch_items: Array.isArray(values.patch_items) ? values.patch_items : [],
            }
          : {}),
        // offline-service
        ...(job.type === 'offline-service'
          ? {
              env_type: 'zadig',
              env_name: (values.env_name as string) || '',
              source: (values.offline_source as string) || 'fixed',
              services: Array.isArray(values.services)
                ? (values.services as string[])
                : values.services
                ? [values.services as string]
                : [],
            }
          : {}),
        // notification
        ...(job.type === 'notification'
          ? {
              webhook_type: (values.webhook_type as string) || 'dingding',
              title: (values.title as string) || '',
              content: (values.content as string) || '',
              webhook_notification_config:
                values.webhook_type === 'webhook' ? { webhook: (values.webhook_url as string) || '' } : undefined,
              wechat_notification_config:
                values.webhook_type === 'wechat' ? { webhook: (values.webhook_url as string) || '' } : undefined,
              dingding_notification_config:
                values.webhook_type === 'dingding'
                  ? { webhook: (values.webhook_url as string) || '', is_at_all: !!values.is_at_all }
                  : undefined,
              feishu_notification_config:
                values.webhook_type === 'feishu' ? { webhook: (values.webhook_url as string) || '' } : undefined,
            }
          : {}),
        // workflow-trigger
        ...(job.type === 'workflow-trigger'
          ? {
              trigger_type: (values.trigger_type as string) || 'fixed',
              is_enable_check: !!values.is_enable_check,
              fixed_workflow_list: Array.isArray(values.fixed_workflow_list) ? values.fixed_workflow_list : [],
            }
          : {}),
      },
    };
    onSave(updated);
    onClose();
  };

  return (
    <Drawer
      title={
        <Space orientation="horizontal">
          <Title level={5} style={{ margin: 0 }}>
            配置任务: {job?.name} ({job?.type})
          </Title>
        </Space>
      }
      open={visible}
      onClose={onClose}
      size="large"
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space orientation="horizontal">
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
              保存任务配置
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如: build-app, deploy-dev" />
        </Form.Item>

        {job?.type === 'zadig-build' && (
          <>
            <Form.Item
              name="service_name"
              label="构建目标服务"
              rules={[{ required: true, message: '请选择服务' }]}
            >
              <Input placeholder="例如: backend-api" />
            </Form.Item>

            <Form.Item name="branch" label="默认代码分支">
              <Input placeholder="例如: main 或 release/v1.0" />
            </Form.Item>

            <Form.Item name="dockerfile" label="Dockerfile 文件路径">
              <Input placeholder="Dockerfile" />
            </Form.Item>
          </>
        )}

        {job?.type === 'zadig-deploy' && (
          <>
            <Form.Item name="deploy_type" label="部署形态" initialValue="k8s">
              <Radio.Group
                onChange={(e) => setDeployType(e.target.value)}
                options={[
                  { label: 'Kubernetes 原生', value: 'k8s' },
                  { label: 'Helm Chart 部署', value: 'helm' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="env"
              label="发布部署目标环境"
              rules={[{ required: true, message: '请选择目标环境' }]}
            >
              <Select
                showSearch
                options={envOptions.length > 0 ? envOptions : [
                  { label: '开发环境 (dev)', value: 'dev' },
                  { label: '集成测试 (qa)', value: 'qa' },
                  { label: '预发布环境 (staging)', value: 'staging' },
                  { label: '生产集群 (prod)', value: 'prod' },
                ]}
                placeholder="请选择目标环境"
              />
            </Form.Item>

            <Form.Item
              name="service_name"
              label="部署服务名称"
              rules={[{ required: true, message: '请输入服务名' }]}
            >
              <Input placeholder="例如: backend-api" />
            </Form.Item>

            {deployType === 'helm' && (
              <>
                <Form.Item
                  name="image"
                  label="部署镜像 (Image)"
                  tooltip="修改镜像输入时自动调用 /api/aslan/workflow/v4/deploy/mergeImage 合并至 Helm Values YAML"
                  extra="输入或修改镜像后失焦或点击右侧按钮，自动联动合并"
                >
                  <Space.Compact block>
                    <Input
                      placeholder="例如: ccr.ccs.tencentyun.com/ns/service:v1.0.0"
                      onBlur={() => handleMergeImage()}
                    />
                    <Button
                      type="primary"
                      ghost
                      loading={mergingImage}
                      onClick={() => handleMergeImage()}
                    >
                      合并镜像至 Values
                    </Button>
                  </Space.Compact>
                </Form.Item>

                <Form.Item
                  name="update_service_revision"
                  label="更新服务配置版本"
                  valuePropName="checked"
                  tooltip="部署时是否同步更新目标环境的服务配置版本"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="values_yaml"
                  label="Helm Values YAML"
                  tooltip="Helm Chart 部署 values。镜像输入变更后将自动合并进该配置。"
                >
                  <YamlEditor
                    value={form.getFieldValue('values_yaml') || ''}
                    onChange={(val) => form.setFieldsValue({ values_yaml: val })}
                    height={260}
                  />
                </Form.Item>
              </>
            )}
          </>
        )}

        {job?.type === 'zadig-helm-chart-deploy' && (
          <>
            <Form.Item
              name="env"
              label="发布目标环境"
              rules={[{ required: true, message: '请选择目标环境' }]}
            >
              <Select
                showSearch
                options={envOptions.length > 0 ? envOptions : [
                  { label: '开发环境 (dev)', value: 'dev' },
                  { label: '集成测试 (qa)', value: 'qa' },
                ]}
                placeholder="请选择目标环境"
              />
            </Form.Item>

            <Form.Item
              name="skip_check_run_status"
              label="跳过运行状态检查"
              valuePropName="checked"
              tooltip="部署后是否跳过 Workload 运行就绪状态探测"
            >
              <Switch />
            </Form.Item>

            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Helm Chart 部署清单:
            </Typography.Text>
            <Form.List name="deploy_helm_charts">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      variant="borderless"
                      style={{ background: '#fbfbfb', border: '1px solid #f0f0f0', borderRadius: 6 }}
                      styles={{ body: { padding: 16 } }}
                      title={<Typography.Text style={{ fontSize: 13 }}>Helm Release #{name + 1}</Typography.Text>}
                      extra={
                        fields.length > 1 ? (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          >
                            删除
                          </Button>
                        ) : null
                      }
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'release_name']}
                            label="Release 名称"
                            rules={[{ required: true, message: '请输入 Release 名称' }]}
                          >
                            <Input placeholder="例如: my-chart-release" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'chart_repo']}
                            label="Chart 仓库名"
                          >
                            <Input placeholder="例如: official-charts" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'chart_name']}
                            label="Chart 名称"
                            rules={[{ required: true, message: '请输入 Chart 名称' }]}
                          >
                            <Input placeholder="例如: nginx-ingress" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'chart_version']}
                            label="Chart 版本"
                          >
                            <Input placeholder="例如: 1.2.0" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        {...restField}
                        name={[name, 'values_yaml']}
                        label="Values YAML 覆盖 (可选)"
                      >
                        <Input.TextArea
                          rows={3}
                          placeholder="key: value\nreplicaCount: 2"
                        />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ release_name: '', chart_repo: '', chart_name: '', chart_version: '', values_yaml: '' })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加 Helm Chart
                  </Button>
                </div>
              )}
            </Form.List>
          </>
        )}

        {job?.type === 'zadig-vm-deploy' && (
          <>
            <Form.Item
              name="env"
              label="主机部署目标环境"
              rules={[{ required: true, message: '请选择目标主机环境' }]}
            >
              <Select
                showSearch
                options={envOptions.length > 0 ? envOptions : [
                  { label: '主机测试环境 (vm-dev)', value: 'vm-dev' },
                  { label: '预发主机环境 (vm-staging)', value: 'vm-staging' },
                ]}
                placeholder="请选择目标环境"
              />
            </Form.Item>

            <Form.Item name="source" label="部署来源" initialValue="runtime">
              <Radio.Group
                onChange={(e) => setVmDeploySource(e.target.value)}
                options={[
                  { label: '运行时指定 (runtime)', value: 'runtime' },
                  { label: '上游构建产物 (fromjob)', value: 'fromjob' },
                ]}
              />
            </Form.Item>

            {vmDeploySource === 'fromjob' && (
              <Form.Item
                name="job_name"
                label="来源构建任务名称"
                rules={[{ required: true, message: '请输入上游构建任务名称' }]}
              >
                <Input placeholder="例如: zadig-build-1" />
              </Form.Item>
            )}

            <Typography.Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>
              主机部署配置清单:
            </Typography.Text>
            <Form.List name="service_and_vm_deploys">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      variant="borderless"
                      style={{ background: '#fbfbfb', border: '1px solid #f0f0f0', borderRadius: 6 }}
                      styles={{ body: { padding: 16 } }}
                      title={<Typography.Text style={{ fontSize: 13 }}>主机部署项 #{name + 1}</Typography.Text>}
                      extra={
                        fields.length > 1 ? (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          >
                            删除
                          </Button>
                        ) : null
                      }
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'service_name']}
                            label="服务名称"
                            rules={[{ required: true, message: '请输入服务名称' }]}
                          >
                            <Input placeholder="例如: order-service" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'service_module']}
                            label="服务组件"
                            rules={[{ required: true, message: '请输入服务组件' }]}
                          >
                            <Input placeholder="例如: order-api" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'deploy_name']}
                            label="主机部署目标"
                            rules={[{ required: true, message: '请输入部署目标/主机组标识' }]}
                          >
                            <Input placeholder="例如: host-group-1 或 vm-node-01" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'deploy_artifact_type']}
                            label="产物类型"
                            initialValue="file"
                          >
                            <Select
                              options={[
                                { label: '软件包/文件 (file)', value: 'file' },
                                { label: '容器镜像 (image)', value: 'image' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'file_name']}
                            label="文件/软件包名称"
                          >
                            <Input placeholder="例如: app.tar.gz" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'artifact_url']}
                            label="产物下载/对象存储 URL"
                          >
                            <Input placeholder="https://... 或 s3://..." />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        {...restField}
                        name={[name, 'image']}
                        label="镜像地址 (仅容器产物需填写)"
                      >
                        <Input placeholder="例如: ccr.ccs.tencentyun.com/ns/order-api:v1.0" />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        service_name: '',
                        service_module: '',
                        deploy_name: '',
                        deploy_artifact_type: 'file',
                        file_name: '',
                        artifact_url: '',
                        image: '',
                      })
                    }
                    block
                    icon={<PlusOutlined />}
                  >
                    添加主机部署项
                  </Button>
                </div>
              )}
            </Form.List>
          </>
        )}

        {job?.type === 'freestyle' && (
          <Form.Item name="script" label="执行 Shell 脚本指令">
            <YamlEditor
              value={form.getFieldValue('script') || ''}
              onChange={(val) => form.setFieldsValue({ script: val })}
              height={280}
            />
          </Form.Item>
        )}

        {job?.type === 'sql' && (
          <>
            <Form.Item
              name="sql_type"
              label="数据库引擎类型"
              initialValue="mysql"
              rules={[{ required: true, message: '请选择数据库类型' }]}
            >
              <Radio.Group
                options={[
                  { label: 'MySQL', value: 'mysql' },
                  { label: 'MariaDB', value: 'mariadb' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="db_instance_id"
              label="目标数据库实例标识 (可选)"
              tooltip="项目中预先配置的 DB 实例标识或连接串引用"
            >
              <Input placeholder="例如: default-mysql 或 db-prod-instance" />
            </Form.Item>

            <Form.Item
              name="sql"
              label="SQL 执行脚本"
              rules={[{ required: true, message: '请输入要执行的 SQL 脚本' }]}
              extra={
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    loading={validatingSQL}
                    onClick={handleValidateSQL}
                  >
                    校验 SQL 语法
                  </Button>
                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    基于 TiDB 解析引擎实时验证 DDL/DML 语法准确性
                  </Typography.Text>
                </div>
              }
            >
              <YamlEditor
                value={form.getFieldValue('sql') || ''}
                onChange={(val) => form.setFieldsValue({ sql: val })}
                height={260}
              />
            </Form.Item>
          </>
        )}

        {job?.type === 'zadig-test' && (
          <Form.Item
            name="test_name"
            label="关联测试配置"
            rules={[{ required: true, message: '请选择测试配置' }]}
            extra="列表来自质量中心的测试配置 (testing/test)"
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={testOptions}
              placeholder="选择自动化测试配置"
              notFoundContent="暂无测试配置，请先在质量中心创建"
            />
          </Form.Item>
        )}

        {job?.type === 'zadig-scanning' && (
          <Form.Item
            name="scanning_id"
            label="关联代码扫描"
            rules={[{ required: true, message: '请选择扫描配置' }]}
            extra="列表来自代码审查的扫描配置"
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={scanOptions}
              placeholder="选择扫描配置"
              notFoundContent="暂无扫描配置，请先在代码审查中创建"
            />
          </Form.Item>
        )}

        {job?.type === 'zadig-distribute-image' && (
          <>
            <Form.Item
              name="target_env"
              label="镜像分发目标环境"
              rules={[{ required: true, message: '请选择目标环境' }]}
            >
              <Select
                options={envOptions.length > 0 ? envOptions : [{ label: 'dev', value: 'dev' }, { label: 'qa', value: 'qa' }, { label: 'prod', value: 'prod' }]}
                placeholder="选择分发目标环境"
              />
            </Form.Item>
            <Form.Item name="service_name" label="目标服务名称">
              <Input placeholder="例如: backend-api" />
            </Form.Item>
          </>
        )}

        {job?.type === 'zadig-restart' && (
          <>
            <Form.Item
              name="env"
              label="目标环境"
              rules={[{ required: true, message: '请选择环境' }]}
            >
              <Select
                showSearch
                options={envOptions}
                placeholder="选择要重启服务的环境"
                notFoundContent="暂无环境"
              />
            </Form.Item>
            <Form.Item name="service_name" label="服务名称" rules={[{ required: true, message: '请输入服务名' }]}>
              <Input placeholder="例如: backend-api" />
            </Form.Item>
          </>
        )}

        {job?.type === 'approval' && (
          <>
            <Form.Item
              name="description"
              label="审批说明"
              rules={[{ required: true, message: '请输入审批说明' }]}
            >
              <Input.TextArea rows={3} placeholder="说明本次发布审批的背景与影响范围" />
            </Form.Item>
            <Form.Item
              name="approve_timeout"
              label="审批超时 (小时，超时自动终止)"
              initialValue={24}
            >
              <InputNumber min={1} max={168} style={{ width: 140 }} />
            </Form.Item>
          </>
        )}

        {job?.type === 'custom-deploy' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="cluster_id"
                  label="目标集群"
                  rules={[{ required: true, message: '请选择部署目标集群' }]}
                >
                  <Select
                    showSearch
                    options={clusterOptions}
                    placeholder="请选择 Kubernetes 集群"
                    notFoundContent="暂无可用集群"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="timeout"
                  label="部署超时时间 (分钟)"
                  initialValue={60}
                >
                  <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="cd_skip_check_run_status"
                  label="运行状态检查"
                  valuePropName="checked"
                  tooltip="开启后不阻塞等待 Pod 处于 Ready 状态"
                >
                  <Switch checkedChildren="跳过检查" unCheckedChildren="等待就绪" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="cd_source" label="镜像来源" initialValue="runtime">
              <Radio.Group
                onChange={(e) => setCustomDeploySource(e.target.value)}
                options={[
                  { label: '运行时指定镜像', value: 'runtime' },
                  { label: '从前序任务获取', value: 'fromjob' },
                ]}
              />
            </Form.Item>

            {customDeploySource === 'fromjob' && (
              <Form.Item
                name="cd_job_name"
                label="前序构建任务名称"
                rules={[{ required: true, message: '请输入前序任务名称' }]}
              >
                <Input placeholder="例如: build-app" />
              </Form.Item>
            )}

            <Form.Item
              label="部署目标容器配置 (Targets)"
              tooltip="指定需要部署更新的工作负载与容器镜像"
            >
              <Form.List name="targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`部署目标 #${name + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            >
                              删除
                            </Button>
                          ) : null
                        }
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'target']}
                              label="目标工作负载及容器"
                              rules={[{ required: true, message: '请输入目标（格式: type/name/container）' }]}
                              tooltip="格式: workload_type/workload_name/container_name，例如: deployment/my-app/app"
                            >
                              <Input placeholder="deployment/app-name/container-name" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'image']}
                              label="镜像地址 (Image)"
                              tooltip="可留空由运行时指定或固定镜像地址"
                            >
                              <Input placeholder="例如: registry.example.com/app:v1.0" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ target: '', image: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加部署目标容器
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'k8s-resource-patch' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="cluster_id"
                  label="目标集群"
                  rules={[{ required: true, message: '请选择集群' }]}
                >
                  <Select
                    showSearch
                    options={clusterOptions}
                    placeholder="请选择 Kubernetes 集群"
                    notFoundContent="暂无可用集群"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Patch 清单条目 (PatchItems)"
              tooltip="按顺序依次对指定的 Kubernetes 资源执行 Patch 操作"
            >
              <Form.List name="patch_items">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`Patch 项 #${name + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            >
                              删除
                            </Button>
                          ) : null
                        }
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'resource_kind']}
                              label="资源类型"
                              rules={[{ required: true, message: '请选择或输入资源类型' }]}
                            >
                              <Select
                                showSearch
                                options={[
                                  { label: 'Deployment', value: 'Deployment' },
                                  { label: 'StatefulSet', value: 'StatefulSet' },
                                  { label: 'DaemonSet', value: 'DaemonSet' },
                                  { label: 'Service', value: 'Service' },
                                  { label: 'ConfigMap', value: 'ConfigMap' },
                                  { label: 'Ingress', value: 'Ingress' },
                                  { label: 'Secret', value: 'Secret' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'resource_name']}
                              label="资源名称"
                              rules={[{ required: true, message: '请输入资源名称' }]}
                            >
                              <Input placeholder="例如: my-service" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'patch_strategy']}
                              label="Patch 策略"
                              rules={[{ required: true, message: '请选择 Patch 策略' }]}
                            >
                              <Select
                                options={[
                                  { label: 'strategic-merge', value: 'strategic-merge' },
                                  { label: 'merge', value: 'merge' },
                                  { label: 'json', value: 'json' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item
                          {...restField}
                          name={[name, 'patch_content']}
                          label="Patch 内容 (YAML / JSON)"
                          rules={[{ required: true, message: '请输入 Patch 内容' }]}
                          tooltip="Kubernetes API 支持的标准 patch 内容结构"
                        >
                          <Input.TextArea
                            rows={4}
                            placeholder={'spec:\n  template:\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest'}
                            style={{ fontFamily: 'monospace' }}
                          />
                        </Form.Item>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          resource_kind: 'Deployment',
                          resource_name: '',
                          patch_strategy: 'strategic-merge',
                          patch_content: '',
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      添加 Patch 资源项
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'offline-service' && (
          <>
            <Form.Item
              name="env_name"
              label="目标环境"
              rules={[{ required: true, message: '请选择要下线服务所在环境' }]}
            >
              <Select
                showSearch
                options={envOptions}
                placeholder="选择目标环境"
                notFoundContent="暂无可用环境"
              />
            </Form.Item>

            <Form.Item name="offline_source" label="服务指定方式" initialValue="fixed">
              <Radio.Group
                options={[
                  { label: '固定服务列表', value: 'fixed' },
                  { label: '运行时选择服务', value: 'runtime' },
                ]}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.offline_source !== cur.offline_source}
            >
              {({ getFieldValue }) =>
                getFieldValue('offline_source') !== 'runtime' ? (
                  <Form.Item
                    name="services"
                    label="待下线服务名称"
                    rules={[{ required: true, message: '请输入或选择待下线服务' }]}
                    tooltip="输入服务名称并按回车添加多个服务"
                  >
                    <Select
                      mode="tags"
                      placeholder="输入服务名称回车添加，如: service-a"
                      tokenSeparators={[',', ' ']}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        )}

        {job?.type === 'notification' && (
          <>
            <Form.Item
              name="webhook_type"
              label="通知渠道类型"
              rules={[{ required: true, message: '请选择通知渠道' }]}
              initialValue="dingding"
            >
              <Radio.Group
                onChange={(e) => setNotificationWebhookType(e.target.value)}
                options={[
                  { label: '钉钉 (DingTalk)', value: 'dingding' },
                  { label: '企业微信 (WeChat Work)', value: 'wechat' },
                  { label: '飞书 (Feishu)', value: 'feishu' },
                  { label: '通用 Webhook', value: 'webhook' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="webhook_url"
              label="Webhook 回调地址"
              rules={[{ required: true, message: '请输入 Webhook URL' }]}
              tooltip="填入群机器人提供的完整 Webhook URL 接口地址"
            >
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </Form.Item>

            <Form.Item
              name="title"
              label="消息标题"
              rules={[{ required: true, message: '请输入消息通知标题' }]}
            >
              <Input placeholder="例如: 工作流发布通知" />
            </Form.Item>

            <Form.Item
              name="content"
              label="消息正文内容"
              rules={[{ required: true, message: '请输入通知内容' }]}
              tooltip="支持 Markdown 语法与工作流环境变量，如 {{.workflow.name}}"
            >
              <Input.TextArea
                rows={4}
                placeholder="发布任务已完成，服务名: {{.service.name}}，状态: {{.status}}"
              />
            </Form.Item>

            {notificationWebhookType === 'dingding' && (
              <Form.Item
                name="is_at_all"
                label="群全员提醒 (@所有人)"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            )}
          </>
        )}

        {job?.type === 'workflow-trigger' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="trigger_type" label="触发模式" initialValue="fixed">
                  <Radio.Group
                    options={[
                      { label: '固定工作流 (Fixed)', value: 'fixed' },
                      { label: '通用动态触发 (Common)', value: 'common' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="is_enable_check"
                  label="执行结果状态检查"
                  valuePropName="checked"
                  tooltip="开启后本任务将等待被触发工作流执行结束，并校验其成功状态"
                >
                  <Switch checkedChildren="等待并校验结果" unCheckedChildren="仅异步触发" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="目标工作流清单 (FixedWorkflows)"
              tooltip="配置当执行到本任务时需要被触发的下游工作流"
            >
              <Form.List name="fixed_workflow_list">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`下游工作流 #${name + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            >
                              删除
                            </Button>
                          ) : null
                        }
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'project_name']}
                              label="所属项目名称"
                              rules={[{ required: true, message: '请输入项目标识' }]}
                            >
                              <Input placeholder="例如: zadig" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workflow_name']}
                              label="工作流标识"
                              rules={[{ required: true, message: '请输入工作流标识' }]}
                            >
                              <Input placeholder="例如: deploy-sub-service" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'service_name']}
                              label="关联服务名 (可选)"
                            >
                              <Input placeholder="例如: sub-service" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          project_name: (job?.spec?.project_name as string) || '',
                          workflow_name: '',
                          service_name: '',
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      添加下游触发工作流
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}
      </Form>
    </Drawer>
  );
};

export default JobConfigDrawer;
