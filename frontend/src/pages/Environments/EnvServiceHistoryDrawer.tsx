import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Modal,
  Input,
  Alert,
  Tabs,
  Tooltip,
  App,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
  EyeOutlined,
  DiffOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import environmentApi, {
  type EnvServiceVersionItem,
  type EnvServiceVersionDiff,
  type EnvServiceVersionYaml,
} from '../../api/environment';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';
import MonacoEditor from '@monaco-editor/react';

const { Text } = Typography;

export interface EnvServiceHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  serviceName: string;
  isHelmChart?: boolean;
  production?: boolean;
  onRollbackSuccess?: () => void;
}

/**
 * 环境服务版本历史抽屉
 * 后端契约:
 *  - 列表: GET /api/aslan/environment/environments/:name/version/:serviceName
 *  - 详情 YAML: GET /api/aslan/environment/environments/:name/version/:serviceName/revision/:revision
 *  - 版本 Diff: GET /api/aslan/environment/environments/:name/version/:serviceName/diff
 *  - 回滚检查: GET /api/aslan/environment/environments/:name/version/:serviceName/rollback/check
 *  - 执行回滚: POST /api/aslan/environment/environments/:name/version/:serviceName/rollback
 */
export const EnvServiceHistoryDrawer: React.FC<EnvServiceHistoryDrawerProps> = ({
  open,
  onClose,
  projectName,
  envName,
  serviceName,
  isHelmChart = false,
  production = false,
  onRollbackSuccess,
}) => {
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<EnvServiceVersionItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Diff Modal 状态
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<EnvServiceVersionDiff | null>(null);
  const [diffRevA, setDiffRevA] = useState<number>(0);
  const [diffRevB, setDiffRevB] = useState<number>(0);
  const [activeDiffTab, setActiveDiffTab] = useState<'rendered' | 'variable'>('rendered');

  // 查看单个版本 YAML 状态
  const [viewYamlOpen, setViewYamlOpen] = useState(false);
  const [viewYamlLoading, setViewYamlLoading] = useState(false);
  const [versionYamlData, setVersionYamlData] = useState<EnvServiceVersionYaml | null>(null);
  const [viewingRevision, setViewingRevision] = useState<number>(0);
  const [activeYamlTab, setActiveYamlTab] = useState<'rendered' | 'variable'>('rendered');

  // 回滚操作中状态
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!open || !projectName || !envName || !serviceName) return;
    setLoading(true);
    try {
      const res = await environmentApi.listServiceVersions(
        projectName,
        envName,
        serviceName,
        isHelmChart,
        production
      );
      // 逆向旧版逻辑: 倒序排列，最新 revision 居首
      const list = Array.isArray(res) ? [...res].reverse() : [];
      setVersions(list);
      setSelectedRowKeys([]);
    } catch {
      setVersions([]);
      message.error('获取服务版本历史失败');
    } finally {
      setLoading(false);
    }
  }, [open, projectName, envName, serviceName, isHelmChart, production, message]);

  useEffect(() => {
    if (open) {
      fetchVersions();
    } else {
      setSelectedRowKeys([]);
      setDiffOpen(false);
      setViewYamlOpen(false);
    }
  }, [open, fetchVersions]);

  // 处理对比
  const handleOpenDiff = async () => {
    if (selectedRowKeys.length !== 2) return;
    const revA = Number(selectedRowKeys[0]);
    const revB = Number(selectedRowKeys[1]);
    setDiffRevA(revA);
    setDiffRevB(revB);
    setDiffOpen(true);
    setDiffLoading(true);
    try {
      const res = await environmentApi.diffServiceVersions(
        projectName,
        envName,
        serviceName,
        revA,
        revB,
        isHelmChart,
        production
      );
      setDiffData(res);
    } catch {
      message.error(`对比版本 ${revA} 与 ${revB} 失败`);
      setDiffOpen(false);
    } finally {
      setDiffLoading(false);
    }
  };

  // 查看指定版本的 YAML
  const handleViewYaml = async (revision: number) => {
    setViewingRevision(revision);
    setViewYamlOpen(true);
    setViewYamlLoading(true);
    try {
      const res = await environmentApi.getServiceVersionYaml(
        projectName,
        envName,
        serviceName,
        revision,
        isHelmChart,
        production
      );
      setVersionYamlData(res);
    } catch {
      message.error(`获取版本 ${revision} 配置失败`);
      setViewYamlOpen(false);
    } finally {
      setViewYamlLoading(false);
    }
  };

  // 回滚流程：Check -> Confirm -> Rollback
  const handleRollback = async (record: EnvServiceVersionItem) => {
    const revision = record.revision;
    setRollbackLoading(true);

    try {
      // 1. 回滚前镜像可用性检查
      const checkRes = await environmentApi.checkServiceVersionRollback(
        projectName,
        envName,
        serviceName,
        revision,
        isHelmChart,
        production
      );

      setRollbackLoading(false);

      let detailInput = '';
      const hasUnavailable = !checkRes.available || (checkRes.unavailable_images && checkRes.unavailable_images.length > 0);

      modal.confirm({
        title: `确认回滚服务 [${serviceName}] 到版本 ${revision}？`,
        icon: hasUnavailable ? <WarningOutlined style={{ color: '#faad14' }} /> : <RollbackOutlined style={{ color: '#1677ff' }} />,
        width: 540,
        content: (
          <div style={{ marginTop: 12 }}>
            {hasUnavailable && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                title="镜像可用性告警"
                description={
                  <div>
                    以下镜像在内网镜像仓中不可用或无法拉取，回滚可能导致容器启动失败：
                    <ul style={{ paddingLeft: 18, margin: '6px 0 0 0' }}>
                      {checkRes.unavailable_images?.map((img) => (
                        <li key={img}>
                          <Text code>{img}</Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                }
              />
            )}
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
              回滚操作将使用该版本的渲染配置与镜像重新部署服务实例。
            </Text>
            <Input.TextArea
              placeholder="请输入回滚说明（可选）"
              rows={2}
              onChange={(e) => {
                detailInput = e.target.value;
              }}
            />
          </div>
        ),
        okText: '确认回滚',
        okButtonProps: { danger: hasUnavailable },
        cancelText: '取消',
        onOk: async () => {
          try {
            await environmentApi.rollbackServiceVersion(
              projectName,
              envName,
              serviceName,
              revision,
              detailInput || `回滚到版本 ${revision}`,
              isHelmChart,
              production
            );
            message.success(`服务 [${serviceName}] 回滚到版本 ${revision} 成功`);
            fetchVersions();
            if (onRollbackSuccess) {
              onRollbackSuccess();
            }
          } catch (err: unknown) {
            const errObj = err as { response?: { data?: { message?: string; description?: string } } };
            const errMsg = errObj.response?.data?.message || errObj.response?.data?.description || '回滚失败，请检查权限或日志';
            message.error(errMsg);
          }
        },
      });
    } catch (err: unknown) {
      setRollbackLoading(false);
      const errObj = err as { response?: { data?: { message?: string } } };
      const errMsg = errObj.response?.data?.message || '回滚检查失败';
      message.error(errMsg);
    }
  };

  const columns: ColumnsType<EnvServiceVersionItem> = [
    {
      title: '版本号',
      dataIndex: 'revision',
      key: 'revision',
      width: 100,
      render: (rev: number, _, idx) => (
        <Space>
          <Text strong style={{ color: '#1677ff' }}>
            #{rev}
          </Text>
          {idx === 0 && <Tag color="green">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '部署策略/方式',
      dataIndex: 'deploy_type',
      key: 'deploy_type',
      width: 120,
      render: (type: string, record) => (
        <Space size={4}>
          <Tag color="blue">{type || 'k8s'}</Tag>
          {record.deploy_strategy && <Tag color="cyan">{record.deploy_strategy}</Tag>}
        </Space>
      ),
    },
    {
      title: '容器镜像',
      dataIndex: 'containers',
      key: 'containers',
      ellipsis: true,
      render: (containers: EnvServiceVersionItem['containers']) => {
        if (!containers || containers.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space orientation="vertical" size={2} style={{ maxWidth: 300 }}>
            {containers.map((c) => (
              <Tooltip key={c.name} title={c.image}>
                <Tag style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}: {c.image ? c.image.split('/').pop() : '-'}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
    {
      title: '变更说明',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (text: string, record) => (
        <div>
          {record.operation && (
            <Tag color={record.operation === 'rollback' ? 'orange' : 'default'} style={{ marginRight: 6 }}>
              {record.operation}
            </Tag>
          )}
          <Text type={text ? undefined : 'secondary'}>{text || '常规变更更新'}</Text>
        </div>
      ),
    },
    {
      title: '更新人',
      dataIndex: 'create_by',
      key: 'create_by',
      width: 130,
      ellipsis: true,
      render: (by: string) => by || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 160,
      render: (ts: number) => (ts ? dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record, idx) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewYaml(record.revision)}
          >
            查看配置
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<RollbackOutlined />}
            disabled={idx === 0 || rollbackLoading}
            onClick={() => handleRollback(record)}
          >
            回滚
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1677ff' }} />
            <span>服务版本历史: {serviceName}</span>
            <Tag color="geekblue">{envName}</Tag>
          </Space>
        }
        placement="right"
        open={open}
        onClose={onClose}
        size={960}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<DiffOutlined />}
              disabled={selectedRowKeys.length !== 2}
              onClick={handleOpenDiff}
            >
              版本对比 ({selectedRowKeys.length}/2)
            </Button>
            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchVersions}>
              刷新
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Alert
            type="info"
            showIcon
            title="提示: 在下方表格勾选任意 2 个历史版本，可点击右上角「版本对比」进行精确的双栏差异分析与回滚预判。"
          />
        </div>

        <Table
          dataSource={versions}
          columns={columns}
          rowKey="revision"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个版本` }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (keys) => {
              if (keys.length <= 2) {
                setSelectedRowKeys(keys);
              } else {
                // 仅保留最新选中的 2 个
                setSelectedRowKeys(keys.slice(-2));
              }
            },
          }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史版本记录" />,
          }}
        />
      </Drawer>

      {/* 两版本对比弹窗 */}
      <Modal
        title={
          <Space>
            <DiffOutlined style={{ color: '#1677ff' }} />
            <span>
              版本差异对比: #{diffRevA} vs #{diffRevB} ({serviceName})
            </span>
          </Space>
        }
        open={diffOpen}
        onCancel={() => setDiffOpen(false)}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Tabs
            activeKey={activeDiffTab}
            onChange={(k) => setActiveDiffTab(k as 'rendered' | 'variable')}
            items={[
              {
                key: 'rendered',
                label: '渲染 YAML 对比 (Rendered YAML)',
              },
              {
                key: 'variable',
                label: '变量配置对比 (Variable YAML)',
              },
            ]}
          />
        </div>

        {diffLoading ? (
          <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReloadOutlined spin style={{ fontSize: 24 }} />
          </div>
        ) : diffData ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong style={{ color: '#fa8c16' }}>
                左侧: 版本 #{diffRevA} ({diffData.create_by_a || '-'}, {diffData.create_time_a ? dayjs(diffData.create_time_a * 1000).format('YYYY-MM-DD HH:mm') : '-'})
              </Text>
              <Text strong style={{ color: '#52c41a' }}>
                右侧: 版本 #{diffRevB} ({diffData.create_by_b || '-'}, {diffData.create_time_b ? dayjs(diffData.create_time_b * 1000).format('YYYY-MM-DD HH:mm') : '-'})
              </Text>
            </div>
            <YamlDiffEditor
              original={activeDiffTab === 'rendered' ? diffData.yaml_a || '' : diffData.variable_yaml_a || ''}
              modified={activeDiffTab === 'rendered' ? diffData.yaml_b || '' : diffData.variable_yaml_b || ''}
              height="480px"
              theme="light"
            />
          </div>
        ) : (
          <Empty description="暂无对比数据" />
        )}
      </Modal>

      {/* 单个版本 YAML 查看抽屉 */}
      <Drawer
        title={
          <Space>
            <EyeOutlined style={{ color: '#1677ff' }} />
            <span>
              版本 #{viewingRevision} 配置详情 ({serviceName})
            </span>
          </Space>
        }
        open={viewYamlOpen}
        onClose={() => setViewYamlOpen(false)}
        size={780}
        loading={viewYamlLoading}
      >
        <Tabs
          activeKey={activeYamlTab}
          onChange={(k) => setActiveYamlTab(k as 'rendered' | 'variable')}
          items={[
            { key: 'rendered', label: '渲染后 YAML (Rendered)' },
            { key: 'variable', label: '环境变量配置 (Variable YAML)' },
          ]}
        />
        <div style={{ marginTop: 12, border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
          <MonacoEditor
            height="520px"
            language="yaml"
            theme="light"
            value={
              activeYamlTab === 'rendered'
                ? versionYamlData?.yaml || '# 无渲染后 YAML'
                : versionYamlData?.variable_yaml || '# 无变量配置'
            }
            options={{ readOnly: true, minimap: { enabled: false } }}
            loading={<ReloadOutlined spin />}
          />
        </div>
      </Drawer>
    </>
  );
};

export default EnvServiceHistoryDrawer;
