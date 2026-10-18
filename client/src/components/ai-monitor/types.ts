export interface Amount {
  files: number;
  bytes: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  exists: boolean;
}

export interface CategoryStat extends Amount {
  id: string;
  label: string;
  description?: string;
  cleanable: boolean;
}

export interface TypeStat extends Amount {
  extension: string;
}

export interface DayStat {
  date: string;
  filesCreated: number;
  bytesCreated: number;
  sessionsStarted: number;
}

export interface SessionInfo {
  id: string;
  name: string;
  group: string;
  bytes: number;
  files: number;
  created: string;
  lastActive: string;
}

export interface GroupStat {
  label: string;
  sessions: number;
  bytes: number;
  lastActive: string;
}

export interface ActionRef {
  action: string;
  days?: number;
  category?: string;
}

export interface Insight {
  level: 'info' | 'warn' | 'critical' | 'good';
  title: string;
  detail: string;
  action?: ActionRef;
}

export interface ActionInfo extends ActionRef {
  label: string;
  description: string;
  estimate: Amount;
  sessions: number;
}

export interface Report {
  provider: string;
  label: string;
  root: string;
  exists: boolean;
  scannedAt: string;
  scanMs: number;
  total: Amount;
  media: Amount;
  created7d: Amount;
  created30d: Amount;
  categories: CategoryStat[];
  fileTypes: TypeStat[];
  activity: DayStat[];
  sessions: {
    supported: boolean;
    total: number;
    active7d: number;
    started7d: number;
    started30d: number;
    perActiveDay: number;
    medianBytes: number;
    largestBytes: number;
    stale: Amount;
    staleSessions: number;
    tinySessions: number;
    list: SessionInfo[];
    truncated: boolean;
  };
  groups: GroupStat[];
  insights: Insight[];
  actions: ActionInfo[];
  reclaimable: Amount;
}

/** A cleanup request: an action (with its params) or an explicit list of session ids. */
export interface CleanupTarget extends ActionRef {
  label: string;
  ids?: string[];
}

export interface CleanupResult {
  action: string;
  files: number;
  bytes: number;
  sessions: number;
  skippedRecent: number;
  sample: string[];
  dryRun: boolean;
  deleted: number;
  freedBytes: number;
  failed: number;
}
