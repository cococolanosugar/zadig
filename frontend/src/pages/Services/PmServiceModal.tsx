import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Space,
  Typography,
  Card,
  Alert,
  Tag,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  HeartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { feedback } from '../../utils/feedback';
import {
  serviceApi,
  ServiceDetail,
  PmHealthCheck,
  PmServiceTemplate,
  PmServiceBuildObject,
} from '../../api/service';

const { Text } = Typography;

interface PmServiceModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  isProduction?: boolean;
  serviceName?: string | null;
  serviceDetail?: ServiceDetail | null;
  onSuccess: (createdOrUpdatedName?: string) => void;
}

export const PmServiceModal: React.FC<PmServiceModalProps> = ({
  open,
  onClose,
  projectName,
  isProduction: _isProduction = false,
  serviceName,
  serviceDetail,
  onSuccess,
}) => {
  const isEdit = Boolean(serviceName);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [updatingHealthCheck, setUpdatingHealthCheck] = useState(false);
  const [enableHealthCheck, setEnableHealthCheck] = useState(false);

  // 初始化表单
  useEffect(() => {
    if (open) {
      if (isEdit && serviceDetail) {
        const detail = serviceDetail as unknown as PmServiceTemplate;
        const checks = detail.health_checks || [];
        setEnableHealthCheck(checks.length > 0);
        form.setFieldsValue({
          service_name: detail.service_name,
          visibility: detail.visibility || 'private',
          start_cmd: detail.start_cmd || '',
          stop_cmd: detail.stop_cmd || '',
          restart_cmd: detail.restart_cmd || '',
          health_checks: checks.length > 0 ? checks : [
            {
              protocol: 'http',
              port: 8080,
              path: '/healthz',
              time_out: 2,
              interval: 5,
              healthy_threshold: 3,
              unhealthy_threshold: 3,
            },
          ],
        });
      } else {
        setEnableHealthCheck(false);
        form.resetFields();
        form.setFieldsValue({
          visibility: 'private',
          start_cmd: '# 启动命令示例\n# systemctl start my-app',
          stop_cmd: '# 停止命令示例\n# systemctl stop my-app',
          restart_cmd: '# 重启命令示例\n# systemctl restart my-app',
          health_checks: [
            {
              protocol: 'http',
              port: 8080,
              path: '/healthz',
              time_out: 2,
              interval: 5,
              healthy_threshold: 3,
              unhealthy_threshold: 3,
            },
          ],
        });
      }
    }
  }, [open, isEdit, serviceDetail, form]);

  // 全量提交创建或更新 PM 服务
  const handleSaveAll = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const healthChecks: PmHealthCheck[] = enableHealthCheck
        ? (values.health_checks || []).map((hc: PmHealthCheck) => ({
            protocol: hc.protocol || 'http',
            port: Number(hc.port),
            path: hc.protocol === 'http' ? hc.path || '' : '',
            time_out: Number(hc.time_out || 2),
            interval: Number(hc.interval || 5),
            healthy_threshold: Number(hc.healthy_threshold || 3),
            unhealthy_threshold: Number(hc.unhealthy_threshold || 3),
          }))
        : [];

      const pmTemplate: PmServiceTemplate = {
        product_name: projectName,
        service_name: isEdit ? (serviceName as string) : values.service_name,
        visibility: values.visibility || 'private',
        type: 'pm',
        start_cmd: values.start_cmd || '',
        stop_cmd: values.stop_cmd || '',
        restart_cmd: values.restart_cmd || '',
        health_checks: healthChecks,
      };

      const payload: PmServiceBuildObject = {
        pm_service_tmpl: pmTemplate,
      };

      if (isEdit) {
        await serviceApi.updatePmService(projectName, payload);
        feedback.message.success(`主机服务 ${pmTemplate.service_name} 更新成功`);
      } else {
        await serviceApi.createPmService(projectName, payload);
        feedback.message.success(`主机服务 ${pmTemplate.service_name} 创建成功`);
      }

      onSuccess(pmTemplate.service_name);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交主机服务失败，请检查参数';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 快捷联动更新探活配置（PUT /service/pm/healthCheckUpdate）
  const handleUpdateHealthCheckOnly = async () => {
    if (!serviceName) return;
    try {
      const values = await form.validateFields();
      setUpdatingHealthCheck(true);

      const healthChecks: PmHealthCheck[] = enableHealthCheck
        ? (values.health_checks || []).map((hc: PmHealthCheck) => ({
            protocol: hc.protocol || 'http',
            port: Number(hc.port),
            path: hc.protocol === 'http' ? hc.path || '' : '',
            time_out: Number(hc.time_out || 2),
            interval: Number(hc.interval || 5),
            healthy_threshold: Number(hc.healthy_threshold || 3),
            unhealthy_threshold: Number(hc.unhealthy_threshold || 3),
          }))
        : [];

      const payload: PmServiceTemplate = {
        product_name: projectName,
        service_name: serviceName,
        visibility: values.visibility || 'private',
        type: 'pm',
        health_checks: healthChecks,
      };

      await serviceApi.updatePmHealthCheckStatus(projectName, payload);
      feedback.message.success('探活配置与健康检查状态已热更新成功');
      onSuccess(serviceName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新探活配置失败';
      feedback.message.error(msg);
    } finally {
      setUpdatingHealthCheck(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <span>{isEdit ? `编辑主机 (PM) 服务: ${serviceName}` : '新建主机 (PM) 服务'}</span>
          <Tag color="purple">主机架构</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          {isEdit && (
            <Button
              icon={<HeartOutlined />}
              loading={updatingHealthCheck}
              onClick={handleUpdateHealthCheckOnly}
            >
              热更新探活配置
            </Button>
          )}
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={handleSaveAll}
          >
            {isEdit ? '保存服务配置' : '创建主机服务'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {/* 基本信息 */}
        <Card
          variant="borderless"
          title="基本信息"
          size="small"
          style={{ background: '#fafafa', marginBottom: 16, borderRadius: 8 }}
        >
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="service_name"
                label="服务标识 (Service Name)"
                rules={[
                  { required: true, message: '请输入服务名称' },
                  { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '服务名称仅支持小写字母、数字及中划线' },
                ]}
              >
                <Input placeholder="例如: nginx-host-agent" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="visibility" label="可见性" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'private', label: '项目私有 (Private)' },
                    { value: 'public', label: '全局共享 (Public)' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 部署控制脚本 */}
        <Card
          variant="borderless"
          title="部署与生命周期脚本"
          size="small"
          style={{ background: '#fafafa', marginBottom: 16, borderRadius: 8 }}
        >
          <Form.Item
            name="start_cmd"
            label="启动命令 (Start Command)"
            rules={[{ required: true, message: '请输入启动命令' }]}
            tooltip="主机上启动应用进程的命令，例如 systemctl start demo 或 nohup ./app &"
          >
            <Input.TextArea rows={3} style={{ fontFamily: 'monospace' }} placeholder="systemctl start demo" />
          </Form.Item>

          <Form.Item
            name="stop_cmd"
            label="停止命令 (Stop Command)"
            tooltip="停止主机应用进程的命令，例如 systemctl stop demo"
          >
            <Input.TextArea rows={2} style={{ fontFamily: 'monospace' }} placeholder="systemctl stop demo" />
          </Form.Item>

          <Form.Item
            name="restart_cmd"
            label="重启命令 (Restart Command)"
            tooltip="重启主机应用进程的命令，例如 systemctl restart demo"
          >
            <Input.TextArea rows={2} style={{ fontFamily: 'monospace' }} placeholder="systemctl restart demo" />
          </Form.Item>
        </Card>

        {/* 探活配置 */}
        <Card
          variant="borderless"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <HeartOutlined style={{ color: '#ff4d4f' }} />
                <span>服务健康检查 (探活配置)</span>
              </Space>
              <Switch checked={enableHealthCheck} onChange={setEnableHealthCheck} />
            </div>
          }
          size="small"
          style={{ background: '#fafafa', borderRadius: 8 }}
        >
          {enableHealthCheck ? (
            <>
              <Alert
                title="后端验证规则提示"
                description="超时时间 (time_out) 必须在 2-60 秒之间；探测间隔 (interval) 必须在 2-60 秒之间；健康/不健康阈值必须在 2-10 次之间。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.List name="health_checks">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }, idx) => (
                      <Card
                        key={key}
                        size="small"
                        style={{ marginBottom: 12, background: '#fff' }}
                        title={`探活规则 #${idx + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            />
                          ) : null
                        }
                      >
                        <Row gutter={12}>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'protocol']}
                              label="协议"
                              rules={[{ required: true, message: '请选择协议' }]}
                            >
                              <Select
                                options={[
                                  { value: 'http', label: 'HTTP' },
                                  { value: 'tcp', label: 'TCP' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'port']}
                              label="端口"
                              rules={[
                                { required: true, message: '请输入端口' },
                                { type: 'number', min: 1, max: 65535, message: '端口 1-65535' },
                              ]}
                            >
                              <InputNumber style={{ width: '100%' }} placeholder="8080" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'path']}
                              label="请求路径"
                              tooltip="TCP 协议下无需填写路径"
                            >
                              <Input placeholder="/healthz" />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Row gutter={12}>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'time_out']}
                              label="响应超时 (秒)"
                              rules={[
                                { required: true, message: '请输入超时' },
                                { type: 'number', min: 2, max: 60, message: '范围 2-60 秒' },
                              ]}
                            >
                              <InputNumber style={{ width: '100%' }} min={2} max={60} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'interval']}
                              label="探测间隔 (秒)"
                              rules={[
                                { required: true, message: '请输入间隔' },
                                { type: 'number', min: 2, max: 60, message: '范围 2-60 秒' },
                              ]}
                            >
                              <InputNumber style={{ width: '100%' }} min={2} max={60} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'healthy_threshold']}
                              label="健康阈值 (次)"
                              rules={[
                                { required: true, message: '请输入阈值' },
                                { type: 'number', min: 2, max: 10, message: '范围 2-10 次' },
                              ]}
                            >
                              <InputNumber style={{ width: '100%' }} min={2} max={10} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              {...restField}
                              name={[name, 'unhealthy_threshold']}
                              label="不健康阈值 (次)"
                              rules={[
                                { required: true, message: '请输入阈值' },
                                { type: 'number', min: 2, max: 10, message: '范围 2-10 次' },
                              ]}
                            >
                              <InputNumber style={{ width: '100%' }} min={2} max={10} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button
                      type="dashed"
                      onClick={() =>
                        add({
                          protocol: 'http',
                          port: 8080,
                          path: '/healthz',
                          time_out: 2,
                          interval: 5,
                          healthy_threshold: 3,
                          unhealthy_threshold: 3,
                        })
                      }
                      block
                      icon={<PlusOutlined />}
                    >
                      新增探活规则
                    </Button>
                  </>
                )}
              </Form.List>
            </>
          ) : (
            <Text type="secondary" style={{ fontSize: 13, display: 'block', padding: '12px 0' }}>
              未开启探活检查。开启后，系统将在部署后通过 HTTP/TCP 探测主机上运行的服务状态。
            </Text>
          )}
        </Card>
      </Form>
    </Modal>
  );
};

export default PmServiceModal;
