import http from './client';

export interface EnterpriseLicenseInfo {
  status?: string;
  company?: string;
  license_type?: string;
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
};

export default enterpriseApi;
