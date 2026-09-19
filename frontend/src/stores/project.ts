import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectItem {
  name: string;
  alias?: string;
  desc?: string;
  product_name?: string;
  created_at?: number;
  updated_at?: number;
  updatedAt?: number;
  updatedBy?: string;
  onboard?: boolean;
  public?: boolean;
  deployType?: string;
  is_favorite?: boolean;
}

interface ProjectState {
  currentProject: string | null;
  projects: ProjectItem[];
  loading: boolean;
  setCurrentProject: (projectName: string | null) => void;
  setProjects: (projects: ProjectItem[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      projects: [],
      loading: false,

      setCurrentProject: (currentProject) => set({ currentProject }),
      setProjects: (projects) => {
        set((state) => ({
          projects,
          // If currentProject is null and we have projects, auto-select first project
          currentProject: state.currentProject || (projects.length > 0 ? (projects[0].name || projects[0].product_name || null) : null),
        }));
      },
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'zadig_project_store',
      partialize: (state) => ({
        currentProject: state.currentProject,
      }),
    }
  )
);
