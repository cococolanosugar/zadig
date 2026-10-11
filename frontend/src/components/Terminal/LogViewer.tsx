import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button, Space, Tooltip, Switch, Typography, Tag } from 'antd';
import {
  ClearOutlined,
  CopyOutlined,
  DownloadOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { subscribeSSE } from '../../utils/sse';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface LogViewerProps {
  logs?: string[];
  streamUrl?: string;
  height?: number | string;
  title?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  logs = [],
  streamUrl,
  height = 420,
  title = '实时控制台日志',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const rawLogsBufferRef = useRef<string[]>([]);

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const autoScrollRef = useRef<boolean>(true);
  autoScrollRef.current = autoScroll;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lineCount, setLineCount] = useState<number>(0);

  const handleClear = useCallback(() => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      rawLogsBufferRef.current = [];
      setLineCount(0);
      feedback.message.success('控制台日志已清空');
    }
  }, []);

  const handleScrollTop = useCallback(() => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToTop();
    }
  }, []);

  const handleScrollBottom = useCallback(() => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToBottom();
    }
  }, []);

  const handleCopy = useCallback(() => {
    const text = rawLogsBufferRef.current.join('\n');
    if (!text.trim()) {
      feedback.message.warning('当前无日志内容可复制');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      feedback.message.success('已复制全部日志内容到剪贴板');
    }).catch(() => {
      feedback.message.error('复制日志到剪贴板失败');
    });
  }, []);

  const handleDownload = useCallback(() => {
    const text = rawLogsBufferRef.current.join('\n');
    if (!text.trim()) {
      feedback.message.warning('当前无日志内容可下载');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-log-${dayjs().format('YYYYMMDD-HHmmss')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    feedback.message.success('日志文件下载已触发');
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
  }, []);

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
    fitAddonRef.current = fitAddon;

    rawLogsBufferRef.current = [];
    if (logs.length > 0) {
      logs.forEach((line) => {
        term.writeln(line);
        rawLogsBufferRef.current.push(line);
      });
      setLineCount(logs.length);
      if (autoScrollRef.current) {
        term.scrollToBottom();
      }
    }

    let unsubscribe: (() => void) | null = null;
    if (streamUrl) {
      try {
        unsubscribe = subscribeSSE<string | { message?: string }>(streamUrl, {
          onMessage: (data) => {
            let lineStr = '';
            if (typeof data === 'string') {
              lineStr = data;
            } else if (data && typeof data === 'object' && 'message' in data) {
              lineStr = String((data as { message?: string }).message || '');
            } else {
              lineStr = JSON.stringify(data);
            }
            term.writeln(lineStr);
            rawLogsBufferRef.current.push(lineStr);
            setLineCount((prev) => prev + 1);
            if (autoScrollRef.current) {
              term.scrollToBottom();
            }
          },
          onError: () => {
            term.writeln('\r\n\x1b[33m[日志流已结束]\x1b[0m');
          },
        });
      } catch {
        term.writeln('\x1b[31m[Error] 无法建立 SSE 实时日志流连接\x1b[0m');
      }
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribe) {
        unsubscribe();
      }
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
    };
  }, [logs, streamUrl]);

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050,
        backgroundColor: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        height,
        width: '100%',
        backgroundColor: '#1e1e1e',
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333333',
      };

  return (
    <div style={containerStyle}>
      {/* Top Toolbar */}
      <div
        style={{
          height: 36,
          backgroundColor: '#252526',
          borderBottom: '1px solid #333333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <Space orientation="horizontal" size={8}>
          <FileTextOutlined style={{ color: '#0066ff' }} />
          <Text style={{ color: '#cccccc', fontSize: 13, fontWeight: 500 }}>{title}</Text>
          {lineCount > 0 && (
            <Tag color="default" style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
              {lineCount} 行
            </Tag>
          )}
        </Space>

        <Space orientation="horizontal" size={4}>
          <Tooltip title={autoScroll ? '点击关闭自动滚动' : '点击开启自动滚动'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>
              <Switch
                size="small"
                checked={autoScroll}
                onChange={setAutoScroll}
                checkedChildren="自动滚屏"
                unCheckedChildren="暂停滚动"
              />
            </span>
          </Tooltip>

          <Tooltip title="跳转至顶部 (Scroll to Top)">
            <Button
              type="text"
              size="small"
              icon={<VerticalAlignTopOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleScrollTop}
            />
          </Tooltip>

          <Tooltip title="跳转至底部 (Scroll to Bottom)">
            <Button
              type="text"
              size="small"
              icon={<VerticalAlignBottomOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleScrollBottom}
            />
          </Tooltip>

          <Tooltip title="清空日志 (Clear)">
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleClear}
            />
          </Tooltip>

          <Tooltip title="复制全部日志 (Copy All)">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleCopy}
            />
          </Tooltip>

          <Tooltip title="下载日志文件 (Download)">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleDownload}
            />
          </Tooltip>

          <Tooltip title={isFullscreen ? '退出全屏 (Exit Fullscreen)' : '全屏展示 (Fullscreen)'}>
            <Button
              type="text"
              size="small"
              icon={
                isFullscreen ? (
                  <FullscreenExitOutlined style={{ color: '#d9d9d9' }} />
                ) : (
                  <FullscreenOutlined style={{ color: '#d9d9d9' }} />
                )
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Terminal Viewport */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 8,
          overflow: 'hidden',
          backgroundColor: '#1e1e1e',
        }}
        ref={terminalRef}
      />
    </div>
  );
};

export default LogViewer;
