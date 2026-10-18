import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '../store/useAppStore';
import LoadingState, { ErrorMessage } from './layout/LoadingState';
import PageHeader from './layout/PageHeader';
import { useToast } from './Toast';

export default function Releases() {
  const toast = useToast();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { path, owner, name, tag, notes }
  const [submitting, setSubmitting] = useState(false);

  const loadReleases = () =>
    apiFetch('/api/releases')
      .then((r) => r.json())
      .then((d) => setReleases(d.releases || []));

  useEffect(() => {
    setLoading(true);
    loadReleases()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRelease = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/release/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: modal.path,
          owner: modal.owner,
          name: modal.name,
          tag: modal.tag,
          notes: modal.notes,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast(result.message || 'Release tag created!', 'success');
        setModal(null);
        loadReleases();
      } else {
        toast(`Error: ${result.error || 'Failed to create release'}`, 'error');
      }
    } catch {
      toast('Error communicating with server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="releases-section">
      <PageHeader
        title="Cut Releases"
        description="Manage repository releases, view recent tag states, and check for unreleased changes."
      />

      {loading && <LoadingState label="Evaluating tag history…" />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!loading && !error && releases.length === 0 && (
        <p className="text-muted-foreground text-sm">No repositories configured yet.</p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {releases.map((release) => (
          <Card key={release.path || `${release.owner}/${release.name}`}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{release.name}</div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                    <span>
                      Tag: <strong className="text-foreground">{release.lastTag}</strong>
                    </span>
                    <span aria-hidden>•</span>
                    <span>
                      Type: <strong className="text-foreground">{release.type}</strong>
                    </span>
                  </div>
                </div>
                <Badge variant={release.requiresRelease ? 'orange' : 'green'} className="shrink-0">
                  {release.requiresRelease ? 'Pending Tag' : 'Up to Date'}
                </Badge>
              </div>

              {release.commits.length > 0 ? (
                <ul className="bg-muted/50 max-h-40 space-y-1 overflow-y-auto rounded-lg p-3 font-mono text-xs">
                  {release.commits.map((c, j) => (
                    <li key={j} className="break-words">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">All commits are tagged and fully released.</p>
              )}

              {release.requiresRelease && (
                <div>
                  <Button
                    onClick={() =>
                      setModal({ path: release.path, owner: release.owner, name: release.name, tag: '', notes: '' })
                    }
                  >
                    <Tag /> Cut Release
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Release Tag</DialogTitle>
            <DialogDescription>Tags the latest commit of {modal?.name} and publishes the notes.</DialogDescription>
          </DialogHeader>
          {modal && (
            <form className="grid gap-4" onSubmit={handleRelease}>
              <div className="grid gap-2">
                <Label htmlFor="release-tag">Tag Name (e.g. v1.0.0)</Label>
                <Input
                  id="release-tag"
                  placeholder="v1.0.0"
                  required
                  value={modal.tag}
                  onChange={(e) => setModal({ ...modal, tag: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="release-notes">Release Notes</Label>
                <Textarea
                  id="release-notes"
                  rows={6}
                  placeholder="Describe the changes..."
                  required
                  value={modal.notes}
                  onChange={(e) => setModal({ ...modal, notes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Publishing…' : 'Publish Release'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
