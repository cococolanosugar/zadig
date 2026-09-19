import http from './client';
import { buildEncryptedLoginPayload } from '../utils/crypto';
import type { UserInfo } from '../stores/auth';

export interface RSAPublicKeyResponse {
  publicKey: string;
}

export interface LoginResponse extends UserInfo {
  token: string;
  uid: string;
  email: string;
  name: string;
  account: string;
  phone?: string;
  group_ids?: string[];
  identityType?: string;
  mfa_required?: boolean;
}

export interface UserPermissionResponse {
  is_system_admin: boolean;
  project_admin_list: string[];
  system_verbs: string[];
}

export interface RoleBindingItem {
  uid: string;
  role: string;
  project_name?: string;
}

export const authApi = {
  /**
   * Fetch the server's active RSA public key.
   */
  async getRSAPublicKey(): Promise<string> {
    const res = await http.get<RSAPublicKeyResponse>('/api/aslan/system/rsaKey/publicKey');
    return res.publicKey;
  },

  /**
   * Authenticate user credentials with envelope encryption.
   */
  async login(
    account: string,
    passwordPlain: string,
    captcha?: { id: string; answer: string }
  ): Promise<LoginResponse> {
    const publicKeyPem = await this.getRSAPublicKey();
    const payload = buildEncryptedLoginPayload(account, passwordPlain, publicKeyPem, captcha);
    return http.post<LoginResponse>('/api/v1/login', payload);
  },

  /**
   * Terminate the user session.
   */
  async logout(): Promise<void> {
    await http.get('/api/v1/logout');
  },

  /**
   * Fetch system permissions and admin status for current user.
   */
  async getUserPermissions(): Promise<UserPermissionResponse> {
    return http.get<UserPermissionResponse>('/api/v1/policy/permission', {
      skipErrorHandler: true,
    });
  },

  /**
   * Fetch the assigned RBAC role bindings for a given user ID.
   */
  async getUserRoleBindings(uid: string): Promise<RoleBindingItem[]> {
    return http.get<RoleBindingItem[]>(`/api/v1/policy/role-bindings`, {
      params: { uid },
      skipErrorHandler: true,
    });
  },

  /**
   * Check enabled external login connectors (e.g. LDAP, OAuth).
   */
  async getLoginEnabled(): Promise<unknown> {
    return http.get('/api/v1/login-enabled');
  },
};

export default authApi;
