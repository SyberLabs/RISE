/**
 * The repository a Changes run may read (docs/plans/RISE-CHANGES.md).
 *
 * A public digest runs on the caller's runner. This gate stops a private
 * repository, and a name that is not owner/name, before any pull-request body
 * is read and before any model is asked. GitHub's own record is the authority:
 * the run continues only when that record says the repository is public and is
 * the one that was asked for. A failure says so in one sentence and repeats
 * nothing GitHub returned.
 */

export const PUBLIC_REPOSITORY_REFUSAL = 'The repository is not public, so the run stops before reading it';

/** A repository record larger than this is refused unparsed. A real record is far smaller. */
const MAX_RECORD = 128 * 1024;

/**
 * owner is 1–39 characters, alphanumeric, with hyphens not at either end.
 * name is 1–100 of those characters plus `.` and `_`. A second check refuses
 * `.`, `..`, a `..` segment and a `.git` suffix, which the character class allows.
 */
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A sentence when `repo` is not `owner/name`; null when it is. */
export function repositoryNameProblems(repo) {
  if (typeof repo !== 'string' || !NAME.test(repo)) return 'The repository must be owner/name';
  const name = repo.slice(repo.indexOf('/') + 1);
  if (name === '.' || name === '..' || name.includes('..') || name.endsWith('.git')) return 'The repository must be owner/name';
  return null;
}

/**
 * A sentence when `record` is not GitHub's public record of `repo`; null when it is.
 * `private` must be boolean false and `visibility` must be the string `public`.
 * An internal repository fails that, and so does a missing flag.
 */
export function publicRepositoryProblems(repo, record) {
  if (!isObject(record)) return 'GitHub did not return the repository';
  if (record.full_name !== repo) return 'GitHub returned a different repository, so the run stops before reading it';
  if (record.private !== false || record.visibility !== 'public') return PUBLIC_REPOSITORY_REFUSAL;
  return null;
}

/** Throw unless GitHub says `repo` is public. `gh` is the same injected command the collector uses. */
export async function requirePublicRepository(gh, repo) {
  const name = repositoryNameProblems(repo);
  if (name) throw new Error(name);
  const slash = repo.indexOf('/');
  const owner = repo.slice(0, slash);
  const repository = repo.slice(slash + 1);
  let text;
  try {
    text = await gh(['api', '--method', 'GET', `repos/${owner}/${repository}`]);
  } catch {
    throw new Error(PUBLIC_REPOSITORY_REFUSAL);
  }
  if (typeof text !== 'string' || text.length > MAX_RECORD) throw new Error(PUBLIC_REPOSITORY_REFUSAL);
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw new Error(PUBLIC_REPOSITORY_REFUSAL);
  }
  const problem = publicRepositoryProblems(repo, record);
  if (problem) throw new Error(problem);
}
