/** Focus values are `repo.path || owner/name` (see Repositories). */
export function repoFocusValue(repo) {
  return repo.path || `${repo.owner}/${repo.name}`;
}

/** True for a GitHub `owner/name` slug; local paths also contain '/' but never look like this. */
export function isGitHubSlug(value: string) {
  return /^[\w.-]+\/[\w.-]+$/.test(value) && !value.startsWith('.');
}

/** Local repos match by path, path-less (GitHub) repos by owner/name. */
export function isFocusRepo(repo, focusProject: string) {
  if (!focusProject) return false;
  if (repo.path) return repo.path === focusProject;
  return `${repo.owner}/${repo.name}` === focusProject;
}
