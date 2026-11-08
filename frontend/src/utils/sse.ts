import { useAuthStore } from '../stores/auth';

export interface SSEOptions<T = unknown> {
  onMessage: (data: T) => void;
  onError?: (err: unknown) => void;
  /** 服务端正常结束流（reader done）时回调；不触发重连 */
  onComplete?: () => void;
  autoReconnect?: boolean; // 默认 true：流中断后自动重连
  maxRetries?: number;     // 最大重试次数，默认 5
  retryDelayMs?: number;   // 初始重试延迟，默认 1000ms
}

// 指数退避上限（1s -> 2s -> 4s -> 8s -> 10s 封顶）
const MAX_RETRY_DELAY_MS = 10_000;

/**
 * Standard SSE subscriber using fetch + ReadableStream, supporting Authorization Bearer Token
 * and proper cleanup via AbortController on component unmount.
 *
 * P1-S1 韧性增强：
 * - 网络报错/流中断（非用户主动 cleanup/abort）时按指数退避自动重建 fetch 流连接；
 * - 重试超过 maxRetries 触发 onError 并终止；
 * - 返回的清理函数具备最高优先级：立即标记销毁、清除待触发重连定时器并 abort，防止内存泄漏。
 */
export function subscribeSSE<T = unknown>(url: string, options: SSEOptions<T>): () => void {
  const controller = new AbortController();
  const token = useAuthStore.getState().token || '';

  const autoReconnect = options.autoReconnect !== false;
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.retryDelayMs ?? 1000;

  let isDestroyed = false; // 用户主动清理标记（最高优先级）
  let retryCount = 0;
  let currentDelay = baseDelayMs;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleReconnect = (err: unknown) => {
    // 用户已主动清理：绝不重连
    if (isDestroyed || controller.signal.aborted) return;
    if (!autoReconnect) {
      options.onError?.(err);
      return;
    }
    if (retryCount >= maxRetries) {
      options.onError?.(err);
      return;
    }
    retryCount += 1;
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (isDestroyed || controller.signal.aborted) return;
      connect();
    }, currentDelay);
    // 指数退避：1s -> 2s -> 4s -> 8s，上限 10s
    currentDelay = Math.min(currentDelay * 2, MAX_RETRY_DELAY_MS);
  };

  const connect = () => {
    if (isDestroyed) return;
    fetch(url, {
      headers,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`SSE HTTP error! status: ${res.status}`);
        }
        if (!res.body) return;

        // 连接成功即重置退避状态（对齐"健康后恢复初始延迟"语义）
        retryCount = 0;
        currentDelay = baseDelayMs;

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are delimited by double newlines
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr) {
                  try {
                    const parsed = JSON.parse(dataStr);
                    options.onMessage(parsed);
                  } catch {
                    options.onMessage(dataStr as unknown as T);
                  }
                }
              }
            }
          }
        }
        // LOOP4-B1: 服务端正常关流（done=true）视为成功结束，不重连
        if (!isDestroyed && !controller.signal.aborted) {
          options.onComplete?.();
        }
      })
      .catch((err) => {
        // 用户主动 abort：静默退出，不触发 onError / 重连
        if (isDestroyed || controller.signal.aborted) return;
        scheduleReconnect(err);
      });
  };

  connect();

  return () => {
    // 清理函数最高优先级：标记销毁 -> 清除待触发重连定时器 -> 立即 abort
    isDestroyed = true;
    clearRetryTimer();
    controller.abort();
  };
}

export default subscribeSSE;
