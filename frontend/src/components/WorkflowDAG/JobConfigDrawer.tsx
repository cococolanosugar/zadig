import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  AutoComplete,
  Button,
  Space,
  Typography,
  Radio,
  Switch,
  Card,
  Row,
  Col,
  InputNumber,
  Divider,
  Tag,
  Alert,
  Tooltip,
} from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { workflowApi, type WorkflowJob } from '../../api/workflow';
import { settingsApi } from '../../api/settings';
import { feedback } from '../../utils/feedback';
import YamlEditor from '../Editor/YamlEditor';
import http from '../../api/client';

const { Title } = Typography;

export interface JobConfigDrawerProps {
  visible: boolean;
  job: WorkflowJob | null;
  /** 所属项目名，用于请求工作流动态可用变量 */
  projectName?: string;
  onClose: () => void;
  onSave: (updatedJob: WorkflowJob) => void;
}

export const JobConfigDrawer: React.FC<JobConfigDrawerProps> = ({
  visible,
  job,
  projectName,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [envOptions, setEnvOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [testOptions, setTestOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [scanOptions, setScanOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [clusterOptions, setClusterOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [serviceOptions, setServiceOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [customDeploySource, setCustomDeploySource] = useState<'runtime' | 'fromjob'>('runtime');
  // R12 任务三: zadig-deploy 镜像来源（fromjob = 来自上游构建 Job / runtime = 运行时指定镜像）
  const [deployImageSource, setDeployImageSource] = useState<'fromjob' | 'runtime'>('runtime');
  const [istioStrategyType, setIstioStrategyType] = useState<'weight' | 'header'>('weight');
  const [fetchingBgYamlIndex, setFetchingBgYamlIndex] = useState<number | null>(null);
  const [notificationWebhookType, setNotificationWebhookType] = useState<string>('dingding');
  const [deployType, setDeployType] = useState<'k8s' | 'helm'>('k8s');
  const [vmDeploySource, setVmDeploySource] = useState<'runtime' | 'fromjob'>('runtime');
  const [approvalType, setApprovalType] = useState<string>('native');
  const [approvalSource, setApprovalSource] = useState<string>('runtime');
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string; name: string }>>([]);
  const [mergingImage, setMergingImage] = useState(false);
  const [validatingSQL, setValidatingSQL] = useState(false);
  const [jenkinsTools, setJenkinsTools] = useState<Array<{ label: string; value: string }>>([]);
  const [jenkinsJobs, setJenkinsJobs] = useState<Array<{ label: string; value: string }>>([]);
  const [triggerableWorkflows, setTriggerableWorkflows] = useState<Array<{ label: string; value: string }>>([]);
  const [loadingJenkinsJobs, setLoadingJenkinsJobs] = useState(false);
  const [loadingJenkinsArgs, setLoadingJenkinsArgs] = useState(false);
  // REA-S5-1: k8s-resource-patch 从 patch 内容提取出的变量参数（按 patch_items 下标缓存）
  const [patchParamsMap, setPatchParamsMap] = useState<
    Record<number, Array<{ name: string; params_type?: string }>>
  >({});
  const [extractingPatchIndex, setExtractingPatchIndex] = useState<number | null>(null);
  // REA-S5-2: 当前 Job 可引用的动态占位变量
  const [dynamicVariables, setDynamicVariables] = useState<string[]>([]);
  const [loadingDynamicVariables, setLoadingDynamicVariables] = useState(false);

  useEffect(() => {
    if (job) {
      const isHelm = job.type === 'zadig-deploy' && job.spec?.deploy_type === 'helm';
      setDeployType(isHelm ? 'helm' : 'k8s');
      const vmSrc = (job.spec?.source as 'runtime' | 'fromjob') || 'runtime';
      setVmDeploySource(vmSrc);
      const cdSrc = (job.spec?.source as 'runtime' | 'fromjob') || 'runtime';
      setCustomDeploySource(cdSrc);
      // R12 任务三: 初始化 zadig-deploy 镜像来源（Wizard 生成的流水线默认 fromjob）
      const deployImgSrc = (job.spec?.source as 'fromjob' | 'runtime') || 'runtime';
      setDeployImageSource(deployImgSrc);
      const notifType = (job.spec?.webhook_type as string) || 'dingding';
      setNotificationWebhookType(notifType);
      const bgSrc = (job.spec?.source as 'runtime' | 'fixed') || 'runtime';
      const iStrat = (job.spec?.grayscale_strategy as 'weight' | 'header') || 'weight';
      setIstioStrategyType(iStrat);

      const appType = (job.spec?.type as string) || 'native';
      setApprovalType(appType);
      const appSrc = (job.spec?.source as string) || 'runtime';
      setApprovalSource(appSrc);
      const nativeApp = (job.spec?.native_approval as Record<string, any>) || {};
      const nativeUsers = Array.isArray(nativeApp.approve_users)
        ? nativeApp.approve_users.map((u: any) => u.user_id || u.uid || u.user_name).filter(Boolean)
        : [];
      const appTimeoutHours = Math.round(Number(job.spec?.timeout || nativeApp.timeout || 1440) / 60) || 24;

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
        // k8s-blue-green-deploy
        bg_production: !!job.spec?.production,
        bg_env: (job.spec?.env as string) || 'dev',
        bg_source: bgSrc,
        bg_services: Array.isArray(job.spec?.services) && job.spec.services.length > 0
          ? job.spec.services
          : [{ service_name: '', blue_service_yaml: '', blue_service_name: '', green_service_name: '' }],
        // k8s-blue-green-release
        bg_from_job: (job.spec?.from_job as string) || '',
        // k8s-canary-deploy
        canary_cluster_id: (job.spec?.cluster_id as string) || '',
        canary_namespace: (job.spec?.namespace as string) || '',
        canary_targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ k8s_service_name: '', container_name: '', image: '', canary_percentage: 20, deploy_timeout: 10 }],
        // k8s-canary-release
        canary_from_job: (job.spec?.from_job as string) || '',
        canary_release_timeout: Number(job.spec?.release_timeout) || 10,
        // k8s-gray-release
        gray_cluster_id: (job.spec?.cluster_id as string) || '',
        gray_namespace: (job.spec?.namespace as string) || '',
        gray_from_job: (job.spec?.from_job as string) || '',
        gray_scale: Number(job.spec?.gray_scale) || 20,
        gray_deploy_timeout: Number(job.spec?.deploy_timeout) || 10,
        gray_targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ workload_type: 'Deployment', workload_name: '', container_name: '', image: '', replica: 1 }],
        // k8s-gray-rollback
        gray_rollback_cluster_id: (job.spec?.cluster_id as string) || '',
        gray_rollback_namespace: (job.spec?.namespace as string) || '',
        gray_rollback_timeout: Number(job.spec?.rollback_timeout) || 10,
        gray_rollback_targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ workload_type: 'Deployment', workload_name: '' }],
        // istio-release
        istio_cluster_id: (job.spec?.cluster_id as string) || '',
        istio_namespace: (job.spec?.namespace as string) || '',
        istio_from_job: (job.spec?.from_job as string) || '',
        istio_weight: job.spec?.weight !== undefined ? Number(job.spec?.weight) : 30,
        istio_replica_percentage: Number(job.spec?.replica_percentage) || 0,
        istio_timeout: Number(job.spec?.timeout) || 10,
        istio_targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ workload_name: '', container_name: '', image: '' }],
        // istio-rollback
        istio_rollback_cluster_id: (job.spec?.cluster_id as string) || '',
        istio_rollback_namespace: (job.spec?.namespace as string) || '',
        istio_rollback_timeout: Number(job.spec?.timeout) || 10,
        istio_rollback_targets: Array.isArray(job.spec?.targets) && job.spec.targets.length > 0
          ? job.spec.targets
          : [{ workload_name: '', container_name: '' }],
        // update-env-istio-config
        istio_base_env: (job.spec?.base_env as string) || 'dev',
        istio_production: !!job.spec?.production,
        istio_source: (job.spec?.source as string) || 'fixed',
        istio_grayscale_strategy: iStrat,
        istio_weight_configs: Array.isArray(job.spec?.weight_configs) && job.spec.weight_configs.length > 0
          ? job.spec.weight_configs
          : [{ env_name: (job.spec?.base_env as string) || 'dev', weight: 80 }, { env_name: 'qa', weight: 20 }],
        istio_header_match_configs: Array.isArray(job.spec?.header_match_configs) && job.spec.header_match_configs.length > 0
          ? job.spec.header_match_configs
          : [{ key: 'x-env', value: 'gray' }],
        // approval
        approval_title: (job.spec?.approval_title as string) || '',
        approval_type: appType,
        approval_source: appSrc,
        approval_job_name: (job.spec?.job_name as string) || '',
        approval_timeout: appTimeoutHours,
        needed_approvers: Number(nativeApp.needed_approvers) || 1,
        approve_users: nativeUsers,
        description: (job.spec?.description as string) || '',
        // jenkins
        jenkins_id: (job.spec?.jenkins_id as string) || '',
        jenkins_job_name:
          (job.spec?.job_name as string) ||
          ((job.spec?.jobs as Array<Record<string, any>>)?.[0]?.job_name as string) ||
          '',
        jenkins_parameters: Array.isArray(job.spec?.parameters) && job.spec.parameters.length > 0
          ? job.spec.parameters
          : Array.isArray((job.spec?.jobs as Array<Record<string, any>>)?.[0]?.parameters)
          ? (job.spec?.jobs as Array<Record<string, any>>)[0].parameters
          : [],
      });
    }
  }, [job, form]);

  // 按需加载环境/测试/扫描/集群/服务列表/审批用户列表/Jenkins
  useEffect(() => {
    if (!visible || !job) return;
    const projectName = job.spec?.project_name as string | undefined;

    // Jenkins 工具与 Job 列表
    if (job.type === 'jenkins') {
      settingsApi
        .getCICDTools()
        .then((tools) => {
          const list = tools
            .filter((t) => !t.type || t.type.toLowerCase() === 'jenkins')
            .map((t) => ({ label: `${t.name} (${t.url})`, value: t.id }));
          setJenkinsTools(list);
        })
        .catch(() => setJenkinsTools([]));
      const initialJenkinsId = (job.spec?.jenkins_id as string) || '';
      if (initialJenkinsId) {
        setLoadingJenkinsJobs(true);
        settingsApi
          .getJenkinsJobNames(initialJenkinsId)
          .then((jobs) => {
            setJenkinsJobs(jobs.map((j) => ({ label: j, value: j })));
          })
          .catch(() => setJenkinsJobs([]))
          .finally(() => setLoadingJenkinsJobs(false));
      }
    }

    // 审批用户列表
    if (job.type === 'approval') {
      settingsApi
        .getUsersBrief()
        .then((users) => {
          setUserOptions(
            users.map((u) => ({
              label: `${u.name || u.account}${u.email ? ` (${u.email})` : ''}`,
              value: u.uid || u.account,
              name: u.name || u.account,
            }))
          );
        })
        .catch(() => setUserOptions([]));
    }

    // 触发工作流列表
    if (job.type === 'workflow-trigger') {
      workflowApi
        .getAvailableTriggerWorkflows(projectName)
        .then((wfs) => {
          setTriggerableWorkflows(
            wfs.map((w) => {
              const wfName = w.name || w.workflow_name || '';
              const title = w.display_name && w.display_name !== wfName ? `${w.display_name} (${wfName})` : wfName;
              return {
                label: title,
                value: wfName,
              };
            })
          );
        })
        .catch(() => setTriggerableWorkflows([]));
    }
    // 环境列表
    if (
      job.type === 'zadig-deploy' ||
      job.type === 'zadig-helm-chart-deploy' ||
      job.type === 'zadig-vm-deploy' ||
      job.type === 'zadig-restart' ||
      job.type === 'offline-service' ||
      job.type === 'k8s-blue-green-deploy' ||
      job.type === 'update-env-istio-config'
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
    // 服务列表
    if (job.type === 'k8s-blue-green-deploy' || job.type === 'zadig-deploy') {
      http
        .get<Array<{ service_name: string }>>(`/api/aslan/service/services?projectName=${projectName || ''}`, {
          skipErrorHandler: true,
        })
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setServiceOptions(list.map((s) => ({ label: s.service_name, value: s.service_name })));
        })
        .catch(() => setServiceOptions([]));
    }
    // 集群列表
    if (
      job.type === 'custom-deploy' ||
      job.type === 'k8s-resource-patch' ||
      job.type === 'k8s-canary-deploy' ||
      job.type === 'k8s-gray-release' ||
      job.type === 'k8s-gray-rollback' ||
      job.type === 'istio-release' ||
      job.type === 'istio-rollback'
    ) {
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
      // FULL-A-03: 优先走 picket 鉴权代理（租户隔离/OPA 一致），失败降级 aslan 原生接口
      const testQuery = projectName ? `?projectName=${encodeURIComponent(projectName)}` : '';
      http
        .get<Array<{ name: string }>>(`/api/v1/picket/testing${testQuery}`, { skipErrorHandler: true })
        .catch(() =>
          http.get<Array<{ name: string }>>(`/api/aslan/testing/test${testQuery}`, {
            skipErrorHandler: true,
          })
        )
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

  // REA-S5-2: 打开抽屉时按 projectName + job.name 拉取可用动态占位变量，供用户引用上游变量
  useEffect(() => {
    const effectiveProjectName = projectName || (job?.spec?.project_name as string) || '';
    if (!visible || !job || !effectiveProjectName) {
      setDynamicVariables([]);
      return;
    }
    let cancelled = false;
    setLoadingDynamicVariables(true);
    workflowApi
      .getAvailableDynamicVariables(
        effectiveProjectName,
        job.name,
        {
          name: '',
          stages: [{ name: 'job-config-preview', parallel: false, jobs: [job] }],
        },
        false
      )
      .then((vars) => {
        if (!cancelled) setDynamicVariables(Array.isArray(vars) ? vars : []);
      })
      .catch(() => {
        if (!cancelled) setDynamicVariables([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDynamicVariables(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, job, projectName]);

  // REA-S5-1: 从指定 Patch 项的 patch_content 中提取占位变量参数
  const handleExtractPatchParams = async (index: number) => {
    const items = (form.getFieldValue('patch_items') as Array<Record<string, unknown>>) || [];
    const item = items[index];
    const patchContent = item?.patch_content ? String(item.patch_content) : '';
    if (!patchContent.trim()) {
      feedback.message.warning('请先填写 Patch 内容再提取变量参数');
      return;
    }
    setExtractingPatchIndex(index);
    try {
      const params = await workflowApi.getPatchParams({
        resource_name: (item.resource_name as string) || undefined,
        resource_kind: (item.resource_kind as string) || undefined,
        resource_group: (item.resource_group as string) || undefined,
        resource_version: (item.resource_version as string) || undefined,
        patch_content: patchContent,
        params: Array.isArray(item.params)
          ? (item.params as Array<{ name: string; params_type?: string }>)
          : undefined,
        patch_strategy: (item.patch_strategy as string) || undefined,
      });
      const list = Array.isArray(params) ? params : [];
      setPatchParamsMap((prev) => ({ ...prev, [index]: list }));
      if (list.length === 0) {
        feedback.message.info('未从 Patch 内容中解析到占位变量');
      } else {
        feedback.message.success(
          `已提取 ${list.length} 个变量参数: ${list.map((p) => p.name).join(', ')}`
        );
      }
    } catch {
      feedback.message.error('提取 Patch 变量参数失败，请检查 Patch 内容格式');
    } finally {
      setExtractingPatchIndex(null);
    }
  };

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

  const handleFetchBgYaml = async (index: number) => {
    const projectName = (job?.spec?.project_name as string) || '';
    const env = form.getFieldValue('bg_env') || (job?.spec?.env as string) || '';
    const bgServices = form.getFieldValue('bg_services') || [];
    const item = bgServices[index];
    const serviceName = item?.service_name;

    if (!serviceName) {
      feedback.message.warning('请先输入或选择服务名称');
      return;
    }
    if (!env) {
      feedback.message.warning('请先选择目标环境');
      return;
    }

    try {
      setFetchingBgYamlIndex(index);
      const yaml = await workflowApi.getBlueGreenServiceYaml(projectName, env, serviceName);
      if (yaml && typeof yaml === 'string') {
        const nextList = [...bgServices];
        nextList[index] = { ...nextList[index], blue_service_yaml: yaml };
        form.setFieldsValue({ bg_services: nextList });
        feedback.message.success(`已拉取服务 ${serviceName} 的当前 K8s Service YAML`);
      } else {
        feedback.message.info(`未检索到服务 ${serviceName} 在环境 ${env} 中的 YAML 定义`);
      }
    } catch {
      feedback.message.warning('拉取服务 YAML 失败或当前环境未部署该服务');
    } finally {
      setFetchingBgYamlIndex(null);
    }
  };

  const handleJenkinsToolChange = async (val: string) => {
    form.setFieldsValue({ jenkins_job_name: '', jenkins_parameters: [] });
    setJenkinsJobs([]);
    if (!val) return;
    setLoadingJenkinsJobs(true);
    try {
      const jobs = await settingsApi.getJenkinsJobNames(val);
      setJenkinsJobs(jobs.map((j) => ({ label: j, value: j })));
      feedback.message.success(`已加载 ${jobs.length} 个 Jenkins 任务`);
    } catch {
      feedback.message.error('加载 Jenkins 任务列表失败');
    } finally {
      setLoadingJenkinsJobs(false);
    }
  };

  const handleJenkinsJobChange = async (jobName: string) => {
    const jenkinsId = form.getFieldValue('jenkins_id') || (job?.spec?.jenkins_id as string);
    if (!jenkinsId || !jobName) return;
    setLoadingJenkinsArgs(true);
    try {
      const args = await settingsApi.getJenkinsBuildArgs(jenkinsId, jobName);
      const params = args.map((arg) => ({
        name: arg.name,
        value:
          (arg as any).value !== undefined
            ? String((arg as any).value)
            : arg.default_value !== undefined
            ? String(arg.default_value)
            : '',
        type: arg.type || 'string',
        description: arg.description || '',
      }));
      form.setFieldsValue({ jenkins_parameters: params });
      feedback.message.success(`已解析 ${params.length} 个 Jenkins 构建参数`);
    } catch {
      feedback.message.warning('未能拉取到 Jenkins 构建参数，可手动添加');
    } finally {
      setLoadingJenkinsArgs(false);
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
        // R12 任务三: zadig-deploy fromjob 模式下注入部署内容（镜像）
        ...(job.type === 'zadig-deploy' && values.source === 'fromjob'
          ? { deploy_contents: ['image'] as string[] }
          : {}),
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
        // k8s-blue-green-deploy
        ...(job.type === 'k8s-blue-green-deploy'
          ? {
              version: 'v2',
              production: !!values.bg_production,
              env: (values.bg_env as string) || '',
              source: (values.bg_source as string) || 'runtime',
              services: Array.isArray(values.bg_services) ? values.bg_services : [],
            }
          : {}),
        // k8s-blue-green-release
        ...(job.type === 'k8s-blue-green-release'
          ? {
              from_job: (values.bg_from_job as string) || '',
            }
          : {}),
        // k8s-canary-deploy
        ...(job.type === 'k8s-canary-deploy'
          ? {
              cluster_id: (values.canary_cluster_id as string) || '',
              namespace: (values.canary_namespace as string) || '',
              targets: Array.isArray(values.canary_targets) ? values.canary_targets : [],
            }
          : {}),
        // k8s-canary-release
        ...(job.type === 'k8s-canary-release'
          ? {
              from_job: (values.canary_from_job as string) || '',
              release_timeout: Number(values.canary_release_timeout) || 10,
            }
          : {}),
        // k8s-gray-release
        ...(job.type === 'k8s-gray-release'
          ? {
              cluster_id: (values.gray_cluster_id as string) || '',
              namespace: (values.gray_namespace as string) || '',
              from_job: (values.gray_from_job as string) || '',
              gray_scale: Number(values.gray_scale) || 20,
              deploy_timeout: Number(values.gray_deploy_timeout) || 10,
              targets: Array.isArray(values.gray_targets) ? values.gray_targets : [],
            }
          : {}),
        // k8s-gray-rollback
        ...(job.type === 'k8s-gray-rollback'
          ? {
              cluster_id: (values.gray_rollback_cluster_id as string) || '',
              namespace: (values.gray_rollback_namespace as string) || '',
              rollback_timeout: Number(values.gray_rollback_timeout) || 10,
              targets: Array.isArray(values.gray_rollback_targets) ? values.gray_rollback_targets : [],
            }
          : {}),
        // istio-release
        ...(job.type === 'istio-release'
          ? {
              cluster_id: (values.istio_cluster_id as string) || '',
              namespace: (values.istio_namespace as string) || '',
              from_job: (values.istio_from_job as string) || '',
              weight: values.istio_weight !== undefined ? Number(values.istio_weight) : 30,
              replica_percentage: Number(values.istio_replica_percentage) || 0,
              timeout: Number(values.istio_timeout) || 10,
              targets: Array.isArray(values.istio_targets) ? values.istio_targets : [],
            }
          : {}),
        // istio-rollback
        ...(job.type === 'istio-rollback'
          ? {
              cluster_id: (values.istio_rollback_cluster_id as string) || '',
              namespace: (values.istio_rollback_namespace as string) || '',
              timeout: Number(values.istio_rollback_timeout) || 10,
              targets: Array.isArray(values.istio_rollback_targets) ? values.istio_rollback_targets : [],
            }
          : {}),
        // update-env-istio-config
        ...(job.type === 'update-env-istio-config'
          ? {
              base_env: (values.istio_base_env as string) || '',
              production: !!values.istio_production,
              source: (values.istio_source as string) || 'fixed',
              grayscale_strategy: (values.istio_grayscale_strategy as string) || 'weight',
              weight_configs:
                values.istio_grayscale_strategy === 'weight' && Array.isArray(values.istio_weight_configs)
                  ? values.istio_weight_configs
                  : [],
              header_match_configs:
                values.istio_grayscale_strategy === 'header' && Array.isArray(values.istio_header_match_configs)
                  ? values.istio_header_match_configs
                  : [],
            }
          : {}),
        // approval
        ...(job.type === 'approval'
          ? {
              type: (values.approval_type as string) || 'native',
              source: (values.approval_source as string) || 'runtime',
              job_name: values.approval_source === 'fromjob' ? (values.approval_job_name as string) : undefined,
              origin_job_name: values.approval_source === 'fromjob' ? (values.approval_job_name as string) : undefined,
              approval_title: (values.approval_title as string) || '',
              description: (values.description as string) || '',
              timeout: (Number(values.approval_timeout) || 24) * 60,
              native_approval: {
                timeout: (Number(values.approval_timeout) || 24) * 60,
                needed_approvers: Number(values.needed_approvers) || 1,
                approve_users: Array.isArray(values.approve_users)
                  ? values.approve_users.map((uid: string) => {
                      const matched = userOptions.find((u) => u.value === uid);
                      return {
                        type: 'user',
                        user_id: uid,
                        user_name: matched ? matched.name : uid,
                      };
                    })
                  : [],
              },
            }
          : {}),
        ...(job.type === 'jenkins'
          ? {
              jenkins_id: (values.jenkins_id as string) || '',
              job_name: (values.jenkins_job_name as string) || '',
              parameters: Array.isArray(values.jenkins_parameters) ? values.jenkins_parameters : [],
              jobs: values.jenkins_job_name
                ? [
                    {
                      job_name: values.jenkins_job_name as string,
                      parameters: Array.isArray(values.jenkins_parameters) ? values.jenkins_parameters : [],
                    },
                  ]
                : [],
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

        <Form.Item
          label={
            <Space orientation="horizontal" size={6}>
              <span>可用动态变量</span>
              {loadingDynamicVariables && <span style={{ fontSize: 12, color: '#999' }}>加载中...</span>}
            </Space>
          }
          tooltip="当前 Job 可引用的上游变量占位符，可直接复制到脚本或 YAML 内容中使用"
        >
          {dynamicVariables.length > 0 ? (
            <Space orientation="horizontal" size={[4, 4]} wrap>
              {dynamicVariables.map((v) => (
                <Tag key={v} color="blue" style={{ fontFamily: 'monospace', marginInlineEnd: 0 }}>
                  {v}
                </Tag>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {loadingDynamicVariables ? '正在获取可用变量...' : '暂无可用动态变量'}
            </Typography.Text>
          )}
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

            {/* R12 任务三: 镜像来源 — fromjob 使上游构建 Job 产出的镜像无缝流入部署阶段 */}
            <Form.Item name="source" label="镜像来源" initialValue="runtime">
              <Radio.Group
                onChange={(e) => setDeployImageSource(e.target.value)}
                options={[
                  { label: '来自上游构建 Job (fromjob)', value: 'fromjob' },
                  { label: '运行时指定镜像 (runtime)', value: 'runtime' },
                ]}
              />
            </Form.Item>

            {deployImageSource === 'fromjob' && (
              <Form.Item
                name="job_name"
                label="关联构建 Job"
                rules={[{ required: true, message: '请输入上游构建 Job 名称' }]}
                extra="填写同流水线内构建任务的名称（如向导生成的默认构建 Job：build），部署时自动注入其产出镜像。"
              >
                <Input placeholder="例如: build" />
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
              name="approval_title"
              label="审批标题"
              rules={[{ required: true, message: '请输入审批标题' }]}
            >
              <Input placeholder="例如: 生产环境发布前置审批" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="approval_type" label="审批方式" initialValue="native">
                  <Radio.Group
                    onChange={(e) => setApprovalType(e.target.value)}
                    options={[
                      { label: '平台原生', value: 'native' },
                      { label: '飞书审批', value: 'lark' },
                      { label: '钉钉审批', value: 'dingtalk' },
                      { label: '企业微信', value: 'workwx' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="approval_source" label="审批人来源" initialValue="runtime">
                  <Radio.Group
                    onChange={(e) => setApprovalSource(e.target.value)}
                    options={[
                      { label: '运行时指定', value: 'runtime' },
                      { label: '从前序任务获取', value: 'fromjob' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            {approvalSource === 'fromjob' && (
              <Form.Item
                name="approval_job_name"
                label="前序任务名称"
                rules={[{ required: true, message: '请输入前序任务名称' }]}
              >
                <Input placeholder="例如: approval-decision-job" />
              </Form.Item>
            )}

            {approvalSource === 'runtime' && approvalType === 'native' && (
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="approve_users"
                    label="审批人"
                    tooltip="仅审批人可执行审批"
                    rules={[{ required: true, message: '请选择审批人' }]}
                  >
                    <Select
                      mode="multiple"
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="请选择审批人员"
                      options={userOptions}
                      notFoundContent="暂无用户"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="needed_approvers"
                    label="会签人数"
                    tooltip="其中一名审批人同意或拒绝即可（若会签人数为1）"
                    initialValue={1}
                    rules={[{ required: true, message: '请输入会签人数' }]}
                  >
                    <InputNumber min={1} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {approvalSource === 'runtime' && approvalType !== 'native' && (
              <Form.Item label="第三方平台审批">
                <Typography.Text type="secondary">
                  当前选择的是 {approvalType === 'lark' ? '飞书' : approvalType === 'dingtalk' ? '钉钉' : '企业微信'} 审批模式，工作流执行至本步骤时将向对应审批应用自动发起审批单。
                </Typography.Text>
              </Form.Item>
            )}

            <Form.Item
              name="approval_timeout"
              label="审批超时 (小时，超时自动终止)"
              initialValue={24}
              rules={[{ required: true, message: '请输入审批超时时间' }]}
            >
              <InputNumber min={1} max={168} style={{ width: 140 }} />
            </Form.Item>

            <Form.Item
              name="description"
              label="审批说明"
              rules={[{ required: true, message: '请输入审批说明' }]}
            >
              <Input.TextArea rows={3} placeholder="说明本次发布审批的背景与影响范围" />
            </Form.Item>
          </>
        )}

        {job?.type === 'jenkins' && (
          <Card
            title="Jenkins 任务与动态参数配置"
            variant="borderless"
            style={{ marginBottom: 16, background: '#fafafa' }}
          >
            <Form.Item
              name="jenkins_id"
              label="Jenkins 集成实例"
              rules={[{ required: true, message: '请选择 Jenkins 集成实例' }]}
            >
              <Select
                showSearch
                placeholder="请选择 Jenkins 集成实例"
                options={jenkinsTools}
                onChange={handleJenkinsToolChange}
                notFoundContent={jenkinsTools.length === 0 ? '暂无 Jenkins 集成实例，请先在系统设置中集成' : undefined}
              />
            </Form.Item>

            <Form.Item
              name="jenkins_job_name"
              label="Jenkins 任务 (Job Name)"
              rules={[{ required: true, message: '请选择 Jenkins 任务' }]}
              extra={
                <Space style={{ marginTop: 4 }}>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={loadingJenkinsArgs}
                    onClick={() => {
                      const jName = form.getFieldValue('jenkins_job_name');
                      if (jName) handleJenkinsJobChange(jName);
                      else feedback.message.warning('请先选择 Jenkins 任务');
                    }}
                  >
                    重新解析并同步构建参数
                  </Button>
                </Space>
              }
            >
              <Select
                showSearch
                placeholder={loadingJenkinsJobs ? '正在拉取 Jenkins Job 列表...' : '请选择 Jenkins 任务'}
                loading={loadingJenkinsJobs}
                options={jenkinsJobs}
                onChange={handleJenkinsJobChange}
              />
            </Form.Item>

            <Divider style={{ margin: '16px 0 12px 0' }}>构建参数 (Build Parameters)</Divider>

            <Form.List name="jenkins_parameters">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} align="middle">
                      <Col span={7}>
                        <Form.Item
                          {...restField}
                          name={[name, 'name']}
                          rules={[{ required: true, message: '参数名必填' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="参数名 (如 BRANCH)" />
                        </Form.Item>
                      </Col>
                      <Col span={9}>
                        <Form.Item
                          {...restField}
                          name={[name, 'value']}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="默认值/参数值" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'type']}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            options={[
                              { label: 'String', value: 'string' },
                              { label: 'Choice', value: 'choice' },
                              { label: 'Boolean', value: 'boolean' },
                              { label: 'Password', value: 'password' },
                            ]}
                            placeholder="参数类型"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', value: '', type: 'string' })}
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 8 }}
                  >
                    添加构建参数
                  </Button>
                </div>
              )}
            </Form.List>
          </Card>
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
                          <Space orientation="horizontal" size={4}>
                            <Tooltip title="从 Patch 内容中解析 {{.variable}} 形式的占位变量参数">
                              <Button
                                type="text"
                                icon={<ThunderboltOutlined />}
                                loading={extractingPatchIndex === name}
                                onClick={() => handleExtractPatchParams(name)}
                              >
                                提取变量参数
                              </Button>
                            </Tooltip>
                            {fields.length > 1 && (
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                              >
                                删除
                              </Button>
                            )}
                          </Space>
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
                        {Array.isArray(patchParamsMap[name]) && patchParamsMap[name].length > 0 && (
                          <Alert
                            type="info"
                            showIcon
                            title="已提取的变量参数"
                            description={
                              <Space orientation="horizontal" size={[4, 4]} wrap>
                                {patchParamsMap[name].map((p) => (
                                  <Tag
                                    key={p.name}
                                    color="geekblue"
                                    style={{ fontFamily: 'monospace', marginInlineEnd: 0 }}
                                  >
                                    {p.name}
                                    {p.params_type ? ` (${p.params_type})` : ''}
                                  </Tag>
                                ))}
                              </Space>
                            }
                          />
                        )}
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
                              rules={[{ required: true, message: '请输入或选择工作流标识' }]}
                            >
                              <AutoComplete
                                placeholder="选择或输入下游工作流标识"
                                options={triggerableWorkflows}
                              />
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

        {job?.type === 'k8s-blue-green-deploy' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="bg_env"
                  label="目标环境"
                  rules={[{ required: true, message: '请选择蓝绿部署目标环境' }]}
                >
                  <Select
                    showSearch
                    options={envOptions}
                    placeholder="选择部署环境"
                    notFoundContent="暂无可用环境"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="bg_production"
                  label="环境属性"
                  valuePropName="checked"
                  tooltip="是否为生产发布环境"
                >
                  <Switch checkedChildren="生产环境" unCheckedChildren="测试环境" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="bg_source" label="服务指定方式" initialValue="runtime">
              <Radio.Group
                options={[
                  { label: '运行时选择服务与镜像', value: 'runtime' },
                  { label: '固定服务部署清单', value: 'fixed' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="蓝绿部署服务清单 (Services)"
              tooltip="指定蓝绿部署的目标服务与对应 Service 配置"
            >
              <Form.List name="bg_services">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`蓝绿服务 #${name + 1}`}
                        extra={
                          <Space orientation="horizontal">
                            <Button
                              size="small"
                              type="link"
                              loading={fetchingBgYamlIndex === name}
                              onClick={() => handleFetchBgYaml(name)}
                            >
                              拉取当前环境 Service YAML
                            </Button>
                            {fields.length > 1 && (
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                              >
                                删除
                              </Button>
                            )}
                          </Space>
                        }
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'service_name']}
                              label="部署服务名"
                              rules={[{ required: true, message: '请输入或选择服务名' }]}
                            >
                              {serviceOptions.length > 0 ? (
                                <Select
                                  showSearch
                                  options={serviceOptions}
                                  placeholder="选择服务"
                                />
                              ) : (
                                <Input placeholder="例如: backend-api" />
                              )}
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'blue_service_name']}
                              label="蓝版本 Service 名称 (可选)"
                              tooltip="留空将默认按系统蓝绿命名规则自动生成"
                            >
                              <Input placeholder="例如: backend-api-blue" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item
                          {...restField}
                          name={[name, 'blue_service_yaml']}
                          label="Blue Service YAML 定义"
                          tooltip="蓝绿路由 Service 的 K8s 资源定义（可点击右上角自动拉取环境现有 YAML）"
                        >
                          <Input.TextArea
                            rows={4}
                            placeholder="apiVersion: v1&#10;kind: Service&#10;metadata:&#10;  name: my-svc&#10;spec:&#10;  selector:&#10;    app: my-svc"
                            style={{ fontFamily: 'monospace' }}
                          />
                        </Form.Item>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ service_name: '', blue_service_yaml: '', blue_service_name: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加蓝绿服务条目
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'k8s-blue-green-release' && (
          <Form.Item
            name="bg_from_job"
            label="关联前序蓝绿部署任务 (FromJob)"
            rules={[{ required: true, message: '请输入前序蓝绿部署任务名' }]}
            tooltip="确认发布并切换流量至蓝版本，必须引用同工作流中前序的 k8s-blue-green-deploy 任务"
          >
            <Input placeholder="例如: blue-green-deploy" />
          </Form.Item>
        )}

        {job?.type === 'k8s-canary-deploy' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="canary_cluster_id"
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
                  name="canary_namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="金丝雀部署目标 (Targets)"
              tooltip="配置金丝雀发布的服务、容器与灰度流量比例"
            >
              <Form.List name="canary_targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`金丝雀目标 #${name + 1}`}
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
                              name={[name, 'k8s_service_name']}
                              label="K8s 服务名"
                              rules={[{ required: true, message: '请输入服务名' }]}
                            >
                              <Input placeholder="例如: web-svc" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'container_name']}
                              label="容器名称"
                              rules={[{ required: true, message: '请输入容器名' }]}
                            >
                              <Input placeholder="例如: nginx" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'canary_percentage']}
                              label="金丝雀流量比例 (%)"
                              rules={[{ required: true, message: '请输入 1-100 的百分比' }]}
                              initialValue={20}
                            >
                              <InputNumber min={1} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={16}>
                            <Form.Item
                              {...restField}
                              name={[name, 'image']}
                              label="金丝雀镜像地址"
                              rules={[{ required: true, message: '请输入镜像地址' }]}
                            >
                              <Input placeholder="例如: nginx:alpine 或 ccr.ccs.tencentyun.com/ns/svc:v2" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'deploy_timeout']}
                              label="部署超时 (分钟)"
                              initialValue={10}
                            >
                              <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          k8s_service_name: '',
                          container_name: '',
                          image: '',
                          canary_percentage: 20,
                          deploy_timeout: 10,
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      添加金丝雀目标
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'k8s-canary-release' && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="canary_from_job"
                label="关联前序金丝雀部署任务 (FromJob)"
                rules={[{ required: true, message: '请输入前序金丝雀部署任务名' }]}
                tooltip="确认发布并全量切流，必须引用前序阶段的 k8s-canary-deploy 任务"
              >
                <Input placeholder="例如: canary-deploy" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="canary_release_timeout"
                label="发布超时时间 (分钟)"
                initialValue={10}
              >
                <InputNumber min={1} max={1440} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {job?.type === 'k8s-gray-release' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="gray_cluster_id"
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
                  name="gray_namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="gray_from_job"
                  label="前序灰度任务名称"
                  tooltip="若为流水线中的首个灰度部署任务，请留空；若为后续推进/全量发布步骤，请填写首个任务名"
                >
                  <Input placeholder="首个任务留空，后续步骤必填" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="gray_scale"
                  label="灰度比例 (%)"
                  rules={[{ required: true, message: '请输入 1-100 的百分比' }]}
                  tooltip="本次灰度释放的流量/副本比例；流水线中最后一个灰度任务必须为 100"
                  initialValue={20}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="gray_deploy_timeout"
                  label="部署超时 (分钟)"
                  initialValue={10}
                >
                  <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="灰度部署目标工作负载 (Targets)"
              tooltip="指定需要进行灰度更新的工作负载"
            >
              <Form.List name="gray_targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`灰度目标 #${name + 1}`}
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
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workload_type']}
                              label="负载类型"
                              initialValue="Deployment"
                            >
                              <Select
                                options={[
                                  { label: 'Deployment', value: 'Deployment' },
                                  { label: 'StatefulSet', value: 'StatefulSet' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workload_name']}
                              label="负载名称"
                              rules={[{ required: true, message: '请输入工作负载名称' }]}
                            >
                              <Input placeholder="例如: web-app" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'container_name']}
                              label="容器名称"
                              rules={[{ required: true, message: '请输入容器名称' }]}
                            >
                              <Input placeholder="例如: app" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'replica']}
                              label="副本数 (可选)"
                            >
                              <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="可选" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item
                          {...restField}
                          name={[name, 'image']}
                          label="镜像地址"
                          tooltip="可选，首个发布步骤若从前序构建获取或固定镜像"
                        >
                          <Input placeholder="例如: nginx:alpine" />
                        </Form.Item>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          workload_type: 'Deployment',
                          workload_name: '',
                          container_name: '',
                          image: '',
                          replica: 1,
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      添加灰度目标负载
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'k8s-gray-rollback' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="gray_rollback_cluster_id"
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
                  name="gray_rollback_namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="gray_rollback_timeout"
              label="回滚超时时间 (分钟)"
              initialValue={10}
            >
              <InputNumber min={1} max={1440} style={{ width: 200 }} />
            </Form.Item>

            <Form.Item
              label="回滚目标清单 (可选)"
              tooltip="可指定具体需要回滚的工作负载，留空则由系统自动检索当前集群命名空间中的灰度状态"
            >
              <Form.List name="gray_rollback_targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`回滚项 #${name + 1}`}
                        extra={
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          >
                            删除
                          </Button>
                        }
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workload_type']}
                              label="负载类型"
                              initialValue="Deployment"
                            >
                              <Select
                                options={[
                                  { label: 'Deployment', value: 'Deployment' },
                                  { label: 'StatefulSet', value: 'StatefulSet' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workload_name']}
                              label="负载名称"
                              rules={[{ required: true, message: '请输入工作负载名' }]}
                            >
                              <Input placeholder="例如: web-app" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ workload_type: 'Deployment', workload_name: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加指定回滚目标
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'istio-release' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="istio_cluster_id"
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
                  name="istio_namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name="istio_from_job"
                  label="前序 Istio 任务名称"
                  tooltip="首个 Istio 发布任务留空；后续推进/全量发布步骤填写首个任务名"
                >
                  <Input placeholder="首个任务留空" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="istio_weight"
                  label="流量权重 (%)"
                  rules={[{ required: true, message: '请输入 0-100 的权重值' }]}
                  tooltip="本次发布的流量权重（0-100），最后发布步骤需为 100"
                  initialValue={30}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="istio_replica_percentage"
                  label="副本比例 (%)"
                  tooltip="可选，灰度实例副本比例"
                  initialValue={0}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="istio_timeout"
                  label="部署超时 (分钟)"
                  initialValue={10}
                >
                  <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Istio 发布目标清单 (Targets)"
              tooltip="指定通过 Istio 进行流量灰度发布的工作负载"
            >
              <Form.List name="istio_targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`发布目标 #${name + 1}`}
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
                              name={[name, 'workload_name']}
                              label="工作负载名称"
                              rules={[{ required: true, message: '请输入工作负载名称' }]}
                            >
                              <Input placeholder="例如: payment-api" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'container_name']}
                              label="容器名称"
                              rules={[{ required: true, message: '请输入容器名称' }]}
                            >
                              <Input placeholder="例如: payment" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'image']}
                              label="发布镜像地址"
                            >
                              <Input placeholder="例如: payment:v2.0" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ workload_name: '', container_name: '', image: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加 Istio 发布目标
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'istio-rollback' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="istio_rollback_cluster_id"
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
                  name="istio_rollback_namespace"
                  label="命名空间 (Namespace)"
                  rules={[{ required: true, message: '请输入命名空间' }]}
                >
                  <Input placeholder="例如: default 或 qa-env" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="istio_rollback_timeout"
              label="回滚超时时间 (分钟)"
              initialValue={10}
            >
              <InputNumber min={1} max={1440} style={{ width: 200 }} />
            </Form.Item>

            <Form.Item
              label="回滚目标清单 (可选)"
              tooltip="可指定具体需要回滚的 Istio 路由负载，留空由系统自动检索"
            >
              <Form.List name="istio_rollback_targets">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        variant="borderless"
                        style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                        title={`回滚项 #${name + 1}`}
                        extra={
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          >
                            删除
                          </Button>
                        }
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'workload_name']}
                              label="工作负载名"
                              rules={[{ required: true, message: '请输入负载名' }]}
                            >
                              <Input placeholder="例如: payment-api" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'container_name']}
                              label="容器名"
                              rules={[{ required: true, message: '请输入容器名' }]}
                            >
                              <Input placeholder="例如: payment" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ workload_name: '', container_name: '' })}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加回滚目标
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
          </>
        )}

        {job?.type === 'update-env-istio-config' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="istio_base_env"
                  label="基准环境 (BaseEnv)"
                  rules={[{ required: true, message: '请选择基准环境' }]}
                >
                  <Select
                    showSearch
                    options={envOptions}
                    placeholder="选择基准环境"
                    notFoundContent="暂无可用环境"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="istio_production"
                  label="环境类型"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="生产环境" unCheckedChildren="非生产环境" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="istio_source" label="策略来源" initialValue="fixed">
                  <Radio.Group
                    options={[
                      { label: '固定灰度策略 (Fixed)', value: 'fixed' },
                      { label: '运行时策略 (Runtime)', value: 'runtime' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="istio_grayscale_strategy" label="灰度策略类型" initialValue="weight">
                  <Radio.Group
                    onChange={(e) => setIstioStrategyType(e.target.value)}
                    options={[
                      { label: '权重分流 (Weight)', value: 'weight' },
                      { label: 'Header 匹配 (HeaderMatch)', value: 'header' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            {istioStrategyType === 'weight' && (
              <Form.Item
                label="环境流量权重配置 (WeightConfigs)"
                tooltip="按环境分配流量权重，各环境权重之和应为 100%"
              >
                <Form.List name="istio_weight_configs">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      {fields.map(({ key, name, ...restField }) => (
                        <Card
                          key={key}
                          size="small"
                          variant="borderless"
                          style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                          title={`权重配置 #${name + 1}`}
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
                                name={[name, 'env_name']}
                                label="环境名称"
                                rules={[{ required: true, message: '请输入或选择环境' }]}
                              >
                                <Select
                                  showSearch
                                  options={envOptions}
                                  placeholder="选择环境"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                {...restField}
                                name={[name, 'weight']}
                                label="流量权重 (%)"
                                rules={[{ required: true, message: '请输入 0-100 的权重值' }]}
                              >
                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button
                        type="dashed"
                        onClick={() => add({ env_name: '', weight: 50 })}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加权重环境条目
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </Form.Item>
            )}

            {istioStrategyType === 'header' && (
              <Form.Item
                label="Header 请求头匹配规则 (HeaderMatchConfigs)"
                tooltip="符合匹配规则的请求将分流至灰度环境"
              >
                <Form.List name="istio_header_match_configs">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      {fields.map(({ key, name, ...restField }) => (
                        <Card
                          key={key}
                          size="small"
                          variant="borderless"
                          style={{ background: 'var(--ant-color-fill-quaternary, #f9f9f9)' }}
                          title={`匹配规则 #${name + 1}`}
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
                                name={[name, 'key']}
                                label="Header 键名 (Key)"
                                rules={[{ required: true, message: '请输入 Header 键' }]}
                              >
                                <Input placeholder="例如: x-user-group 或 env" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                {...restField}
                                name={[name, 'value']}
                                label="Header 匹配值 (Value)"
                                rules={[{ required: true, message: '请输入 Header 值' }]}
                              >
                                <Input placeholder="例如: internal 或 gray" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button
                        type="dashed"
                        onClick={() => add({ key: '', value: '' })}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加 Header 匹配规则
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Drawer>
  );
};

export default JobConfigDrawer;
