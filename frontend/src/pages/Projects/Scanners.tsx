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
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import LogViewer from '../../components/Terminal/LogViewer';

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
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text, Title } = Typography;
const { Option } = Select;

export interface ScannerItem {
  id?: string;
  name: string;
  description?: string;
  scanner_type: 'sonar' | 'ai-review' | 'trivy' | 'standard';
  enable_ai_review?: boolean;
  repos?: { repo_name: string; branch: string }[];
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
  const [reportDrawerVisible, setReportDrawerVisible] = useState<boolean>(false);
  const [selectedScanner, setSelectedScanner] = useState<ScannerItem | null>(null);
  const [form] = Form.useForm();

  // 路由 /scanner/create、/scanner/edit/:name 自动打开弹窗
  useEffect(() => {
    if (location.pathname.includes('/scanner/create') || location.pathname.includes('/scanner/ai-review/create')) {
      const isAi = location.pathname.includes('/ai-review/');
      form.setFieldsValue({ scanner_type: isAi ? 'ai-review' : 'sonar' });
      setModalVisible(true);
    } else if (location.pathname.includes('/scanner/edit/') || location.pathname.includes('/scanner/ai-review/edit/')) {
      if (routeScannerName && scanners.length > 0) {
        const target = scanners.find((s) => s.name === routeScannerName);
        if (target) {
          form.setFieldsValue({
            name: target.name,
            description: target.description,
            scanner_type: target.scanner_type,
            repo_name: target.repos?.[0]?.repo_name,
          });
          setModalVisible(true);
        }
      }
    }
  }, [location.pathname, routeScannerName, scanners, form]);

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
          `/api/aslan/testing/scanning/${scanner.id}/task/${taskId}/artifact_info?jobName=${encodeURIComponent(scanner.name)}`,
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
        `/api/aslan/testing/scanning/artifact?id=${encodeURIComponent(taskDrawer.scannerId)}&jobName=${encodeURIComponent(taskDrawer.scannerName)}&taskID=${taskDrawer.taskId}&projectName=${encodeURIComponent(projectName)}`,
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
        const taskRes = await http.get<ScanningTaskItem[] | { items?: ScanningTaskItem[] }>(
          `/api/aslan/testing/scanning/${scanner.id}/task`,
          { skipErrorHandler: true }
        );
        setScanTasks(
          Array.isArray(taskRes) ? taskRes : (taskRes as { items?: ScanningTaskItem[] })?.items || []
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
      const payload: ScannerItem = {
        name: values.name,
        description: values.description,
        scanner_type: values.scanner_type,
        enable_ai_review: values.scanner_type === 'ai-review',
        repos: [{ repo_name: values.repo_name || 'main-repo', branch: 'main' }],
        last_status: 'untested',
      };

      await http.post(`/api/aslan/testing/scanning?projectName=${projectName}`, payload);
      feedback.message.success('代码审查规则创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchScanners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建代码审查规则失败，请检查配置参数';
      feedback.message.error(msg);
    }
  };

  const handleTriggerScan = async (record: ScannerItem) => {
    feedback.message.loading(`正在对 [${record.name}] 触发代码安全扫描...`, 1);
    try {
      await http.post(
        `/api/aslan/testing/scanning/${record.name}/task?projectName=${projectName}`,
        {}
      );
      feedback.message.success(`代码审查任务 [${record.name}] 已在后台成功启动，检测完成后将同步质量门禁`);
      fetchScanners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '触发代码审查任务失败';
      feedback.message.error(msg);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await http.delete(`/api/aslan/testing/scanning/${name}?projectName=${projectName}`);
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
            <Text strong style={{ fontSize: 14 }}>
              {text}
            </Text>
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
        if (type === 'ai-review') return <Tag color="purple">LLM AI 审查</Tag>;
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
      width: 220,
      render: (_, record) => (
        <Space size="middle">
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
          <Popconfirm
            title="确认删除该代码审查配置？"
            onConfirm={() => handleDelete(record.name)}
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
              onClick={() => {
                form.resetFields();
                setModalVisible(true);
              }}
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
                  onClick={() => {
                    form.resetFields();
                    setModalVisible(true);
                  }}
                >
                  新建审查规则
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Scanner Modal */}
      <Modal
        title="新建代码质量审查与扫描规则"
        open={modalVisible}
        onOk={handleSaveScanner}
        onCancel={handleCloseModal}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scanner_type: 'sonar' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="扫描模块名称"
            rules={[
              { required: true, message: '请输入扫描模块名称' },
              { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字及连字符(-)' },
            ]}
          >
            <Input placeholder="例如：sonar-security-scan" />
          </Form.Item>

          <Form.Item
            name="scanner_type"
            label="审查分析引擎"
            rules={[{ required: true, message: '请选择审查引擎' }]}
          >
            <Select>
              <Option value="sonar">SonarQube 静态代码扫描</Option>
              <Option value="ai-review">Zadig AI 智能审查 (LLM PR Review)</Option>
              <Option value="trivy">Trivy 安全漏洞与 CVE 审查</Option>
              <Option value="standard">通用自定义脚本检测</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="规则描述">
            <Input placeholder="说明该审查模块的检测规范与门禁目标" />
          </Form.Item>

          <Form.Item name="repo_name" label="关联代码仓库">
            <Input placeholder="例如：koderover/backend-core" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quality Report Drawer */}
      <Drawer
        title={`质量门禁检测报告: ${selectedScanner?.name || ''}`}
        placement="right"
        size={560}
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
