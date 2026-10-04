import React, { useState, useEffect } from 'react';
import {
  Modal,
  Alert,
  Spin,
  Typography,
  Space,
  Button,
  Tabs,
  Form,
  Input,
  Tag,
  Divider,
} from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { workflowApi } from '../../api/workflow';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

export interface ManualExecModalProps {
  open: boolean;
  stageName: string;
  workflowName: string;
  taskId: number | string;
  projectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualExecModal: React.FC<ManualExecModalProps> = ({
  open,
  stageName,
  workflowName,
  taskId,
  projectName,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stageInfo, setStageInfo] = useState<{
    name: string;
    modifyParams: boolean;
    jobs: Array<Record<string, unknown>>;
  } | null>(null);
  const [activeJobKey, setActiveJobKey] = useState<string>('0');
  const [editableJobs, setEditableJobs] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!open || !stageName || !workflowName || !taskId) return;
    setLoading(true);
    workflowApi
      .getManualExecTaskInfo(workflowName, taskId, projectName, stageName)
      .then((res: Record<string, unknown>) => {
        const stages = (res?.stages as Array<Record<string, unknown>>) || [];
        const targetStage = stages.find((s) => s.name === stageName) || stages[0];
        if (targetStage) {
          const rawJobs = (targetStage.jobs as Array<Record<string, unknown>>) || [];
          const manualExec = targetStage.manual_exec as Record<string, unknown> | undefined;
          const canModify = Boolean(manualExec?.modify_params);
          setStageInfo({
            name: (targetStage.name as string) || stageName,
            modifyParams: canModify,
            jobs: rawJobs,
          });
          setEditableJobs(JSON.parse(JSON.stringify(rawJobs)));
          setActiveJobKey('0');
        } else {
          setStageInfo({
            name: stageName,
            modifyParams: false,
            jobs: [],
          });
          setEditableJobs([]);
        }
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          '获取手动执行阶段信息失败';
        feedback.message.error(msg);
      })
      .finally(() => setLoading(false));
  }, [open, stageName, workflowName, taskId, projectName]);

  const handleUpdateJobSpec = (jobIndex: number, field: string, value: unknown) => {
    setEditableJobs((prev) => {
      const next = [...prev];
      const job = { ...next[jobIndex] };
      const spec = { ...((job.spec as Record<string, unknown>) || {}) };
      spec[field] = value;
      job.spec = spec;
      next[jobIndex] = job;
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await workflowApi.manualExecWorkflowTask(
        workflowName,
        taskId,
        stageName,
        { jobs: editableJobs },
        projectName
      );
      feedback.message.success(`阶段 [${stageName}] 已手动触发继续执行！`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; description?: string } } })?.response?.data
          ?.description ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '手动执行触发失败';
      feedback.message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space orientation="horizontal">
          <ThunderboltOutlined style={{ color: '#fa8c16' }} />
          <span>手动执行确认 - 阶段 [{stageName}]</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={submitting}
          disabled={loading}
          onClick={handleSubmit}
        >
          确认执行
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Spin description="正在拉取阶段待执行信息..." />
        </div>
      ) : (
        <div>
          {stageInfo?.modifyParams ? (
            <Alert
              title="该阶段已开启参数修改"
              description="手动执行该阶段前，支持针对各个任务重新输入或微调运行参数（如构建分支、镜像地址、发布环境等）。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Alert
              title="准备继续执行阶段"
              description="该阶段未开启参数修改，点击下方「确认执行」按钮将直接按原定配置继续运行。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {editableJobs.length === 0 ? (
            <Paragraph type="secondary">该阶段未包含任何待执行的 Job 任务。</Paragraph>
          ) : stageInfo?.modifyParams ? (
            <Tabs
              activeKey={activeJobKey}
              onChange={setActiveJobKey}
              items={editableJobs.map((job, idx) => {
                const jobName = (job.name as string) || `Job-${idx + 1}`;
                const jobType = (job.type as string) || 'unknown';
                const spec = (job.spec as Record<string, unknown>) || {};

                return {
                  key: String(idx),
                  label: (
                    <Space size={4}>
                      <span>{jobName}</span>
                      <Tag color="blue">{jobType}</Tag>
                    </Space>
                  ),
                  children: (
                    <Form layout="vertical" style={{ marginTop: 8 }}>
                      <Form.Item label="任务名称">
                        <Input value={jobName} disabled />
                      </Form.Item>

                      {jobType === 'zadig-build' && (
                        <>
                          <Form.Item label="构建服务">
                            <Input
                              value={(spec.service_name as string) || ''}
                              onChange={(e) => handleUpdateJobSpec(idx, 'service_name', e.target.value)}
                              placeholder="目标服务名称"
                            />
                          </Form.Item>
                          <Form.Item label="代码分支 (Branch)">
                            <Input
                              value={(spec.branch as string) || ''}
                              onChange={(e) => handleUpdateJobSpec(idx, 'branch', e.target.value)}
                              placeholder="例如: main 或 feat/branch"
                            />
                          </Form.Item>
                        </>
                      )}

                      {(jobType === 'zadig-deploy' || jobType === 'zadig-vm-deploy') && (
                        <>
                          <Form.Item label="部署目标环境">
                            <Input
                              value={(spec.env as string) || ''}
                              onChange={(e) => handleUpdateJobSpec(idx, 'env', e.target.value)}
                              placeholder="例如: dev, qa, prod"
                            />
                          </Form.Item>
                          <Form.Item label="部署镜像地址 (Image)">
                            <Input
                              value={(spec.image as string) || ''}
                              onChange={(e) => handleUpdateJobSpec(idx, 'image', e.target.value)}
                              placeholder="例如: ccr.ccs.tencentyun.com/ns/service:tag"
                            />
                          </Form.Item>
                        </>
                      )}

                      {jobType === 'zadig-helm-chart-deploy' && (
                        <Form.Item label="目标环境">
                          <Input
                            value={(spec.env as string) || ''}
                            onChange={(e) => handleUpdateJobSpec(idx, 'env', e.target.value)}
                            placeholder="例如: dev, qa"
                          />
                        </Form.Item>
                      )}

                      {jobType === 'freestyle' && (
                        <Form.Item label="自定义 Shell 脚本指令">
                          <Input.TextArea
                            rows={4}
                            value={(spec.script as string) || ''}
                            onChange={(e) => handleUpdateJobSpec(idx, 'script', e.target.value)}
                            placeholder="#!/bin/bash\necho 'hello'"
                          />
                        </Form.Item>
                      )}

                      {/* 变量覆盖或 JSON 扩展字段编辑 */}
                      <Form.Item label="高级参数 Spec (JSON 格式查看/微调)">
                        <Input.TextArea
                          rows={4}
                          value={JSON.stringify(spec, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setEditableJobs((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], spec: parsed };
                                return next;
                              });
                            } catch {
                              // 用户输入中的语法暂不阻断，由失焦处理
                            }
                          }}
                        />
                      </Form.Item>
                    </Form>
                  ),
                };
              })}
            />
          ) : (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                阶段待执行任务清单 ({editableJobs.length}):
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editableJobs.map((job, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#fff',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <Space orientation="horizontal">
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <Text strong>{(job.name as string) || `Job-${idx + 1}`}</Text>
                      <Tag color="cyan">{(job.type as string) || 'general'}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      就绪状态
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Divider style={{ margin: '16px 0 8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 手动执行将向后端发送该阶段待执行的 Job 清单，恢复工作流调度器运行。
          </Text>
        </div>
      )}
    </Modal>
  );
};
