import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../../stores/auth';

export interface PodTerminalProps {
  podName?: string;
  containerName?: string;
  projectName?: string;
  envName?: string;
  clusterId?: string;
  // 生产环境走 /api/podexec/production/ 变体（对齐旧版 isProd 分支）
  production?: boolean;
  height?: number | string;
  // 支持自定义 WS URL（例如工作流调试终端 /api/podexec/debug/...）
  customWsUrl?: string;
  welcomeMessage?: string;
}

// WS 消息协议对齐 pkg/microservice/podexec/core/service/ws_terminal.go 的 TerminalMessage：
//   客户端 → 服务端：{operation:'stdin',data} / {operation:'resize',rows,cols}
//   服务端 → 客户端：{operation:'stdout',data}
// 非 JSON 消息会被服务端直接断开（Read 中 Unmarshal 失败即 EndOfTransmission）
interface TerminalMessage {
  operation: 'stdin' | 'resize' | 'stdout' | 'heartbeat' | string;
  data?: string;
  rows?: number;
  cols?: number;
}

export const PodTerminal: React.FC<PodTerminalProps> = ({
  podName = '',
  containerName = '',
  projectName = '',
  envName = '',
  clusterId = '',
  production = false,
  height = 480,
  customWsUrl,
  welcomeMessage,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#141414',
        foreground: '#f0f0f0',
        cursor: '#0066ff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermInstance.current = term;

    if (welcomeMessage) {
      term.writeln(welcomeMessage);
    } else {
      term.writeln(`\x1b[34m[Zadig Web Terminal]\x1b[0m 正在连接 Pod: \x1b[32m${podName}\x1b[0m (Container: \x1b[36m${containerName}\x1b[0m)...`);
    }

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const prefix = production ? 'production/' : '';
    const token = useAuthStore.getState().token || '';
    const wsUrl =
      customWsUrl ||
      `${protocol}//${host}/api/podexec/${prefix}${encodeURIComponent(projectName)}/${encodeURIComponent(podName)}/${encodeURIComponent(containerName)}/podExec/${encodeURIComponent(envName)}?projectName=${encodeURIComponent(projectName)}&token=${encodeURIComponent(token)}`;

    const sendResize = (ws: WebSocket) => {
      const dims = fitAddon.proposeDimensions();
      if (dims && dims.cols > 0 && dims.rows > 0) {
        const msg: TerminalMessage = { operation: 'resize', rows: dims.rows, cols: dims.cols };
        ws.send(JSON.stringify(msg));
      }
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        // 先同步终端尺寸，再请求 bash（对齐旧版 bundle：服务端起 /bin/sh，成功时升级为 bash）
        sendResize(ws);
        const shellMsg: TerminalMessage = { operation: 'stdin', data: 'bash \r' };
        ws.send(JSON.stringify(shellMsg));
        term.writeln('\x1b[32m[Connected] 终端已就绪。\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
        // 服务端只回 {operation:'stdout',data} 的 JSON 文本帧
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as TerminalMessage;
            if (msg.operation === 'stdout' && typeof msg.data === 'string') {
              term.write(msg.data);
            }
          } catch {
            term.write(event.data);
          }
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            try {
              const msg = JSON.parse(text) as TerminalMessage;
              if (msg.operation === 'stdout' && typeof msg.data === 'string') {
                term.write(msg.data);
              }
            } catch {
              term.write(text);
            }
          });
        }
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[31m[Error] WebSocket 连接遇到错误。\x1b[0m');
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[33m[Disconnected] 终端连接已关闭。\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg: TerminalMessage = { operation: 'stdin', data };
          ws.send(JSON.stringify(msg));
        }
      });
    } catch {
      term.writeln('\r\n\x1b[31m[Error] 初始化 WebSocket 失败。\x1b[0m');
    }

    const handleResize = () => {
      fitAddon.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendResize(ws);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws) {
        ws.close();
      }
      term.dispose();
    };
  }, [podName, containerName, projectName, envName, clusterId, production]);

  return (
    <div
      style={{
        height,
        width: '100%',
        backgroundColor: '#141414',
        borderRadius: 6,
        padding: 8,
        overflow: 'hidden',
      }}
      ref={terminalRef}
    />
  );
};

export default PodTerminal;