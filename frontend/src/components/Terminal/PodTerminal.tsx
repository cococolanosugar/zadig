import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon, ISearchOptions } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import {
  Space,
  Button,
  Input,
  Tooltip,
  Popover,
  Tag,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  UpOutlined,
  DownOutlined,
  CloseOutlined,
  ClearOutlined,
  ReloadOutlined,
  CopyOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

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
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // 终端运行状态
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectKey, setReconnectKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 搜索相关状态
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchCount, setSearchCount] = useState(0);

  // 文件下载弹层相关状态
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadPath, setDownloadPath] = useState('');
  const [downloading, setDownloading] = useState(false);

  // 搜索装饰器配置（对齐旧版 ContainerDebug：matchBackground #fce94f, activeMatchBackground #FF4500）
  const getSearchOptions = useCallback(
    (): ISearchOptions => ({
      caseSensitive,
      wholeWord,
      regex,
      incremental: true,
      decorations: {
        matchBackground: '#fce94f',
        activeMatchBackground: '#FF4500',
        matchOverviewRuler: '#fce94f',
        activeMatchColorOverviewRuler: '#FF4500',
      },
    }),
    [caseSensitive, wholeWord, regex]
  );

  // 执行搜索查找
  const doSearch = useCallback(
    (direction: 'next' | 'prev' = 'next', keyword?: string) => {
      const term = keyword !== undefined ? keyword : searchText;
      const searchAddon = searchAddonRef.current;
      if (!searchAddon) return;

      if (!term.trim()) {
        searchAddon.clearDecorations();
        setSearchIndex(0);
        setSearchCount(0);
        return;
      }

      const options = getSearchOptions();
      if (direction === 'next') {
        searchAddon.findNext(term, options);
      } else {
        searchAddon.findPrevious(term, options);
      }
    },
    [searchText, getSearchOptions]
  );

  // 切换搜索选项时自动重新高亮
  useEffect(() => {
    if (searchOpen && searchText.trim()) {
      doSearch('next');
    }
  }, [searchOpen, searchText, caseSensitive, wholeWord, regex, doSearch]);

  // 初始化 Terminal 与 WebSocket 连接
  useEffect(() => {
    if (!terminalRef.current) return;

    setStatus('connecting');

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
    fitAddonRef.current = fitAddon;

    const searchAddon = new SearchAddon({
      highlightLimit: 1000,
    });
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // 监听搜索匹配数量与索引变更
    searchAddon.onDidChangeResults((e) => {
      if (e) {
        setSearchIndex(e.resultIndex);
        setSearchCount(e.resultCount);
      } else {
        setSearchIndex(0);
        setSearchCount(0);
      }
    });

    term.open(terminalRef.current);
    fitAddon.fit();
    xtermInstance.current = term;

    if (welcomeMessage) {
      term.writeln(welcomeMessage);
    } else {
      term.writeln(
        `\x1b[34m[Zadig Web Terminal]\x1b[0m 正在连接 Pod: \x1b[32m${podName || 'pod'}\x1b[0m (Container: \x1b[36m${containerName || 'default'}\x1b[0m)...`
      );
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
        setStatus('connected');
        sendResize(ws);
        const shellMsg: TerminalMessage = { operation: 'stdin', data: 'bash \r' };
        ws.send(JSON.stringify(shellMsg));
        term.writeln('\x1b[32m[Connected] 终端已就绪。\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
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
        setStatus('disconnected');
        term.writeln('\r\n\x1b[31m[Error] WebSocket 连接遇到错误。\x1b[0m');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        term.writeln('\r\n\x1b[33m[Disconnected] 终端连接已关闭。\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg: TerminalMessage = { operation: 'stdin', data };
          ws.send(JSON.stringify(msg));
        }
      });
    } catch {
      setStatus('disconnected');
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
      xtermInstance.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [podName, containerName, projectName, envName, clusterId, production, customWsUrl, welcomeMessage, reconnectKey]);

  // 全屏切换处理
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      setTimeout(() => {
        fitAddonRef.current?.fit();
        const ws = socketRef.current;
        const dims = fitAddonRef.current?.proposeDimensions();
        if (ws && ws.readyState === WebSocket.OPEN && dims && dims.cols > 0 && dims.rows > 0) {
          ws.send(JSON.stringify({ operation: 'resize', rows: dims.rows, cols: dims.cols }));
        }
      }, 100);
      return next;
    });
  };

  // 支持键盘 Esc 退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 1. 清屏 (term.clear)
  const handleClearScreen = () => {
    xtermInstance.current?.clear();
  };

  // 2. 置顶 / 置底 (scrollToTop / scrollToBottom)
  const handleScrollTop = () => {
    xtermInstance.current?.scrollToTop();
  };

  const handleScrollBottom = () => {
    xtermInstance.current?.scrollToBottom();
  };

  // 3. 复制选中文本 (term.getSelection)
  const handleCopySelection = async () => {
    const selected = xtermInstance.current?.getSelection();
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
        feedback.message.success('已复制所选终端文本');
      } catch {
        feedback.message.error('复制失败，请手动按 Ctrl+C / Cmd+C');
      }
    } else {
      feedback.message.info('请先用鼠标在终端中划选要复制的内容');
    }
  };

  // 4. 重连终端
  const handleReconnect = () => {
    setReconnectKey((k) => k + 1);
  };

  // 5. 容器文件下载 (契约: GET /api/aslan/environment/kube/pods/:podName/file?projectName=&envName=&container=&path=&production=)
  const handleDownloadFile = async () => {
    const trimmedPath = downloadPath.trim();
    if (!trimmedPath) return;
    if (!podName || !projectName || !envName) {
      feedback.message.warning('缺少 Pod、项目或环境上下文，无法定位文件');
      return;
    }

    setDownloading(true);
    try {
      const token = useAuthStore.getState().token || '';
      const params = new URLSearchParams({
        projectName,
        envName,
        container: containerName || podName,
        path: trimmedPath,
        production: production ? 'true' : 'false',
      });
      const url = `/api/aslan/environment/kube/pods/${encodeURIComponent(podName)}/file?${params.toString()}`;

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        let errMsg = `下载失败 (HTTP ${res.status})`;
        try {
          const errData = await res.json();
          errMsg = errData.message || errData.description || errMsg;
        } catch {
          // ignore non-json
        }
        throw new Error(errMsg);
      }

      // 获取文件名
      let fileName = trimmedPath.split('/').filter(Boolean).pop() || 'download';
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileName = decodeURIComponent(match[1]);
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      feedback.message.success(`文件 [${fileName}] 下载成功`);
      setDownloadOpen(false);
      setDownloadPath('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下载容器文件失败';
      feedback.message.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2000,
        backgroundColor: '#141414',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        height,
        width: '100%',
        backgroundColor: '#141414',
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={containerStyle}>
      {/* Terminal Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: '#1f1f1f',
          borderBottom: '1px solid #2d2d2d',
          userSelect: 'none',
          gap: 12,
        }}
      >
        {/* Left: Pod & Container Info & Connection Status */}
        <Space orientation="horizontal" size="small" style={{ overflow: 'hidden', flexShrink: 0 }}>
          <CodeOutlined style={{ color: '#0066ff' }} />
          <Text strong style={{ color: '#e6e6e6', fontSize: 12 }}>
            {podName || 'Pod Terminal'}
          </Text>
          {containerName && (
            <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
              {containerName}
            </Tag>
          )}
          {production && (
            <Tag color="error" style={{ margin: 0, fontSize: 11 }}>
              生产环境
            </Tag>
          )}
          <Tag
            color={status === 'connected' ? 'success' : status === 'connecting' ? 'processing' : 'default'}
            style={{ margin: 0, fontSize: 11 }}
          >
            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中...' : '已断开'}
          </Tag>
        </Space>

        {/* Center / Search Bar Area */}
        {searchOpen ? (
          <Space orientation="horizontal" size={4} style={{ flex: 1, maxWidth: 440, justifyContent: 'center' }}>
            <Input
              size="small"
              placeholder="搜索终端内容 (Enter 下一个, Shift+Enter 上一个)"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                doSearch('next', e.target.value);
              }}
              onPressEnter={(e) => {
                if (e.shiftKey) {
                  doSearch('prev');
                } else {
                  doSearch('next');
                }
              }}
              suffix={
                searchText.trim() ? (
                  <Tag color="default" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                    {searchCount > 0 ? `${searchIndex + 1}/${searchCount}` : '0/0'}
                  </Tag>
                ) : null
              }
              style={{ width: 240, backgroundColor: '#141414', borderColor: '#3a3a3a', color: '#fff' }}
              autoFocus
            />
            <Tooltip title="上一个匹配 (Shift+Enter)">
              <Button
                type="text"
                size="small"
                icon={<UpOutlined style={{ color: '#d9d9d9' }} />}
                disabled={!searchText.trim()}
                onClick={() => doSearch('prev')}
              />
            </Tooltip>
            <Tooltip title="下一个匹配 (Enter)">
              <Button
                type="text"
                size="small"
                icon={<DownOutlined style={{ color: '#d9d9d9' }} />}
                disabled={!searchText.trim()}
                onClick={() => doSearch('next')}
              />
            </Tooltip>
            <Tooltip title="区分大小写 (Case Sensitive)">
              <Button
                type={caseSensitive ? 'primary' : 'text'}
                size="small"
                onClick={() => setCaseSensitive(!caseSensitive)}
                style={{ fontSize: 11, minWidth: 28, padding: '0 4px' }}
              >
                Aa
              </Button>
            </Tooltip>
            <Tooltip title="全词匹配 (Whole Word)">
              <Button
                type={wholeWord ? 'primary' : 'text'}
                size="small"
                onClick={() => setWholeWord(!wholeWord)}
                style={{ fontSize: 11, minWidth: 28, padding: '0 4px' }}
              >
                \b
              </Button>
            </Tooltip>
            <Tooltip title="正则表达式 (Regex)">
              <Button
                type={regex ? 'primary' : 'text'}
                size="small"
                onClick={() => setRegex(!regex)}
                style={{ fontSize: 11, minWidth: 28, padding: '0 4px' }}
              >
                .*
              </Button>
            </Tooltip>
            <Tooltip title="关闭搜索">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ color: '#bfbfbf' }} />}
                onClick={() => {
                  setSearchOpen(false);
                  setSearchText('');
                  searchAddonRef.current?.clearDecorations();
                }}
              />
            </Tooltip>
          </Space>
        ) : null}

        {/* Right: Actions Toolbar */}
        <Space orientation="horizontal" size={4} style={{ flexShrink: 0 }}>
          {!searchOpen && (
            <Tooltip title="搜索终端输出 (Search)">
              <Button
                type="text"
                size="small"
                icon={<SearchOutlined style={{ color: '#d9d9d9' }} />}
                onClick={() => setSearchOpen(true)}
              />
            </Tooltip>
          )}

          <Tooltip title="清空屏幕 (Clear)">
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleClearScreen}
            />
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

          <Tooltip title="复制选中文本 (Copy)">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleCopySelection}
            />
          </Tooltip>

          <Tooltip title="重新连接终端 (Reconnect)">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined style={{ color: '#d9d9d9' }} />}
              onClick={handleReconnect}
            />
          </Tooltip>

          {/* Download File Popover */}
          <Popover
            open={downloadOpen}
            onOpenChange={setDownloadOpen}
            trigger="click"
            placement="bottomRight"
            title={
              <Space>
                <DownloadOutlined style={{ color: '#0066ff' }} />
                <span>下载容器文件</span>
              </Space>
            }
            content={
              <div style={{ width: 340, padding: '4px 0' }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  输入要从容器 [{containerName || 'default'}] 中下载的文件绝对路径：
                </Text>
                <Input
                  placeholder="例如: /etc/hostname 或 /var/log/app.log"
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  onPressEnter={handleDownloadFile}
                  disabled={downloading}
                  style={{ marginBottom: 12 }}
                  allowClear
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button size="small" onClick={() => setDownloadOpen(false)}>
                    取消
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<DownloadOutlined />}
                    loading={downloading}
                    disabled={!downloadPath.trim()}
                    onClick={handleDownloadFile}
                  >
                    确认下载
                  </Button>
                </div>
              </div>
            }
          >
            <Tooltip title="下载容器文件 (Download File)">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined style={{ color: '#d9d9d9' }} />}
              />
            </Tooltip>
          </Popover>

          <Tooltip title={isFullscreen ? '退出全屏 (Esc)' : '全屏终端'}>
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
          width: '100%',
          backgroundColor: '#141414',
          padding: 8,
          overflow: 'hidden',
        }}
        ref={terminalRef}
      />
    </div>
  );
};

export default PodTerminal;