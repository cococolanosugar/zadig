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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      roles: [],
      publicKey: null,
      isAuthenticated: false,

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
