import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

export interface YamlDiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
}

export const YamlDiffEditor: React.FC<YamlDiffEditorProps> = ({
  original,
  modified,
  language = 'yaml',
  height = '500px',
  readOnly = true,
  theme = 'vs-dark',
}) => {
  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <DiffEditor
        height={height}
        language={language}
        theme={theme}
        original={original}
        modified={modified}
        options={{
          readOnly,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          automaticLayout: true,
        }}
      />
    </div>
  );
};

export default YamlDiffEditor;
