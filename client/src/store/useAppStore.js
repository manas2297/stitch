import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────
  repos: [],
  focusProject: '',
  activeTab: 'focus',
  activeEnergy: 'all',
  isLoadingRepos: false,

  // ── Actions ──────────────────────────────────────────
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveEnergy: (energy) => set({ activeEnergy: energy }),

  loadRepos: async () => {
    set({ isLoadingRepos: true });
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      set({ repos: data.repos, focusProject: data.focusProject, isLoadingRepos: false });
    } catch (err) {
      console.error('Failed to load repos:', err);
      set({ isLoadingRepos: false });
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
      await fetch('/api/repos/toggle-major', {
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
      await fetch('/api/repos', {
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
    const res = await fetch('/api/repos', {
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
      await fetch('/api/repos/set-focus', {
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
