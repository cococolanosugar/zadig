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
  required_action?: string;
  mfa_challenge_token?: string;
  mfa_expires_at?: number;
  recovery_codes?: string[];
}

export interface MFASetupResponse {
  required_action?: string;
  mfa_challenge_token?: string;
  mfa_expires_at?: number;
  secret?: string;
  otpauth_url?: string;
  qrcode?: string;
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

  /**
   * MFA login challenge: generate QR/secret for first-time enrollment.
   */
  async mfaSetup(mfaChallengeToken: string): Promise<MFASetupResponse> {
    return http.post<MFASetupResponse>(
      '/api/v1/login/mfa/setup',
      { mfa_challenge_token: mfaChallengeToken },
      { skipErrorHandler: true }
    );
  },

  /**
   * MFA login challenge: submit OTP to finish first-time enrollment.
   * Returns the formal login state (User + token + recovery codes).
   */
  async mfaEnroll(mfaChallengeToken: string, otpCode: string): Promise<LoginResponse> {
    return http.post<LoginResponse>(
      '/api/v1/login/mfa/enroll',
      { mfa_challenge_token: mfaChallengeToken, otp_code: otpCode },
      { skipErrorHandler: true }
    );
  },

  /**
   * MFA login challenge: submit OTP or recovery code to finish login.
   * Returns the formal login state (User + token).
   */
  async mfaVerify(mfaChallengeToken: string, otpCode?: string, recoveryCode?: string): Promise<LoginResponse> {
    return http.post<LoginResponse>(
      '/api/v1/login/mfa/verify',
      {
        mfa_challenge_token: mfaChallengeToken,
        otp_code: otpCode || undefined,
        recovery_code: recoveryCode || undefined,
      },
      { skipErrorHandler: true }
    );
  },

  /**
   * 获取系统特性开关 (如 RegisterTrigger 注册开关)
   * GET /api/v1/features/:name (pkg/microservice/systemconfig/core/features/handler/router.go:30)
   */
  async getFeature(name: string): Promise<{ name: string; enabled: boolean }> {
    try {
      return await http.get<{ name: string; enabled: boolean }>(`/api/v1/features/${encodeURIComponent(name)}`, {
        skipErrorHandler: true,
      });
    } catch {
      return { name, enabled: false };
    }
  },
};

export default authApi;
