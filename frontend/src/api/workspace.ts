import http from './client';

export interface RepoTreeNode {
  name: string;
  path: string;
  type: 'tree' | 'blob' | string;
  mode?: string;
  sha?: string;
  submodule?: boolean;
}

export interface WorkspaceFileInfo {
  parent: string;
  name: string;
  size: number;
  mode?: number;
  mod_time?: number;
  is_dir: boolean;
}

export interface GetRepoTreeParams {
  codehost_id?: number;
  owner?: string;
  namespace?: string;
  repo: string;
  path?: string;
  branch?: string;
  repoLink?: string;
}

export interface GetFileContentsParams {
  repoOwner: string;
  repoName: string;
  branchName: string;
  path: string;
  isDir?: boolean;
}

export interface GetGitWorkspaceFilesParams {
  repoOwner: string;
  repoNamespace?: string;
  repoName: string;
  branchName: string;
  remoteName?: string;
  dir?: string;
}

export const workspaceApi = {
  /**
   * 获取远程代码库文件树
   * GET /api/aslan/code/workspace/tree
   */
  async getRepoTree(params: GetRepoTreeParams): Promise<RepoTreeNode[]> {
    const query = new URLSearchParams();
    if (params.codehost_id !== undefined) query.append('codehost_id', String(params.codehost_id));
    if (params.owner) query.append('owner', params.owner);
    if (params.namespace) query.append('namespace', params.namespace);
    if (params.repo) query.append('repo', params.repo);
    if (params.path) query.append('path', params.path);
    if (params.branch) query.append('branch', params.branch);
    if (params.repoLink) query.append('repoLink', params.repoLink);

    const res = await http.get<RepoTreeNode[]>(`/api/aslan/code/workspace/tree?${query.toString()}`);
    return Array.isArray(res) ? res : [];
  },

  /**
   * 获取指定文件/目录内容
   * GET /api/aslan/code/workspace/getcontents/:codehostId
   */
  async getFileContents(codehostId: number, params: GetFileContentsParams): Promise<string> {
    const query = new URLSearchParams({
      repoOwner: params.repoOwner,
      repoName: params.repoName,
      branchName: params.branchName,
      path: params.path,
      isDir: String(!!params.isDir),
    });

    const res = await http.get<string | { content?: string }>(
      `/api/aslan/code/workspace/getcontents/${codehostId}?${query.toString()}`
    );
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object' && 'content' in res) return String(res.content || '');
    return '';
  },

  /**
   * 获取已拉取到本地工作区的 Git 文件列表
   * GET /api/aslan/code/workspace/git/:codehostId
   */
  async getGitWorkspaceFiles(
    codehostId: number,
    params: GetGitWorkspaceFilesParams
  ): Promise<WorkspaceFileInfo[]> {
    const query = new URLSearchParams({
      repoOwner: params.repoOwner,
      repoName: params.repoName,
      branchName: params.branchName,
      remoteName: params.remoteName || 'origin',
    });
    if (params.repoNamespace) query.append('repoNamespace', params.repoNamespace);
    if (params.dir) query.append('dir', params.dir);

    const res = await http.get<WorkspaceFileInfo[]>(
      `/api/aslan/code/workspace/git/${codehostId}?${query.toString()}`
    );
    return Array.isArray(res) ? res : [];
  },
};

export default workspaceApi;
