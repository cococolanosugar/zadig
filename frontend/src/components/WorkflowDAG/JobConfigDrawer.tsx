import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  InputNumber,
  Radio,
  Switch,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
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
  const [mergingImage, setMergingImage] = useState(false);

  useEffect(() => {
    if (job) {
      const isHelm = job.type === 'helm-deploy' || job.spec?.deploy_type === 'helm';
      setDeployType(isHelm ? 'helm' : 'k8s');
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
      });
    }
  }, [job, form]);

  // 按需加载环境/测试/扫描列表
  useEffect(() => {
    if (!visible || !job) return;
    const projectName = job.spec?.project_name as string | undefined;
    // 环境列表
    if (job.type === 'zadig-deploy' || job.type === 'helm-deploy' || job.type === 'zadig-restart') {
      http
        .get<Array<{ name: string }>>(`/api/aslan/environment/environments?projectName=${projectName || ''}`, {
          skipErrorHandler: true,
        })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setEnvOptions(list.map((e) => ({ label: e.name, value: e.name })));
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

  const handleFinish = (values: Record<string, unknown>) => {
    if (!job) return;
    const isHelm = job.type === 'helm-deploy' || values.deploy_type === 'helm';
    const updated: WorkflowJob = {
      ...job,
      name: values.name as string,
      spec: {
        ...job.spec,
        service_name: values.service_name as string,
        env: values.env as string,
        deploy_type: isHelm ? 'helm' : 'k8s',
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

        {(job?.type === 'zadig-deploy' || job?.type === 'helm-deploy') && (
          <>
            {job.type === 'zadig-deploy' && (
              <Form.Item name="deploy_type" label="部署形态" initialValue="k8s">
                <Radio.Group
                  onChange={(e) => setDeployType(e.target.value)}
                  options={[
                    { label: 'Kubernetes 原生', value: 'k8s' },
                    { label: 'Helm Chart 部署', value: 'helm' },
                  ]}
                />
              </Form.Item>
            )}

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

            {(job.type === 'helm-deploy' || deployType === 'helm') && (
              <>
                <Form.Item
                  name="image"
                  label="部署镜像 (Image)"
                  tooltip="修改镜像输入时自动调用 /api/aslan/workflow/v4/deploy/mergeImage 合并至 Helm Values YAML"
                  extra="输入或修改镜像后失焦或点击右侧按钮，自动联动合并"
                >
                  <Input
                    placeholder="例如: ccr.ccs.tencentyun.com/ns/service:v1.0.0"
                    onBlur={() => handleMergeImage()}
                    addonAfter={
                      <Button
                        type="link"
                        size="small"
                        loading={mergingImage}
                        onClick={() => handleMergeImage()}
                      >
                        合并镜像至 Values
                      </Button>
                    }
                  />
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

        {job?.type === 'freestyle' && (
          <Form.Item name="script" label="执行 Shell 脚本指令">
            <YamlEditor
              value={form.getFieldValue('script') || ''}
              onChange={(val) => form.setFieldsValue({ script: val })}
              height={280}
            />
          </Form.Item>
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
