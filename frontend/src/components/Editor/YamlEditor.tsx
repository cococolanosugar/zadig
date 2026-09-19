import React from 'react';
import Editor, { type OnChange } from '@monaco-editor/react';

export interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
}

export const YamlEditor: React.FC<YamlEditorProps> = ({
  value,
  onChange,
  height = '500px',
  readOnly = false,
  theme = 'vs-dark',
}) => {
  const handleChange: OnChange = (val) => {
    if (onChange) {
      onChange(val || '');
    }
  };

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <Editor
        height={height}
        language="yaml"
        theme={theme}
        value={value}
        onChange={handleChange}
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
  );
};

export default YamlEditor;
