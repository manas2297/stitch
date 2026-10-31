import { create } from 'zustand';

import { isGitHubSlug } from '@/lib/focus';

// The desktop webview routes /api/* straight to the Go handlers (see backend/internal/desktop).
export const apiFetch = (url, options = {}) => fetch(url, options);

interface AppState {
  [key: string]: any;
}

const useAppStore = create<AppState>((set, get) => ({
  // ── State ────────────────────────────────────────────
  repos: [],
  currentUser: '',
  focusProject: '',
  activeTab: 'focus',
  activeEnergy: 'all',
  isLoadingRepos: false,
  sidebarCollapsed: false,
  githubRepoCount: 0,
  confirmModal: null, // { title, message, resolve }
  overviewRecents: null,
  overviewContributions: null,
  overviewLocalContributions: null,
  overviewDelivery: null,
  overviewGoals: { activeDaysPerWeek: 5 },
  tabEnergies: {
    overview: 'all',
    repositories: 'all',
    focus: 'high',
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
  confirm: (title, message) => new Promise((resolve) => {
    set({ confirmModal: { title, message, resolve } });
  }),
  resolveConfirm: (value) => {
    const { confirmModal } = get();
    if (confirmModal) {
      confirmModal.resolve(value);
      set({ confirmModal: null });
    }
  },

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
      const res = await apiFetch('/api/repos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, owner, name }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to delete repository.');
      }
      await get().loadRepos();
    } catch (err) {
      console.error(err);
      throw err;
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
    // Local paths contain '/' too; only a bare owner/name slug is a GitHub repo.
    if (isGitHubSlug(value)) {
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

  loadOverviewData: async () => {
    const p1 = apiFetch('/api/recents')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) set({ overviewRecents: d }); });

    const p2 = apiFetch('/api/contributions')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) set({ overviewContributions: d }); });

    const p3 = apiFetch('/api/contributions/local')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) set({ overviewLocalContributions: d }); });

    const p4 = apiFetch('/api/overview/delivery')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) set({ overviewDelivery: d }); });

    const p5 = apiFetch('/api/overview/goals')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) set({ overviewGoals: d }); });

    await Promise.allSettled([p1, p2, p3, p4, p5]);
  },

  // Repositories needs the local scan (and GitHub's 30-day counts) without the rest of the Overview.
  loadRepoActivity: async () => {
    const { overviewLocalContributions, overviewContributions } = get();
    const jobs = [];
    if (!overviewLocalContributions) {
      jobs.push(apiFetch('/api/contributions/local')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) set({ overviewLocalContributions: d }); }));
    }
    if (!overviewContributions) {
      jobs.push(apiFetch('/api/contributions')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) set({ overviewContributions: d }); }));
    }
    await Promise.allSettled(jobs);
  },

  // Add/remove many repos in one config write, then refresh everything derived from the list.
  bulkRepos: async ({ add = [], remove = [] }) => {
    const res = await apiFetch('/api/repos/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add, remove }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    await get().loadRepos();
    // Local insights only cover tracked repos, so rescan them.
    set({ overviewLocalContributions: null });
    get().loadRepoActivity();
    return data;
  },

  openRepo: async (path, target) => {
    const res = await apiFetch('/api/repos/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, target }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  },

  saveOverviewGoals: async (goals) => {
    const previous = get().overviewGoals;
    set({ overviewGoals: goals });
    try {
      const res = await apiFetch('/api/overview/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goals),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Failed to save goals:', err);
      set({ overviewGoals: previous });
    }
  },
}));

export default useAppStore;
