import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

/** Repo dropdown with an "all repositories" option (empty string value). */
export default function RepoSelect({
  repos,
  value,
  onChange,
  allLabel = 'All Repositories (Recent 10)',
}: {
  repos: { owner?: string; name?: string }[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  const options = [...new Set(repos.map((r) => `${r.owner}/${r.name}`))];

  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="w-full sm:w-72" aria-label="Repository">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((slug) => (
          <SelectItem key={slug} value={slug}>
            {slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
