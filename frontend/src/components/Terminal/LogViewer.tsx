import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface LogViewerProps {
  logs?: string[];
  streamUrl?: string;
  height?: number | string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  logs = [],
  streamUrl,
  height = 420,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.2,
      scrollback: 10000,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermInstance.current = term;

    if (logs.length > 0) {
      logs.forEach((line) => term.writeln(line));
    }

    let eventSource: EventSource | null = null;
    if (streamUrl) {
      try {
        eventSource = new EventSource(streamUrl);
        eventSource.onmessage = (event) => {
          term.writeln(event.data);
        };
        eventSource.onerror = () => {
          term.writeln('\r\n\x1b[33m[Stream Ended]\x1b[0m');
          eventSource?.close();
        };
      } catch {
        term.writeln('\x1b[31m[Error] 无法启动日志流监听\x1b[0m');
      }
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (eventSource) {
        eventSource.close();
      }
      term.dispose();
    };
  }, [logs, streamUrl]);

  return (
    <div
      style={{
        height,
        width: '100%',
        backgroundColor: '#1e1e1e',
        borderRadius: 6,
        padding: 8,
        overflow: 'hidden',
      }}
      ref={terminalRef}
    />
  );
};

export default LogViewer;
