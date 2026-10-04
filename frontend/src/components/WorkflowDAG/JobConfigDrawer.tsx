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
      });
    }
  }, [job, form]);

  // 按需加载环境/测试/扫描列表
  useEffect(() => {
    if (!visible || !job) return;
    const projectName = job.spec?.project_name as string | undefined;
    // 环境列表
    if (
      job.type === 'zadig-deploy' ||
      job.type === 'zadig-helm-chart-deploy' ||
      job.type === 'zadig-vm-deploy' ||
      job.type === 'zadig-restart'
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
      </Form>
    </Drawer>
  );
};

export default JobConfigDrawer;
