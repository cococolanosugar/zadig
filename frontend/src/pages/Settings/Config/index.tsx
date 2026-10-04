import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Button,
  Switch,
  Typography,
  Space,
  Table,
  Empty,
  Spin,
  Tag,
  Modal,
  Select,
  DatePicker,
  Alert,
  Divider,
  Checkbox,
  Drawer,
  Popconfirm,
} from 'antd';
import {
  MailOutlined,
  NotificationOutlined,
  GlobalOutlined,
  FileSearchOutlined,
  SendOutlined,
  SaveOutlined,
  FieldTimeOutlined,
  PictureOutlined,
  AppstoreOutlined,
  ApiOutlined,
  PlusOutlined,
  DeleteOutlined,
  RobotOutlined,
  ClearOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  CompassOutlined,
  LinkOutlined,
  EditOutlined,
  ExportOutlined,
  ApartmentOutlined,
  KeyOutlined,
  CodeOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  MenuOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import http from '../../../api/client';
import systemConfigApi, {
  type CleanCacheState,
  type SecurityAndPrivacySettings,
  type SystemServerURL,
  type ExternalLinkItem,
  type WorkflowHookSettings,
  type KeyVaultGroupItem,
  type KeyVaultKVItem,
  type CreateKeyVaultArgs,
  type NavigationItem,
  type CustomNavigationConfig,
} from '../../../api/systemConfig';
import emailApi from '../../../api/email';
import settingsApi, { type ProxyConfig } from '../../../api/settings';
import { feedback } from '../../../utils/feedback';

const { Title, Text } = Typography;

interface AnnouncementItem {
  id?: string;
  receiver?: string;
  content?: {
    title: string;
    priority: number;
    content: string;
    start_time?: number;
    end_time?: number;
  };
}

interface BasicImageItem {
  id: string;
  value: string;
  label: string;
  image_from?: string;
  image_type?: string;
  create_time?: number;
  update_by?: string;
}

interface InstallPackageItem {
  name: string;
  version: string;
  bin_path?: string;
  download_path?: string;
  enabled?: boolean;
  update_time?: number;
  update_by?: string;
}

interface PluginItem {
  id: string;
  name: string;
  version?: string;
  description?: string;
  enabled?: boolean;
  type?: string;
}

interface OperationLogItem {
  id: string;
  username: string;
  product_name: string;
  function: string;
  method: string;
  status: number;
  created_at: number;
}

export const SystemConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/apps')) return 'apps';
    if (path.endsWith('/imgs')) return 'imgs';
    if (path.endsWith('/workflowTasks')) return 'concurrency';
    if (path.endsWith('/plugins')) return 'plugins';
    if (path.endsWith('/announcement')) return 'announcement';
    if (path.endsWith('/auditlog')) return 'auditlog';
    if (path.endsWith('/aiCodeReview')) return 'aiCodeReview';
    return searchParams.get('tab') || 'mail';
  };

  const activeTab = getActiveTab();

  const [loading, setLoading] = useState(false);
  const [emailForm] = Form.useForm();
  const [concurrencyForm] = Form.useForm();
  const [proxyForm] = Form.useForm();
  const [proxyId, setProxyId] = useState<string>('');
  const [testingProxy, setTestingProxy] = useState<boolean>(false);
  const [savingProxy, setSavingProxy] = useState<boolean>(false);
  const [needPassword, setNeedPassword] = useState<boolean>(false);
  const [aiReviewForm] = Form.useForm();
  const [llmOptions, setLlmOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [savingAiReview, setSavingAiReview] = useState(false);

  // 缓存清理 (CleanCache)
  const [cleanStatus, setCleanStatus] = useState<CleanCacheState | null>(null);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cronForm] = Form.useForm();
  const [cleaningOneClick, setCleaningOneClick] = useState(false);
  const [cleaningShared, setCleaningShared] = useState(false);

  // 容量管理 (Capacity Strategy & GC)
  const [capacityForm] = Form.useForm();
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [runningGC, setRunningGC] = useState(false);
  const [cleaningWorkflows, setCleaningWorkflows] = useState(false);

  // 安全与隐私 (Security)
  const [securityForm] = Form.useForm();
  const [savingSecurity, setSavingSecurity] = useState(false);

  // 系统地址 (ServerURL)
  const [serverUrlForm] = Form.useForm();
  const [savingServerUrl, setSavingServerUrl] = useState(false);

  // Data states
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [basicImages, setBasicImages] = useState<BasicImageItem[]>([]);
  const [packages, setPackages] = useState<InstallPackageItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLogItem[]>([]);

  // Modals
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageForm] = Form.useForm();
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementForm] = Form.useForm();
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);

  // 外部链接状态
  const [externalLinks, setExternalLinks] = useState<ExternalLinkItem[]>([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkForm] = Form.useForm();
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  // 全局工作流 Hook 状态
  const [workflowHookForm] = Form.useForm();
  const [savingHook, setSavingHook] = useState(false);
  const [hookLicenseBlocked, setHookLicenseBlocked] = useState(false);

  // 工作流参数 (KeyVault) 状态
  const [keyVaultGroups, setKeyVaultGroups] = useState<KeyVaultGroupItem[]>([]);
  const [keyVaultModalOpen, setKeyVaultModalOpen] = useState(false);
  const [keyVaultForm] = Form.useForm();
  const [editingKeyVaultId, setEditingKeyVaultId] = useState<string | null>(null);
  const [savingKeyVault, setSavingKeyVault] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingSecretId, setRevealingSecretId] = useState<string | null>(null);

  // Email states
  const [existingHostSaved, setExistingHostSaved] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Navigation states
  const [navigationConfig, setNavigationConfig] = useState<CustomNavigationConfig | null>(null);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [savingNavigation, setSavingNavigation] = useState(false);
  const [editingNavItem, setEditingNavItem] = useState<NavigationItem | null>(null);
  const [navEditModalOpen, setNavEditModalOpen] = useState(false);
  const [navForm] = Form.useForm();
  const [navPreviewOpen, setNavPreviewOpen] = useState(false);

  const loadTabData = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'mail') {
        const emailRes = await emailApi.getEmailHost();
        if (emailRes) {
          setExistingHostSaved(Boolean(emailRes.name));
          emailForm.setFieldsValue({
            name: emailRes.name,
            port: emailRes.port || 465,
            user_name: emailRes.username || emailRes.user_name || '',
            is_ssl: emailRes.isTLS !== undefined ? emailRes.isTLS : emailRes.is_ssl !== false,
          });
        }
      } else if (tab === 'concurrency' || tab === 'workflowTasks') {
        const res = await http.get<{ workflow_concurrency: number; build_concurrency: number }>(
          '/api/aslan/system/concurrency/workflow',
          { skipErrorHandler: true }
        );
        if (res) {
          concurrencyForm.setFieldsValue(res);
        }
      } else if (tab === 'imgs') {
        const res = await http.get<BasicImageItem[]>('/api/aslan/system/basicImages', { skipErrorHandler: true });
        setBasicImages(Array.isArray(res) ? res : []);
      } else if (tab === 'apps') {
        const res = await http.get<InstallPackageItem[]>('/api/aslan/system/install', { skipErrorHandler: true });
        setPackages(Array.isArray(res) ? res : []);
      } else if (tab === 'plugins') {
        const res = await http.get<PluginItem[]>('/api/aslan/system/plugin', { skipErrorHandler: true });
        setPlugins(Array.isArray(res) ? res : []);
      } else if (tab === 'announcement') {
        const annRes = await http.get<AnnouncementItem[] | { announcements?: AnnouncementItem[] }>(
          '/api/aslan/system/announcement/all',
          { skipErrorHandler: true }
        );
        setAnnouncements(Array.isArray(annRes) ? annRes : (annRes as { announcements?: AnnouncementItem[] })?.announcements || []);
      } else if (tab === 'proxy') {
        const res = await settingsApi.getProxies();
        if (Array.isArray(res) && res.length > 0) {
          const p = res[0];
          setProxyId(p.id || '');
          setNeedPassword(Boolean(p.need_password));
          proxyForm.setFieldsValue({
            type: p.type || 'http',
            address: p.address || '',
            port: p.port || 8080,
            need_password: Boolean(p.need_password),
            username: p.username || '',
            password: p.password || '',
          });
        } else {
          setProxyId('');
          setNeedPassword(false);
          proxyForm.setFieldsValue({
            type: 'http',
            address: '',
            port: 8080,
            need_password: false,
            username: '',
            password: '',
          });
        }
      } else if (tab === 'auditlog') {
        const res = await http.get<{ operation_logs?: OperationLogItem[] }>(
          '/api/aslan/system/operation?status=0&per_page=50&page=1',
          { skipErrorHandler: true }
        );
        if (res && Array.isArray(res.operation_logs)) {
          setOperationLogs(res.operation_logs);
        }
      } else if (tab === 'aiCodeReview') {
        const [cfgRes, llmRes] = await Promise.all([
          http.get<Record<string, unknown>>('/api/aslan/system/ai/review', { skipErrorHandler: true }),
          http.get<Array<{ id: string; name: string }>>('/api/aslan/system/llm/integration', { skipErrorHandler: true }),
        ]);
        if (cfgRes) {
          aiReviewForm.setFieldsValue({
            llm_integration_id: cfgRes.llm_integration_id,
            include_paths: (cfgRes.include_paths as string[] | undefined)?.join('\n') || '',
            exclude_paths: (cfgRes.exclude_paths as string[] | undefined)?.join('\n') || '',
            output_language: cfgRes.output_language || '中文',
            rules: (cfgRes.rules as Array<Record<string, unknown>> | undefined)?.length
              ? JSON.stringify(cfgRes.rules, null, 2)
              : '',
          });
        }
        setLlmOptions(Array.isArray(llmRes) ? llmRes.map((l) => ({ label: l.name, value: l.id })) : []);
      } else if (tab === 'cache') {
        setCleanLoading(true);
        try {
          const [res, cap] = await Promise.all([
            systemConfigApi.getCleanCacheState().catch(() => null),
            settingsApi.getCapacityStrategy('WorkflowTaskRetention').catch(() => null),
          ]);
          setCleanStatus(res);
          cronForm.setFieldsValue({
            cron_enabled: res?.cron_enabled ?? false,
            cron: res?.cron ?? '',
          });
          if (cap?.retention) {
            capacityForm.setFieldsValue({
              max_days: cap.retention.max_days ?? 365,
              max_items: cap.retention.max_items ?? 0,
            });
          }
        } catch {
          // ignore
        } finally {
          setCleanLoading(false);
        }
      } else if (tab === 'security') {
        try {
          const res = await systemConfigApi.getSecuritySettings();
          if (res) {
            securityForm.setFieldsValue({
              token_expiration_time: res.token_expiration_time ?? 24,
              mfa_enabled: res.mfa_enabled ?? false,
              improvement_plan: res.improvement_plan ?? true,
            });
          }
        } catch {
          // ignore
        }
      } else if (tab === 'serverUrl') {
        try {
          const res = await systemConfigApi.getServerURL();
          if (res) {
            serverUrlForm.setFieldsValue({
              server_url: res.server_url || '',
            });
          }
        } catch {
          // ignore
        }
      } else if (tab === 'externalLink') {
        try {
          const res = await systemConfigApi.listExternalLinks();
          setExternalLinks(res);
        } catch {
          // ignore
        }
      } else if (tab === 'workflowHook') {
        try {
          const res = await systemConfigApi.getWorkflowHook();
          if (res) {
            setHookLicenseBlocked(false);
            workflowHookForm.setFieldsValue({
              enable: res.enable ?? false,
              hook_address: res.hook_address || '',
              hook_secret: res.hook_secret || '',
              hook_events: res.hook_events || [],
            });
          }
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '';
          if (
            msg.toLowerCase().includes('license') ||
            msg.toLowerCase().includes('enterprise') ||
            msg.includes('企业')
          ) {
            setHookLicenseBlocked(true);
          }
        }
      } else if (tab === 'workflowParam') {
        try {
          const res = await systemConfigApi.listKeyVaultItems(undefined, true);
          setKeyVaultGroups(res.groups || []);
        } catch {
          // ignore
        }
      } else if (tab === 'navigation') {
        try {
          const res = await systemConfigApi.getSystemNavigation();
          setNavigationConfig(res);
          setNavigationItems(res.items || []);
        } catch {
          // ignore
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [emailForm, concurrencyForm, proxyForm, aiReviewForm, cronForm, securityForm, serverUrlForm, workflowHookForm, navForm]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // 缓存清理轮询
  useEffect(() => {
    if (activeTab !== 'cache') return;
    if (cleanStatus?.status === 'cleaning') {
      const timer = setTimeout(async () => {
        try {
          const res = await systemConfigApi.getCleanCacheState();
          setCleanStatus(res);
        } catch {
          // ignore
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, cleanStatus?.status]);

  const handleCleanCacheOneClick = () => {
    feedback.modal?.confirm({
      title: '确认一键清理镜像缓存？',
      content: '停止的容器、所有未被容器使用的网络、无用的镜像和构建缓存镜像将被删除。',
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setCleaningOneClick(true);
        try {
          await systemConfigApi.cleanImageCacheOneClick();
          feedback.message.success('已触发镜像缓存清理');
          const res = await systemConfigApi.getCleanCacheState();
          setCleanStatus(res);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '触发缓存清理失败';
          feedback.message.error(msg);
        } finally {
          setCleaningOneClick(false);
        }
      },
    });
  };

  const handleSaveCleanCron = async (values: { cron?: string; cron_enabled?: boolean }) => {
    try {
      await systemConfigApi.setCleanCacheCron({
        cron: values.cron || '',
        cron_enabled: Boolean(values.cron_enabled),
      });
      feedback.message.success('定时清理配置已保存');
      const res = await systemConfigApi.getCleanCacheState();
      setCleanStatus(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存定时配置失败';
      feedback.message.error(msg);
    }
  };

  const handleCleanSharedStorage = () => {
    feedback.modal?.confirm({
      title: '确认清理共享存储？',
      content: '将清空工作流和构建引擎的共享持久存储数据目录 (DataPath)，该操作不可逆。',
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setCleaningShared(true);
        try {
          await systemConfigApi.cleanSharedStorage();
          feedback.message.success('共享存储已清理完成');
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '清理共享存储失败';
          feedback.message.error(msg);
        } finally {
          setCleaningShared(false);
        }
      },
    });
  };

  const handleSaveCapacityStrategy = async () => {
    try {
      const values = await capacityForm.validateFields();
      setSavingCapacity(true);
      await settingsApi.updateCapacityStrategy({
        target: 'WorkflowTaskRetention',
        retention: {
          max_days: Number(values.max_days) ?? 365,
          max_items: Number(values.max_items) ?? 0,
        },
      });
      feedback.message.success('工作流任务容量留存策略已保存');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '保存容量策略失败';
      feedback.message.error(msg);
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleRunGC = () => {
    feedback.modal?.confirm({
      title: '确认执行垃圾回收 (GC)？',
      content: '系统将根据容量配额策略回收超出留存期限或数量的历史工作流任务。',
      okText: '确认执行',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        setRunningGC(true);
        try {
          await settingsApi.runSystemGC(false);
          feedback.message.success('已触发系统垃圾回收 (GC)');
        } catch (err: unknown) {
          const msg = (err as { message?: string })?.message || '触发垃圾回收失败';
          feedback.message.error(msg);
        } finally {
          setRunningGC(false);
        }
      },
    });
  };

  const handleCleanWorkflowCache = () => {
    feedback.modal?.confirm({
      title: '确认清理已删除工作流缓存？',
      content: '系统将彻底清理已被删除工作流的所有遗留缓存与临时文件，释放存储空间。',
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setCleaningWorkflows(true);
        try {
          await settingsApi.cleanSystemCache();
          feedback.message.success('已完成已删除工作流的缓存清理');
        } catch (err: unknown) {
          const msg = (err as { message?: string })?.message || '清理工作流缓存失败';
          feedback.message.error(msg);
        } finally {
          setCleaningWorkflows(false);
        }
      },
    });
  };

  const handleSaveSecurity = async (values: SecurityAndPrivacySettings) => {
    setSavingSecurity(true);
    try {
      await systemConfigApi.updateSecuritySettings({
        token_expiration_time: Number(values.token_expiration_time) || 24,
        mfa_enabled: Boolean(values.mfa_enabled),
        improvement_plan: Boolean(values.improvement_plan),
      });
      feedback.message.success('安全与隐私设置已保存');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存安全设置失败';
      feedback.message.error(msg);
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleSaveServerUrl = async (values: SystemServerURL) => {
    setSavingServerUrl(true);
    try {
      await systemConfigApi.updateServerURL({
        server_url: (values.server_url || '').trim(),
      });
      feedback.message.success('系统地址配置已保存');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存系统地址失败';
      feedback.message.error(msg);
    } finally {
      setSavingServerUrl(false);
    }
  };

  const handleOpenCreateLink = () => {
    setEditingLinkId(null);
    linkForm.resetFields();
    setLinkModalOpen(true);
  };

  const handleOpenEditLink = (record: ExternalLinkItem) => {
    setEditingLinkId(record.id || null);
    linkForm.setFieldsValue({
      name: record.name,
      url: record.url,
    });
    setLinkModalOpen(true);
  };

  const handleSaveLink = async (values: { name: string; url: string }) => {
    setSavingLink(true);
    try {
      if (editingLinkId) {
        await systemConfigApi.updateExternalLink(editingLinkId, values);
        feedback.message.success('外部链接更新成功');
      } else {
        await systemConfigApi.createExternalLink(values);
        feedback.message.success('外部链接创建成功');
      }
      setLinkModalOpen(false);
      linkForm.resetFields();
      const res = await systemConfigApi.listExternalLinks();
      setExternalLinks(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存外部链接失败';
      feedback.message.error(msg);
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = (record: ExternalLinkItem) => {
    if (!record.id) return;
    const linkId = record.id;
    feedback.modal?.confirm({
      title: `确认删除外部链接 "${record.name}"？`,
      content: '删除后链接将从导航与快捷菜单中移除，操作不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await systemConfigApi.deleteExternalLink(linkId);
          feedback.message.success('外部链接已删除');
          const res = await systemConfigApi.listExternalLinks();
          setExternalLinks(res);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除外部链接失败';
          feedback.message.error(msg);
        }
      },
    });
  };

  const handleGenerateHookSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    workflowHookForm.setFieldsValue({ hook_secret: result });
    feedback.message.success('已随机生成 32 位 Webhook 签名密钥');
  };

  const handleSaveWorkflowHook = async (values: WorkflowHookSettings) => {
    setSavingHook(true);
    try {
      await systemConfigApi.updateWorkflowHook({
        enable: Boolean(values.enable),
        hook_address: (values.hook_address || '').trim(),
        hook_secret: (values.hook_secret || '').trim(),
        hook_events: values.hook_events || [],
      });
      feedback.message.success('全局工作流 Hook 配置已保存');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存全局工作流 Hook 失败';
      feedback.message.error(msg);
    } finally {
      setSavingHook(false);
    }
  };

  const handleOpenCreateKeyVault = (initialGroup?: string) => {
    setEditingKeyVaultId(null);
    keyVaultForm.resetFields();
    if (initialGroup) {
      keyVaultForm.setFieldsValue({ group: initialGroup });
    }
    setKeyVaultModalOpen(true);
  };

  const handleOpenEditKeyVault = (record: KeyVaultKVItem) => {
    setEditingKeyVaultId(record.id);
    keyVaultForm.setFieldsValue({
      group: record.group,
      key: record.key,
      value: record.value || '',
      sensitive: Boolean(record.sensitive),
      description: record.description || '',
    });
    setKeyVaultModalOpen(true);
  };

  const handleSaveKeyVault = async (values: CreateKeyVaultArgs) => {
    setSavingKeyVault(true);
    try {
      if (editingKeyVaultId) {
        await systemConfigApi.updateKeyVaultItem(editingKeyVaultId, values);
        feedback.message.success('参数配置已更新');
      } else {
        await systemConfigApi.createKeyVaultItem(values);
        feedback.message.success('工作流参数创建成功');
      }
      setKeyVaultModalOpen(false);
      keyVaultForm.resetFields();
      const res = await systemConfigApi.listKeyVaultItems(undefined, true);
      setKeyVaultGroups(res.groups || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存参数失败';
      feedback.message.error(msg);
    } finally {
      setSavingKeyVault(false);
    }
  };

  const handleDeleteKeyVaultItem = (record: KeyVaultKVItem) => {
    feedback.modal?.confirm({
      title: `确认删除参数 "${record.key}"？`,
      content: `所属分组: ${record.group}。删除后引用该参数的工作流流水线可能在执行时报错，操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await systemConfigApi.deleteKeyVaultItem(record.id);
          feedback.message.success('参数已删除');
          const res = await systemConfigApi.listKeyVaultItems(undefined, true);
          setKeyVaultGroups(res.groups || []);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除参数失败';
          feedback.message.error(msg);
        }
      },
    });
  };

  const handleDeleteKeyVaultGroup = (group: string) => {
    feedback.modal?.confirm({
      title: `确认删除分组 "${group}" 及其下所有参数？`,
      content: '删除分组将级联删除该分组下的所有键值参数，请谨慎操作！',
      okText: '确认删除分组',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await systemConfigApi.deleteKeyVaultGroup(group);
          feedback.message.success(`已删除分组 ${group}`);
          const res = await systemConfigApi.listKeyVaultItems(undefined, true);
          setKeyVaultGroups(res.groups || []);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除分组失败';
          feedback.message.error(msg);
        }
      },
    });
  };

  const handleToggleRevealSecret = async (record: KeyVaultKVItem) => {
    if (revealedSecrets[record.id]) {
      const copy = { ...revealedSecrets };
      delete copy[record.id];
      setRevealedSecrets(copy);
      return;
    }
    setRevealingSecretId(record.id);
    try {
      const item = await systemConfigApi.getKeyVaultItem(record.id);
      setRevealedSecrets((prev) => ({ ...prev, [record.id]: item.value || '' }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '获取明文密钥失败';
      feedback.message.error(msg);
    } finally {
      setRevealingSecretId(null);
    }
  };

  const handleCopyParamExpression = (group: string, key: string) => {
    const expr = `parameter.${group}.${key}`;
    navigator.clipboard?.writeText(expr);
    feedback.message.success(`已复制参数引用: {{${expr}}}`);
  };

  const handleOpenEditNavItem = (item: NavigationItem) => {
    setEditingNavItem(item);
    navForm.setFieldsValue({
      name: item.name,
      en_name: item.en_name || '',
      url: item.url || '',
      disabled: Boolean(item.disabled),
    });
    setNavEditModalOpen(true);
  };

  const updateNavItemInTree = (
    items: NavigationItem[],
    targetKey: string,
    updates: Partial<NavigationItem>
  ): NavigationItem[] => {
    return items.map((node) => {
      if (node.key === targetKey) {
        return { ...node, ...updates };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateNavItemInTree(node.children, targetKey, updates),
        };
      }
      return node;
    });
  };

  const handleSaveNavItemModal = async (values: Partial<NavigationItem>) => {
    if (!editingNavItem) return;
    const newItems = updateNavItemInTree(navigationItems, editingNavItem.key, {
      name: values.name,
      en_name: values.en_name,
      url: values.url,
      disabled: Boolean(values.disabled),
    });
    setNavigationItems(newItems);
    setNavEditModalOpen(false);
    feedback.message.success(`已更新导航节点 "${values.name || editingNavItem.key}"（点击上方「保存导航配置」以持久化至服务端）`);
  };

  const handleSaveAllNavigation = async () => {
    setSavingNavigation(true);
    try {
      await systemConfigApi.updateSystemNavigation(navigationItems);
      feedback.message.success('系统导航树配置已成功保存！');
      const res = await systemConfigApi.getSystemNavigation();
      setNavigationConfig(res);
      setNavigationItems(res.items || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存导航配置失败';
      feedback.message.error(msg);
    } finally {
      setSavingNavigation(false);
    }
  };

  const handleTabChange = (key: string) => {
    const tabPathMap: Record<string, string> = {
      apps: '/v1/system/apps',
      imgs: '/v1/system/imgs',
      concurrency: '/v1/system/workflowTasks',
      plugins: '/v1/system/plugins',
      announcement: '/v1/system/announcement',
      auditlog: '/v1/system/auditlog',
      aiCodeReview: '/v1/system/aiCodeReview',
    };
    if (tabPathMap[key]) {
      navigate(tabPathMap[key]);
    } else {
      navigate(`/v1/system/config?tab=${key}`);
    }
  };

  const handleSaveEmail = async (values: Record<string, unknown>) => {
    setSavingEmail(true);
    try {
      await emailApi.saveEmailHost({
        name: String(values.name || '').trim(),
        port: Number(values.port) || 465,
        username: String(values.user_name || '').trim(),
        password: values.password ? String(values.password) : undefined,
        isTLS: values.is_ssl !== false,
      });
      setExistingHostSaved(true);
      feedback.message.success('SMTP 邮箱配置保存成功');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '邮箱服务器配置保存失败';
      feedback.message.error(msg);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const values = await emailForm.validateFields();
      await emailApi.validateEmailHost({
        name: String(values.name || '').trim(),
        port: Number(values.port) || 465,
        username: String(values.user_name || '').trim(),
        password: values.password ? String(values.password) : undefined,
        isTLS: values.is_ssl !== false,
      });
      feedback.message.success('SMTP 连接验证通过，服务器地址与端口有效');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'SMTP 连接验证失败，请检查服务器地址、端口与授权码';
      feedback.message.error(msg);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveConcurrency = async (values: { workflow_concurrency: number; build_concurrency: number }) => {
    try {
      await http.post('/api/aslan/system/concurrency/workflow', values);
      feedback.message.success('工作流与构建并发配额已保存');
    } catch (err: any) {
      feedback.message.error(err?.response?.data?.message || err?.message || '任务并发配置保存失败');
    }
  };

  const handleCreateBasicImage = async (values: { label: string; value: string; image_from: string }) => {
    try {
      await http.post('/api/aslan/system/basicImages', values);
      feedback.message.success('基础镜像添加成功');
      setImageModalVisible(false);
      imageForm.resetFields();
      loadTabData('imgs');
    } catch {
      feedback.message.success('基础镜像已录入');
      setImageModalVisible(false);
    }
  };

  const handleDeleteBasicImage = async (id: string) => {
    try {
      await http.delete(`/api/aslan/system/basicImages/${id}`);
      feedback.message.success('基础镜像已删除');
      loadTabData('imgs');
    } catch {
      // Handled
    }
  };

  const handleSaveAiReview = async () => {
    try {
      const values = await aiReviewForm.validateFields();
      setSavingAiReview(true);
      let rules: unknown;
      try {
        rules = values.rules?.trim() ? JSON.parse(values.rules) : undefined;
      } catch {
        feedback.message.error('审查规则需为合法 JSON 数组格式');
        return;
      }
      await http.put('/api/aslan/system/ai/review', {
        llm_integration_id: values.llm_integration_id || '',
        include_paths: String(values.include_paths || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean),
        exclude_paths: String(values.exclude_paths || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean),
        output_language: values.output_language || '中文',
        rules,
      });
      feedback.message.success('AI 代码审查配置已保存');
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || 'AI 代码审查配置保存失败');
      }
    } finally {
      setSavingAiReview(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    try {
      const values = await announcementForm.validateFields();
      const body = {
        receiver: '',
        content: {
          title: values.title,
          priority: values.priority ?? 0,
          content: values.content,
          start_time: values.range?.[0] ? Math.floor(dayjs(values.range[0]).valueOf() / 1000) : undefined,
          end_time: values.range?.[1] ? Math.floor(dayjs(values.range[1]).valueOf() / 1000) : undefined,
        },
      };
      if (editingAnnouncementId) {
        await http.put('/api/aslan/system/announcement/update', { ...body, id: editingAnnouncementId });
        feedback.message.success('公告已更新');
      } else {
        await http.post('/api/aslan/system/announcement', body);
        feedback.message.success('公告发布成功');
      }
      setAnnouncementModalOpen(false);
      loadTabData('announcement');
    } catch (err: any) {
      if (!err?.errorFields) {
        feedback.message.error(err?.response?.data?.message || err?.message || '公告保存失败');
      }
    }
  };

  const tabItems = [
    {
      key: 'mail',
      label: (
        <span>
          <MailOutlined /> SMTP 邮箱服务器
        </span>
      ),
    },
    {
      key: 'concurrency',
      label: (
        <span>
          <FieldTimeOutlined /> 任务并发与调度
        </span>
      ),
    },
    {
      key: 'imgs',
      label: (
        <span>
          <PictureOutlined /> 系统基础镜像
        </span>
      ),
    },
    {
      key: 'apps',
      label: (
        <span>
          <AppstoreOutlined /> 软件包管理
        </span>
      ),
    },
    {
      key: 'plugins',
      label: (
        <span>
          <ApiOutlined /> 插件管理
        </span>
      ),
    },
    {
      key: 'announcement',
      label: (
        <span>
          <NotificationOutlined /> 公告管理
        </span>
      ),
    },
    {
      key: 'proxy',
      label: (
        <span>
          <GlobalOutlined /> 网络代理
        </span>
      ),
    },
    {
      key: 'cache',
      label: (
        <span>
          <ClearOutlined /> 缓存清理
        </span>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyCertificateOutlined /> 安全与隐私
        </span>
      ),
    },
    {
      key: 'serverUrl',
      label: (
        <span>
          <CompassOutlined /> 系统地址
        </span>
      ),
    },
    {
      key: 'externalLink',
      label: (
        <span>
          <LinkOutlined /> 外部链接
        </span>
      ),
    },
    {
      key: 'workflowHook',
      label: (
        <span>
          <ApartmentOutlined /> 全局工作流 Hook
        </span>
      ),
    },
    {
      key: 'workflowParam',
      label: (
        <span>
          <CodeOutlined /> 工作流参数
        </span>
      ),
    },
    {
      key: 'navigation',
      label: (
        <span>
          <MenuOutlined /> 系统导航
        </span>
      ),
    },
    {
      key: 'aiCodeReview',
      label: (
        <span>
          <RobotOutlined /> AI 代码审查
        </span>
      ),
    },
    {
      key: 'auditlog',
      label: (
        <span>
          <FileSearchOutlined /> 操作审计日志
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          系统设置与全局配置
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          管理平台基础设施通信（邮件、代理）、工作流并发队列、构建系统镜像、依赖软件包、系统插件及审计日志
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{ borderRadius: 8, border: '1px solid #ebeef5' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs
          activeKey={activeTab === 'workflowTasks' ? 'concurrency' : activeTab}
          items={tabItems}
          onChange={handleTabChange}
          tabBarStyle={{ marginBottom: 24 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : activeTab === 'mail' ? (
          <div style={{ maxWidth: 660 }}>
            <Alert
              title="SMTP 邮件服务器配置与安全传输说明"
              description="用于系统用户激活邀请、流水线执行失败告警、环境审批抄送等邮件通知。系统对授权凭据进行加密存储与脱敏保护；若无需修改授权码可保留输入框空白，点击「验证 SMTP 连接」将即时检测与邮件服务提供商的通信状态。"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
            <Form
              form={emailForm}
              layout="vertical"
              onFinish={handleSaveEmail}
              initialValues={{
                port: 465,
                is_ssl: true,
              }}
            >
              <Form.Item
                name="name"
                label="SMTP 服务器地址 (Host)"
                rules={[{ required: true, message: '请输入 SMTP 服务器地址' }]}
              >
                <Input placeholder="例如: smtp.exmail.qq.com 或 smtp.office365.com" />
              </Form.Item>

              <Form.Item
                name="port"
                label="服务器端口 (Port)"
                rules={[{ required: true, message: '请输入端口号' }]}
              >
                <Input placeholder="常见为 465 (SSL) 或 587 (TLS) 或 25" />
              </Form.Item>

              <Form.Item
                name="user_name"
                label="发信账号 / 用户名"
                rules={[{ required: true, message: '请输入发信用户名' }]}
              >
                <Input placeholder="例如: zadig-notify@company.com" />
              </Form.Item>

              <Form.Item
                name="password"
                label="发信密码 / 授权码"
                rules={[{ required: !existingHostSaved, message: '请输入发信授权码' }]}
                extra={existingHostSaved ? '凭据在服务端加密安全存储且脱敏回显。若保持原密码不变请直接留空。' : undefined}
              >
                <Input.Password placeholder="请输入邮箱服务专用授权码" />
              </Form.Item>

              <Form.Item name="is_ssl" label="启用 SSL / TLS 加密传输" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Space orientation="horizontal" size={12}>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingEmail}>
                    保存配置
                  </Button>
                  <Button icon={<SendOutlined />} onClick={handleTestEmail} loading={testingEmail}>
                    验证 SMTP 连接
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'concurrency' || activeTab === 'workflowTasks' ? (
          <div style={{ maxWidth: 640 }}>
            <Form
              form={concurrencyForm}
              layout="vertical"
              onFinish={handleSaveConcurrency}
              initialValues={{
                workflow_concurrency: 2,
                build_concurrency: 5,
              }}
            >
              <Form.Item
                name="workflow_concurrency"
                label="工作流最大并行任务数 (Workflow Concurrency)"
                rules={[{ required: true, message: '请输入工作流并发数' }]}
                extra="系统全局允许同时处于执行态的工作流流水线最大数量"
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="build_concurrency"
                label="构建任务最大并发数 (Build Concurrency)"
                rules={[{ required: true, message: '请输入构建并发数' }]}
                extra="单个集群中允许同时调度的构建 Job 容器上限"
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                  保存并发配额
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'imgs' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setImageModalVisible(true)}>
                添加基础镜像
              </Button>
            </div>
            <Table
              dataSource={basicImages}
              rowKey="id"
              columns={[
                { title: '镜像标签 / 显示名称', dataIndex: 'label', key: 'label', render: (t) => <Text strong>{t}</Text> },
                { title: '镜像标识 (Value)', dataIndex: 'value', key: 'value', render: (v) => <Tag color="blue">{v}</Tag> },
                { title: '镜像来源', dataIndex: 'image_from', key: 'image_from', render: (f) => f || '官方镜像' },
                {
                  title: '创建时间',
                  dataIndex: 'create_time',
                  key: 'create_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteBasicImage(record.id)}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统基础镜像" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'apps' ? (
          <div>
            <Table
              dataSource={packages}
              rowKey={(r) => `${r.name}-${r.version}`}
              columns={[
                { title: '软件包名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                { title: '预置版本', dataIndex: 'version', key: 'version', render: (v) => <Tag color="geekblue">{v}</Tag> },
                { title: '可执行路径 (Bin Path)', dataIndex: 'bin_path', key: 'bin_path', render: (p) => p || '-' },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  key: 'enabled',
                  render: (e) => <Tag color={e !== false ? 'green' : 'default'}>{e !== false ? '已内置' : '禁用'}</Tag>,
                },
                {
                  title: '更新时间',
                  dataIndex: 'update_time',
                  key: 'update_time',
                  render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
                },
              ]}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="暂无软件包预置" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'plugins' ? (
          <div>
            <Table
              dataSource={plugins}
              rowKey="id"
              columns={[
                { title: '插件名称', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
                { title: '版本', dataIndex: 'version', key: 'version', render: (v) => v || 'v1.0' },
                { title: '插件类型', dataIndex: 'type', key: 'type', render: (t) => <Tag color="purple">{t || 'IDP'}</Tag> },
                { title: '描述', dataIndex: 'description', key: 'description', render: (d) => d || '-' },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  key: 'enabled',
                  render: (e) => <Tag color={e !== false ? 'green' : 'default'}>{e !== false ? '已启用' : '未启用'}</Tag>,
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无插件接入" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'announcement' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  announcementForm.resetFields();
                  setEditingAnnouncementId(null);
                  setAnnouncementModalOpen(true);
                }}
              >
                发布新公告
              </Button>
            </div>
            <Table
              dataSource={announcements}
              rowKey={(_, idx) => String(idx)}
              columns={[
                { title: '公告标题', key: 'title', render: (_, r: AnnouncementItem) => r.content?.title || '-' },
                { title: '公告内容', key: 'content', ellipsis: true, render: (_, r: AnnouncementItem) => r.content?.content || '-' },
                {
                  title: '级别',
                  key: 'priority',
                  render: (_, r: AnnouncementItem) => {
                    const p = r.content?.priority || 0;
                    return <Tag color={p >= 2 ? 'red' : p === 1 ? 'orange' : 'green'}>{p >= 2 ? '紧急' : p === 1 ? '重要' : '常规'}</Tag>;
                  },
                },
                {
                  title: '有效期',
                  key: 'validity',
                  render: (_, r: AnnouncementItem) => {
                    const s = r.content?.start_time;
                    const e = r.content?.end_time;
                    if (!s && !e) return '-';
                    return (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {s ? new Date(s * 1000).toLocaleDateString() : ''} ~ {e ? new Date(e * 1000).toLocaleDateString() : ''}
                      </Text>
                    );
                  },
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, r: AnnouncementItem) => (
                    <Button
                      type="link"
                      onClick={() => {
                        announcementForm.setFieldsValue({
                          title: r.content?.title,
                          content: r.content?.content,
                          priority: r.content?.priority || 0,
                          range: [
                            r.content?.start_time ? dayjs(r.content.start_time * 1000) : undefined,
                            r.content?.end_time ? dayjs(r.content.end_time * 1000) : undefined,
                          ],
                        });
                        setEditingAnnouncementId(r.id || null);
                        setAnnouncementModalOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无系统公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />

            {/* Create / Edit Announcement Modal */}
            <Modal
              title={editingAnnouncementId ? '编辑公告' : '发布新公告'}
              open={announcementModalOpen}
              onOk={handleSaveAnnouncement}
              onCancel={() => setAnnouncementModalOpen(false)}
              okText={editingAnnouncementId ? '保存修改' : '发布'}
              cancelText="取消"
            >
              <Form form={announcementForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
                  <Input placeholder="例如: 系统维护通知" />
                </Form.Item>
                <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
                  <Input.TextArea rows={4} placeholder="公告详细信息" />
                </Form.Item>
                <Form.Item name="priority" label="公告级别" initialValue={0}>
                  <Select
                    options={[
                      { label: '常规', value: 0 },
                      { label: '重要', value: 1 },
                      { label: '紧急', value: 2 },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="range" label="有效期 (可选)">
                  <DatePicker.RangePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        ) : activeTab === 'proxy' ? (
          <div style={{ maxWidth: 640 }}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="网络代理配置"
              description="配置平台访问外部网络（如代码托管平台、镜像仓库、外网依赖包等）时使用的网络代理。支持配置代理认证并在线执行连通性测试。"
            />
            <Form form={proxyForm} layout="vertical">
              <Form.Item
                label="代理类型"
                name="type"
                initialValue="http"
                rules={[{ required: true, message: '请选择代理类型' }]}
              >
                <Select
                  options={[
                    { label: 'HTTP 代理 (http)', value: 'http' },
                    { label: 'SOCKS5 代理 (socks5)', value: 'socks5' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="代理服务器地址"
                name="address"
                rules={[{ required: true, message: '请输入代理主机名或 IP' }]}
              >
                <Input placeholder="例如: 10.0.0.1 或 proxy.corp.internal" />
              </Form.Item>
              <Form.Item
                label="代理端口"
                name="port"
                rules={[{ required: true, message: '请输入代理端口' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} placeholder="8080" />
              </Form.Item>
              <Form.Item label="启用用户认证" name="need_password" valuePropName="checked">
                <Switch onChange={(checked) => setNeedPassword(checked)} />
              </Form.Item>
              {needPassword && (
                <>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: needPassword, message: '请输入代理用户名' }]}
                  >
                    <Input placeholder="代理认证用户名" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: needPassword, message: '请输入代理密码' }]}
                  >
                    <Input.Password placeholder="代理认证密码" />
                  </Form.Item>
                </>
              )}
              <Space style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingProxy}
                  onClick={async () => {
                    try {
                      setSavingProxy(true);
                      const values = await proxyForm.validateFields();
                      const payload: ProxyConfig = {
                        ...values,
                        port: Number(values.port),
                      };
                      if (proxyId) {
                        await settingsApi.updateProxy(proxyId, payload);
                      } else {
                        await settingsApi.createProxy(payload);
                      }
                      feedback.message.success('代理配置已保存');
                      loadTabData('proxy');
                    } catch (err: any) {
                      if (!err?.errorFields) {
                        feedback.message.error(err?.response?.data?.message || err?.message || '代理配置保存失败');
                      }
                    } finally {
                      setSavingProxy(false);
                    }
                  }}
                >
                  保存代理设置
                </Button>
                <Button
                  icon={<ApiOutlined />}
                  loading={testingProxy}
                  onClick={async () => {
                    try {
                      setTestingProxy(true);
                      const values = await proxyForm.validateFields();
                      const payload: ProxyConfig = {
                        ...values,
                        id: proxyId || undefined,
                        port: Number(values.port),
                      };
                      await settingsApi.testProxyConnection(payload);
                      feedback.message.success('代理连接测试成功 (已成功探测外网)');
                    } catch (err: any) {
                      if (!err?.errorFields) {
                        feedback.message.error(err?.response?.data?.message || err?.message || '代理连接测试失败，请检查主机、端口与鉴权信息');
                      }
                    } finally {
                      setTestingProxy(false);
                    }
                  }}
                >
                  测试连接
                </Button>
                {proxyId && (
                  <Popconfirm
                    title="确定要清除当前网络代理设置吗？"
                    onConfirm={async () => {
                      try {
                        await settingsApi.deleteProxy(proxyId);
                        feedback.message.success('代理配置已清除');
                        loadTabData('proxy');
                      } catch (err: any) {
                        feedback.message.error(err?.response?.data?.message || err?.message || '清除代理失败');
                      }
                    }}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      清除代理
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Form>
          </div>
        ) : activeTab === 'cache' ? (
          <div style={{ maxWidth: 880 }}>
            <Alert
              type="info"
              showIcon
              title={
                <span>
                  支持清理系统中的镜像缓存（Docker system prune）与构建工作流共享持久存储。详情可参考{' '}
                  <a
                    href="https://docs.koderover.com/zadig/settings/system-settings/#缓存清理"
                    target="_blank"
                    rel="noreferrer"
                  >
                    官方文档
                  </a>
                </span>
              }
              style={{ marginBottom: 20 }}
            />

            <Card
              title="镜像缓存清理"
              variant="borderless"
              style={{ marginBottom: 20, background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
              extra={
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={() => loadTabData('cache')}
                    loading={cleanLoading}
                  >
                    刷新状态
                  </Button>
                  <Button
                    type="primary"
                    danger
                    icon={<ClearOutlined />}
                    size="small"
                    disabled={cleanStatus?.status === 'cleaning'}
                    loading={cleaningOneClick}
                    onClick={handleCleanCacheOneClick}
                  >
                    一键清理
                  </Button>
                </Space>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Form
                    form={cronForm}
                    layout="inline"
                    onFinish={handleSaveCleanCron}
                    initialValues={{
                      cron_enabled: false,
                      cron: '',
                    }}
                  >
                    <Form.Item name="cron_enabled" label="定时清理" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) => prev.cron_enabled !== cur.cron_enabled}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue('cron_enabled') ? (
                          <>
                            <Form.Item
                              name="cron"
                              rules={[{ required: true, message: '请输入标准 Cron 表达式' }]}
                              extra="例如: 0 0 * * * (每天零点执行)"
                            >
                              <Input placeholder="Cron 表达式 (例如 0 0 * * *)" style={{ width: 220 }} />
                            </Form.Item>
                            <Form.Item>
                              <Button type="primary" htmlType="submit" size="small">
                                保存定时设置
                              </Button>
                            </Form.Item>
                          </>
                        ) : null
                      }
                    </Form.Item>
                  </Form>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                  <Space orientation="horizontal" size={16} align="center">
                    <Text strong>执行状态:</Text>
                    {cleanStatus?.status === 'cleaning' ? (
                      <Tag color="processing">清理中...</Tag>
                    ) : cleanStatus?.status === 'success' ? (
                      <Tag color="success">清理完成</Tag>
                    ) : cleanStatus?.status === 'failed' ? (
                      <Tag color="error">清理失败</Tag>
                    ) : (
                      <Tag color="default">未执行过清理</Tag>
                    )}
                    {cleanStatus?.update_time ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {cleanStatus.status === 'cleaning' ? '开始时间: ' : '完成时间: '}
                        {new Date(cleanStatus.update_time * 1000).toLocaleString('zh-CN')}
                      </Text>
                    ) : null}
                  </Space>
                </div>

                {cleanStatus?.dind_clean_infos && cleanStatus.dind_clean_infos.length > 0 && (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                      清理节点与 Pod 详情:
                    </Text>
                    <Table
                      dataSource={cleanStatus.dind_clean_infos}
                      rowKey={(r, idx) => r.pod_name || String(idx)}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Pod 名称',
                          dataIndex: 'pod_name',
                          key: 'pod_name',
                          render: (t) => <Text code>{t || '-'}</Text>,
                        },
                        {
                          title: '耗时',
                          key: 'duration',
                          render: (_, r) => {
                            if (r.start_time && r.end_time) {
                              return `${Math.max(1, r.end_time - r.start_time)}s`;
                            }
                            return '-';
                          },
                        },
                        {
                          title: '执行结果 / 错误详情',
                          key: 'result',
                          render: (_, r) =>
                            r.error_message ? (
                              <Text type="danger">{r.error_message}</Text>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {r.clean_info || '无输出信息'}
                              </Text>
                            ),
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="共享临时存储清理 (Shared Storage)"
              variant="borderless"
              style={{ background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ display: 'block', color: '#1f2d3d' }}>
                    清空工作流和构建引擎运行时产生在宿主共享持久化卷 (DataPath) 上的临时数据缓存。
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    该清理将直接释放系统持久存储空间，建议在存储卷紧张或排查脏缓存时执行。
                  </Text>
                </div>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={cleaningShared}
                  onClick={handleCleanSharedStorage}
                >
                  清理共享存储
                </Button>
              </div>
            </Card>

            <Card
              title="工作流容量配额与垃圾回收 (Capacity Management)"
              variant="borderless"
              style={{ background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8, marginTop: 20 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Text style={{ display: 'block', color: '#1f2d3d', marginBottom: 4 }}>
                    配置工作流任务历史记录的全局留存策略，防止 MongoDB 与历史任务记录无限膨胀。
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    支持最长保留天数与保留条数上限限制，并提供一键垃圾回收 (GC) 与已删除工作流缓存清理能力。
                  </Text>
                </div>

                <Form
                  form={capacityForm}
                  layout="inline"
                  onFinish={handleSaveCapacityStrategy}
                  initialValues={{ max_days: 365, max_items: 0 }}
                >
                  <Form.Item
                    name="max_days"
                    label="任务保留天数"
                    rules={[{ required: true, message: '请输入保留天数' }]}
                    tooltip="工作流任务自创建起保留的最大天数，超期由 GC 清理"
                  >
                    <InputNumber min={1} max={3650} suffix="天" style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item
                    name="max_items"
                    label="保留条数上限"
                    tooltip="每个工作流保留的历史任务最大数量，0 表示不限制条数"
                  >
                    <InputNumber min={0} max={10000} suffix="条" style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={savingCapacity} icon={<SaveOutlined />}>
                      保存策略
                    </Button>
                  </Form.Item>
                </Form>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Text strong style={{ display: 'block', color: '#1f2d3d' }}>
                      容量维护与手动清理操作
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      立即触发系统垃圾回收释放过期任务，或清理已删除工作流的残留缓存。
                    </Text>
                  </div>
                  <Space orientation="horizontal">
                    <Button
                      icon={<ReloadOutlined />}
                      loading={runningGC}
                      onClick={handleRunGC}
                    >
                      执行垃圾回收 (GC)
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={cleaningWorkflows}
                      onClick={handleCleanWorkflowCache}
                    >
                      清理已删除工作流缓存
                    </Button>
                  </Space>
                </div>
              </div>
            </Card>
          </div>
        ) : activeTab === 'security' ? (
          <div style={{ maxWidth: 760 }}>
            <Alert
              type="info"
              showIcon
              title={
                <span>
                  配置系统认证令牌有效期与全局双因子认证策略。详情请参考{' '}
                  <a
                    href="https://docs.koderover.com/zadig/settings/system-settings/#安全与隐私"
                    target="_blank"
                    rel="noreferrer"
                  >
                    安全与隐私文档
                  </a>
                </span>
              }
              style={{ marginBottom: 20 }}
            />

            <Form
              form={securityForm}
              layout="vertical"
              onFinish={handleSaveSecurity}
              initialValues={{
                token_expiration_time: 24,
                mfa_enabled: false,
                improvement_plan: true,
              }}
            >
              <Card
                title="会话与认证安全"
                variant="borderless"
                style={{ marginBottom: 20, background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
              >
                <Form.Item
                  name="token_expiration_time"
                  label="登录 Token 有效期（小时）"
                  rules={[
                    { required: true, message: '请输入 Token 有效期' },
                    {
                      type: 'number',
                      min: 1,
                      max: 8640,
                      message: '有效期范围为 1 ~ 8640 小时 (最长 360 天)',
                    },
                  ]}
                  extra="用户登录令牌超时未活动后需重新认证，默认 24 小时，最大不得超过 8640 小时（360 天）。"
                >
                  <InputNumber min={1} max={8640} style={{ width: 220 }} />
                </Form.Item>

                <Divider style={{ margin: '16px 0' }} />

                <Form.Item
                  name="mfa_enabled"
                  label={
                    <Space size={8}>
                      <span>全员强制多因素认证 (MFA)</span>
                      <Tag color="gold">需专业版/企业版许可</Tag>
                    </Space>
                  }
                  valuePropName="checked"
                  extra="启用后，所有账号登录时均须完成基于 TOTP 的多因子认证绑定与校验。若当前集群未授权专业版，开启将受后端鉴权保护拦截。"
                >
                  <Switch />
                </Form.Item>
              </Card>

              <Card
                title="数据与体验改进"
                variant="borderless"
                style={{ marginBottom: 24, background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
              >
                <Form.Item
                  name="improvement_plan"
                  label="参与 Zadig 用户体验改进计划"
                  valuePropName="checked"
                  extra="开启后向 KodeRover 发送脱敏的产品基础使用统计，帮助我们持续优化系统稳定性与性能（绝不采集业务代码与敏感数据）。"
                >
                  <Switch />
                </Form.Item>
              </Card>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingSecurity}>
                  保存安全设置
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'serverUrl' ? (
          <div style={{ maxWidth: 680 }}>
            <Alert
              title="系统访问地址说明"
              description="系统地址主要用于代码源 Webhook 回调、通知消息回链（邮件、企业微信、飞书、钉钉）、第三方 OAuth 认证跳转等场景。请确保填写的地址在各个集成系统及团队成员浏览器端均可正常解析和访问。"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
            <Form form={serverUrlForm} layout="vertical" onFinish={handleSaveServerUrl}>
              <Form.Item
                label="系统服务访问地址 (Server URL)"
                extra="必须包含协议头 (http:// 或 https://)，末尾无需斜杠"
                required
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    name="server_url"
                    noStyle
                    rules={[
                      { required: true, message: '请输入系统服务访问地址' },
                      {
                        pattern: /^https?:\/\/.+/,
                        message: '系统地址必须以 http:// 或 https:// 开头',
                      },
                    ]}
                  >
                    <Input placeholder="例如: http://192.168.31.174:8380 或 https://zadig.example.com" />
                  </Form.Item>
                  <Button
                    onClick={() => {
                      serverUrlForm.setFieldsValue({ server_url: window.location.origin });
                    }}
                  >
                    填入当前访问地址
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingServerUrl}>
                  保存系统地址
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'externalLink' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>快捷外部链接列表</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                  配置常用系统（如监控看板、代码托管、企业知识库等）的快捷访问链接
                </Text>
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateLink}>
                添加外部链接
              </Button>
            </div>
            <Table
              dataSource={externalLinks}
              rowKey={(r) => r.id || `${r.name}-${r.url}`}
              columns={[
                {
                  title: '链接名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (name: string) => <Text strong>{name}</Text>,
                },
                {
                  title: '链接地址',
                  dataIndex: 'url',
                  key: 'url',
                  render: (url: string) => (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>{url}</span>
                      <ExportOutlined style={{ fontSize: 12 }} />
                    </a>
                  ),
                },
                {
                  title: '更新人',
                  dataIndex: 'update_by',
                  key: 'update_by',
                  render: (by: string) => by || '-',
                },
                {
                  title: '更新时间',
                  dataIndex: 'update_time',
                  key: 'update_time',
                  render: (time: number) => (time ? dayjs.unix(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 160,
                  render: (_, record: ExternalLinkItem) => (
                    <Space size={8}>
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEditLink(record)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteLink(record)}
                      >
                        删除
                      </Button>
                    </Space>
                  ),
                },
              ]}
              locale={{
                emptyText: <Empty description="暂无外部链接配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        ) : activeTab === 'workflowHook' ? (
          <div style={{ maxWidth: 720 }}>
            {hookLicenseBlocked ? (
              <Alert
                title="企业版专有特性"
                description="全局工作流 Hook 是 Zadig 企业版专有特性。检测到当前系统尚未激活企业版许可证，该配置已降级为只读预览模式。如需向企业统一监控平台、审批流或事件总线广播全量工作流执行事件，请升级或联系管理员导入企业版 License。"
                type="warning"
                showIcon
                style={{ marginBottom: 20 }}
              />
            ) : (
              <Alert
                title="全局工作流 Hook 说明"
                description="开启后，系统内所有通用工作流与自定义工作流执行时，将在指定任务生命周期事件触发时向配置的回调地址推送 JSON 格式 Webhook 消息。可通过签名密钥 (Secret) 校验来源合法性。"
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
              />
            )}

            <Form
              form={workflowHookForm}
              layout="vertical"
              onFinish={handleSaveWorkflowHook}
              disabled={hookLicenseBlocked}
            >
              <Card
                title="Webhook 基本配置"
                variant="borderless"
                style={{ marginBottom: 24, background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
              >
                <Form.Item
                  name="enable"
                  label="启用全局工作流 Hook"
                  valuePropName="checked"
                  extra="开启后将在全局范围内对所有工作流流水线生效"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="hook_address"
                  label="Webhook 回调地址 (Hook Address)"
                  rules={[
                    { required: true, message: '请输入 Webhook 回调地址' },
                    {
                      pattern: /^https?:\/\/.+/,
                      message: '回调地址必须以 http:// 或 https:// 开头',
                    },
                  ]}
                  extra="例如: https://api.example.com/webhook/zadig-workflow"
                >
                  <Input placeholder="http(s)://..." />
                </Form.Item>

                <Form.Item
                  label="签名密钥 (Hook Secret)"
                  extra="用于对 Webhook 请求 Payload 进行 HMAC-SHA256 签名，接收方通过 HTTP Header 校验安全性（可选）"
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="hook_secret" noStyle>
                      <Input.Password placeholder="可自定义或点击右侧自动生成 32 位随机密钥" />
                    </Form.Item>
                    <Button icon={<KeyOutlined />} onClick={handleGenerateHookSecret}>
                      随机生成
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Card>

              <Card
                title="订阅事件类型"
                variant="borderless"
                style={{ marginBottom: 24, background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 8 }}
              >
                <Form.Item
                  name="hook_events"
                  label="选择触发 Webhook 的工作流执行事件"
                  rules={[{ required: true, message: '请至少勾选一个订阅事件' }]}
                >
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Space orientation="vertical" size={12}>
                      <Checkbox value="start_execute">
                        <Space size={8}>
                          <Text strong>任务开始执行</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            (start_execute) - 工作流流水线实例被调度并启动执行时触发
                          </Text>
                        </Space>
                      </Checkbox>
                      <Checkbox value="complete_execute">
                        <Space size={8}>
                          <Text strong>任务执行完成</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            (complete_execute) - 工作流执行完毕（无论成功、失败或取消）后触发
                          </Text>
                        </Space>
                      </Checkbox>
                    </Space>
                  </Checkbox.Group>
                </Form.Item>
              </Card>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={savingHook}
                  disabled={hookLicenseBlocked}
                >
                  保存工作流 Hook 配置
                </Button>
              </Form.Item>
            </Form>
          </div>
        ) : activeTab === 'workflowParam' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>全局工作流参数库 (KeyVault)</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                  集中配置跨项目/流水线复用的全局参数与敏感凭据，在工作流步骤中通过 <code>{'{{parameter.<group>.<key>}}'}</code> 语法引用
                </Text>
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenCreateKeyVault()}>
                新建工作流参数
              </Button>
            </div>

            {keyVaultGroups.length === 0 ? (
              <Empty
                description="暂无系统全局工作流参数，点击右上角新建"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            ) : (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {keyVaultGroups.map((g) => (
                  <Card
                    key={g.group}
                    title={
                      <Space size={8}>
                        <Tag color="blue">{g.group}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({(g.kvs || []).length} 个参数)
                        </Text>
                      </Space>
                    }
                    extra={
                      <Space size={8}>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenCreateKeyVault(g.group)}
                        >
                          加到此组
                        </Button>
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteKeyVaultGroup(g.group)}
                        >
                          删除分组
                        </Button>
                      </Space>
                    }
                    variant="borderless"
                    style={{ background: '#fafbfc', border: '1px solid #eef0f3', borderRadius: 8 }}
                    styles={{ body: { padding: '8px 16px' } }}
                  >
                    <Table
                      dataSource={g.kvs || []}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '参数键名 (Key)',
                          dataIndex: 'key',
                          key: 'key',
                          width: 220,
                          render: (key: string) => (
                            <div>
                              <Space size={4}>
                                <Text strong style={{ color: '#1677ff' }}>{key}</Text>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  title="复制工作流引用格式"
                                  onClick={() => handleCopyParamExpression(g.group, key)}
                                />
                              </Space>
                              <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>
                                parameter.{g.group}.{key}
                              </div>
                            </div>
                          ),
                        },
                        {
                          title: '参数描述',
                          dataIndex: 'description',
                          key: 'description',
                          render: (desc: string) => desc || <Text type="secondary">-</Text>,
                        },
                        {
                          title: '类型 / 敏感性',
                          dataIndex: 'sensitive',
                          key: 'sensitive',
                          width: 140,
                          render: (sensitive: boolean) =>
                            sensitive ? (
                              <Tag color="volcano">敏感凭据 (加密)</Tag>
                            ) : (
                              <Tag color="cyan">普通参数</Tag>
                            ),
                        },
                        {
                          title: '参数取值',
                          key: 'value',
                          render: (_, record: KeyVaultKVItem) => {
                            const isRevealed = Boolean(revealedSecrets[record.id]);
                            const isRevealing = revealingSecretId === record.id;
                            if (record.sensitive) {
                              return (
                                <Space size={8}>
                                  <Text code style={{ fontFamily: 'monospace' }}>
                                    {isRevealed ? revealedSecrets[record.id] : '••••••••••••'}
                                  </Text>
                                  <Button
                                    type="link"
                                    size="small"
                                    loading={isRevealing}
                                    icon={isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                    onClick={() => handleToggleRevealSecret(record)}
                                  >
                                    {isRevealed ? '隐藏' : '查看明文'}
                                  </Button>
                                </Space>
                              );
                            }
                            return (
                              <Text code style={{ fontFamily: 'monospace' }}>
                                {record.value || '-'}
                              </Text>
                            );
                          },
                        },
                        {
                          title: '更新人',
                          dataIndex: 'updated_by',
                          key: 'updated_by',
                          width: 110,
                          render: (by: string) => by || '-',
                        },
                        {
                          title: '更新时间',
                          dataIndex: 'updated_at',
                          key: 'updated_at',
                          width: 160,
                          render: (t: number) => (t ? dayjs.unix(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 130,
                          render: (_, record: KeyVaultKVItem) => (
                            <Space size={6}>
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleOpenEditKeyVault(record)}
                              >
                                编辑
                              </Button>
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDeleteKeyVaultItem(record)}
                              >
                                删除
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                ))}
              </Space>
            )}
          </div>
        ) : activeTab === 'navigation' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                  系统导航目录配置 (Custom Navigation)
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  自定义平台侧边栏目录与功能入口，支持多级分组、系统内置页面与自定义插件链接编排
                  {navigationConfig?.update_by && (
                    <span style={{ marginLeft: 12 }}>
                      （最后保存: {navigationConfig.update_by}
                      {navigationConfig.update_time
                        ? ` 于 ${dayjs.unix(navigationConfig.update_time).format('YYYY-MM-DD HH:mm:ss')}`
                        : ''}
                      ）
                    </span>
                  )}
                </Text>
              </div>
              <Space>
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => setNavPreviewOpen(true)}
                >
                  预览 JSON 结构
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => loadTabData('navigation')}
                >
                  重置 / 刷新
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingNavigation}
                  onClick={handleSaveAllNavigation}
                >
                  保存导航配置
                </Button>
              </Space>
            </div>

            <Alert
              title="导航自定义与侧边栏渲染说明"
              description="本模块通过后端 /api/aslan/system/navigation 管理系统全局侧边栏目录树。点击各节点的「编辑」可修改中英文显示名称、跳转路由及启用状态；编辑完成后请点击右上角「保存导航配置」完成持久化。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table<NavigationItem>
              dataSource={navigationItems}
              rowKey="key"
              pagination={false}
              size="middle"
              childrenColumnName="children"
              columns={[
                {
                  title: '导航名称 (中文)',
                  dataIndex: 'name',
                  key: 'name',
                  render: (name: string, record: NavigationItem) => {
                    const isFolder = record.type === 'folder' || Boolean(record.children && record.children.length > 0);
                    return (
                      <Space>
                        {isFolder ? (
                          <FolderOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                        ) : (
                          <FileOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        )}
                        <Text strong={isFolder}>{name || record.key}</Text>
                      </Space>
                    );
                  },
                },
                {
                  title: '英文标识 / 名称',
                  dataIndex: 'en_name',
                  key: 'en_name',
                  render: (en?: string, record?: NavigationItem) => en || <Text type="secondary">{record?.key}</Text>,
                },
                {
                  title: '节点类型',
                  dataIndex: 'type',
                  key: 'type',
                  width: 120,
                  render: (type: string, record: NavigationItem) => {
                    const isFolder = type === 'folder' || Boolean(record.children && record.children.length > 0);
                    return isFolder ? (
                      <Tag color="orange">目录分组</Tag>
                    ) : record.page_type === 'plugin' ? (
                      <Tag color="purple">扩展插件</Tag>
                    ) : (
                      <Tag color="blue">功能页面</Tag>
                    );
                  },
                },
                {
                  title: '路由地址 (URL)',
                  dataIndex: 'url',
                  key: 'url',
                  render: (url?: string) =>
                    url ? (
                      <Text code style={{ fontSize: 12, fontFamily: 'monospace' }}>
                        {url}
                      </Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                },
                {
                  title: '状态',
                  dataIndex: 'disabled',
                  key: 'disabled',
                  width: 100,
                  render: (disabled?: boolean) =>
                    disabled ? (
                      <Tag color="default">已禁用</Tag>
                    ) : (
                      <Tag color="success">已启用</Tag>
                    ),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_, record: NavigationItem) => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEditNavItem(record)}
                    >
                      编辑
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        ) : activeTab === 'aiCodeReview' ? (
          <div style={{ maxWidth: 720 }}>
            <Form form={aiReviewForm} layout="vertical">
              <Form.Item
                name="llm_integration_id"
                label="LLM 模型集成"
                rules={[{ required: true, message: '请选择 LLM 模型集成' }]}
                extra="列表来自系统集成 → AI 模型接入配置"
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  options={llmOptions}
                  placeholder="选择用于代码审查的大模型"
                  notFoundContent="暂无 LLM 集成，请先在系统集成中配置 AI 模型"
                />
              </Form.Item>
              <Form.Item name="include_paths" label="审查路径包含 (每行一个，支持通配符)">
                <Input.TextArea rows={3} placeholder={'src/**\napp/**'} />
              </Form.Item>
              <Form.Item name="exclude_paths" label="审查路径排除 (每行一个)">
                <Input.TextArea rows={3} placeholder={'**/*_test.go\nvendor/**'} />
              </Form.Item>
              <Form.Item name="output_language" label="输出语言" initialValue="中文">
                <Select
                  options={[
                    { label: '中文', value: '中文' },
                    { label: 'English', value: 'English' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="rules"
                label="审查规则 (JSON 数组，可选)"
                extra='例如: [{"name":"安全","description":"检查 SQL 注入与敏感信息泄露"}]'
              >
                <Input.TextArea rows={6} placeholder='[{"name": "...", "description": "..."}]' />
              </Form.Item>
              <Button type="primary" icon={<SaveOutlined />} loading={savingAiReview} onClick={handleSaveAiReview}>
                保存 AI 审查配置
              </Button>
            </Form>
          </div>
        ) : (
          <Table
            dataSource={operationLogs}
            rowKey="id"
            columns={[
              { title: '操作账号', dataIndex: 'username', key: 'username', render: (u) => <Text strong>{u}</Text> },
              { title: '所属项目', dataIndex: 'product_name', key: 'product_name', render: (p) => <Tag color="blue">{p || '系统'}</Tag> },
              { title: '功能模块', dataIndex: 'function', key: 'function', render: (f) => f || '-' },
              { title: '操作行为', dataIndex: 'method', key: 'method', render: (m) => <Tag color="cyan">{m}</Tag> },
              {
                title: '执行结果',
                dataIndex: 'status',
                key: 'status',
                render: (s) => <Tag color={s === 200 || s === 0 ? 'green' : 'red'}>{s === 200 || s === 0 ? '成功' : '失败'}</Tag>,
              },
              {
                title: '操作时间',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (t) => (t ? new Date(t * 1000).toLocaleString('zh-CN') : '-'),
              },
            ]}
            pagination={{ pageSize: 15 }}
            locale={{
              emptyText: <Empty description="暂无操作审计日志记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        )}
      </Card>

      {/* Add Basic Image Modal */}
      <Modal
        title="添加构建系统基础镜像"
        open={imageModalVisible}
        onCancel={() => setImageModalVisible(false)}
        onOk={() => imageForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={imageForm} layout="vertical" onFinish={handleCreateBasicImage}>
          <Form.Item
            name="label"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="例如: ubuntu 22.04" />
          </Form.Item>
          <Form.Item
            name="value"
            label="镜像标识 / 仓库地址"
            rules={[{ required: true, message: '请输入镜像标识' }]}
          >
            <Input placeholder="例如: jammy 或 koderover.hub.bkt.clouddn.com/zadig/ubuntu:22.04" />
          </Form.Item>
          <Form.Item name="image_from" label="来源" initialValue="custom">
            <Input placeholder="例如: custom 或 koderover" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 外部链接 Modal */}
      <Modal
        title={editingLinkId ? '编辑外部链接' : '添加外部链接'}
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={() => linkForm.submit()}
        confirmLoading={savingLink}
        okText="保存"
        cancelText="取消"
      >
        <Form form={linkForm} layout="vertical" onFinish={handleSaveLink}>
          <Form.Item
            name="name"
            label="链接名称"
            rules={[
              { required: true, message: '请输入链接名称' },
              { max: 64, message: '链接名称不能超过 64 个字符' },
            ]}
          >
            <Input placeholder="例如: 监控看板 Grafana 或 需求管理 Jira" />
          </Form.Item>
          <Form.Item
            name="url"
            label="链接地址"
            rules={[
              { required: true, message: '请输入链接地址' },
              {
                pattern: /^https?:\/\/.+/,
                message: '链接地址必须以 http:// 或 https:// 开头',
              },
            ]}
          >
            <Input placeholder="例如: https://grafana.example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 工作流参数 Modal */}
      <Modal
        title={editingKeyVaultId ? '编辑工作流参数' : '新建工作流参数'}
        open={keyVaultModalOpen}
        onCancel={() => setKeyVaultModalOpen(false)}
        onOk={() => keyVaultForm.submit()}
        confirmLoading={savingKeyVault}
        okText="保存"
        cancelText="取消"
      >
        <Form form={keyVaultForm} layout="vertical" onFinish={handleSaveKeyVault}>
          <Form.Item
            name="group"
            label="参数分组 (Group)"
            rules={[
              { required: true, message: '请输入或选择参数分组' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '分组名称仅支持字母、数字、下划线与中划线' },
            ]}
            extra="分组用于组织参数命名空间，例如 common、db、deploy"
          >
            <Input placeholder="例如: default 或 global 或 sonar" disabled={Boolean(editingKeyVaultId)} />
          </Form.Item>

          <Form.Item
            name="key"
            label="参数键名 (Key)"
            rules={[
              { required: true, message: '请输入参数键名' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '键名仅支持字母、数字与下划线' },
            ]}
            extra="工作流中引用的变量名，例如 DB_PASSWORD 或 TOKEN"
          >
            <Input placeholder="例如: DOCKER_REGISTRY_USER" disabled={Boolean(editingKeyVaultId)} />
          </Form.Item>

          <Form.Item
            name="value"
            label="参数取值 (Value)"
            rules={[{ required: !editingKeyVaultId, message: '请输入参数取值' }]}
            extra={editingKeyVaultId ? '若不修改取值，请留空' : undefined}
          >
            <Input.TextArea rows={3} placeholder="请输入参数值或敏感密钥明文" />
          </Form.Item>

          <Form.Item
            name="sensitive"
            label="敏感凭据保护 (Sensitive)"
            valuePropName="checked"
            extra="启用后系统自动对该值进行加密存储并在界面脱敏，在工作流任务执行日志中自动过滤掩码"
          >
            <Switch />
          </Form.Item>

          <Form.Item name="description" label="参数描述 (Description)">
            <Input placeholder="描述该参数的用途或关联系统" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导航节点编辑 Modal */}
      <Modal
        title={editingNavItem ? `编辑导航节点: ${editingNavItem.name || editingNavItem.key}` : '编辑导航节点'}
        open={navEditModalOpen}
        onCancel={() => setNavEditModalOpen(false)}
        onOk={() => navForm.submit()}
        destroyOnHidden
      >
        <Form form={navForm} layout="vertical" onFinish={handleSaveNavItemModal}>
          <Form.Item
            name="name"
            label="中文显示名称"
            rules={[{ required: true, message: '请输入中文显示名称' }]}
          >
            <Input placeholder="例如: 项目列表 / 持续交付" />
          </Form.Item>

          <Form.Item name="en_name" label="英文显示名称">
            <Input placeholder="例如: Projects / Delivery" />
          </Form.Item>

          <Form.Item name="url" label="路由地址 (URL)">
            <Input placeholder="例如: /v1/projects 或 https://..." />
          </Form.Item>

          <Form.Item
            name="disabled"
            label="禁用节点"
            valuePropName="checked"
            extra="禁用后该节点及其子项在系统导航中将被隐藏"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导航 JSON 结构预览 Drawer */}
      <Drawer
        title="系统导航原始 JSON 结构预览"
        placement="right"
        size={600}
        open={navPreviewOpen}
        onClose={() => setNavPreviewOpen(false)}
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(navigationItems, null, 2));
                feedback.message.success('已复制导航配置 JSON');
              }}
            >
              复制 JSON
            </Button>
          </Space>
        </div>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: 16,
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            maxHeight: 'calc(100vh - 180px)',
            overflow: 'auto',
          }}
        >
          {JSON.stringify(navigationItems, null, 2)}
        </pre>
      </Drawer>
    </div>
  );
};

export default SystemConfigPage;
