/**
 * Collect: the pull requests merged into main in a period, read through the
 * GitHub CLI (`gh`), which the caller injects as `gh(args) => stdout`. Every
 * field kept is one the contract names or a fact card reads (facts.js); the
 * body, cut and whole, is kept for the models only and never written to the
 * digest.
 */
import { DATA_BRANCH, LIMITS, indexProblems, pullUrl } from './contract.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;
const COMMITS = 100;
const ISSUES = 10;

/** Newest-updated first: a pull request merged in the period was updated in it or later. */
const MERGED_PULLS_QUERY = `query($owner: String!, $name: String!, $cursor: String, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(baseRefName: "main", states: MERGED, first: $first, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url body mergedAt updatedAt additions deletions
        mergeCommit { oid }
        labels(first: 20) { nodes { name } }
        files(first: ${LIMITS.files}) { totalCount nodes { path additions deletions } }
        commits(first: ${COMMITS}) { nodes { commit { message } } }
        closingIssuesReferences(first: ${ISSUES}) { nodes { number title } }
      }
    }
  }
}`;

const notFound = error => /HTTP 404/.test(`${error?.stderr ?? ''} ${error?.message ?? ''}`);
/** A gateway that gave up on a heavy page: the same page, half as large, usually answers. */
const gaveUp = error => /HTTP 50[24]/.test(`${error?.stderr ?? ''} ${error?.message ?? ''}`);

/** index.json on the data branch, or null before the first digest. */
export async function readIndex(gh, repo) {
  let text;
  try {
    text = await gh(['api', '-H', 'Accept: application/vnd.github.raw+json', `repos/${repo}/contents/index.json?ref=${DATA_BRANCH}`]);
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
  let index;
  try {
    index = JSON.parse(text);
  } catch {
    throw new Error(`index.json on ${DATA_BRANCH} is not JSON`);
  }
  const problems = indexProblems(index);
  if (problems.length) throw new Error(`index.json on ${DATA_BRANCH} breaks the contract: ${problems[0]}`);
  return index;
}

/** Where this run's period starts: --since, else the newest digest's end, else seven days back. */
export function boundary({ index, now, since }) {
  if (since !== undefined) {
    const at = Date.parse(since);
    if (!Number.isFinite(at) || at >= now.getTime()) throw new Error('--since must be an ISO date or time before now');
    return new Date(at).toISOString();
  }
  const ends = (index?.digests ?? []).map(entry => Date.parse(entry.period.to));
  return new Date(ends.length ? Math.max(...ends) : now.getTime() - 7 * DAY_MS).toISOString();
}

function clip(text, length) {
  const characters = Array.from(text);
  return characters.length <= length ? text : `${characters.slice(0, length - 1).join('')}…`;
}

const counted = value => Number.isInteger(value) && value >= 0;
const oneLine = text => clip(text.replace(/\s+/g, ' ').trim(), LIMITS.title);

/** One GraphQL node as the contract's and the fact card's fields, or an error that names what is wrong. */
export function normalizePull(node, repo) {
  const number = node?.number;
  if (!Number.isInteger(number) || number < 1) throw new Error('A pull request without a number');
  if (node.url !== pullUrl(number, repo)) throw new Error(`#${number}: unexpected url`);
  if (typeof node.title !== 'string' || !node.title.trim()) throw new Error(`#${number}: no title`);
  if (!Number.isFinite(Date.parse(node.mergedAt))) throw new Error(`#${number}: no merge time`);
  const oid = node.mergeCommit?.oid;
  if (typeof oid !== 'string' || !/^[0-9a-f]{40}$/.test(oid)) throw new Error(`#${number}: the merge commit is not a 40-character sha`);
  const files = (node.files?.nodes ?? []).filter(file => typeof file?.path === 'string').slice(0, LIMITS.files);
  // GitHub's schema makes every line count non-null: one missing is a fault, never a count of 0 a page could publish.
  if (![node.additions, node.deletions, ...files.flatMap(file => [file.additions, file.deletions])].every(counted)) {
    throw new Error(`#${number}: no line counts`);
  }
  const characters = Array.from(typeof node.body === 'string' ? node.body : '');
  return {
    number,
    title: oneLine(node.title),
    body: characters.slice(0, LIMITS.body).join(''),
    fullBody: characters.slice(0, LIMITS.fullBody).join(''),
    bodyCut: characters.length > LIMITS.fullBody,
    url: node.url,
    mergedAt: node.mergedAt,
    mergeSha: oid,
    labels: (node.labels?.nodes ?? []).map(label => label?.name).filter(name => typeof name === 'string'),
    files: files.map(file => file.path),
    fileCount: Number.isInteger(node.files?.totalCount) ? node.files.totalCount : Infinity,
    fileStats: files.map(file => ({ path: file.path, additions: file.additions, deletions: file.deletions })),
    additions: node.additions,
    deletions: node.deletions,
    commits: (node.commits?.nodes ?? []).map(entry => entry?.commit?.message)
      .filter(message => typeof message === 'string' && message.trim())
      .slice(0, COMMITS)
      .map(message => oneLine(message.trim().split(/\r?\n/)[0])),
    issues: (node.closingIssuesReferences?.nodes ?? [])
      .filter(issue => Number.isInteger(issue?.number) && typeof issue.title === 'string')
      .slice(0, ISSUES)
      .map(issue => ({ number: issue.number, title: oneLine(issue.title) }))
  };
}

/** Every pull request merged into main after `from` and at or before `to`, newest merge first. */
export async function collectMergedPulls(gh, { repo, from, to }) {
  const [owner, name] = repo.split('/');
  const start = Date.parse(from);
  const end = Date.parse(to);
  const pulls = [];
  let cursor = null;
  const ask = first => {
    const args = ['api', 'graphql', '-f', `query=${MERGED_PULLS_QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `first=${first}`];
    if (cursor !== null) args.push('-f', `cursor=${cursor}`);
    return gh(args);
  };
  for (;;) {
    let text;
    try {
      text = await ask(PAGE_SIZE);
    } catch (error) {
      if (!gaveUp(error)) throw error;
      text = await ask(PAGE_SIZE / 2);
    }
    const response = JSON.parse(text);
    if (Array.isArray(response?.errors) && response.errors.length) {
      throw new Error(`GitHub refused the query: ${String(response.errors[0]?.message).slice(0, 200)}`);
    }
    const connection = response?.data?.repository?.pullRequests;
    if (!connection || !Array.isArray(connection.nodes)) throw new Error('GitHub answered without pull requests');
    let older = false;
    for (const node of connection.nodes) {
      if (Date.parse(node?.updatedAt) <= start) {
        older = true;
        break;
      }
      const mergedAt = Date.parse(node?.mergedAt);
      if (mergedAt > start && mergedAt <= end) pulls.push(normalizePull(node, repo));
    }
    if (older || !connection.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  return pulls.sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt) || b.number - a.number);
}
