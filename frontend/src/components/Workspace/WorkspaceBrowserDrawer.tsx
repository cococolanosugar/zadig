import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Tree,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
  Typography,
  Spin,
  Empty,
  Card,
  Tag,
} from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  CodeOutlined,
  ReloadOutlined,
  CopyOutlined,
  BranchesOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { workspaceApi, type RepoTreeNode } from '../../api/workspace';
import settingsApi, { type CodeHostItem } from '../../api/settings';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

export interface WorkspaceBrowserDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultCodeHostId?: number;
  defaultOwner?: string;
  defaultRepo?: string;
  defaultBranch?: string;
}

export const WorkspaceBrowserDrawer: React.FC<WorkspaceBrowserDrawerProps> = ({
  open,
  onClose,
  defaultCodeHostId,
  defaultOwner = '',
  defaultRepo = '',
  defaultBranch = 'master',
}) => {
  const [codeHosts, setCodeHosts] = useState<CodeHostItem[]>([]);
  const [selectedCodeHostId, setSelectedCodeHostId] = useState<number | undefined>(defaultCodeHostId);
  const [owner, setOwner] = useState<string>(defaultOwner);
  const [repo, setRepo] = useState<string>(defaultRepo);
  const [branch, setBranch] = useState<string>(defaultBranch);

  const [loading, setLoading] = useState<boolean>(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState<boolean>(false);

  // 加载系统代码源列表
  useEffect(() => {
    if (open) {
      settingsApi
        .getCodeHosts()
        .then((list) => {
          setCodeHosts(list);
          if (!selectedCodeHostId && list.length > 0) {
            setSelectedCodeHostId(list[0].id);
          }
        })
        .catch(() => setCodeHosts([]));
    }
  }, [open, selectedCodeHostId]);

  // 同步外部 props
  useEffect(() => {
    if (defaultCodeHostId) setSelectedCodeHostId(defaultCodeHostId);
    if (defaultOwner) setOwner(defaultOwner);
    if (defaultRepo) setRepo(defaultRepo);
    if (defaultBranch) setBranch(defaultBranch);
  }, [defaultCodeHostId, defaultOwner, defaultRepo, defaultBranch]);

  // 将后端 TreeNode 转换为 Ant Design Tree DataNode
  const convertNodesToTree = (nodes: RepoTreeNode[], parentPath = ''): DataNode[] => {
    return nodes.map((node) => {
      const isDir = node.type === 'tree';
      const nodePath = node.path || (parentPath ? `${parentPath}/${node.name}` : node.name);
      return {
        key: nodePath,
        title: (
          <Space orientation="horizontal" size={6}>
            {isDir ? (
              <FolderOutlined style={{ color: '#fa8c16' }} />
            ) : node.name.endsWith('.yaml') || node.name.endsWith('.yml') ? (
              <CodeOutlined style={{ color: '#52c41a' }} />
            ) : (
              <FileTextOutlined style={{ color: '#1677ff' }} />
            )}
            <Text style={{ fontSize: 13 }}>{node.name}</Text>
          </Space>
        ),
        isLeaf: !isDir,
      };
    });
  };

  // 刷新加载根目录
  const fetchRootTree = useCallback(async () => {
    if (!selectedCodeHostId && !repo) return;
    setLoading(true);
    setFileContent('');
    setSelectedFilePath('');
    try {
      const res = await workspaceApi.getRepoTree({
        codehost_id: selectedCodeHostId,
        owner: owner.trim() || undefined,
        repo: repo.trim(),
        branch: branch.trim() || undefined,
        path: '',
      });
      setTreeData(convertNodesToTree(res));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载工作区文件树失败';
      feedback.message.error(msg);
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCodeHostId, owner, repo, branch]);

  useEffect(() => {
    if (open && (selectedCodeHostId || repo)) {
      fetchRootTree();
    }
  }, [open, fetchRootTree, selectedCodeHostId, repo]);

  // 异步加载子目录 (loadData)
  const onLoadData = async ({ key, children }: DataNode) => {
    if (children) return;
    const dirPath = String(key);
    try {
      const res = await workspaceApi.getRepoTree({
        codehost_id: selectedCodeHostId,
        owner: owner.trim() || undefined,
        repo: repo.trim(),
        branch: branch.trim() || undefined,
        path: dirPath,
      });

      const childNodes = convertNodesToTree(res, dirPath);

      const updateTreeChildren = (origin: DataNode[]): DataNode[] => {
        return origin.map((node) => {
          if (node.key === key) {
            return { ...node, children: childNodes };
          }
          if (node.children) {
            return { ...node, children: updateTreeChildren(node.children) };
          }
          return node;
        });
      };

      setTreeData((prev) => updateTreeChildren(prev));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载子目录失败';
      feedback.message.error(msg);
    }
  };

  // 选中文件节点查看内容
  const handleSelectNode = async (selectedKeys: React.Key[], info: { node: DataNode }) => {
    if (selectedKeys.length === 0) return;
    const pathStr = String(selectedKeys[0]);
    if (!info.node.isLeaf) return; // 目录节点不读取内容

    setSelectedFilePath(pathStr);
    setContentLoading(true);
    try {
      const content = await workspaceApi.getFileContents(selectedCodeHostId || 0, {
        repoOwner: owner.trim(),
        repoName: repo.trim(),
        branchName: branch.trim(),
        path: pathStr,
        isDir: false,
      });
      setFileContent(content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '读取文件内容失败';
      setFileContent(`// 读取文件内容失败: ${msg}`);
    } finally {
      setContentLoading(false);
    }
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    feedback.message.success('已复制到剪贴板');
  };

  return (
    <Drawer
      title={
        <Space>
          <FileSearchOutlined style={{ color: '#0066ff' }} />
          <span>代码工作区浏览器 (Code Workspace Browser)</span>
        </Space>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRootTree} loading={loading}>
            重新加载
          </Button>
        </Space>
      }
    >
      {/* 顶部代码源及仓库参数配置 */}
      <Card variant="borderless" styles={{ body: { padding: 12, background: '#f8fafc', marginBottom: 16 } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              代码源
            </Text>
            <Select
              style={{ width: '100%' }}
              value={selectedCodeHostId}
              onChange={(val) => setSelectedCodeHostId(val)}
              options={codeHosts.map((c) => ({
                label: `${c.alias || c.address} (${c.type})`,
                value: c.id,
              }))}
              placeholder="选择代码源"
            />
          </Col>
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Owner / Namespace
            </Text>
            <Input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="例如: koderover"
            />
          </Col>
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              代码仓库 Repo
            </Text>
            <Input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="例如: zadig"
            />
          </Col>
          <Col span={4}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              分支 Branch
            </Text>
            <Input
              prefix={<BranchesOutlined style={{ color: '#bfbfbf' }} />}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </Col>
          <Col span={2} style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: 20 }}>
            <Button type="primary" onClick={fetchRootTree} loading={loading}>
              浏览
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 左右分栏：左侧文件树，右侧内容预览 */}
      <Row gutter={16} style={{ minHeight: 520 }}>
        {/* 左侧文件树 */}
        <Col span={8} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 13 }}>
              文件目录树
            </Text>
            <Tag color="cyan">{treeData.length} 项</Tag>
          </div>
          <Spin spinning={loading}>
            {treeData.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无文件或尚未连接代码库"
                style={{ marginTop: 40 }}
              />
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                <Tree
                  showLine={{ showLeafIcon: false }}
                  loadData={onLoadData}
                  treeData={treeData}
                  onSelect={handleSelectNode}
                />
              </div>
            )}
          </Spin>
        </Col>

        {/* 右侧文件内容预览 */}
        <Col span={16} style={{ paddingLeft: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Space>
              <Text strong style={{ fontSize: 13 }}>
                文件内容预览
              </Text>
              {selectedFilePath && <Tag color="blue">{selectedFilePath}</Tag>}
            </Space>
            {fileContent && (
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                复制内容
              </Button>
            )}
          </div>

          <Spin spinning={contentLoading}>
            {selectedFilePath ? (
              <div
                style={{
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  borderRadius: 6,
                  padding: 14,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  minHeight: 480,
                  maxHeight: 520,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {fileContent || '// 文件内容为空'}
              </div>
            ) : (
              <div
                style={{
                  minHeight: 480,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  borderRadius: 6,
                  border: '1px dashed #d9d9d9',
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="在左侧文件树中点击任意文件进行只读查看"
                />
              </div>
            )}
          </Spin>
        </Col>
      </Row>
    </Drawer>
  );
};

export default WorkspaceBrowserDrawer;
