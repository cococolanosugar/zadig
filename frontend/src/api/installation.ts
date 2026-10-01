import http from './client';

export interface SystemInitializationStatus {
  initialized: boolean;
}

export interface UserInitializationReq {
  username: string;
  password: string;
  company: string;
  email: string;
  phone?: number | string | null;
  improvement_plan?: boolean;
}

export interface InstallationLicenseReq {
  license: string;
}

export interface InstallationLicenseInfo {
  system_id?: string;
  company?: string;
  version?: string;
}

export const installationApi = {
  /**
   * Get system initialization status.
   */
  async getStatus(): Promise<SystemInitializationStatus> {
    return http.get<SystemInitializationStatus>('/api/aslan/system/initialization/status');
  },

  /**
   * Initialize admin user during first-time system setup.
   */
  async initializeUser(data: UserInitializationReq): Promise<unknown> {
    return http.post('/api/aslan/system/initialization/user', data);
  },

  /**
   * Get enterprise license info during installation setup.
   */
  async getLicenseInfo(): Promise<InstallationLicenseInfo> {
    return http.get<InstallationLicenseInfo>('/api/plutus-enterprise/license').catch(() => ({}));
  },

  /**
   * Create or bind enterprise license token.
   */
  async createLicense(data: InstallationLicenseReq): Promise<unknown> {
    return http.post('/api/plutus-enterprise/license', data);
  },
};

export default installationApi;
