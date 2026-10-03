import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  Typography,
  Space,
  Button,
  Input,
  Tag,
  Alert,
  Spin,
  Card,
  Divider,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  BulbOutlined,
  WarningOutlined,
  ClearOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import statApi, { type AiAnalysisResp } from '../../api/stat';
import { feedback } from '../../utils/feedback';

const { Text, Paragraph } = Typography;

export interface AiAnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName?: string;
  defaultProject?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: number;
  tokenNum?: number;
  isError?: boolean;
}

const DEFAULT_FALLBACK_PROMPTS = [
  '分析近一个月的构建与部署整体表现，评估质量与交付效率并给出优化建议。',
  '根据最近一个月的构建成功率与失败率变化，分析项目的发展趋势与潜在风险。',
  '通过历史测试与部署数据，分析目前流水线交付的最大短板并提供解决措施。',
  '对比分析构建频次与部署耗时，识别耗时较长、失败频次高的瓶颈环节。',
];

const MOCK_AI_REPORT = `### 🎯 Zadig DevOps 效能与质量分析简报

根据平台近 30 天的交付数据综合评估，以下是项目构建、部署与测试效能的多维度洞察结论：

1. **项目质量与稳定性**
   - **测试通过率**：近期自动化测试执行稳定，平均通过率保持在 **94.2%**，但在主干合并阶段偶发集成测试超时。
   - **回滚与失败率**：过去 30 天内共记录 **2 次** 生产/测试环境服务回滚，主要原因为配置中心变量漂移与外部数据库超时。

2. **交付效率与耗时分析**
   - **平均构建耗时**：核心服务平均构建耗时由月初的 **186 秒** 优化至 **132 秒**，得益于 Docker 缓存层优化；
   - **部署频次**：日均部署 **8.4 次**，交付节奏平稳，主要集中在工作日下午 14:00~17:00。

3. **专家优化建议**
   - **构建加速**：针对耗时 Top 3 的模块引入 Kaniko / 共享存储缓存，预计可再缩短 25% 耗时；
   - **质量左移**：建议在 Pull Request 触发工作流中增加单元测试阻断阈值，避免缺陷流向预发环境；
   - **告警协同**：在系统设置中启用工作流 Webhook 与钉钉/企业微信群通知，提升异常排错响应速度。`;

export const AiAnalysisDrawer: React.FC<AiAnalysisDrawerProps> = ({
  open,
  onClose,
  projectName,
  defaultProject,
}) => {
  const activeProject = projectName || (defaultProject ? defaultProject : undefined);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [llmErrorDetected, setLlmErrorDetected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadPrompts();
      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `你好！我是 Zadig 效能与质量 AI 专家分析助手。我可以结合系统中的构建、测试、部署、回滚统计数据，为你生成智能分析与优化建议。${
              activeProject ? `当前分析作用域：【${activeProject}】。` : ''
            }`,
            time: Date.now(),
          },
        ]);
      }
    }
  }, [open, activeProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, analyzing]);

  const loadPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const res = await statApi.getAiAnalysisPrompts();
      if (res && Array.isArray(res.prompts) && res.prompts.length > 0) {
        setPrompts(res.prompts);
      } else {
        setPrompts(DEFAULT_FALLBACK_PROMPTS);
      }
    } catch {
      setPrompts(DEFAULT_FALLBACK_PROMPTS);
    } finally {
      setLoadingPrompts(false);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || analyzing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      time: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setAnalyzing(true);
    setLlmErrorDetected(false);

    try {
      const now = Math.floor(Date.now() / 1000);
      const res: AiAnalysisResp = await statApi.getAiAnalysis({
        prompt: textToSend,
        project_list: activeProject ? [activeProject] : [],
        start_time: now - 30 * 86400,
        end_time: now,
      });

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.answer || '未能从大模型获取到有效分析结论。',
        time: Date.now(),
        tokenNum: res.token_num,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setLlmErrorDetected(true);
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        '请求大模型分析失败';

      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `【AI 分析未完成】后端服务返回：${errMsg}。\n\n提示：本功能依赖系统集成的 LLM 大模型服务（如 OpenAI、DeepSeek、通义千问等）。若当前环境未配置大模型或秘钥已失效，请联系管理员在「系统设置 → 系统集成」中配置 AI 模型。`,
        time: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectPrompt = (promptText: string) => {
    let resolved = promptText;
    if (resolved.includes('%s')) {
      resolved = resolved.replace('%s', projectName || '当前');
    }
    handleSend(resolved);
  };

  const handleApplyMockReport = () => {
    const mockMsg: ChatMessage = {
      id: `mock-${Date.now()}`,
      role: 'assistant',
      content: MOCK_AI_REPORT,
      time: Date.now(),
      tokenNum: 768,
    };
    setMessages((prev) => [...prev, mockMsg]);
    feedback.message.success('已展示模拟效能分析报告');
  };

  const handleClearMessages = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `你好！我是 Zadig 效能与质量 AI 专家分析助手。已清空历史对话。`,
        time: Date.now(),
      },
    ]);
  };

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#722ed1', fontSize: 18 }} />
          <span>AI 效能洞察与质量分析助手</span>
          {projectName && <Tag color="blue">{projectName}</Tag>}
        </Space>
      }
      placement="right"
      size="large"
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClearMessages}
            disabled={messages.length <= 1}
          >
            清空对话
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Prompts Recommendation area */}
        <div style={{ marginBottom: 16 }}>
          <Space align="center" style={{ marginBottom: 8 }}>
            <BulbOutlined style={{ color: '#faad14' }} />
            <Text strong style={{ fontSize: 13 }}>
              推荐分析问题
            </Text>
            {loadingPrompts && <Spin size="small" />}
          </Space>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {prompts.map((p, idx) => {
              const display = p.replace(/%s/g, projectName || '当前');
              return (
                <Tag
                  key={idx}
                  color="purple"
                  style={{
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    maxWidth: '100%',
                    whiteSpace: 'normal',
                    lineHeight: '18px',
                  }}
                  onClick={() => !analyzing && handleSelectPrompt(p)}
                >
                  {display}
                </Tag>
              );
            })}
          </div>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* Message scroll container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Card
                size="small"
                variant="borderless"
                style={{
                  maxWidth: '88%',
                  backgroundColor: m.role === 'user' ? '#1677ff' : m.isError ? '#fff2f0' : '#f9f0ff',
                  borderColor: m.isError ? '#ffccc7' : 'transparent',
                  borderRadius: 8,
                  color: m.role === 'user' ? '#fff' : '#1f2d3d',
                }}
                styles={{
                  body: {
                    padding: '10px 14px',
                    color: m.role === 'user' ? '#fff' : 'inherit',
                  },
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                  {m.role === 'assistant' ? (
                    m.isError ? (
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                    ) : (
                      <RobotOutlined style={{ color: '#722ed1' }} />
                    )
                  ) : null}
                  <Text
                    style={{
                      fontSize: 11,
                      color: m.role === 'user' ? 'rgba(255,255,255,0.85)' : '#8c8c8c',
                    }}
                  >
                    {m.role === 'user' ? '我的提问' : 'Zadig AI DevOps 专家'}
                  </Text>
                  {m.tokenNum && (
                    <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
                      Tokens: {m.tokenNum}
                    </Tag>
                  )}
                </div>
                <Paragraph
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    color: m.role === 'user' ? '#fff' : 'inherit',
                    fontSize: 13,
                    lineHeight: '22px',
                  }}
                >
                  {m.content}
                </Paragraph>
              </Card>
            </div>
          ))}

          {analyzing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Card
                size="small"
                variant="borderless"
                style={{ backgroundColor: '#f9f0ff', borderRadius: 8 }}
                styles={{ body: { padding: '10px 14px' } }}
              >
                <Space>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    AI 正在综合构建、部署、测试指标进行深度分析与推理，请稍候...
                  </Text>
                </Space>
              </Card>
            </div>
          )}

          {llmErrorDetected && (
            <Alert
              title="大模型集成前置提示"
              description={
                <div>
                  <div>当前环境尚未集成默认大模型服务或 API 请求被拦截。您可以点击下方按钮查看标准 DevOps 效能分析报告样例：</div>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginTop: 4 }}
                    onClick={handleApplyMockReport}
                  >
                    查看模拟分析效果
                  </Button>
                </div>
              }
              type="warning"
              showIcon
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ marginTop: 16 }}>
          <Input.TextArea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入你对项目构建、部署、测试效能的分析需求（按 Enter 发送，Shift+Enter 换行）..."
            rows={3}
            disabled={analyzing}
            style={{ borderRadius: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Space size={4}>
              <InfoCircleOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                基于 /api/aslan/stat/v2/ai/analysis 契约驱动
              </Text>
            </Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={analyzing}
              disabled={!inputPrompt.trim()}
              onClick={() => handleSend()}
              style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
            >
              发送分析
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default AiAnalysisDrawer;
