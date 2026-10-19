import { useEffect, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  MapPin,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  User,
  Wrench,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { INSTALL_GUIDES } from '@/lib/installGuides';
import { cn } from '@/lib/utils';
import useAppStore, { apiFetch } from '../store/useAppStore';
import PageHeader from './layout/PageHeader';
import { useToast } from './Toast';

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  repositories: 'Repositories',
  focus: 'Focus Area',
  releases: 'Cut Release',
  'pr-reviews': 'PR Reviews',
  issues: 'Issues',
  builds: 'Fix Builds',
  profile: 'Profile',
};

// Tabs that were removed but may still have a saved energy level in config.json
const RETIRED_TABS = new Set(['projects']);

/** Format a GitHub ISO date string to a friendly "Member since YYYY" label. */
function memberSince(isoStr) {
  if (!isoStr) return null;
  const year = new Date(isoStr).getFullYear();
  return isNaN(year) ? null : `Member since ${year}`;
}

function Chip({ icon: Icon, children }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Icon className="size-3.5" /> {children}
    </span>
  );
}

function CopyBlock({ step, text, toastMsg }: { step: string; text: string; toastMsg: string }) {
  const toast = useToast();
  return (
    <div className="grid gap-1.5">
      <span className="text-muted-foreground text-xs">{step}</span>
      <div className="flex items-start gap-2">
        <code className="bg-muted flex-1 rounded-md border p-2 font-mono text-xs break-all whitespace-pre-wrap">{text}</code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast(toastMsg, 'success');
          }}
        >
          <Copy /> Copy
        </Button>
      </div>
    </div>
  );
}

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');
  const [selectedMissing, setSelectedMissing] = useState<string | null>(null);

  const { tabEnergies, saveTabEnergies } = useAppStore();
  const [localTabEnergies, setLocalTabEnergies] = useState({});
  const [savingModes, setSavingModes] = useState(false);

  useEffect(() => {
    if (tabEnergies) setLocalTabEnergies(tabEnergies);
  }, [tabEnergies]);

  const handleSaveModes = async () => {
    setSavingModes(true);
    const result = await saveTabEnergies(localTabEnergies);
    if (result?.success) {
      toast('Mode configuration saved successfully!', 'success');
    } else {
      toast(`Failed to save configuration: ${result?.error || 'Unknown error'}`, 'error');
    }
    setSavingModes(false);
  };

  const loadProfile = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiFetch('/api/profile');
      const data = await res.json();
      setProfile(data);
      setGitName(data.git?.globalName || '');
      setGitEmail(data.git?.globalEmail || '');
    } catch {
      toast('Failed to load profile details.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateGit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/profile/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gitName, email: gitEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Git profile updated!', 'success');
        loadProfile();
      } else {
        toast(data.error || 'Failed to update configurations.', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-4 h-56 w-full" />
      </div>
    );
  }

  const gh = profile?.github ?? {};
  const since = memberSince(gh.createdAt);
  const diagnostics = [
    { label: 'Git Version', val: profile?.diagnostics?.gitVersion },
    { label: 'GitHub CLI Version', val: profile?.diagnostics?.ghVersion },
    { label: 'Operating System', val: profile?.diagnostics?.os },
    { label: 'Active Shell', val: profile?.diagnostics?.shell },
  ];
  const guide = selectedMissing ? INSTALL_GUIDES[selectedMissing] : null;

  return (
    <section id="profile-section" className="flex flex-col gap-6">
      <PageHeader
        title="Developer Profile"
        description="Manage your Git identity credentials and view system diagnostics."
        className="mb-0"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GitHub CLI session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4" /> GitHub CLI Session
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            {gh.username ? (
              <div className="flex items-start gap-4">
                {gh.avatarUrl ? (
                  <img src={gh.avatarUrl} alt="Avatar" className="size-16 shrink-0 rounded-full border-2 sm:size-[68px]" />
                ) : (
                  <div className="bg-muted flex size-16 shrink-0 items-center justify-center rounded-full">
                    <User className="size-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold">@{gh.username}</h4>
                    {gh.plan && gh.plan !== 'free' && (
                      <Badge variant="green" className="text-[0.62rem] capitalize">
                        {gh.plan}
                      </Badge>
                    )}
                    {gh.sshKeyCount > 0 && (
                      <Badge className="border text-[0.62rem]">
                        <KeyRound /> {gh.sshKeyCount} SSH key{gh.sshKeyCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {gh.email && <div className="text-muted-foreground text-sm break-all">{gh.email}</div>}
                  {gh.bio && <p className="text-sm break-words italic">{gh.bio}</p>}
                  {(gh.followers > 0 || gh.following > 0) && (
                    <div className="flex gap-3 text-sm">
                      <span>
                        <strong>{gh.followers.toLocaleString()}</strong> followers
                      </span>
                      <span>
                        <strong>{gh.following.toLocaleString()}</strong> following
                      </span>
                    </div>
                  )}
                  {(gh.location || gh.company || since) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {gh.location && <Chip icon={MapPin}>{gh.location}</Chip>}
                      {gh.company && <Chip icon={Building2}>{gh.company}</Chip>}
                      {since && <Chip icon={CalendarDays}>{since}</Chip>}
                    </div>
                  )}
                  <a
                    href={`https://github.com/${gh.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 pt-1 text-xs hover:underline"
                  >
                    View Profile <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Not authenticated. Run <code className="bg-muted rounded px-1">gh auth login</code> inside your terminal
                to link your GitHub account.
              </p>
            )}

            <div className="mt-auto border-t pt-5">
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Authentication Status
              </h4>
              <div className="flex items-center gap-2 text-sm">
                <span className={cn('size-2 rounded-full', gh.username ? 'bg-success' : 'bg-destructive')} />
                {gh.username ? 'Logged in via Keychain' : 'Logged out'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global git identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4" /> Global Git Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleUpdateGit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="git-name">
                  Global Username (<code>user.name</code>)
                </Label>
                <Input id="git-name" value={gitName} onChange={(e) => setGitName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="git-email">
                  Global Email (<code>user.email</code>)
                </Label>
                <Input
                  id="git-email"
                  type="email"
                  value={gitEmail}
                  onChange={(e) => setGitEmail(e.target.value)}
                  placeholder="johndoe@example.com"
                />
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Git Config'}
                </Button>
              </div>
            </form>

            {profile?.git?.emailMismatch && (
              <div role="alert" className="flex gap-3 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong>Email mismatch detected.</strong> Your GitHub CLI email (<code>{gh.email}</code>) differs from
                  your global git email (<code>{profile.git.globalEmail}</code>). Commits may be attributed to the wrong
                  account or appear unsigned on GitHub.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              {diagnostics.map(({ label, val }) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold break-words">{val || 'Unknown'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4" /> Runtimes &amp; Tools
            </CardTitle>
            <CardAction>
              <Button variant="secondary" size="sm" onClick={() => loadProfile(true)} disabled={refreshing}>
                <RefreshCw className={cn(refreshing && 'animate-spin')} /> {refreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile?.runtimes &&
                Object.entries(profile.runtimes).map(([key, val]) => {
                  const cleaned = typeof val === 'string' ? val.trim() : String(val || '').trim();
                  const installed = cleaned !== '' && cleaned !== 'Not Installed';
                  const isSelected = selectedMissing === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={installed}
                      onClick={() => setSelectedMissing(isSelected ? null : key)}
                      title={!installed ? 'Click to view install guide' : undefined}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-default',
                        !installed && 'hover:bg-muted/50 cursor-pointer',
                        isSelected && 'border-primary bg-muted/50',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold tracking-wide uppercase">{key}</span>
                        <Badge variant={installed ? 'green' : 'red'} className="px-1.5 py-0.5 text-[0.6rem] normal-case">
                          {installed ? 'Installed' : 'Missing'}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {installed ? cleaned : 'Click to install →'}
                      </span>
                    </button>
                  );
                })}
            </div>

            {guide && (
              <div className="border-destructive/20 bg-destructive/5 grid gap-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-destructive text-sm font-bold uppercase">Setup Guide: {selectedMissing}</h4>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelectedMissing(null)} aria-label="Close guide">
                    <X />
                  </Button>
                </div>
                <CopyBlock step="1. Install command (macOS Homebrew)" text={guide.cmd} toastMsg="Command copied!" />
                <CopyBlock step="2. Append to Path (zsh)" text={guide.path} toastMsg="Path setup copied!" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mode configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" /> Section Mode Configuration
          </CardTitle>
          <CardDescription>Define which energy mode category each navigation section belongs to.</CardDescription>
          <CardAction>
            <Button onClick={handleSaveModes} disabled={savingModes}>
              {savingModes ? 'Saving...' : 'Save'}{" "}
              <span className="hidden sm:inline">Configurations</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(localTabEnergies)
              .filter(([tabId]) => !RETIRED_TABS.has(tabId))
              .map(([tabId, currentEnergy]) => (
              <div key={tabId} className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {TAB_LABELS[tabId] || tabId.charAt(0).toUpperCase() + tabId.slice(1)}
                  </div>
                  <div className="text-muted-foreground text-xs">ID: {tabId}</div>
                </div>
                <Select
                  value={currentEnergy as string}
                  onValueChange={(v) => setLocalTabEnergies((prev) => ({ ...prev, [tabId]: v }))}
                >
                  <SelectTrigger className="w-40 shrink-0" aria-label={`${tabId} energy mode`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="low">Low Energy</SelectItem>
                    <SelectItem value="medium">Medium Energy</SelectItem>
                    <SelectItem value="high">High Energy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
