import { useEffect, useMemo, useState } from 'react';
import { PartyPopper } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import useAppStore, { apiFetch } from '../store/useAppStore';
import ActivityRow from './layout/ActivityRow';
import FilterBar from './layout/FilterBar';
import { ErrorMessage } from './layout/LoadingState';
import ListSkeleton from './layout/ListSkeleton';
import PageHeader from './layout/PageHeader';
import RepoSelect from './layout/RepoSelect';

export default function PRReviews() {
  const repos = useAppStore((s) => s.repos);
  const reposWithRemotes = repos.filter((r) => r.owner && r.name);

  const [selectedRepo, setSelectedRepo] = useState('');
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = async (value: string) => {
    setLoading(true);
    setError('');
    setFilter('');
    try {
      let result;
      if (!value) {
        const res = await apiFetch('/api/recents');
        const d = await res.json();
        result = (d.prs || []).map((pr) => ({ ...pr, repoName: pr.repository?.name }));
      } else {
        const [owner, name] = value.split('/');
        const res = await apiFetch(`/api/prs?owner=${owner}&name=${name}`);
        const d = await res.json();
        if (d.error) throw new Error(d.details || d.error);
        result = d.prs || [];
      }
      setPrs(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  const filtered = useMemo(
    () =>
      filter.trim()
        ? prs.filter(
            (pr) => pr.title.toLowerCase().includes(filter.toLowerCase()) || String(pr.number).includes(filter),
          )
        : prs,
    [prs, filter],
  );

  return (
    <section id="pr-reviews-section">
      <PageHeader
        title="PR Reviews"
        description="Pull requests requesting attention across your repositories."
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

      {!loading && prs.length > 0 && (
        <FilterBar
          value={filter}
          onChange={setFilter}
          placeholder="Filter by title or PR number…"
          count={`${filtered.length} of ${prs.length}`}
        />
      )}

      <div className="flex flex-col gap-3">
        {loading && <ListSkeleton />}
        {!loading && error && (
          <ErrorMessage>
            <strong>GitHub PRs Fetch Failed:</strong> {error}
          </ErrorMessage>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={PartyPopper}
            title={filter ? 'No matching PRs' : 'All clear!'}
            description={filter ? 'Try a different search term.' : 'No open pull requests found.'}
          />
        )}
        {!loading &&
          filtered.map((pr) => (
            <ActivityRow
              key={pr.url}
              url={pr.url}
              repoName={pr.repoName}
              number={pr.number}
              title={pr.title}
              author={pr.author?.login}
              createdAt={pr.createdAt}
              trailing={
                pr.reviewRequests?.length > 0 ? (
                  <Badge variant="orange">Review Requested</Badge>
                ) : (
                  <Badge variant="blue">Open</Badge>
                )
              }
            />
          ))}
      </div>
    </section>
  );
}
