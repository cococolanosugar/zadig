import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../../stores/auth';

export interface PodTerminalProps {
  podName: string;
  containerName: string;
  projectName: string;
  envName: string;
  clusterId?: string;
  height?: number | string;
}

export const PodTerminal: React.FC<PodTerminalProps> = ({
  podName,
  containerName,
  projectName,
  envName,
  clusterId = '',
  height = 480,
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

    term.writeln(`\x1b[34m[Zadig Web Terminal]\x1b[0m 正在连接 Pod: \x1b[32m${podName}\x1b[0m (Container: \x1b[36m${containerName}\x1b[0m)...`);

    // Build WebSocket URL
    // 后端 podexec WS: /api/podexec/:productName/:podName/:containerName/podExec/:envName
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = useAuthStore.getState().token || '';
    const wsUrl = `${protocol}//${host}/api/podexec/${encodeURIComponent(projectName)}/${encodeURIComponent(podName)}/${encodeURIComponent(containerName)}/podExec/${encodeURIComponent(envName)}?projectName=${encodeURIComponent(projectName)}&token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        term.writeln('\x1b[32m[Connected] 终端已就绪。\x1b[0m\r\n');
        // Notify window resize
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => term.write(text));
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
          ws.send(data);
        }
      });
    } catch {
      term.writeln('\r\n\x1b[31m[Error] 初始化 WebSocket 失败。\x1b[0m');
    }

    const handleResize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
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
  }, [podName, containerName, projectName, envName, clusterId]);

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
