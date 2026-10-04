import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Spin,
  App,
} from 'antd';
import {
  FieldTimeOutlined,
  SaveOutlined,
  PoweroffOutlined,
  SunOutlined,
} from '@ant-design/icons';
import environmentApi, { EnvSleepCronArg } from '../../api/environment';

const { Text } = Typography;

export interface SleepCronModalProps {
  open: boolean;
  projectName: string;
  envName: string;
  production?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SLEEP_PRESETS = [
  { label: '工作日 20:00', cron: '0 0 20 ? * MON-FRI' },
  { label: '每天 21:00', cron: '0 0 21 * * ?' },
  { label: '每天 23:00', cron: '0 0 23 * * ?' },
];

const AWAKE_PRESETS = [
  { label: '工作日 08:30', cron: '0 30 8 ? * MON-FRI' },
  { label: '工作日 09:00', cron: '0 0 9 ? * MON-FRI' },
  { label: '每天 08:00', cron: '0 0 8 * * ?' },
];

export const SleepCronModal: React.FC<SleepCronModalProps> = ({
  open,
  projectName,
  envName,
  production = false,
  onClose,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchSleepCron = async () => {
    if (!projectName || !envName) return;
    setLoading(true);
    try {
      const res = await environmentApi.getEnvSleepCron(projectName, envName, production);
      form.setFieldsValue({
        sleep_cron_enable: res?.sleep_cron_enable ?? false,
        sleep_cron: res?.sleep_cron || '0 0 20 * * ?',
        awake_cron_enable: res?.awake_cron_enable ?? false,
        awake_cron: res?.awake_cron || '0 0 8 * * ?',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取定时睡眠配置失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && projectName && envName) {
      fetchSleepCron();
    } else {
      form.resetFields();
    }
  }, [open, projectName, envName]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: EnvSleepCronArg = {
        sleep_cron_enable: !!values.sleep_cron_enable,
        sleep_cron: (values.sleep_cron || '').trim(),
        awake_cron_enable: !!values.awake_cron_enable,
        awake_cron: (values.awake_cron || '').trim(),
      };

      await environmentApi.upsertEnvSleepCron(projectName, envName, payload, production);
      message.success(`环境 [${envName}] 定时睡眠与唤醒配置已更新`);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存配置失败，请检查 Crontab 表达式';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <FieldTimeOutlined style={{ color: '#0066ff' }} />
          <span>定时睡眠与唤醒: {envName}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSubmit}
        >
          保存设置
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <Alert
            type="info"
            showIcon
            title="定时睡眠/唤醒说明"
            description="开启定时睡眠与唤醒后，系统将按照设定的 Crontab 表达式自动将环境休眠以节省集群资源，并在工作时间恢复所有 Deployment/StatefulSet 副本。"
          />

          <Form form={form} layout="vertical">
            {/* Scheduled Sleep Section */}
            <Card
              variant="borderless"
              style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0', marginBottom: 16 }}
              title={
                <Space>
                  <PoweroffOutlined style={{ color: '#ff4d4f' }} />
                  <span style={{ fontWeight: 600 }}>定时睡眠 (Scheduled Sleep)</span>
                </Space>
              }
              extra={
                <Form.Item
                  name="sleep_cron_enable"
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
                </Form.Item>
              }
            >
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.sleep_cron_enable !== cur.sleep_cron_enable}
              >
                {({ getFieldValue }) => {
                  const enabled = getFieldValue('sleep_cron_enable');
                  return (
                    <div>
                      <Form.Item
                        label="睡眠 Crontab 表达式"
                        name="sleep_cron"
                        rules={[
                          {
                            required: enabled,
                            message: '启用定时睡眠时必须输入合法的 Crontab 表达式',
                          },
                        ]}
                        tooltip="支持标准 5 段 (分 时 日 月 周) 或 6 段 (秒 分 时 日 月 周) Cron 表达式"
                      >
                        <Input
                          placeholder="例如: 0 0 20 * * ? (每天 20:00 睡眠)"
                          disabled={!enabled}
                        />
                      </Form.Item>

                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                          快捷预设:
                        </Text>
                        <Space wrap size={[4, 4]}>
                          {SLEEP_PRESETS.map((p) => (
                            <Tag
                              key={p.cron}
                              color={enabled ? 'blue' : 'default'}
                              style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
                              onClick={() => {
                                if (enabled) {
                                  form.setFieldsValue({ sleep_cron: p.cron });
                                }
                              }}
                            >
                              {p.label} ({p.cron})
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  );
                }}
              </Form.Item>
            </Card>

            {/* Scheduled Awake Section */}
            <Card
              variant="borderless"
              style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}
              title={
                <Space>
                  <SunOutlined style={{ color: '#faad14' }} />
                  <span style={{ fontWeight: 600 }}>定时唤醒 (Scheduled Awake)</span>
                </Space>
              }
              extra={
                <Form.Item
                  name="awake_cron_enable"
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
                </Form.Item>
              }
            >
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.awake_cron_enable !== cur.awake_cron_enable}
              >
                {({ getFieldValue }) => {
                  const enabled = getFieldValue('awake_cron_enable');
                  return (
                    <div>
                      <Form.Item
                        label="唤醒 Crontab 表达式"
                        name="awake_cron"
                        rules={[
                          {
                            required: enabled,
                            message: '启用定时唤醒时必须输入合法的 Crontab 表达式',
                          },
                        ]}
                        tooltip="支持标准 5 段 (分 时 日 月 周) 或 6 段 (秒 分 时 日 月 周) Cron 表达式"
                      >
                        <Input
                          placeholder="例如: 0 0 8 * * ? (每天 08:00 唤醒)"
                          disabled={!enabled}
                        />
                      </Form.Item>

                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                          快捷预设:
                        </Text>
                        <Space wrap size={[4, 4]}>
                          {AWAKE_PRESETS.map((p) => (
                            <Tag
                              key={p.cron}
                              color={enabled ? 'orange' : 'default'}
                              style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
                              onClick={() => {
                                if (enabled) {
                                  form.setFieldsValue({ awake_cron: p.cron });
                                }
                              }}
                            >
                              {p.label} ({p.cron})
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  );
                }}
              </Form.Item>
            </Card>
          </Form>
        </div>
      </Spin>
    </Modal>
  );
};

export default SleepCronModal;
