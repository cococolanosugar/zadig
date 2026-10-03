import http from './client';

export interface InitiateUploadRequest {
  file_name: string;
  file_size: number;
  total_parts: number;
}

export interface InitiateUploadResponse {
  session_id: string;
  part_size: number;
  total_parts: number;
  instance_id: string;
}

export interface UploadStatusResponse {
  session_id: string;
  status: 'uploading' | 'completed' | 'failed' | string;
  total_parts: number;
  uploaded_parts: number[];
  missing_parts: number[];
}

export interface CompleteUploadResponse {
  file_id: string;
  file_name: string;
  file_size: number;
}

export interface TemporaryFileInfo {
  id: string;
  file_name: string;
  file_size: number;
  status: string;
  created_at: number;
}

export const PART_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const tempFileApi = {
  /**
   * 初始化分片上传会话
   * POST /api/aslan/system/tempFile/initiate
   */
  async initiateUpload(req: InitiateUploadRequest): Promise<InitiateUploadResponse> {
    return http.post<InitiateUploadResponse>('/api/aslan/system/tempFile/initiate', req);
  },

  /**
   * 上传单个分片
   * POST /api/aslan/system/tempFile/upload/:sessionId/:partNumber
   */
  async uploadPart(sessionId: string, partNumber: number, chunk: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('file', chunk, `part-${partNumber}`);
    await http.post(`/api/aslan/system/tempFile/upload/${sessionId}/${partNumber}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * 完成分片合并
   * POST /api/aslan/system/tempFile/complete/:sessionId
   */
  async completeUpload(sessionId: string): Promise<CompleteUploadResponse> {
    return http.post<CompleteUploadResponse>(`/api/aslan/system/tempFile/complete/${sessionId}`);
  },

  /**
   * 查询分片上传状态（可用于断点续传检测）
   * GET /api/aslan/system/tempFile/status/:sessionId
   */
  async getUploadStatus(sessionId: string): Promise<UploadStatusResponse> {
    return http.get<UploadStatusResponse>(`/api/aslan/system/tempFile/status/${sessionId}`);
  },

  /**
   * 获取已上传的临时文件信息
   * GET /api/aslan/system/tempFile/fileInfo/:fileId
   */
  async getTemporaryFileInfo(fileId: string): Promise<TemporaryFileInfo> {
    return http.get<TemporaryFileInfo>(`/api/aslan/system/tempFile/fileInfo/${fileId}`);
  },

  /**
   * 获取下载地址
   * GET /api/aslan/system/tempFile/download/:fileId
   */
  getDownloadUrl(fileId: string): string {
    return `/api/aslan/system/tempFile/download/${fileId}`;
  },

  /**
   * 高阶实用方法：自动按 5MB 分片并发/顺序上传文件
   */
  async uploadFileMultipart(
    file: File,
    onProgress?: (percent: number, currentPart: number, totalParts: number) => void
  ): Promise<CompleteUploadResponse> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件大小超过最大允许限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    const totalParts = Math.ceil(file.size / PART_SIZE);
    const session = await this.initiateUpload({
      file_name: file.name,
      file_size: file.size,
      total_parts: totalParts,
    });

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const chunk = file.slice(start, end);

      await this.uploadPart(session.session_id, partNumber, chunk);

      if (onProgress) {
        const percent = Math.round((partNumber / totalParts) * 100);
        onProgress(percent, partNumber, totalParts);
      }
    }

    return this.completeUpload(session.session_id);
  },
};

export default tempFileApi;
