import http from './client';

/** 企业组织信息与品牌 Logo（base64） */
export interface Organization {
  name?: string;
  website?: string;
  orgToken?: string;
  copyright_enabled?: boolean;
  big_light_logo?: string;
  big_logo?: string;
  small_logo?: string;
  favicon?: string;
}

export interface EnterpriseLicenseInfo {
  status?: string;
  company?: string;
  license_type?: string;
  // R11 任务三: 对齐后端实际返回字段（expire_at/type）
  expire_at?: number | string;
  type?: string;
  expire_time?: number;
  user_limit?: number;
  cluster_limit?: number;
  features?: string[];
  [key: string]: unknown;
}

export interface EnterpriseThemeInfo {
  theme_type?: string;
  custom_theme?: {
    border_gray?: string;
    font_gray?: string;
    font_light_gray?: string;
    theme_color?: string;
    theme_border_color?: string;
    theme_background_color?: string;
    theme_light_color?: string;
    background_color?: string;
    global_background_color?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const enterpriseApi = {
  /**
   * Get enterprise license details
   */
  async getLicense(): Promise<EnterpriseLicenseInfo> {
    try {
      const res = await http.get<EnterpriseLicenseInfo>('/api/plutus-enterprise/license');
      return res || {};
    } catch {
      return {};
    }
  },

  /**
   * Get system theme and branding
   */
  async getTheme(): Promise<EnterpriseThemeInfo> {
    try {
      const res = await http.get<EnterpriseThemeInfo>('/api/aslan/system/theme');
      return res || {};
    } catch {
      return {};
    }
  },

  /**
   * Update system theme (PUT /api/aslan/system/theme)
   */
  async updateTheme(payload: EnterpriseThemeInfo): Promise<unknown> {
    return http.put('/api/aslan/system/theme', payload);
  },

  /** 获取企业组织信息与品牌定制 */
  async getOrganization(): Promise<Organization> {
    try {
      const res = await http.get<Organization>('/api/plutus-enterprise/organization');
      return res || {};
    } catch {
      return {};
    }
  },

  /** 更新企业组织信息与品牌 Logo */
  async updateOrganization(payload: Partial<Organization>): Promise<Organization> {
    return http.post<Organization>('/api/plutus-enterprise/organization', payload);
  },
};

export default enterpriseApi;
