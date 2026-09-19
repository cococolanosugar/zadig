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
  custom_logo?: string;
  custom_favicon?: string;
  custom_title?: string;
  theme_color?: string;
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
};

export default enterpriseApi;
