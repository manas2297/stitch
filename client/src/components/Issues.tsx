import { useEffect, useMemo, useState } from 'react';
import { CircleCheck } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import useAppStore, { apiFetch } from '../store/useAppStore';
import ActivityRow from './layout/ActivityRow';
import FilterBar from './layout/FilterBar';
import { ErrorMessage } from './layout/LoadingState';
import ListSkeleton from './layout/ListSkeleton';
import PageHeader from './layout/PageHeader';
import RepoSelect from './layout/RepoSelect';

const ALL_LABELS = '__all__';

export default function Issues() {
  const repos = useAppStore((s) => s.repos);
  const reposWithRemotes = repos.filter((r) => r.owner && r.name);

  const [selectedRepo, setSelectedRepo] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  const load = async (value: string) => {
    setLoading(true);
    setError('');
    setFilter('');
    setLabelFilter('');
    try {
      let result;
      if (!value) {
        const res = await apiFetch('/api/recents');
        const d = await res.json();
        result = (d.issues || []).map((i) => ({ ...i, repoName: i.repository?.name }));
      } else {
        const [owner, name] = value.split('/');
        const res = await apiFetch(`/api/issues?owner=${owner}&name=${name}`);
        const d = await res.json();
        if (d.error) throw new Error(d.details || d.error);
        result = d.issues || [];
      }
      setIssues(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => i.labels?.forEach((l) => set.add(String(l.name))));
    return [...set].sort();
  }, [issues]);

  const filtered = useMemo(() => {
    let result = issues;
    if (filter.trim()) {
      result = result.filter(
        (i) => i.title.toLowerCase().includes(filter.toLowerCase()) || String(i.number).includes(filter),
      );
    }
    if (labelFilter) {
      result = result.filter((i) => i.labels?.some((l) => l.name === labelFilter));
    }
    return result;
  }, [issues, filter, labelFilter]);

  return (
    <section id="issues-section">
      <PageHeader
        title="Open Issues"
        description="Find outstanding bugs and features to tackle."
        actions={
          <RepoSelect
            repos={reposWithRemotes}
            value={selectedRepo}
            onChange={(v) => {
              setSelectedRepo(v);
              load(v);
            }}
          />
        }
      />

      {!loading && issues.length > 0 && (
        <FilterBar
          value={filter}
          onChange={setFilter}
          placeholder="Filter by title or issue number…"
          count={`${filtered.length} of ${issues.length}`}
        >
          {allLabels.length > 0 && (
            <Select value={labelFilter || ALL_LABELS} onValueChange={(v) => setLabelFilter(v === ALL_LABELS ? '' : v)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LABELS}>All Labels</SelectItem>
                {allLabels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FilterBar>
      )}

      <div className="flex flex-col gap-3">
        {loading && <ListSkeleton />}
        {!loading && error && (
          <ErrorMessage>
            <strong>GitHub Issues Fetch Failed:</strong> {error}
          </ErrorMessage>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={CircleCheck}
            title={filter || labelFilter ? 'No matching issues' : 'No open issues'}
            description={filter || labelFilter ? 'Try a different filter.' : 'Your repos are looking healthy!'}
          />
        )}
        {!loading &&
          filtered.map((issue) => (
            <ActivityRow
              key={issue.url}
              url={issue.url}
              repoName={issue.repoName}
              number={issue.number}
              title={issue.title}
              author={issue.author?.login}
              createdAt={issue.createdAt}
              extra={issue.labels?.map((l) => {
                const name = String(l.name);
                return (
                  <button key={name} type="button" onClick={() => setLabelFilter(name === labelFilter ? '' : name)}>
                    <Badge
                      variant="default"
                      className={cn(
                        'border text-[0.68rem] normal-case transition-colors hover:bg-muted',
                        name === labelFilter && 'border-primary text-primary',
                      )}
                    >
                      {name}
                    </Badge>
                  </button>
                );
              })}
            />
          ))}
      </div>
    </section>
  );
}
