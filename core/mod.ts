import * as gh from "../gh-wrapper/mod.ts";
import { fetchHistory } from "./fetch_history.ts";
import { fetchSha } from "./fetch_sha.ts";
import { fetchTags } from "./fetch_tags.ts";
import { GhDescribeError } from "./gh_describe_error.ts";
import { resolveRepo } from "./resolve_repo.ts";
import { searchTag } from "./search_tags.ts";

export default ghDescribe;

interface Repo {
  owner: string;
  repo: string;
  host?: string;
}

interface GhDescribeOutput {
  /**
   * `git describe --tags` like describe.
   */
  describe: string;

  /**
   * Most recent tag.
   */
  tag: string;

  /**
   * The number of additional commits from most recent tag.
   */
  distance: number;

  /**
   * 	Object name for the commit itself.
   */
  sha: string;
}

interface GhDescribeOptions {
  /**
   * Target repository. Defaults to origin if omitted. Format: OWNER/REPO
   *
   * @default
   */
  repo?: string | Repo;

  /**
   * Target Commit-ish object name. Defaults to HEAD if omitted.
   */
  commitish?: string;

  /**
   * Only consider tags matching the given glob pattern.
   */
  match?: string | RegExp | (string | RegExp)[];

  /**
   * Do not consider tags matching the given glob pattern.
   */
  exclude?: string | RegExp | (string | RegExp)[];

  /**
   * If the name is not found, use this value.
   */
  defaultTag?: string;
}

/**
 * Emulate `git describe --tags` in shallow clone repository.
 */
export async function ghDescribe(
  {
    repo: maybeRepo,
    commitish,
    defaultTag,
    match,
    exclude,
  }: GhDescribeOptions = {},
): Promise<GhDescribeOutput> {
  const { owner, repo, host } = await resolveRepo(maybeRepo);

  const [tags, { sha, histories }] = await Promise.all([
    fetchTags({ owner, repo, host, match, exclude }),
    (async () => {
      const sha = await fetchSha({ owner, repo, host, sha: commitish });
      const histories = fetchHistory({ owner, repo, host, sha });
      return { sha, histories };
    })(),
  ]);

  const { distance, tag } = (await searchTag(tags, histories)) || {
    distance: 0,
    tag: defaultTag,
  };

  if (!tag) {
    throw new GhDescribeError("No names found, cannot describe anything.");
  }

  const describe = genDescribe(tag, distance, sha);
  return { describe, tag, distance, sha };
}

export async function fetchTotalCommit({ owner, repo, host }: Repo, sha: string) {
  const stdout = await gh.graphql({ host })`
  {
    repository(owner: "${owner}", name: "${repo}") {
      object(expression: "${sha}") {
        ... on Commit {
          history(first: 0) {
            totalCount
          }
        }
      }
    }
  }`;
  const repository = JSON.parse(stdout);
  return repository.object.history.totalCount;
}

export function genDescribe(tag: string, distance: number, sha: string) {
  if (distance === 0) {
    return tag;
  } else {
    return `${tag}-${distance}-g${sha.substring(0, 7)}`;
  }
}
