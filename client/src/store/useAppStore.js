import { create } from 'zustand';

// Smart wrapper targeting the background server port in Desktop/Production modes
export const apiFetch = (url, options = {}) => {
  const isDesktop = window.go !== undefined || import.meta.env.PROD;
  const baseUrl = isDesktop ? 'http://127.0.0.1:4000' : '';
  return fetch(`${baseUrl}${url}`, options);
};

const useAppStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────
  repos: [],
  currentUser: '',
  focusProject: '',
  activeTab: 'focus',
  activeEnergy: 'all',
  isLoadingRepos: false,
  sidebarCollapsed: false,
  githubRepoCount: 0,
  tabEnergies: {
    overview: 'all',
    repositories: 'all',
    focus: 'high',
    projects: 'medium',
    releases: 'medium',
    'pr-reviews': 'low',
    issues: 'low',
    builds: 'high',
    profile: 'all',
  },

  // ── Actions ──────────────────────────────────────────
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveEnergy: (energy) => set({ activeEnergy: energy }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  loadRepos: async () => {
    set({ isLoadingRepos: true });
    try {
      const res = await apiFetch('/api/repos');
      const data = await res.json();
      set({ 
        repos: data.repos, 
        currentUser: data.currentUser || '',
        focusProject: data.focusProject, 
        tabEnergies: data.tabEnergies || get().tabEnergies,
        githubRepoCount: data.githubRepoCount || 0,
        isLoadingRepos: false 
      });
    } catch (err) {
      console.error('Failed to load repos:', err);
      set({ isLoadingRepos: false });
    }
  },

  saveTabEnergies: async (tabEnergies) => {
    try {
      const res = await apiFetch('/api/config/tab-energies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tabEnergies),
      });
      if (res.ok) {
        const data = await res.json();
        set({ tabEnergies: data.tabEnergies });
        return { success: true };
      }
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    } catch (err) {
      console.error('Failed to save tab energies:', err);
      return { success: false, error: err.message };
    }
  },

  toggleMajor: async ({ path, owner, name }) => {
    // Optimistic update in local state
    set((state) => ({
      repos: state.repos.map((r) => {
        const match = (path && r.path === path) || (owner && r.owner === owner && r.name === name);
        return match ? { ...r, isMajorProject: !r.isMajorProject } : r;
      }),
    }));
    // Sync to server
    try {
      await apiFetch('/api/repos/toggle-major', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, owner, name }),
      });
    } catch (err) {
      console.error('Toggle failed, reloading from server:', err);
      get().loadRepos(); // revert on failure
    }
  },

  deleteRepo: async ({ path, owner, name }) => {
    try {
      await apiFetch('/api/repos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, owner, name }),
      });
      await get().loadRepos();
    } catch (err) {
      console.error(err);
    }
  },

  addRepo: async (repoPath) => {
    const res = await apiFetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    });
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error || 'Failed to add repository.');
    }
    await get().loadRepos();
  },

  setFocusProject: async (value) => {
    let params = { path: '', owner: '', name: '' };
    if (value.includes('/')) {
      const [owner, name] = value.split('/');
      params.owner = owner;
      params.name = name;
    } else {
      params.path = value;
    }
    try {
      await apiFetch('/api/repos/set-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      set({ focusProject: value });
    } catch (err) {
      console.error(err);
    }
  },
}));

export default useAppStore;
