import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Radio,
  Button,
  Space,
  Table,
  Input,
  Select,
  Switch,
  Typography,
  Alert,
  Popconfirm,
  App,
} from 'antd';
import {
  ControlOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  SwapRightOutlined,
  SwapLeftOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { serviceApi, ServiceVariableKV } from '../../api/service';
import YamlEditor from '../../components/Editor/YamlEditor';

const { Text } = Typography;

interface ServiceVariablesDrawerProps {
  open: boolean;
  onClose: () => void;
  serviceName: string;
  projectName: string;
  isProduction?: boolean;
  initialKvs?: ServiceVariableKV[];
  initialYaml?: string;
  onSaved?: (kvs: ServiceVariableKV[], yaml: string) => void;
}

export const ServiceVariablesDrawer: React.FC<ServiceVariablesDrawerProps> = ({
  open,
  onClose,
  serviceName,
  projectName,
  isProduction = false,
  initialKvs = [],
  initialYaml = '',
  onSaved,
}) => {
  const { message } = App.useApp();

  const [mode, setMode] = useState<'table' | 'yaml'>('table');
  const [kvs, setKvs] = useState<ServiceVariableKV[]>([]);
  const [yamlStr, setYamlStr] = useState<string>('');
  const [converting, setConverting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setKvs(initialKvs || []);
      setYamlStr(initialYaml || '');
      setMode('table');
    }
  }, [open, initialKvs, initialYaml]);

  // KV -> YAML 转换
  const handleConvertToYaml = async (autoSwitch = false) => {
    setConverting(true);
    try {
      const res = await serviceApi.convertVariableKVAndYaml({
        action: 'toYaml',
        kvs,
        yaml: yamlStr,
      });
      if (res) {
        setYamlStr(res.yaml || '');
        if (res.kvs) {
          setKvs(res.kvs);
        }
        message.success('已成功将表格变量转换为 YAML');
        if (autoSwitch) {
          setMode('yaml');
        }
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '转换失败，请检查变量内容';
      message.error(errMsg);
    } finally {
      setConverting(false);
    }
  };

  // YAML -> KV 转换
  const handleConvertToKV = async (autoSwitch = false) => {
    setConverting(true);
    try {
      const res = await serviceApi.convertVariableKVAndYaml({
        action: 'toKV',
        yaml: yamlStr,
        kvs,
      });
      if (res) {
        setKvs(res.kvs || []);
        if (res.yaml) {
          setYamlStr(res.yaml);
        }
        message.success('已成功将 YAML 解析并填充为结构化变量');
        if (autoSwitch) {
          setMode('table');
        }
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '解析失败，请检查 YAML 语法';
      message.error(errMsg);
    } finally {
      setConverting(false);
    }
  };

  // 模式切换时自动同步
  const handleModeChange = (targetMode: 'table' | 'yaml') => {
    if (targetMode === 'yaml' && mode === 'table') {
      handleConvertToYaml(true);
    } else if (targetMode === 'table' && mode === 'yaml') {
      handleConvertToKV(true);
    } else {
      setMode(targetMode);
    }
  };

  // 增加新变量项
  const handleAddRow = () => {
    const newRow: ServiceVariableKV = {
      key: '',
      value: '',
      type: 'string',
      desc: '',
    };
    setKvs([...kvs, newRow]);
  };

  // 修改行数据
  const handleRowChange = (index: number, patch: Partial<ServiceVariableKV>) => {
    const updated = [...kvs];
    updated[index] = { ...updated[index], ...patch };
    setKvs(updated);
  };

  // 删除行数据
  const handleDeleteRow = (index: number) => {
    const updated = kvs.filter((_, i) => i !== index);
    setKvs(updated);
  };

  // 保存变量
  const handleSave = async () => {
    setSaving(true);
    try {
      // 保存前统一通过 convert 接口确保两者双向一致
      let finalYaml = yamlStr;
      let finalKvs = kvs;

      try {
        const syncRes = await serviceApi.convertVariableKVAndYaml({
          action: mode === 'table' ? 'toYaml' : 'toKV',
          kvs: finalKvs,
          yaml: finalYaml,
        });
        if (syncRes) {
          finalYaml = syncRes.yaml || finalYaml;
          finalKvs = syncRes.kvs || finalKvs;
        }
      } catch {
        // Fallback to current state
      }

      await serviceApi.updateServiceVariable(serviceName, projectName, isProduction, {
        variable_yaml: finalYaml,
        service_variable_kvs: finalKvs,
      });

      setYamlStr(finalYaml);
      setKvs(finalKvs);
      message.success(`服务 [${serviceName}] 变量配置已保存！`);
      if (onSaved) {
        onSaved(finalKvs, finalYaml);
      }
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data
        ?.description || (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || (err as Error)?.message || '保存变量失败';
      message.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '变量键名 (Key)',
      dataIndex: 'key',
      key: 'key',
      width: 170,
      render: (key: string, _: ServiceVariableKV, index: number) => (
        <Input
          size="small"
          placeholder="例如: PORT, DB_HOST"
          value={key}
          onChange={(e) => handleRowChange(index, { key: e.target.value.trim() })}
        />
      ),
    },
    {
      title: '变量类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: string, _: ServiceVariableKV, index: number) => (
        <Select
          size="small"
          value={type || 'string'}
          style={{ width: '100%' }}
          onChange={(val) => handleRowChange(index, { type: val })}
          options={[
            { value: 'string', label: '字符串' },
            { value: 'enum', label: '枚举' },
            { value: 'bool', label: '布尔值' },
            { value: 'yaml', label: 'YAML' },
          ]}
        />
      ),
    },
    {
      title: '枚举可选值 (Options)',
      dataIndex: 'options',
      key: 'options',
      width: 170,
      render: (options: string[] | undefined, record: ServiceVariableKV, index: number) => {
        if (record.type !== 'enum') {
          return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        }
        return (
          <Select
            mode="tags"
            size="small"
            placeholder="输入后回车添加选项"
            value={options || []}
            onChange={(val) => handleRowChange(index, { options: val })}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'desc',
      key: 'desc',
      width: 160,
      render: (desc: string, _: ServiceVariableKV, index: number) => (
        <Input
          size="small"
          placeholder="变量说明"
          value={desc}
          onChange={(e) => handleRowChange(index, { desc: e.target.value })}
        />
      ),
    },
    {
      title: '默认值 (Value)',
      dataIndex: 'value',
      key: 'value',
      render: (value: unknown, record: ServiceVariableKV, index: number) => {
        if (record.type === 'bool') {
          return (
            <Switch
              size="small"
              checked={Boolean(value)}
              onChange={(checked) => handleRowChange(index, { value: checked })}
            />
          );
        }
        if (record.type === 'enum' && record.options && record.options.length > 0) {
          return (
            <Select
              size="small"
              value={String(value ?? '')}
              onChange={(val) => handleRowChange(index, { value: val })}
              options={record.options.map((opt) => ({ value: opt, label: opt }))}
              style={{ width: '100%' }}
            />
          );
        }
        return (
          <Input
            size="small"
            placeholder="默认值"
            value={String(value ?? '')}
            onChange={(e) => handleRowChange(index, { value: e.target.value })}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, __: ServiceVariableKV, index: number) => (
        <Popconfirm
          title="确定删除此变量？"
          onConfirm={() => handleDeleteRow(index)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <ControlOutlined style={{ color: '#1677ff' }} />
          <span>服务变量配置与转换: {serviceName}</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      size={820}
      destroyOnHidden
      extra={
        <Space>
          <Radio.Group
            size="small"
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
          >
            <Radio.Button value="table">表格模式 (KV)</Radio.Button>
            <Radio.Button value="yaml">YAML 模式</Radio.Button>
          </Radio.Group>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存变量
          </Button>
        </Space>
      }
    >
      <Alert
        title="支持表格 (KV) 与 YAML 双向即时转换。在不同模式间切换或点击转换按钮时，系统将调用服务端双向转换引擎保持一致。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 转换操作工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          background: '#fafafa',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid #f0f0f0',
        }}
      >
        <Space>
          {mode === 'table' ? (
            <Button
              type="primary"
              ghost
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
            >
              添加变量
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              在下方直接编辑 YAML，支持多层级嵌套或键值对定义。
            </Text>
          )}
        </Space>

        <Space>
          <Button
            size="small"
            icon={<SwapRightOutlined />}
            loading={converting}
            onClick={() => handleConvertToYaml(false)}
          >
            转换为 YAML
          </Button>
          <Button
            size="small"
            icon={<SwapLeftOutlined />}
            loading={converting}
            onClick={() => handleConvertToKV(false)}
          >
            转换为 KV 变量
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              setKvs(initialKvs || []);
              setYamlStr(initialYaml || '');
            }}
          >
            重置
          </Button>
        </Space>
      </div>

      {mode === 'table' ? (
        <Table
          dataSource={kvs}
          rowKey={(_, idx) => String(idx)}
          columns={columns}
          size="small"
          pagination={false}
          bordered
        />
      ) : (
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
          <YamlEditor
            value={yamlStr}
            onChange={setYamlStr}
            theme="vs-dark"
            height={480}
          />
        </div>
      )}
    </Drawer>
  );
};

export default ServiceVariablesDrawer;
