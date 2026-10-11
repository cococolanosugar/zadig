import React, { useRef, useState, useCallback } from 'react';
import Editor, { type OnChange, type OnMount } from '@monaco-editor/react';
import { Button, Space, Tooltip, Tag, Typography } from 'antd';
import {
  CopyOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CodeOutlined,
  AlignLeftOutlined,
} from '@ant-design/icons';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
  title?: string;
}

export const YamlEditor: React.FC<YamlEditorProps> = ({
  value,
  onChange,
  height = '500px',
  readOnly = false,
  theme = 'vs-dark',
  title = 'YAML 配置编辑器',
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange: OnChange = useCallback(
    (val) => {
      if (onChange) {
        onChange(val || '');
      }
    },
    [onChange]
  );

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      feedback.message.success('YAML 文档已格式化');
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (!value) {
      feedback.message.warning('当前无内容可复制');
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => {
        feedback.message.success('已复制 YAML 配置到剪贴板');
      })
      .catch(() => {
        feedback.message.error('复制失败');
      });
  }, [value]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const isDark = theme === 'vs-dark';
  const headerBg = isDark ? '#252526' : '#fafafa';
  const headerBorder = isDark ? '#333333' : '#e2e8f0';
  const textColor = isDark ? '#d4d4d4' : '#333333';
  const btnColor = isDark ? '#d9d9d9' : '#595959';

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050,
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        height,
        width: '100%',
        border: `1px solid ${headerBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={containerStyle}>
      {/* Top Header Toolbar */}
      <div
        style={{
          height: 36,
          backgroundColor: headerBg,
          borderBottom: `1px solid ${headerBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <Space orientation="horizontal" size={8}>
          <CodeOutlined style={{ color: '#52c41a' }} />
          <Text style={{ color: textColor, fontSize: 13, fontWeight: 500 }}>{title}</Text>
          <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 6px' }}>
            YAML
          </Tag>
          {readOnly && (
            <Tag color="warning" style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 6px' }}>
              只读
            </Tag>
          )}
        </Space>

        <Space orientation="horizontal" size={4}>
          {!readOnly && (
            <Tooltip title="格式化文档 (Format)">
              <Button
                type="text"
                size="small"
                icon={<AlignLeftOutlined style={{ color: btnColor }} />}
                onClick={handleFormat}
              >
                <span style={{ color: btnColor, fontSize: 12 }}>格式化</span>
              </Button>
            </Tooltip>
          )}

          <Tooltip title="复制全部内容 (Copy)">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ color: btnColor }} />}
              onClick={handleCopy}
            >
              <span style={{ color: btnColor, fontSize: 12 }}>复制</span>
            </Button>
          </Tooltip>

          <Tooltip title={isFullscreen ? '退出全屏 (Exit Fullscreen)' : '全屏展示 (Fullscreen)'}>
            <Button
              type="text"
              size="small"
              icon={
                isFullscreen ? (
                  <FullscreenExitOutlined style={{ color: btnColor }} />
                ) : (
                  <FullscreenOutlined style={{ color: btnColor }} />
                )
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Editor Viewport */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="yaml"
          theme={theme}
          value={value}
          onChange={handleChange}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            fontSize: 13,
            wordWrap: 'on',
            automaticLayout: true,
            lineNumbers: 'on',
          }}
        />
      </div>
    </div>
  );
};

export default YamlEditor;
