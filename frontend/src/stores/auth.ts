import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserInfo {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  token?: string;
  account?: string;
  identity_type?: string;
  is_admin?: boolean;
}

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  roles: string[];
  publicKey: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, userInfo: UserInfo) => void;
  setRoles: (roles: string[]) => void;
  setPublicKey: (key: string) => void;
  logout: () => void;
}

const getInitialState = () => {
  try {
    const stored = localStorage.getItem('zadig_auth_store');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.token) {
        return {
          token: parsed.state.token as string,
          userInfo: (parsed.state.userInfo as UserInfo) || null,
          roles: (parsed.state.roles as string[]) || [],
          publicKey: (parsed.state.publicKey as string) || null,
          isAuthenticated: Boolean(parsed.state.token),
        };
      }
    }
  } catch {
    // Ignore error
  }
  return {
    token: null,
    userInfo: null,
    roles: [],
    publicKey: null,
    isAuthenticated: false,
  };
};

const initial = getInitialState();

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: initial.token,
      userInfo: initial.userInfo,
      roles: initial.roles,
      publicKey: initial.publicKey,
      isAuthenticated: initial.isAuthenticated,

      setAuth: (token: string, userInfo: UserInfo) => {
        set({
          token,
          userInfo,
          isAuthenticated: true,
        });
      },

      setRoles: (roles: string[]) => {
        set({ roles });
      },

      setPublicKey: (publicKey: string) => {
        set({ publicKey });
      },

      logout: () => {
        set({
          token: null,
          userInfo: null,
          roles: [],
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'zadig_auth_store',
      partialize: (state) => ({
        token: state.token,
        userInfo: state.userInfo,
        roles: state.roles,
        publicKey: state.publicKey,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
