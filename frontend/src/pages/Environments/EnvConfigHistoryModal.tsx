import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Empty,
  Popconfirm,
  Tabs,
  Alert,
} from 'antd';
import { App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HistoryOutlined,
  RollbackOutlined,
  ReloadOutlined,
  DiffOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import environmentApi, {
  CommonEnvCfgHistoryItem,
  RollbackCommonEnvCfgArgs,
} from '../../api/environment';
import YamlEditor from '../../components/Editor/YamlEditor';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';

const { Text } = Typography;

export interface EnvConfigHistoryModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  envName: string;
  objectName: string;
  commonEnvCfgType: string; // 'ConfigMap' | 'Secret' | 'Ingress' | 'PVC'
  currentYaml?: string;
  production?: boolean;
  onRollbackSuccess?: () => void;
}

export const EnvConfigHistoryModal: React.FC<EnvConfigHistoryModalProps> = ({
  open,
  onClose,
  projectName,
  envName,
  objectName,
  commonEnvCfgType,
  currentYaml = '',
  production = false,
  onRollbackSuccess,
}) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [historyList, setHistoryList] = useState<CommonEnvCfgHistoryItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CommonEnvCfgHistoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'yaml' | 'diff'>('yaml');
  const [rollingBack, setRollingBack] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!open || !objectName) return;
    setLoading(true);
    try {
      const res = await environmentApi.getCommonEnvCfgHistory(
        projectName,
        envName,
        objectName,
        commonEnvCfgType,
        production
      );
      const list = Array.isArray(res) ? res : [];
      setHistoryList(list);
      if (list.length > 0) {
        setSelectedRecord(list[0]);
      } else {
        setSelectedRecord(null);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '获取配置版本历史失败';
      message.error(msg);
      setHistoryList([]);
      setSelectedRecord(null);
    } finally {
      setLoading(false);
    }
  }, [open, objectName, projectName, envName, commonEnvCfgType, production, message]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

  const handleRollback = async (record: CommonEnvCfgHistoryItem) => {
    setRollingBack(true);
    try {
      const payload: RollbackCommonEnvCfgArgs = {
        env_name: envName,
        product_name: projectName,
        name: objectName,
        common_env_cfg_type: commonEnvCfgType,
        yaml_data: record.yaml_data,
        auto_sync: false,
        restart_associated_svc: false,
        production,
      };

      await environmentApi.rollbackCommonEnvCfg(projectName, envName, payload, production);
      message.success(`配置 [${objectName}] 已成功回滚至指定版本`);
      onRollbackSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
          ?.description ||
        (err as { message?: string })?.message ||
        '配置回滚失败';
      message.error(msg);
    } finally {
      setRollingBack(false);
    }
  };

  const formatTimestamp = (ts: number | undefined) => {
    if (!ts) return '-';
    // If timestamp in seconds, multiply by 1000
    const m = ts < 1e11 ? ts * 1000 : ts;
    return dayjs(m).format('YYYY-MM-DD HH:mm:ss');
  };

  const columns: ColumnsType<CommonEnvCfgHistoryItem> = [
    {
      title: '版本保存时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 170,
      render: (ts: number, r) => (
        <Space orientation="horizontal" size={4}>
          <Text strong={selectedRecord?.id === r.id}>{formatTimestamp(ts)}</Text>
        </Space>
      ),
    },
    {
      title: '修改人',
      dataIndex: 'update_user_name',
      key: 'update_user_name',
      width: 120,
      render: (u: string) => <Text type="secondary">{u || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, r) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => setSelectedRecord(r)}
          >
            {selectedRecord?.id === r.id ? '当前查看' : '查看'}
          </Button>
          <Popconfirm
            title={`确定将 [${objectName}] 回滚到此版本？`}
            description="回滚将直接覆盖当前环境的配置内容并同步至集群。"
            onConfirm={() => handleRollback(r)}
            okText="回滚"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<RollbackOutlined />}
              loading={rollingBack}
            >
              回滚
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space orientation="horizontal" size="small">
          <HistoryOutlined style={{ color: '#1677ff' }} />
          <span>环境配置版本历史: {objectName}</span>
          <Tag color="geekblue">{commonEnvCfgType}</Tag>
          <Tag color={production ? 'red' : 'blue'}>{envName}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1100}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        selectedRecord && (
          <Popconfirm
            key="rollback"
            title={`确定将 [${objectName}] 回滚到此版本？`}
            description="回滚将直接覆盖当前环境的配置内容并同步至集群。"
            onConfirm={() => handleRollback(selectedRecord)}
            okText="回滚"
            cancelText="取消"
          >
            <Button type="primary" danger icon={<RollbackOutlined />} loading={rollingBack}>
              回滚到选中的历史版本
            </Button>
          </Popconfirm>
        ),
      ]}
    >
      <Alert
        title="版本历史与回滚说明"
        description="系统记录了每次通过页面或流水线修改环境配置的快照。您可以审查历次版本 YAML，与当前版本进行对比，并在必要时安全回滚。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: 'flex', gap: 16, minHeight: 460 }}>
        {/* 左侧历史列表 */}
        <div style={{ width: 440, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong>历史版本列表 ({historyList.length})</Text>
            <Button
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={fetchHistory}
            >
              刷新
            </Button>
          </div>
          <Table
            dataSource={historyList}
            columns={columns}
            rowKey={(r) => r.id || `${r.create_time}-${r.update_user_name}`}
            loading={loading}
            pagination={{ pageSize: 6, size: 'small' }}
            size="small"
            rowClassName={(r) => (selectedRecord?.id === r.id ? 'ant-table-row-selected' : '')}
            onRow={(record) => ({
              onClick: () => setSelectedRecord(record),
              style: { cursor: 'pointer' },
            })}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史版本记录" />,
            }}
          />
        </div>

        {/* 右侧 YAML / 差异对比预览 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedRecord ? (
            <div>
              <Tabs
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as 'yaml' | 'diff')}
                items={[
                  {
                    key: 'yaml',
                    label: (
                      <span>
                        <FileTextOutlined /> 历史版本 YAML
                      </span>
                    ),
                    children: (
                      <div>
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            保存时间: {formatTimestamp(selectedRecord.create_time)} | 操作人: {selectedRecord.update_user_name || '-'}
                          </Text>
                        </div>
                        <YamlEditor
                          value={selectedRecord.yaml_data || '// 空 YAML'}
                          readOnly
                          theme="light"
                          height={420}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'diff',
                    label: (
                      <span>
                        <DiffOutlined /> 与当前版本对比 (Diff)
                      </span>
                    ),
                    children: (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            左侧: 当前环境实时 YAML | 右侧: 所选历史版本 YAML
                          </Text>
                        </div>
                        <YamlDiffEditor
                          original={currentYaml || '// 当前环境无 YAML 数据'}
                          modified={selectedRecord.yaml_data || '// 历史版本无 YAML 数据'}
                          theme="light"
                          height="420px"
                          readOnly
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              {loading ? <Spin /> : <Empty description="请在左侧选择一个历史版本" />}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EnvConfigHistoryModal;
