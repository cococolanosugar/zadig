import http from './client';

export interface EmailHostConfig {
  name: string; // SMTP host, 例如 smtp.exmail.qq.com
  port: number; // 465, 587, 25
  user_name?: string; // 兼容旧版命名
  username?: string; // 标准命名
  password?: string; // 授权码/密码
  is_ssl?: boolean; // 兼容旧版命名
  isTLS?: boolean; // 标准命名
  from?: string; // 发件人
  created_at?: number;
  updated_at?: number;
}

export interface EmailServiceConfig {
  name?: string; // 业务发信服务标识
  address: string; // 发信邮箱地址
  display_name?: string; // 发信人显示名称
  theme?: string;
  created_at?: number;
  updated_at?: number;
}

export const emailApi = {
  /**
   * 获取 SMTP 邮件服务器配置（密码脱敏）
   * GET /api/v1/emails/host
   */
  async getEmailHost(): Promise<EmailHostConfig | null> {
    try {
      const res = await http.get<EmailHostConfig>('/api/v1/emails/host', { skipErrorHandler: true });
      return res || null;
    } catch {
      return null;
    }
  },

  /**
   * 通过 RSA 加密信封获取加密回传的邮件主机配置
   * GET /api/v1/emails/internal/host?encryptedKey=...
   * 后端通过 RSA 解开 AES 密钥后将明文密码 AES 加密后返回
   */
  async getEncryptedEmailHost(encryptedKey: string): Promise<EmailHostConfig | null> {
    try {
      const res = await http.get<EmailHostConfig>('/api/v1/emails/internal/host', {
        params: { encryptedKey },
        skipErrorHandler: true,
      });
      return res || null;
    } catch {
      return null;
    }
  },

  /**
   * 保存或更新 SMTP 邮件服务器配置
   * POST /api/v1/emails/host
   */
  async saveEmailHost(payload: {
    name: string;
    port: number;
    username: string;
    password?: string;
    isTLS: boolean;
  }): Promise<void> {
    await http.post('/api/v1/emails/host', payload);
  },

  /**
   * 测试并验证 SMTP 服务器连通性与凭据
   * POST /api/v1/emails/host/validate
   */
  async validateEmailHost(payload: {
    name: string;
    port: number;
    username: string;
    password?: string;
    isTLS: boolean;
  }): Promise<void> {
    await http.post('/api/v1/emails/host/validate', payload);
  },

  /**
   * 删除 SMTP 邮件服务器配置
   * DELETE /api/v1/emails/host
   */
  async deleteEmailHost(): Promise<void> {
    await http.delete('/api/v1/emails/host');
  },

  /**
   * 获取业务发信人配置 (EmailService)
   * GET /api/v1/emails/service
   */
  async getEmailService(): Promise<EmailServiceConfig | null> {
    try {
      const res = await http.get<EmailServiceConfig>('/api/v1/emails/service', {
        skipErrorHandler: true,
      });
      return res || null;
    } catch {
      return null;
    }
  },

  /**
   * 创建业务发信人配置
   * POST /api/v1/emails/service
   */
  async saveEmailService(payload: EmailServiceConfig): Promise<void> {
    await http.post('/api/v1/emails/service', payload);
  },

  /**
   * 更新业务发信人配置
   * PATCH /api/v1/emails/service
   */
  async updateEmailService(payload: EmailServiceConfig): Promise<void> {
    await http.patch('/api/v1/emails/service', payload);
  },

  /**
   * 删除业务发信人配置
   * DELETE /api/v1/emails/service
   */
  async deleteEmailService(): Promise<void> {
    await http.delete('/api/v1/emails/service');
  },
};

export default emailApi;
