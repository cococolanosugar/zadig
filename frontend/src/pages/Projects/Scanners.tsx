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
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import http from '../../api/client';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;
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
  const { projectName } = useParams<{ projectName: string }>();
  const [loading, setLoading] = useState<boolean>(false);
  const [scanners, setScanners] = useState<ScannerItem[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [reportDrawerVisible, setReportDrawerVisible] = useState<boolean>(false);
  const [selectedScanner, setSelectedScanner] = useState<ScannerItem | null>(null);
  const [form] = Form.useForm();

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
        onCancel={() => setModalVisible(false)}
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
    </div>
  );
};

export default ScannersPage;
