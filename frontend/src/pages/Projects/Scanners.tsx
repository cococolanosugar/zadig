import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Drawer,
  Form,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Badge,
  Descriptions,
  Empty,
  Spin,
  Timeline,
  Collapse,
  InputNumber,
  Switch,
  Radio,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  FileSearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  EditOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import LogViewer from '../../components/Terminal/LogViewer';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { normalizeJobName } from '../../utils/jobname';
import { feedback } from '../../utils/feedback';
import { settingsApi, type ClusterItem } from '../../api/settings';

const { Text, Title } = Typography;
const { Option } = Select;

interface ScanningTaskItem {
  id?: number | string;
  scan_id?: number | string;
  status?: string;
  creator?: string;
  create_time?: number;
  start_time?: number;
  end_time?: number;
  duration?: number;
}

// ListScanningTaskResp: {scan_info, scan_tasks:[{scan_id,status,run_time,creator,created_at,repo_info}], total_tasks}
const mapScanTask = (t: Record<string, unknown>): ScanningTaskItem => ({
  scan_id: t.scan_id as number,
  status: t.status as string,
  creator: t.creator as string,
  create_time: t.created_at as number,
  duration: t.run_time as number,
});

export interface NotifyCtl {
  enabled: boolean;
  webhook_type: 'dingding' | 'feishu' | 'feishu_person' | 'wechat' | 'msteams' | 'mail' | 'webhook' | string;
  notify_type: string[];
  dingding_notification_config?: {
    hook_address?: string;
    at_mobiles?: string[];
    is_at_all?: boolean;
  };
  wechat_notification_config?: {
    hook_address?: string;
    at_users?: string[];
    is_at_all?: boolean;
  };
  lark_hook_notification_config?: {
    hook_address?: string;
    at_users?: string[];
    is_at_all?: boolean;
  };
  lark_person_notification_config?: {
    app_id?: string;
  };
  msteams_notification_config?: {
    hook_address?: string;
    at_emails?: string[];
  };
  mail_notification_config?: {
    target_users?: Array<{ user_id?: string; name?: string; email?: string }>;
    target_emails?: string[];
  };
  webhook_notification_config?: {
    address?: string;
    token?: string;
  };
}

export interface ScanningCacheSetting {
  cache_enable: boolean;
  cache_dir_type: 'workspace' | 'user_defined' | string;
  cache_user_dir?: string;
}

export interface ScanningAdvancedSetting {
  artifact_paths?: string[];
  cluster_id?: string;
  cluster_source?: string;
  strategy_id?: string;
  timeout?: number;
  res_req?: 'low' | 'medium' | 'high' | 'min' | 'define' | string;
  res_req_spec?: {
    cpu_limit?: number;
    memory_limit?: number;
    cpu_req?: number;
    memory_req?: number;
    gpu_limit?: string;
  };
  hook_ctl?: {
    enabled: boolean;
    items: unknown[];
  };
  notify_ctls?: NotifyCtl[];
  cache?: ScanningCacheSetting;
  concurrency_limit?: number;
  custom_annotations?: Array<{ key: string; value: string }>;
  custom_labels?: Array<{ key: string; value: string }>;
}

export interface ScannerItem {
  id?: string;
  name: string;
  project_name?: string;
  description?: string;
  scanner_type: 'sonar' | 'ai-review' | 'trivy' | 'standard' | 'sonarQube' | 'ai_review' | 'other' | string;
  enable_ai_review?: boolean;
  repos?: { repo_name: string; branch: string }[];
  script?: string;
  update_time?: number;
  update_by?: string;
  last_status?: 'passed' | 'failed' | 'running' | 'untested';
  quality_metrics?: {
    bugs?: number;
    vulnerabilities?: number;
    code_smells?: number;
    coverage?: number;
    ai_suggestions?: string;
  };
  advanced_settings?: ScanningAdvancedSetting;
  outputs?: unknown[];
}

export interface ScanningRepoItem {
  codehost_id: number;
  source: string;
  repo_namespace: string;
  repo_name: string;
  code_repo_scannings?: unknown[];
}

export const ScannersPage: React.FC = () => {
  const { projectName, scannerName: routeScannerName, taskId: routeTaskId } = useParams<{
    projectName: string;
    scannerName?: string;
    taskId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState<boolean>(false);
  const [scanners, setScanners] = useState<ScannerItem[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingScanner, setEditingScanner] = useState<ScannerItem | null>(null);
  const [reportDrawerVisible, setReportDrawerVisible] = useState<boolean>(false);
  const [selectedScanner, setSelectedScanner] = useState<ScannerItem | null>(null);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [repoList, setRepoList] = useState<ScanningRepoItem[]>([]);
  const [repoLoading, setRepoLoading] = useState<boolean>(false);
  const [manualRepoInput, setManualRepoInput] = useState<boolean>(false);
  const [form] = Form.useForm();
  const selectedResReq = Form.useWatch('res_req', form);
  const selectedCacheEnable = Form.useWatch('cache_enable', form);
  const selectedCacheDirType = Form.useWatch('cache_dir_type', form);
  const selectedClusterId = Form.useWatch('cluster_id', form);

  // 加载扫描代码库列表 (F9)
  const fetchScanningRepos = useCallback(async () => {
    if (!projectName) return;
    setRepoLoading(true);
    try {
      const res = await http.get<ScanningRepoItem[]>(
        `/api/aslan/testing/scanning/repo?projectName=${encodeURIComponent(projectName)}`,
        { skipErrorHandler: true }
      );
      setRepoList(Array.isArray(res) ? res : []);
    } catch {
      setRepoList([]);
    } finally {
      setRepoLoading(false);
    }
  }, [projectName]);

  // 加载集群列表
  useEffect(() => {
    settingsApi.getClusters().then((res) => {
      setClusters(Array.isArray(res) ? res : []);
    }).catch(() => {});
    fetchScanningRepos();
  }, [fetchScanningRepos]);

  const handleOpenEdit = useCallback((target: ScannerItem) => {
    setEditingScanner(target);
    fetchScanningRepos();
    const adv = target.advanced_settings;
    const scannerType =
      target.scanner_type === 'ai_review'
        ? 'ai-review'
        : target.scanner_type === 'sonarQube'
        ? 'sonar'
        : target.scanner_type || 'standard';

    const currentRepo = target.repos?.[0]?.repo_name || '';
    setManualRepoInput(!currentRepo || (!repoList.some((r) => r.repo_name === currentRepo) && repoList.length === 0));

    form.setFieldsValue({
      name: target.name,
      description: target.description,
      scanner_type: scannerType,
      repo_name: currentRepo,
      artifact_paths: adv?.artifact_paths || [],
      timeout: adv?.timeout ?? 600,
      concurrency_limit: adv?.concurrency_limit ?? 1,
      cluster_id: adv?.cluster_id || '',
      strategy_id: adv?.strategy_id || '',
      res_req: adv?.res_req || 'low',
      cpu_limit: adv?.res_req_spec?.cpu_limit ?? 1000,
      memory_limit: adv?.res_req_spec?.memory_limit ?? 512,
      cache_enable: adv?.cache?.cache_enable ?? false,
      cache_dir_type: adv?.cache?.cache_dir_type || 'workspace',
      cache_user_dir: adv?.cache?.cache_user_dir || '',
      hook_enabled: adv?.hook_ctl?.enabled !== false,
      notify_ctls: (adv?.notify_ctls || []).map((nc: any) => ({
        ...nc,
        mail_notification_config: nc.mail_notification_config
          ? {
              target_emails: (nc.mail_notification_config.target_users || []).map((u: any) => u.email || u.name || ''),
            }
          : undefined,
      })),
    });
    setModalVisible(true);
  }, [form, repoList, fetchScanningRepos]);

  const handleOpenCreate = useCallback(() => {
    setEditingScanner(null);
    form.resetFields();
    setManualRepoInput(false);
    fetchScanningRepos();
    setModalVisible(true);
  }, [form, fetchScanningRepos]);

  // 路由 /scanner/create、/scanner/edit/:name 自动打开弹窗
  useEffect(() => {
    if (location.pathname.includes('/scanner/create') || location.pathname.includes('/scanner/ai-review/create')) {
      const isAi = location.pathname.includes('/ai-review/');
      setEditingScanner(null);
      form.resetFields();
      form.setFieldsValue({
        scanner_type: isAi ? 'ai-review' : 'sonar',
        timeout: 600,
        concurrency_limit: 1,
        res_req: 'low',
        cpu_limit: 1000,
        memory_limit: 512,
        cache_enable: false,
        cache_dir_type: 'workspace',
        hook_enabled: true,
        artifact_paths: [],
        notify_ctls: [],
      });
      setModalVisible(true);
    } else if (location.pathname.includes('/scanner/edit/') || location.pathname.includes('/scanner/ai-review/edit/')) {
      if (routeScannerName && scanners.length > 0) {
        const target = scanners.find((s) => s.name === routeScannerName);
        if (target) {
          handleOpenEdit(target);
        }
      }
    }
  }, [location.pathname, routeScannerName, scanners, form, handleOpenEdit]);

  const handleCloseModal = () => {
    setModalVisible(false);
    form.resetFields();
    if (location.pathname.includes('/create') || location.pathname.includes('/edit/')) {
      navigate(`/v1/projects/detail/${projectName}/scanner`);
    }
  };

  // 扫描详情抽屉（配置 + 任务记录）
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailScanner, setDetailScanner] = useState<ScannerItem | null>(null);
  const [scanTasks, setScanTasks] = useState<ScanningTaskItem[]>([]);

  // ---------- 扫描任务详情：事件 / SSE 日志 / 产物 / 取消 ----------
  // 契约（workflow/testing handler/router.go + scanning.go）：
  //   GET  /api/aslan/testing/scanning/:id/task/:scan_id/events  → Events([{event_type,time,message}])
  //   GET  /api/aslan/testing/scanning/:id/task/:scan_id/sse     → SSE 实时日志
  //   GET  /api/aslan/testing/scanning/:id/task/:scan_id/artifact_info?jobName= → {file_names,not_history_file_flag}
  //   GET  /api/aslan/testing/scanning/artifact?id=&jobName=&taskID=&projectName= → 二进制 artifact.tar.gz
  //   DELETE /api/aslan/testing/scanning/:id/task/:scan_id?projectName= → 取消
  //   jobName = 扫描器名称（后端扫描工作流的 job.Name 即 scanning.Name）
  const [taskDrawer, setTaskDrawer] = useState<{ scannerId: string; scannerName: string; taskId: string } | null>(null);
  const [taskEvents, setTaskEvents] = useState<Array<{ event_type: string; time: string; message: string }>>([]);
  const [taskEventsLoading, setTaskEventsLoading] = useState(false);
  const [artifactFiles, setArtifactFiles] = useState<string[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [cancellingTask, setCancellingTask] = useState(false);

  const openTaskDetail = useCallback(
    async (scanner: ScannerItem, task: ScanningTaskItem) => {
      if (!scanner.id) return;
      const taskId = String(task.scan_id ?? task.id ?? '');
      setTaskDrawer({ scannerId: scanner.id, scannerName: scanner.name, taskId });
      setTaskEvents([]);
      setArtifactFiles([]);
      setTaskEventsLoading(true);
      setArtifactLoading(true);
      try {
        const res = await http.get<Array<{ event_type: string; time: string; message: string }>>(
          `/api/aslan/testing/scanning/${scanner.id}/task/${taskId}/events`,
          { skipErrorHandler: true }
        );
        setTaskEvents(Array.isArray(res) ? res : []);
      } catch {
        setTaskEvents([]);
      } finally {
        setTaskEventsLoading(false);
      }
      try {
        const res = await http.get<{ file_names?: string[] }>(
          `/api/aslan/testing/scanning/${scanner.id}/task/${taskId}/artifact_info?jobName=${encodeURIComponent(normalizeJobName(scanner.name))}`,
          { skipErrorHandler: true }
        );
        setArtifactFiles(res?.file_names || []);
      } catch {
        setArtifactFiles([]);
      } finally {
        setArtifactLoading(false);
      }
    },
    []
  );

  const handleCancelScanTask = useCallback(
    async (scannerId: string, taskId: string) => {
      if (!projectName) return;
      setCancellingTask(true);
      try {
        await http.delete(
          `/api/aslan/testing/scanning/${scannerId}/task/${taskId}?projectName=${encodeURIComponent(projectName)}`,
          { skipErrorHandler: true }
        );
        feedback.message.success(`扫描任务 #${taskId} 已取消`);
        if (detailScanner) openScannerDetail(detailScanner);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description || '取消失败';
        feedback.message.error(msg);
      } finally {
        setCancellingTask(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskDrawer, projectName, detailScanner]
  );

  const handleDownloadArtifact = useCallback(async () => {
    if (!taskDrawer || !projectName) return;
    try {
      const res = await http.get(
        `/api/aslan/testing/scanning/artifact?id=${encodeURIComponent(taskDrawer.scannerId)}&jobName=${encodeURIComponent(normalizeJobName(taskDrawer.scannerName))}&taskID=${taskDrawer.taskId}&projectName=${encodeURIComponent(projectName)}`,
        { skipErrorHandler: true, responseType: 'blob' }
      );
      const blob = res instanceof Blob ? res : new Blob([res as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artifact.tar.gz';
      a.click();
      URL.revokeObjectURL(url);
      feedback.message.success('产物已下载');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description || '产物下载失败（任务可能未产出产物）';
      feedback.message.error(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDrawer, projectName]);

  const fetchScanners = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const res = await http.get<ScannerItem[]>(
        `/api/aslan/testing/scanning?projectName=${projectName}`
      );
      const list = Array.isArray(res) ? res : [];
      setScanners(list);
    } catch (err: unknown) {
      setScanners([]);
      const msg = err instanceof Error ? err.message : '获取代码审查模块失败';
      feedback.message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    fetchScanners();
  }, [fetchScanners]);

  const openScannerDetail = useCallback(
    async (scanner: ScannerItem) => {
      if (!scanner.id) return;
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailScanner(scanner);
      setScanTasks([]);
      try {
        const res = await http.get<ScannerItem>(
          `/api/aslan/testing/scanning/${scanner.id}`,
          { skipErrorHandler: true }
        );
        if (res) setDetailScanner({ ...scanner, ...res });
      } catch {
        // 保留列表数据
      }
      try {
        // 后端 ListScanningTask 返回 {scan_info, scan_tasks, total_tasks}
        const taskRes = await http.get<{ scan_info?: unknown; scan_tasks?: Array<Record<string, unknown>>; total_tasks?: number }>(
          `/api/aslan/testing/scanning/${scanner.id}/task`,
          { skipErrorHandler: true }
        );
        setScanTasks(
          Array.isArray(taskRes?.scan_tasks) ? taskRes.scan_tasks.map(mapScanTask) : []
        );
      } catch {
        setScanTasks([]);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  // 路由 /scanner/detail/:scannerName → 按名称定位并打开详情
  useEffect(() => {
    if (routeScannerName && scanners.length > 0) {
      const target = scanners.find((s) => s.name === routeScannerName);
      if (target) {
        openScannerDetail(target);
      }
    }
  }, [routeScannerName, scanners, openScannerDetail]);

  const handleSaveScanner = async () => {
    try {
      const values = await form.validateFields();
      const scannerType =
        values.scanner_type === 'ai-review'
          ? 'ai_review'
          : values.scanner_type === 'sonar'
          ? 'sonarQube'
          : 'other';

      const resReq = values.res_req || 'low';
      let cpuLimit = 1000;
      let memoryLimit = 512;
      if (resReq === 'define') {
        cpuLimit = Number(values.cpu_limit || 1000);
        memoryLimit = Number(values.memory_limit || 512);
      } else if (resReq === 'high') {
        cpuLimit = 4000;
        memoryLimit = 2048;
      } else if (resReq === 'medium') {
        cpuLimit = 2000;
        memoryLimit = 1024;
      } else if (resReq === 'min') {
        cpuLimit = 500;
        memoryLimit = 256;
      }

      const adv: ScanningAdvancedSetting = {
        artifact_paths: Array.isArray(values.artifact_paths) ? values.artifact_paths : [],
        cluster_id: values.cluster_id || '',
        cluster_source: '',
        strategy_id: values.strategy_id || '',
        timeout: Number(values.timeout ?? 600),
        res_req: resReq,
        res_req_spec: {
          cpu_limit: cpuLimit,
          memory_limit: memoryLimit,
          cpu_req: 0,
          memory_req: 0,
          gpu_limit: '',
        },
        hook_ctl: {
          enabled: values.hook_enabled !== false,
          items: editingScanner?.advanced_settings?.hook_ctl?.items || [],
        },
        notify_ctls: (values.notify_ctls || []).map((nc: any) => ({
          enabled: nc.enabled !== false,
          webhook_type: nc.webhook_type || 'dingding',
          notify_type: nc.notify_type || ['passed', 'failed'],
          dingding_notification_config: nc.webhook_type === 'dingding' ? nc.dingding_notification_config : undefined,
          wechat_notification_config: nc.webhook_type === 'wechat' ? nc.wechat_notification_config : undefined,
          lark_hook_notification_config: nc.webhook_type === 'feishu' ? nc.lark_hook_notification_config : undefined,
          lark_person_notification_config: nc.webhook_type === 'feishu_person' ? nc.lark_person_notification_config : undefined,
          msteams_notification_config: nc.webhook_type === 'msteams' ? nc.msteams_notification_config : undefined,
          mail_notification_config:
            nc.webhook_type === 'mail' && nc.mail_notification_config?.target_emails
              ? {
                  target_users: (nc.mail_notification_config.target_emails || []).map((email: string) => ({
                    email,
                    name: email,
                  })),
                }
              : undefined,
          webhook_notification_config: nc.webhook_type === 'webhook' ? nc.webhook_notification_config : undefined,
        })),
        cache: {
          cache_enable: !!values.cache_enable,
          cache_dir_type: values.cache_dir_type || 'workspace',
          cache_user_dir: values.cache_user_dir || '',
        },
        concurrency_limit: Number(values.concurrency_limit ?? 1),
        custom_annotations: editingScanner?.advanced_settings?.custom_annotations || [],
        custom_labels: editingScanner?.advanced_settings?.custom_labels || [],
      };

      const selectedRepoObj = repoList.find((r) => r.repo_name === values.repo_name);
      const repoPayload = values.repo_name
        ? [
            {
              repo_name: values.repo_name.trim(),
              branch: 'main',
              codehost_id: selectedRepoObj?.codehost_id,
              source: selectedRepoObj?.source,
              repo_namespace: selectedRepoObj?.repo_namespace,
            },
          ]
        : [{ repo_name: 'main-repo', branch: 'main' }];

      const payload = {
        name: values.name,
        project_name: projectName,
        description: values.description,
        scanner_type: scannerType,
        repos: repoPayload,
        script: editingScanner?.script || '#!/bin/bash\nset -e',
        advanced_settings: adv,
        check_quality_gate: false,
        outputs: editingScanner?.outputs || [],
      };

      if (editingScanner && editingScanner.id) {
        await http.put(`/api/aslan/testing/scanning/${editingScanner.id}?projectName=${projectName}`, payload);
        feedback.message.success('代码审查规则更新成功');
      } else {
        await http.post(`/api/aslan/testing/scanning?projectName=${projectName}`, payload);
        feedback.message.success('代码审查规则创建成功');
      }

      setModalVisible(false);
      setEditingScanner(null);
      form.resetFields();
      fetchScanners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存代码审查规则失败，请检查配置参数';
      feedback.message.error(msg);
    }
  };

  const handleTriggerScan = async (record: ScannerItem) => {
    if (!record.id) {
      feedback.message.error('该扫描模块缺少 ID，无法触发');
      return;
    }
    feedback.message.loading(`正在对 [${record.name}] 触发代码安全扫描...`, 1);
    try {
      // 后端按 ObjectID 查库（FindScanningProjectNameFromID → GetByID），必须用列表项 id
      await http.post(
        `/api/aslan/testing/scanning/${record.id}/task?projectName=${projectName}`,
        {}
      );
      feedback.message.success(`代码审查任务 [${record.name}] 已在后台成功启动，检测完成后将同步质量门禁`);
      fetchScanners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '触发代码审查任务失败';
      feedback.message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // 后端按 ObjectID 删除（GetByID）
      await http.delete(`/api/aslan/testing/scanning/${id}?projectName=${projectName}`);
      feedback.message.success('代码审查模块已删除');
      fetchScanners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除代码审查模块失败';
      feedback.message.error(msg);
    }
  };

  const filteredScanners = scanners.filter(
    (s) =>
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns: ColumnsType<ScannerItem> = [
    {
      title: '扫描模块名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space orientation="vertical" size={2}>
          <Space orientation="horizontal" size={8}>
            {record.scanner_type === 'ai-review' ? (
              <RobotOutlined style={{ color: '#722ed1', fontSize: 16 }} />
            ) : (
              <SafetyCertificateOutlined style={{ color: '#0066ff', fontSize: 16 }} />
            )}
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => openScannerDetail(record)}
            >
              {text}
            </Button>
            {record.scanner_type === 'ai-review' && (
              <Tag color="purple" icon={<ThunderboltOutlined />}>
                AI 智能审查
              </Tag>
            )}
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '检测引擎',
      dataIndex: 'scanner_type',
      key: 'scanner_type',
      width: 150,
      render: (type) => {
        if (type === 'ai-review' || type === 'ai_review') return <Tag color="purple">LLM AI 审查</Tag>;
        if (type === 'trivy') return <Tag color="orange">Trivy CVE 漏洞</Tag>;
        return <Tag color="blue">SonarQube 静态审查</Tag>;
      },
    },
    {
      title: '门禁状态',
      key: 'status',
      width: 140,
      render: (_, record) => {
        if (record.last_status === 'passed') {
          return (
            <Badge status="success" text={<Text style={{ color: '#52c41a' }}>门禁达标</Text>} />
          );
        }
        if (record.last_status === 'failed') {
          return (
            <Badge status="error" text={<Text style={{ color: '#ff4d4f' }}>存在缺陷</Text>} />
          );
        }
        return <Badge status="default" text="未执行" />;
      },
    },
    {
      title: '更新信息',
      key: 'update_time',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {record.update_time
              ? dayjs.unix(record.update_time).format('YYYY-MM-DD HH:mm')
              : '刚刚'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.update_by || 'admin'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 270,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            style={{ color: '#0066ff' }}
            onClick={() => handleTriggerScan(record)}
          >
            立即扫描
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => {
              setSelectedScanner(record);
              setReportDrawerVisible(true);
            }}
          >
            质量报告
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该代码审查配置？"
            onConfirm={() => record.id && handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const passedScanners = scanners.filter((s) => s.last_status === 'passed').length;
  const passRate = scanners.length > 0 ? `${Math.round((passedScanners / scanners.length) * 100)}%` : '-';
  const totalBugsOrVulns = scanners.reduce(
    (acc, s) => acc + (s.quality_metrics?.vulnerabilities || 0) + (s.quality_metrics?.bugs || 0),
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metric Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="代码审查模块"
              value={scanners.length}
              prefix={<SafetyCertificateOutlined style={{ color: '#0066ff' }} />}
              styles={{ content: { fontSize: 24, fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="门禁通过率"
              value={passRate}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { fontSize: 24, fontWeight: 600, color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="AI 智能审查引擎"
              value="已就绪"
              prefix={<RobotOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 20, fontWeight: 600, color: '#722ed1' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title="阻断漏洞数"
              value={totalBugsOrVulns}
              prefix={<CloseCircleOutlined style={{ color: '#8c8c8c' }} />}
              styles={{ content: { fontSize: 24, fontWeight: 600 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table */}
      <Card variant="borderless" styles={{ body: { padding: '20px 24px' } }}>
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
          <Input
            placeholder="搜索代码审查模块、检测引擎..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />

          <Space size="middle">
            <Button icon={<ReloadOutlined />} onClick={fetchScanners} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              新建审查规则
            </Button>
          </Space>
        </div>

        <Table
          rowKey="name"
          columns={columns}
          dataSource={filteredScanners}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个审查配置` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无代码审查配置，可点击右上角「新建审查规则」添加扫描任务"
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleOpenCreate}
                >
                  新建审查规则
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create / Edit Scanner Modal with Advanced Settings */}
      <Modal
        title={editingScanner ? `编辑代码审查规则: ${editingScanner.name}` : '新建代码质量审查与扫描规则'}
        open={modalVisible}
        onOk={handleSaveScanner}
        onCancel={handleCloseModal}
        destroyOnHidden
        width={740}
        okText={editingScanner ? '保存修改' : '确认创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            scanner_type: 'sonar',
            timeout: 600,
            concurrency_limit: 1,
            res_req: 'low',
            cpu_limit: 1000,
            memory_limit: 512,
            cache_enable: false,
            cache_dir_type: 'workspace',
            hook_enabled: true,
            artifact_paths: [],
          }}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="扫描模块名称"
                rules={[
                  { required: true, message: '请输入扫描模块名称' },
                  { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符(-)' },
                ]}
              >
                <Input placeholder="例如：sonar-security-scan" disabled={!!editingScanner} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="scanner_type"
                label="审查分析引擎"
                rules={[{ required: true, message: '请选择审查引擎' }]}
              >
                <Select>
                  <Option value="sonar">SonarQube 静态扫描</Option>
                  <Option value="ai-review">Zadig AI 智能审查</Option>
                  <Option value="trivy">Trivy 安全漏洞扫描</Option>
                  <Option value="standard">通用自定义脚本检测</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="规则描述">
            <Input placeholder="说明该审查模块的检测规范与门禁目标" />
          </Form.Item>

          <Form.Item
            name="repo_name"
            label={
              <Space>
                <span>关联代码仓库</span>
                {repoList.length > 0 && (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                    onClick={() => setManualRepoInput(!manualRepoInput)}
                  >
                    {manualRepoInput ? '切换为下拉选择' : '手动输入'}
                  </Button>
                )}
              </Space>
            }
            rules={[{ required: true, message: '请选择或输入关联代码仓库' }]}
            tooltip="代码审查任务执行时拉取的 Git 代码仓库"
            extra={
              repoList.length === 0
                ? '提示：当前项目暂无扫描代码库，可直接在此手动输入代码仓库名称'
                : undefined
            }
          >
            {repoList.length > 0 && !manualRepoInput ? (
              <Select
                showSearch
                allowClear
                placeholder="请选择代码仓库"
                loading={repoLoading}
                options={(() => {
                  const currentVal = form.getFieldValue('repo_name');
                  const opts = repoList.map((r) => {
                    const fullName = r.repo_namespace ? `${r.repo_namespace}/${r.repo_name}` : r.repo_name;
                    return {
                      label: `${fullName} (${r.source || 'git'})`,
                      value: r.repo_name,
                    };
                  });
                  if (currentVal && !opts.some((o) => o.value === currentVal)) {
                    opts.unshift({
                      label: `${currentVal} (当前配置)`,
                      value: currentVal,
                    });
                  }
                  return opts;
                })()}
              />
            ) : (
              <Input placeholder="请输入代码库名称，例如 zadig 或 koderover/zadig" />
            )}
          </Form.Item>

          <Collapse
            defaultActiveKey={editingScanner ? ['advanced'] : []}
            style={{ marginTop: 16 }}
            items={[
              {
                key: 'advanced',
                label: (
                  <Space>
                    <SettingOutlined style={{ color: '#0066ff' }} />
                    <Text strong>高级设置 (扫描结果导出、集群调度、资源规格、缓存、并发与超时)</Text>
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Form.Item
                      name="artifact_paths"
                      label={
                        <Space>
                          <span>扫描结果导出路径 (Artifact Paths)</span>
                          <Tooltip title="设置一个或者多个文件目录，扫描完成后可在工作流任务详情页进行下载，通常用于扫描报告的导出">
                            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                          </Tooltip>
                        </Space>
                      }
                      extra="输入文件或目录路径后按回车，例如：/workspace/reports 或 /tmp/scan-result.xml"
                    >
                      <Select
                        mode="tags"
                        placeholder="输入路径后按回车添加"
                        tokenSeparators={[',', ' ']}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="cluster_id" label="调度集群">
                          <Select placeholder="默认集群 (Local)" allowClear>
                            <Option value="">默认集群</Option>
                            {clusters.map((c) => (
                              <Option key={c.id} value={c.id}>
                                {c.name} {c.local ? '(本地)' : ''}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="strategy_id" label="调度策略">
                          <Select placeholder="默认策略" allowClear>
                            <Option value="">默认调度策略</Option>
                            {clusters
                              .find((c) => c.id === selectedClusterId)
                              ?.advanced_config?.schedule_strategy?.map((s) => (
                                <Option key={s.strategy_id} value={s.strategy_id}>
                                  {s.strategy_name} {s.default ? '(默认)' : ''}
                                </Option>
                              ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item name="res_req" label="资源规格要求">
                      <Radio.Group>
                        <Radio.Button value="min">极低 (0.5C/256M)</Radio.Button>
                        <Radio.Button value="low">低 (1C/512M)</Radio.Button>
                        <Radio.Button value="medium">中 (2C/1024M)</Radio.Button>
                        <Radio.Button value="high">高 (4C/2048M)</Radio.Button>
                        <Radio.Button value="define">自定义规格</Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {selectedResReq === 'define' && (
                      <Row
                        gutter={16}
                        style={{
                          background: '#fafafa',
                          padding: '12px 16px',
                          borderRadius: 6,
                          marginBottom: 12,
                        }}
                      >
                        <Col span={12}>
                          <Form.Item
                            name="cpu_limit"
                            label="CPU 上限 (mCPU)"
                            rules={[{ required: true, message: '请输入 CPU 上限' }]}
                          >
                            <InputNumber min={100} step={100} style={{ width: '100%' }} placeholder="例如：1000" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="memory_limit"
                            label="内存上限 (MiB)"
                            rules={[{ required: true, message: '请输入内存上限' }]}
                          >
                            <InputNumber min={128} step={128} style={{ width: '100%' }} placeholder="例如：512" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="timeout"
                          label={
                            <Space>
                              <span>任务超时时间 (秒)</span>
                              <Tooltip title="扫描任务在后台执行的最大允许超时时间，超时后任务将被自动终止">
                                <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                              </Tooltip>
                            </Space>
                          }
                          rules={[{ required: true, message: '请输入超时时间' }]}
                        >
                          <InputNumber min={10} max={86400} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="concurrency_limit"
                          label={
                            <Space>
                              <span>任务并发数</span>
                              <Tooltip title="同时执行该扫描任务的最大并发数，1 为严格串行，-1 为不限制并发">
                                <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                              </Tooltip>
                            </Space>
                          }
                        >
                          <InputNumber min={-1} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Card size="small" variant="borderless" style={{ background: '#f9f9f9', borderRadius: 6 }}>
                      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <Text strong>工作空间缓存</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              启用后可加速代码依赖包与历史缓存加载
                            </Text>
                          </Space>
                          <Form.Item name="cache_enable" valuePropName="checked" noStyle>
                            <Switch />
                          </Form.Item>
                        </div>

                        {selectedCacheEnable && (
                          <Row gutter={16} style={{ marginTop: 8 }}>
                            <Col span={12}>
                              <Form.Item name="cache_dir_type" label="缓存目录类型" noStyle>
                                <Radio.Group>
                                  <Radio value="workspace">工作空间目录</Radio>
                                  <Radio value="user_defined">自定义目录</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Col>
                            {selectedCacheDirType === 'user_defined' && (
                              <Col span={12}>
                                <Form.Item
                                  name="cache_user_dir"
                                  label="自定义缓存绝对路径"
                                  rules={[{ required: true, message: '请输入自定义缓存目录' }]}
                                >
                                  <Input placeholder="例如：/root/.sonar/cache" />
                                </Form.Item>
                              </Col>
                            )}
                          </Row>
                        )}
                      </Space>
                    </Card>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                      }}
                    >
                      <Space>
                        <Text strong>Git Webhook 自动触发器</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          允许代码 Push / PR 事件自动触发该扫描流程
                        </Text>
                      </Space>
                      <Form.Item name="hook_enabled" valuePropName="checked" noStyle>
                        <Switch />
                      </Form.Item>
                    </div>

                    <Divider style={{ margin: '12px 0' }} />

                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <Space>
                          <BellOutlined style={{ color: '#0066ff' }} />
                          <Text strong>通知配置 (NotifyCtl)</Text>
                          <Tooltip title="扫描任务执行完成或失败时，通过指定 IM 机器人、个人或 Webhook 通道推送通知">
                            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                          </Tooltip>
                        </Space>
                      </div>

                      <Form.List name="notify_ctls">
                        {(fields, { add, remove }) => (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {fields.map(({ key, name, ...restField }) => (
                              <Card
                                key={key}
                                size="small"
                                variant="borderless"
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                }}
                                styles={{ body: { padding: '12px 16px' } }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                  }}
                                >
                                  <Space>
                                    <Tag color="blue">通知通道 #{name + 1}</Tag>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'enabled']}
                                      valuePropName="checked"
                                      noStyle
                                      initialValue={true}
                                    >
                                      <Switch size="small" checkedChildren="开启" unCheckedChildren="关闭" />
                                    </Form.Item>
                                  </Space>
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(name)}
                                  >
                                    移除
                                  </Button>
                                </div>

                                <Row gutter={16}>
                                  <Col span={8}>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'webhook_type']}
                                      label="通道类型"
                                      rules={[{ required: true, message: '请选择通道类型' }]}
                                      initialValue="dingding"
                                    >
                                      <Select
                                        options={[
                                          { label: '钉钉机器人 (DingTalk)', value: 'dingding' },
                                          { label: '企业微信群机器人 (WeChat)', value: 'wechat' },
                                          { label: '飞书群机器人 (Lark Hook)', value: 'feishu' },
                                          { label: '飞书个人 (Lark Person)', value: 'feishu_person' },
                                          { label: 'Microsoft Teams', value: 'msteams' },
                                          { label: '邮件通知 (Mail)', value: 'mail' },
                                          { label: '通用 Webhook', value: 'webhook' },
                                        ]}
                                      />
                                    </Form.Item>
                                  </Col>

                                  <Col span={16}>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'notify_type']}
                                      label="通知事件"
                                      rules={[{ required: true, message: '请至少选择一个通知事件' }]}
                                      initialValue={['passed', 'failed']}
                                    >
                                      <Select
                                        mode="multiple"
                                        placeholder="选择触发通知的事件"
                                        options={[
                                          { label: '执行成功 (passed)', value: 'passed' },
                                          { label: '执行失败 (failed)', value: 'failed' },
                                          { label: '任务超时 (timeout)', value: 'timeout' },
                                          { label: '任务取消 (cancelled)', value: 'cancelled' },
                                        ]}
                                      />
                                    </Form.Item>
                                  </Col>
                                </Row>

                                {/* 动态通道参数 */}
                                <Form.Item
                                  noStyle
                                  shouldUpdate={(prev, curr) =>
                                    prev?.notify_ctls?.[name]?.webhook_type !==
                                    curr?.notify_ctls?.[name]?.webhook_type
                                  }
                                >
                                  {({ getFieldValue }) => {
                                    const wType = getFieldValue(['notify_ctls', name, 'webhook_type']) || 'dingding';
                                    if (wType === 'dingding') {
                                      return (
                                        <Row gutter={16}>
                                          <Col span={14}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'dingding_notification_config', 'hook_address']}
                                              label="Webhook 机器人地址"
                                              rules={[{ required: true, message: '请输入钉钉 Webhook 地址' }]}
                                            >
                                              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
                                            </Form.Item>
                                          </Col>
                                          <Col span={6}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'dingding_notification_config', 'at_mobiles']}
                                              label="@ 手机号 (可选)"
                                            >
                                              <Select mode="tags" placeholder="手机号回车添加" />
                                            </Form.Item>
                                          </Col>
                                          <Col span={4}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'dingding_notification_config', 'is_at_all']}
                                              valuePropName="checked"
                                              label="@所有人"
                                            >
                                              <Switch size="small" />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      );
                                    } else if (wType === 'wechat') {
                                      return (
                                        <Row gutter={16}>
                                          <Col span={14}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'wechat_notification_config', 'hook_address']}
                                              label="企业微信 Webhook 地址"
                                              rules={[{ required: true, message: '请输入企业微信 Webhook 地址' }]}
                                            >
                                              <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
                                            </Form.Item>
                                          </Col>
                                          <Col span={6}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'wechat_notification_config', 'at_users']}
                                              label="@ 用户 ID (可选)"
                                            >
                                              <Select mode="tags" placeholder="用户 ID 回车添加" />
                                            </Form.Item>
                                          </Col>
                                          <Col span={4}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'wechat_notification_config', 'is_at_all']}
                                              valuePropName="checked"
                                              label="@所有人"
                                            >
                                              <Switch size="small" />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      );
                                    } else if (wType === 'feishu') {
                                      return (
                                        <Row gutter={16}>
                                          <Col span={14}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'lark_hook_notification_config', 'hook_address']}
                                              label="飞书群 Webhook 地址"
                                              rules={[{ required: true, message: '请输入飞书 Webhook 地址' }]}
                                            >
                                              <Input placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
                                            </Form.Item>
                                          </Col>
                                          <Col span={6}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'lark_hook_notification_config', 'at_users']}
                                              label="@ 成员 (可选)"
                                            >
                                              <Select mode="tags" placeholder="open_id 回车添加" />
                                            </Form.Item>
                                          </Col>
                                          <Col span={4}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'lark_hook_notification_config', 'is_at_all']}
                                              valuePropName="checked"
                                              label="@所有人"
                                            >
                                              <Switch size="small" />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      );
                                    } else if (wType === 'feishu_person') {
                                      return (
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'lark_person_notification_config', 'app_id']}
                                          label="飞书应用 App ID"
                                          rules={[{ required: true, message: '请输入飞书应用 App ID' }]}
                                        >
                                          <Input placeholder="cli_xxxxxxxxxxx" />
                                        </Form.Item>
                                      );
                                    } else if (wType === 'msteams') {
                                      return (
                                        <Row gutter={16}>
                                          <Col span={16}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'msteams_notification_config', 'hook_address']}
                                              label="Teams Incoming Webhook"
                                              rules={[{ required: true, message: '请输入 Teams Webhook 地址' }]}
                                            >
                                              <Input placeholder="https://outlook.office.com/webhook/..." />
                                            </Form.Item>
                                          </Col>
                                          <Col span={8}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'msteams_notification_config', 'at_emails']}
                                              label="@ 用户邮箱 (可选)"
                                            >
                                              <Select mode="tags" placeholder="邮箱回车添加" />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      );
                                    } else if (wType === 'mail') {
                                      return (
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'mail_notification_config', 'target_emails']}
                                          label="收件人邮箱"
                                          rules={[{ required: true, message: '请至少输入一个收件人邮箱' }]}
                                        >
                                          <Select mode="tags" placeholder="输入邮箱后回车添加" />
                                        </Form.Item>
                                      );
                                    } else if (wType === 'webhook') {
                                      return (
                                        <Row gutter={16}>
                                          <Col span={14}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'webhook_notification_config', 'address']}
                                              label="回调接口 URL"
                                              rules={[{ required: true, message: '请输入 Webhook URL' }]}
                                            >
                                              <Input placeholder="https://api.example.com/webhook/scan-callback" />
                                            </Form.Item>
                                          </Col>
                                          <Col span={10}>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'webhook_notification_config', 'token']}
                                              label="鉴权 Token (可选)"
                                            >
                                              <Input placeholder="Bearer Token 或签名密钥" />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      );
                                    }
                                    return null;
                                  }}
                                </Form.Item>
                              </Card>
                            ))}

                            <Button
                              type="dashed"
                              onClick={() =>
                                add({
                                  enabled: true,
                                  webhook_type: 'dingding',
                                  notify_type: ['passed', 'failed'],
                                  dingding_notification_config: { hook_address: '', at_mobiles: [], is_at_all: false },
                                })
                              }
                              icon={<PlusOutlined />}
                              style={{ width: '100%' }}
                            >
                              添加通知通道
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* Quality Report Drawer */}
      <Drawer
        title={`质量门禁检测报告: ${selectedScanner?.name || ''}`}
        placement="right"
        size="large"
        open={reportDrawerVisible}
        onClose={() => setReportDrawerVisible(false)}
      >
        {selectedScanner && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Descriptions title="基本信息" column={2} bordered size="small">
              <Descriptions.Item label="引擎类型">
                {selectedScanner.scanner_type}
              </Descriptions.Item>
              <Descriptions.Item label="门禁状态">
                <Tag color="success">达标 (Passed)</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>
                {selectedScanner.update_time
                  ? dayjs.unix(selectedScanner.update_time).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card
              title="核心质量指标"
              variant="borderless"
              styles={{ body: { padding: '16px' } }}
              style={{ background: '#fafafa' }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Bugs (漏洞缺陷)"
                    value={selectedScanner.quality_metrics?.bugs ?? 0}
                    styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Vulnerabilities (安全风险)"
                    value={selectedScanner.quality_metrics?.vulnerabilities ?? 0}
                    styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Code Smells (代码异味)"
                    value={selectedScanner.quality_metrics?.code_smells ?? 0}
                    styles={{ content: { color: '#faad14', fontWeight: 600 } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="测试覆盖率"
                    value={selectedScanner.quality_metrics?.coverage ?? 85}
                    suffix="%"
                    styles={{ content: { color: '#0066ff', fontWeight: 600 } }}
                  />
                </Col>
              </Row>
            </Card>

            <Card
              title={
                <Space>
                  <RobotOutlined style={{ color: '#722ed1' }} />
                  <span>AI 审查智能评估与建议</span>
                </Space>
              }
              variant="borderless"
              styles={{ body: { padding: '16px' } }}
            >
              <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
                {selectedScanner.quality_metrics?.ai_suggestions ||
                  '未检测出严重违规或安全隐患，模块符合企业级上线交付基线。'}
              </Text>
            </Card>
          </div>
        )}
      </Drawer>

      {/* Scanner Detail Drawer: 配置 + 任务记录 */}
      <Drawer
        title={`扫描详情: ${detailScanner?.name || ''}`}
        placement="right"
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailScanner(null);
          if (routeScannerName) {
            navigate(`/v1/projects/detail/${projectName}/scanner`);
          }
        }}
        size="large"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailScanner ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="扫描器类型">
                <Tag color="geekblue">{detailScanner.scanner_type || 'standard'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{detailScanner.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="AI 审查">
                {detailScanner.enable_ai_review ? <Tag color="purple">已启用</Tag> : <Tag color="default">未启用</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="代码仓库">
                {(detailScanner.repos || [])
                  .map((r) => `${r.repo_name || '-'} @ ${r.branch || '-'}`)
                  .join('、') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {detailScanner.update_time
                  ? `${dayjs(detailScanner.update_time * 1000).format('YYYY-MM-DD HH:mm')} · ${detailScanner.update_by || '-'}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 8px' }}>
              <Title level={5} style={{ margin: 0 }}>
                高级设置
              </Title>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailOpen(false);
                  handleOpenEdit(detailScanner);
                }}
              >
                编辑规则
              </Button>
            </div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="扫描结果导出" span={2}>
                {detailScanner.advanced_settings?.artifact_paths && detailScanner.advanced_settings.artifact_paths.length > 0 ? (
                  <Space size={4} wrap>
                    {detailScanner.advanced_settings.artifact_paths.map((p) => (
                      <Tag key={p} color="blue">
                        {p}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">未设置</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="超时时间">
                {detailScanner.advanced_settings?.timeout ? `${detailScanner.advanced_settings.timeout} 秒` : '600 秒'}
              </Descriptions.Item>
              <Descriptions.Item label="并发上限">
                {detailScanner.advanced_settings?.concurrency_limit === -1
                  ? '无限制'
                  : (detailScanner.advanced_settings?.concurrency_limit ?? 1)}
              </Descriptions.Item>
              <Descriptions.Item label="资源规格">
                <Tag color="cyan">{detailScanner.advanced_settings?.res_req || 'low'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="缓存机制">
                {detailScanner.advanced_settings?.cache?.cache_enable ? (
                  <Tag color="success">
                    已启用 ({detailScanner.advanced_settings.cache.cache_dir_type || 'workspace'})
                  </Tag>
                ) : (
                  <Tag color="default">未启用</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="触发器 Hook">
                {detailScanner.advanced_settings?.hook_ctl?.enabled !== false ? (
                  <Tag color="success">已启用</Tag>
                ) : (
                  <Tag color="default">未启用</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="调度集群">
                {detailScanner.advanced_settings?.cluster_id || '默认集群'}
              </Descriptions.Item>
              <Descriptions.Item label="通知配置" span={2}>
                {detailScanner.advanced_settings?.notify_ctls && detailScanner.advanced_settings.notify_ctls.length > 0 ? (
                  <Space wrap size={4}>
                    {detailScanner.advanced_settings.notify_ctls.map((nc, idx) => (
                      <Tag key={idx} color={nc.enabled ? 'blue' : 'default'}>
                        {nc.webhook_type}: {(nc.notify_type || []).join('/')}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">未配置</Text>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ margin: '20px 0 8px' }}>
              扫描任务记录
            </Title>
            <Table
              dataSource={scanTasks}
              rowKey={(r) => String(r.scan_id || r.id || Math.random())}
              rowClassName={(record) => (routeTaskId && String(record.scan_id ?? record.id) === routeTaskId ? 'ant-table-row-selected' : '')}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              size="small"
              columns={[
                {
                  title: '任务 ID',
                  dataIndex: 'scan_id',
                  key: 'scan_id',
                  render: (v) => <Text code>{String(v ?? '-')}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s) => {
                    const map: Record<string, 'success' | 'processing' | 'error' | 'default'> = {
                      passed: 'success',
                      failed: 'error',
                      running: 'processing',
                    };
                    return <Badge status={map[String(s)] || 'default'} text={String(s || '未知')} />;
                  },
                },
                {
                  title: '触发人',
                  dataIndex: 'creator',
                  key: 'creator',
                  render: (c) => <Text type="secondary">{String(c || '-')}</Text>,
                },
                {
                  title: '创建时间',
                  dataIndex: 'create_time',
                  key: 'create_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString() : '-'),
                },
                {
                  title: '耗时',
                  dataIndex: 'duration',
                  key: 'duration',
                  render: (d) => (d ? `${d}s` : '-'),
                },
                {
                  title: '操作',
                  key: 'actions',
                  render: (_, r) => (
                    <Space size={0}>
                      <Button
                        type="link"
                        size="small"
                        icon={<FileSearchOutlined />}
                        onClick={() => detailScanner && openTaskDetail(detailScanner, r)}
                      >
                        详情/日志
                      </Button>
                      {String(r.status) === 'running' && (
                        <Popconfirm
                          title={`确定取消任务 #${String(r.scan_id ?? r.id)}？`}
                          onConfirm={() => detailScanner && handleCancelScanTask(detailScanner.id as string, String(r.scan_id ?? r.id))}
                        >
                          <Button type="link" size="small" danger loading={cancellingTask}>取消</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无扫描任务记录，点击列表中的「立即扫描」触发" />,
              }}
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未获取到扫描配置详情" />
        )}
      </Drawer>

      {/* 扫描任务详情：事件 / SSE 日志 / 产物下载 */}
      <Drawer
        title={`扫描任务: ${taskDrawer?.scannerName || ''} #${taskDrawer?.taskId || ''}`}
        placement="right"
        open={!!taskDrawer}
        onClose={() => setTaskDrawer(null)}
        size="large"
      >
        {taskDrawer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title="执行控制台日志 (SSE)">
              <LogViewer
                height={320}
                streamUrl={`/api/aslan/testing/scanning/${taskDrawer.scannerId}/task/${taskDrawer.taskId}/sse`}
              />
            </Card>

            <Card size="small" title="任务事件">
              {taskEventsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Spin />
                </div>
              ) : taskEvents.length > 0 ? (
                <Timeline
                  items={taskEvents.map((e, i) => ({
                    key: i,
                    color: e.event_type === 'error' ? 'red' : e.event_type === 'warning' ? 'orange' : 'blue',
                    children: (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{e.time}</Text>
                        <div style={{ fontSize: 13 }}>{e.message}</div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务事件" />
              )}
            </Card>

            <Card
              size="small"
              title="扫描产物"
              extra={
                <Button
                  size="small"
                  icon={<FileSearchOutlined />}
                  onClick={handleDownloadArtifact}
                  disabled={artifactLoading || artifactFiles.length === 0}
                >
                  下载 artifact.tar.gz
                </Button>
              }
            >
              {artifactLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Spin />
                </div>
              ) : artifactFiles.length > 0 ? (
                <Space size={4} wrap>
                  {artifactFiles.map((f) => (
                    <Tag key={f} color="geekblue">{f}</Tag>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该任务未产出扫描产物（需配置归档步骤）" />
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ScannersPage;
