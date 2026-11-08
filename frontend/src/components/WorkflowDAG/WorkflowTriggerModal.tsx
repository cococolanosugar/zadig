import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Spin,
  Tooltip,
  Divider,
  Card,
  Radio,
  Tag,
  Empty,
  Checkbox,
  Alert,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  TagOutlined,
  BugOutlined,
} from '@ant-design/icons';
import {
  workflowApi,
  type WorkflowParam,
  type WorkflowRepoRef,
  type WorkflowStage,
  type WorkflowJob,
} from '../../api/workflow';
import { serviceApi } from '../../api/service';
import { feedback } from '../../utils/feedback';
import { useNavigate } from 'react-router-dom';
import ChunkUploader, { type ChunkUploaderValue } from '../common/ChunkUploader';

const { Text, Title } = Typography;

export interface WorkflowTriggerModalProps {
  visible: boolean;
  workflowName: string;
  projectName: string;
  onClose: () => void;
}

interface ServiceAndBuildItem {
  service_name?: string;
  service_module?: string;
  build_name?: string;
  image?: string;
  image_name?: string;
  repos?: WorkflowRepoRef[];
  [key: string]: unknown;
}

interface DeployEnvOption {
  env?: string;
  env_alias?: string;
  production?: boolean;
  services?: Array<{ service_name?: string; service_module?: string; name?: string } | string>;
}

interface RepoEditState {
  key: string;
  jobName: string;
  serviceName: string;
  serviceModule: string;
  repoIndex: number;
  codehostId: number;
  repoOwner: string;
  repoName: string;
  mode: 'branch' | 'tag' | 'commit';
  branch: string;
  tag: string;
  commitId: string;
}

interface DeployEditState {
  jobName: string;
  jobType: string;
  env: string;
  envOptions: DeployEnvOption[];
  serviceOptions: string[];
  selectedServices: string[];
}

const DEPLOY_JOB_TYPES = new Set([
  'zadig-deploy',
  'custom-deploy',
  'zadig-helm-deploy',
  'zadig-helm-chart-deploy',
  'zadig-vm-deploy',
]);

const stripIllegalFields = (payload: Record<string, unknown>): Record<string, unknown> => {
  const {
    task_id: _taskId,
    recentTasks: _rt,
    recentSuccessfulTask: _rst,
    recentFailedTask: _rft,
    successRate: _sr,
    averageExecutionTime: _aet,
    isFavorite: _fav,
    hash: _hash,
    ...rest
  } = payload;
  return rest;
};

const serviceKeyOf = (svc: ServiceAndBuildItem) =>
  `${svc.service_name || ''}-${svc.service_module || ''}`;

const extractServiceNames = (services: DeployEnvOption['services']): string[] => {
  if (!Array.isArray(services)) return [];
  return services
    .map((s) => {
      if (typeof s === 'string') return s;
      return s.service_name || s.name || '';
    })
    .filter(Boolean);
};

const RepoParamFields: React.FC<{ param: WorkflowParam }> = ({ param }) => {
  const mode = Form.useWatch(`${param.name}__mode`) || 'branch';
  const repo = param.repo || {};
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {repo.repo_owner || repo.repo_namespace}/{repo.repo_name}
      </Text>
      <Form.Item name={`${param.name}__mode`} style={{ marginBottom: 0 }}>
        <Radio.Group
          optionType="button"
          options={[
            { label: '分支', value: 'branch' },
            { label: 'Tag', value: 'tag' },
            { label: 'Commit', value: 'commit' },
          ]}
        />
      </Form.Item>
      {mode === 'branch' && (
        <Form.Item name={`${param.name}__branch`} style={{ marginBottom: 0 }}>
          <Input prefix={<BranchesOutlined />} placeholder="分支名，例如 main" />
        </Form.Item>
      )}
      {mode === 'tag' && (
        <Form.Item name={`${param.name}__tag`} style={{ marginBottom: 0 }}>
          <Input prefix={<TagOutlined />} placeholder="Tag，例如 v1.0.0" />
        </Form.Item>
      )}
      {mode === 'commit' && (
        <Form.Item name={`${param.name}__commit`} style={{ marginBottom: 0 }}>
          <Input placeholder="Commit SHA" />
        </Form.Item>
      )}
    </Space>
  );
};

/**
 * 执行工作流 Modal — 数据源为 GET /api/aslan/workflow/v4/preset/:name
 * 支持：全局 params、构建 Job 代码源分支/Tag/Commit 注入、部署 Job 环境与服务选择。
 */
export const WorkflowTriggerModal: React.FC<WorkflowTriggerModalProps> = ({
  visible,
  workflowName,
  projectName,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [preset, setPreset] = useState<Record<string, unknown> | null>(null);
  const [params, setParams] = useState<WorkflowParam[]>([]);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});
  const [dynamicLoading, setDynamicLoading] = useState<Record<string, boolean>>({});
  const [repoEdits, setRepoEdits] = useState<RepoEditState[]>([]);
  const [deployEdits, setDeployEdits] = useState<DeployEditState[]>([]);
  const [branchOptions, setBranchOptions] = useState<Record<string, string[]>>({});
  const [tagOptions, setTagOptions] = useState<Record<string, string[]>>({});
  const [refLoading, setRefLoading] = useState<Record<string, boolean>>({});
  const [presetError, setPresetError] = useState<{ message: string; isRegistry: boolean } | null>(
    null
  );
  const [resetCache, setResetCache] = useState(false);
  const navigate = useNavigate();

  const hydrateRuntimeEdits = useCallback((stages: WorkflowStage[] | undefined) => {
    const repos: RepoEditState[] = [];
    const deploys: DeployEditState[] = [];
    (stages || []).forEach((stage) => {
      (stage.jobs || []).forEach((job: WorkflowJob) => {
        const spec = (job.spec || {}) as Record<string, unknown>;
        if (job.type === 'zadig-build') {
          const builds = (spec.service_and_builds ||
            spec.default_service_and_builds ||
            []) as ServiceAndBuildItem[];
          builds.forEach((svc) => {
            (svc.repos || []).forEach((repo, repoIndex) => {
              if (repo.hidden || repo.use_default) return;
              const key = `${job.name}::${serviceKeyOf(svc)}::${repoIndex}`;
              const hasTag = !!repo.tag;
              const hasCommit = !!repo.enable_commit || !!repo.commit_id;
              repos.push({
                key,
                jobName: job.name,
                serviceName: svc.service_name || '',
                serviceModule: svc.service_module || '',
                repoIndex,
                codehostId: Number(repo.codehost_id || 0),
                repoOwner: String(repo.repo_owner || repo.repo_namespace || ''),
                repoName: String(repo.repo_name || ''),
                mode: hasCommit ? 'commit' : hasTag ? 'tag' : 'branch',
                branch: String(repo.branch || ''),
                tag: String(repo.tag || ''),
                commitId: String(repo.commit_id || ''),
              });
            });
          });
        }
        if (DEPLOY_JOB_TYPES.has(String(job.type))) {
          const envOptions = (Array.isArray(spec.env_options) ? spec.env_options : []) as DeployEnvOption[];
          const currentEnv = String(spec.env || spec.env_name || envOptions[0]?.env || '');
          const matched = envOptions.find((o) => o.env === currentEnv);
          const serviceOptions = extractServiceNames(
            matched?.services ||
              (spec.services as DeployEnvOption['services']) ||
              (spec.service_and_images as DeployEnvOption['services']) ||
              []
          );
          deploys.push({
            jobName: job.name,
            jobType: String(job.type),
            env: currentEnv,
            envOptions,
            serviceOptions,
            selectedServices: serviceOptions.slice(),
          });
        }
      });
    });
    setRepoEdits(repos);
    setDeployEdits(deploys);
  }, []);

  const loadRepoRefs = useCallback(async (edit: RepoEditState) => {
    if (!edit.codehostId || !edit.repoOwner || !edit.repoName) return;
    setRefLoading((prev) => ({ ...prev, [edit.key]: true }));
    try {
      const [branches, tags] = await Promise.all([
        serviceApi.getCodehostBranches(edit.codehostId, edit.repoOwner, edit.repoName),
        serviceApi.getCodehostTags(edit.codehostId, edit.repoOwner, edit.repoName),
      ]);
      setBranchOptions((prev) => ({
        ...prev,
        [edit.key]: (branches || []).map((b) => b.name).filter(Boolean),
      }));
      setTagOptions((prev) => ({
        ...prev,
        [edit.key]: (tags || []).map((t) => t.name).filter(Boolean),
      }));
    } catch {
      // 分支/Tag 加载失败不阻断触发，允许手工输入
    } finally {
      setRefLoading((prev) => ({ ...prev, [edit.key]: false }));
    }
  }, []);

  const renderDynamicVar = useCallback(
    async (
      param: WorkflowParam,
      currentPreset: Record<string, unknown>,
      forceDefault = false
    ) => {
      setDynamicLoading((prev) => ({ ...prev, [param.name]: true }));
      try {
        const options = await workflowApi.renderDynamicVariables(
          projectName,
          '',
          '',
          '',
          param.name,
          currentPreset
        );
        const list = Array.isArray(options) ? options : [];
        setDynamicOptions((prev) => ({ ...prev, [param.name]: list }));

        const curVal = form.getFieldValue(param.name);
        if ((!curVal || forceDefault) && list.length > 0) {
          form.setFieldsValue({ [param.name]: list[0] });
        }
      } catch (err) {
        console.error(`Failed to render dynamic variable ${param.name}:`, err);
      } finally {
        setDynamicLoading((prev) => ({ ...prev, [param.name]: false }));
      }
    },
    [projectName, form]
  );

  useEffect(() => {
    if (visible && workflowName) {
      setPresetLoading(true);
      setPreset(null);
      setParams([]);
      setDynamicOptions({});
      setDynamicLoading({});
      setRepoEdits([]);
      setDeployEdits([]);
      setBranchOptions({});
      setTagOptions({});
      setPresetError(null);
      setResetCache(false);
      form.setFieldsValue({ remark: '' });
      workflowApi
        .getWorkflowPreset(workflowName)
        .then((res) => {
          if (res) {
            const rawPreset = res as unknown as Record<string, unknown>;
            setPreset(rawPreset);
            const pList = res.params || [];
            setParams(pList);
            const initialValues: Record<string, unknown> = { remark: '' };
            pList.forEach((p) => {
              if (p.type === 'repo' && p.repo) {
                initialValues[`${p.name}__mode`] = p.repo.tag
                  ? 'tag'
                  : p.repo.enable_commit || p.repo.commit_id
                  ? 'commit'
                  : 'branch';
                initialValues[`${p.name}__branch`] = p.repo.branch || '';
                initialValues[`${p.name}__tag`] = p.repo.tag || '';
                initialValues[`${p.name}__commit`] = p.repo.commit_id || '';
              } else {
                initialValues[p.name] = p.value ?? p.default ?? '';
              }
            });
            form.setFieldsValue(initialValues);
            hydrateRuntimeEdits(res.stages);

            pList.forEach((p) => {
              if (p.type === 'script') {
                renderDynamicVar(p, rawPreset, !p.value);
              }
            });
          }
        })
        .catch((err: unknown) => {
          const errData = (
            err as { response?: { data?: { message?: string; description?: string } } }
          )?.response?.data;
          const desc = errData?.description || '';
          const msg =
            errData?.message || (err instanceof Error ? err.message : '') || '获取工作流执行参数失败';
          const fullMsg = desc ? `${msg}: ${desc}` : msg;
          const combined = `${msg} ${desc}`.toLowerCase();
          const isRegistry =
            combined.includes('registry') ||
            combined.includes('镜像仓库') ||
            combined.includes('default registry');
          setPresetError({ message: fullMsg, isRegistry });
          if (!isRegistry) {
            feedback.message.error(fullMsg);
          }
        })
        .finally(() => setPresetLoading(false));
    }
  }, [visible, workflowName, form, renderDynamicVar, hydrateRuntimeEdits]);

  useEffect(() => {
    repoEdits.forEach((edit) => {
      if (edit.codehostId && edit.repoOwner && edit.repoName) {
        loadRepoRefs(edit);
      }
    });
  }, [repoEdits, loadRepoRefs]);

  const handleRefreshDynamicVar = (param: WorkflowParam) => {
    if (!preset) return;
    const currentValues = form.getFieldsValue();
    const currentPreset = {
      ...preset,
      params: params.map((p) => ({
        ...p,
        value: currentValues[p.name] ?? p.value ?? '',
      })),
    };
    renderDynamicVar(param, currentPreset, false);
  };

  const updateRepoEdit = (key: string, patch: Partial<RepoEditState>) => {
    setRepoEdits((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const updateDeployEdit = (jobName: string, patch: Partial<DeployEditState>) => {
    setDeployEdits((prev) =>
      prev.map((d) => {
        if (d.jobName !== jobName) return d;
        const next = { ...d, ...patch };
        if (patch.env !== undefined) {
          const matched = d.envOptions.find((o) => o.env === patch.env);
          const serviceOptions = extractServiceNames(matched?.services || d.serviceOptions);
          next.serviceOptions = serviceOptions.length > 0 ? serviceOptions : d.serviceOptions;
          next.selectedServices =
            serviceOptions.length > 0 ? serviceOptions.slice() : d.selectedServices;
        }
        return next;
      })
    );
  };

  const applyRepoAndDeployToStages = (stages: WorkflowStage[]): WorkflowStage[] => {
    return (stages || []).map((stage) => ({
      ...stage,
      jobs: (stage.jobs || []).map((job) => {
        const spec = { ...(job.spec || {}) } as Record<string, unknown>;

        if (job.type === 'zadig-build') {
          const builds = (
            (spec.service_and_builds || spec.default_service_and_builds || []) as ServiceAndBuildItem[]
          ).map((svc) => {
            const repos = (svc.repos || []).map((repo, repoIndex) => {
              const edit = repoEdits.find(
                (r) =>
                  r.jobName === job.name &&
                  r.serviceName === (svc.service_name || '') &&
                  r.serviceModule === (svc.service_module || '') &&
                  r.repoIndex === repoIndex
              );
              if (!edit) return repo;
              if (edit.mode === 'tag') {
                return {
                  ...repo,
                  branch: '',
                  tag: edit.tag,
                  commit_id: '',
                  enable_commit: false,
                };
              }
              if (edit.mode === 'commit') {
                return {
                  ...repo,
                  branch: edit.branch || repo.branch,
                  tag: '',
                  commit_id: edit.commitId,
                  enable_commit: true,
                };
              }
              return {
                ...repo,
                branch: edit.branch,
                tag: '',
                commit_id: '',
                enable_commit: false,
              };
            });
            return { ...svc, repos };
          });
          spec.service_and_builds = builds;
        }

        if (DEPLOY_JOB_TYPES.has(String(job.type))) {
          const edit = deployEdits.find((d) => d.jobName === job.name);
          if (edit) {
            if (job.type === 'custom-deploy') {
              // custom-deploy 使用 namespace/cluster，不强制改 env；若有 env_name 字段则同步
              if ('env_name' in spec || edit.env) {
                spec.env_name = edit.env;
              }
            } else {
              spec.env = edit.env;
              spec.env_name = edit.env;
            }
            if (Array.isArray(spec.services) && edit.selectedServices.length > 0) {
              const original = spec.services as Array<Record<string, unknown> | string>;
              spec.services = original.filter((s) => {
                const name = typeof s === 'string' ? s : String(s.service_name || s.name || '');
                return edit.selectedServices.includes(name);
              });
            }
            if (Array.isArray(spec.service_and_images) && edit.selectedServices.length > 0) {
              const original = spec.service_and_images as Array<Record<string, unknown>>;
              spec.service_and_images = original.filter((s) =>
                edit.selectedServices.includes(String(s.service_name || ''))
              );
            }
          }
        }

        return { ...job, spec };
      }),
    }));
  };

  const handleExecute = async (debug = false) => {
    if (!preset) return;
    if (debug) setDebugLoading(true);
    else setLoading(true);
    try {
      const values = await form.validateFields();
      const updatedParams = params.map((p) => {
        if (p.type === 'repo') {
          const mode = (values[`${p.name}__mode`] as string) || 'branch';
          const branch = (values[`${p.name}__branch`] as string) || '';
          const tag = (values[`${p.name}__tag`] as string) || '';
          const commitId = (values[`${p.name}__commit`] as string) || '';
          const nextRepo: WorkflowRepoRef = { ...(p.repo || {}) };
          if (mode === 'tag') {
            nextRepo.tag = tag;
            nextRepo.branch = '';
            nextRepo.commit_id = '';
            nextRepo.enable_commit = false;
          } else if (mode === 'commit') {
            nextRepo.commit_id = commitId;
            nextRepo.enable_commit = true;
            nextRepo.tag = '';
            if (branch) nextRepo.branch = branch;
          } else {
            nextRepo.branch = branch;
            nextRepo.tag = '';
            nextRepo.commit_id = '';
            nextRepo.enable_commit = false;
          }
          return { ...p, repo: nextRepo, value: branch || tag || commitId || p.value || '' };
        }
        const val = values[p.name] ?? p.value ?? '';
        if (p.type === 'file' && typeof val === 'object' && val !== null) {
          const fileVal = val as ChunkUploaderValue;
          return {
            ...p,
            value: fileVal.file_name,
            file_id: fileVal.file_id,
          };
        }
        return {
          ...p,
          value: val,
        };
      });

      const stages = applyRepoAndDeployToStages(
        ((preset.stages as WorkflowStage[]) || []).slice()
      );

      const payload = stripIllegalFields({
        ...(preset as Record<string, unknown>),
        project: projectName || (preset.project as string) || '',
        name: workflowName || (preset.name as string),
        params: updatedParams,
        stages,
        remark: (values.remark as string) || '',
        // V4 后端字段为 ignore_cache；reset_cache 兼容旧契约与规格命名
        ignore_cache: resetCache,
        reset_cache: resetCache,
        debug,
      });

      const res = await workflowApi.triggerWorkflow(payload);

      feedback.message.success(
        debug ? `工作流 ${workflowName} 已以调试模式启动！` : `工作流 ${workflowName} 已成功启动！`
      );
      onClose();

      const taskId = res?.task_id;
      if (!taskId) {
        feedback.message.warning('工作流已触发，但未返回 task_id，请从任务列表进入');
        return;
      }
      const targetUrl = projectName
        ? `/v1/projects/detail/${projectName}/pipelines/custom/${workflowName}/${taskId}`
        : `/v1/pipelines/${workflowName}/task/${taskId}`;
      navigate(targetUrl);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        '触发失败，请稍后重试';
      feedback.message.error(`触发失败: ${msg}`);
    } finally {
      setLoading(false);
      setDebugLoading(false);
    }
  };

  const renderParamField = (p: WorkflowParam) => {
    switch (p.type) {
      case 'choice':
        return (
          <Select
            options={(p.choice_option || []).map((opt) => ({ label: opt, value: opt }))}
            placeholder="请选择"
          />
        );
      case 'multi-select':
        return (
          <Select
            mode="multiple"
            options={(p.choice_option || []).map((opt) => ({ label: opt, value: opt }))}
            placeholder="请选择 (多选)"
          />
        );
      case 'script': {
        const options = dynamicOptions[p.name] || [];
        const isVarLoading = !!dynamicLoading[p.name];
        return (
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              showSearch
              allowClear
              placeholder={isVarLoading ? '计算动态选项中...' : '请选择动态变量选项'}
              loading={isVarLoading}
              options={options.map((opt) => ({ label: opt, value: opt }))}
              notFoundContent={isVarLoading ? <Spin size="small" /> : '暂无可用动态选项'}
            />
            <Tooltip title="重新计算动态选项">
              <Button
                icon={<ReloadOutlined spin={isVarLoading} />}
                disabled={isVarLoading}
                onClick={() => handleRefreshDynamicVar(p)}
              />
            </Tooltip>
          </Space.Compact>
        );
      }
      case 'repo':
        return <RepoParamFields param={p} />;
      case 'text':
        return <Input.TextArea rows={2} placeholder={p.description || '请输入'} />;
      case 'file':
        return (
          <ChunkUploader
            extraPrompt={`为参数 ${p.name} 上传大文件（最大 500MB），用于任务容器挂载`}
          />
        );
      default:
        return <Input placeholder={p.description || '请输入'} />;
    }
  };

  const hasRuntimeSections = repoEdits.length > 0 || deployEdits.length > 0;
  const canSubmit = !presetLoading && !!preset && !presetError?.isRegistry;
  const busy = loading || debugLoading;

  const envSelectOptions = useMemo(
    () =>
      deployEdits.map((d) => ({
        jobName: d.jobName,
        options:
          d.envOptions.length > 0
            ? d.envOptions.map((o) => ({
                value: o.env || '',
                label: o.env_alias ? `${o.env} (${o.env_alias})` : o.env || '',
              }))
            : d.env
            ? [{ value: d.env, label: d.env }]
            : [],
      })),
    [deployEdits]
  );

  return (
    <Modal
      title={
        <Space orientation="horizontal">
          <PlayCircleOutlined style={{ color: '#52c41a' }} />
          <span>执行工作流: {workflowName}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="debug"
          icon={<BugOutlined />}
          loading={debugLoading}
          disabled={!canSubmit || busy}
          onClick={() => handleExecute(true)}
        >
          调试执行
        </Button>,
        <Button
          key="run"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={loading}
          disabled={!canSubmit || busy}
          onClick={() => handleExecute(false)}
        >
          立即执行
        </Button>,
      ]}
      width={720}
      destroyOnHidden
    >
      {presetLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#64748b' }}>正在获取工作流执行参数...</div>
        </div>
      ) : presetError ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          title={
            presetError.isRegistry
              ? '当前项目尚未配置默认镜像仓库，构建任务需指定镜像仓库'
              : '获取工作流执行参数失败'
          }
          description={
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {presetError.message}
              </Text>
              {presetError.isRegistry && (
                <Button
                  type="primary"
                  onClick={() => {
                    onClose();
                    navigate('/v1/system/integration');
                  }}
                >
                  前往系统集成配置镜像仓库
                </Button>
              )}
            </Space>
          }
        />
      ) : (
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="remark" label="执行备注">
            <Input.TextArea rows={2} placeholder="请输入执行备注" maxLength={500} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 16 }}>
            <Checkbox checked={resetCache} onChange={(e) => setResetCache(e.target.checked)}>
              不使用缓存
            </Checkbox>
          </Form.Item>

          {params.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 0 }}>
                运行参数
              </Title>
              {params.map((p) => (
                <Form.Item
                  key={p.name}
                  name={p.type === 'repo' ? undefined : p.name}
                  label={
                    <Space orientation="horizontal" size={6}>
                      <Text strong>{p.name}</Text>
                      {p.type && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          ({p.type})
                        </Text>
                      )}
                    </Space>
                  }
                  tooltip={p.description}
                  rules={
                    p.type === 'repo'
                      ? undefined
                      : p.required
                      ? [{ required: true, message: `请填写 ${p.name}` }]
                      : [{ required: false }]
                  }
                >
                  {renderParamField(p)}
                </Form.Item>
              ))}
            </>
          )}

          {repoEdits.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0 16px' }} />
              <Title level={5}>
                <BranchesOutlined /> 构建代码源
              </Title>
              <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                {repoEdits.map((edit) => (
                  <Card
                    key={edit.key}
                    size="small"
                    variant="outlined"
                    title={
                      <Space size={8} wrap>
                        <Text strong>
                          {edit.serviceName}
                          {edit.serviceModule ? ` / ${edit.serviceModule}` : ''}
                        </Text>
                        <Tag color="blue">{edit.jobName}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {edit.repoOwner}/{edit.repoName}
                        </Text>
                      </Space>
                    }
                  >
                    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                      <Radio.Group
                        value={edit.mode}
                        optionType="button"
                        onChange={(e) => updateRepoEdit(edit.key, { mode: e.target.value })}
                        options={[
                          { label: '分支', value: 'branch' },
                          { label: 'Tag', value: 'tag' },
                          { label: 'Commit', value: 'commit' },
                        ]}
                      />
                      {edit.mode === 'branch' && (
                        <Space.Compact style={{ width: '100%' }}>
                          <Select
                            showSearch={{ optionFilterProp: 'label' }}
                            allowClear
                            loading={!!refLoading[edit.key]}
                            value={
                              (branchOptions[edit.key] || []).includes(edit.branch)
                                ? edit.branch
                                : undefined
                            }
                            placeholder="从列表选择分支"
                            options={(branchOptions[edit.key] || []).map((b) => ({
                              label: b,
                              value: b,
                            }))}
                            onChange={(v) => updateRepoEdit(edit.key, { branch: v || '' })}
                            style={{ width: '55%' }}
                          />
                          <Input
                            style={{ width: '45%' }}
                            value={edit.branch}
                            placeholder="或手动输入分支"
                            onChange={(e) => updateRepoEdit(edit.key, { branch: e.target.value })}
                          />
                        </Space.Compact>
                      )}
                      {edit.mode === 'tag' && (
                        <Space.Compact style={{ width: '100%' }}>
                          <Select
                            showSearch={{ optionFilterProp: 'label' }}
                            allowClear
                            loading={!!refLoading[edit.key]}
                            value={
                              (tagOptions[edit.key] || []).includes(edit.tag) ? edit.tag : undefined
                            }
                            placeholder="从列表选择 Tag"
                            options={(tagOptions[edit.key] || []).map((t) => ({
                              label: t,
                              value: t,
                            }))}
                            onChange={(v) => updateRepoEdit(edit.key, { tag: v || '' })}
                            style={{ width: '55%' }}
                          />
                          <Input
                            style={{ width: '45%' }}
                            value={edit.tag}
                            placeholder="或手动输入 Tag"
                            onChange={(e) => updateRepoEdit(edit.key, { tag: e.target.value })}
                          />
                        </Space.Compact>
                      )}
                      {edit.mode === 'commit' && (
                        <Input
                          value={edit.commitId}
                          placeholder="Commit SHA"
                          onChange={(e) => updateRepoEdit(edit.key, { commitId: e.target.value })}
                        />
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            </>
          )}

          {deployEdits.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Title level={5}>
                <CloudServerOutlined /> 目标部署环境
              </Title>
              <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                {deployEdits.map((edit) => {
                  const opts =
                    envSelectOptions.find((o) => o.jobName === edit.jobName)?.options || [];
                  return (
                    <Card
                      key={edit.jobName}
                      size="small"
                      variant="outlined"
                      title={
                        <Space>
                          <Text strong>{edit.jobName}</Text>
                          <Tag>{edit.jobType}</Tag>
                        </Space>
                      }
                    >
                      <Form.Item label="部署环境" style={{ marginBottom: 12 }}>
                        {opts.length > 0 ? (
                          <Select
                            value={edit.env || undefined}
                            options={opts}
                            placeholder="选择目标环境"
                            onChange={(v) => updateDeployEdit(edit.jobName, { env: v })}
                            style={{ width: '100%' }}
                          />
                        ) : (
                          <Input
                            value={edit.env}
                            placeholder="环境名称，例如 dev"
                            onChange={(e) =>
                              updateDeployEdit(edit.jobName, { env: e.target.value })
                            }
                          />
                        )}
                      </Form.Item>
                      {edit.serviceOptions.length > 0 && (
                        <Form.Item label="部署服务" style={{ marginBottom: 0 }}>
                          <Select
                            mode="multiple"
                            value={edit.selectedServices}
                            options={edit.serviceOptions.map((s) => ({ label: s, value: s }))}
                            placeholder="选择要部署的服务"
                            onChange={(v) =>
                              updateDeployEdit(edit.jobName, { selectedServices: v })
                            }
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      )}
                    </Card>
                  );
                })}
              </Space>
            </>
          )}

          {params.length === 0 && !hasRuntimeSections && (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="该工作流没有可配置的运行参数，点击「立即执行」直接启动。"
              />
            </div>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default WorkflowTriggerModal;
