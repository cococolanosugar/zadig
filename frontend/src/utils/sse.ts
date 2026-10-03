import { useAuthStore } from '../stores/auth';

export interface SSEOptions<T = unknown> {
  onMessage: (data: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Standard SSE subscriber using fetch + ReadableStream, supporting Authorization Bearer Token
 * and proper cleanup via AbortController on component unmount.
 */
export function subscribeSSE<T = unknown>(url: string, options: SSEOptions<T>): () => void {
  const controller = new AbortController();
  const token = useAuthStore.getState().token || '';

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetch(url, {
    headers,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`SSE HTTP error! status: ${res.status}`);
      }
      if (!res.body) return;

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
    })
    .catch((err) => {
      if (controller.signal.aborted) return;
      options.onError?.(err);
    });

  return () => {
    controller.abort();
  };
}

export default subscribeSSE;
