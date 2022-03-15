/**
 * @fileoverview Provides various kinds of CI state.
 *
 * References:
 * GitHub Actions: https://docs.github.com/en/free-pro-team@latest/actions/reference/environment-variables#default-environment-variables
 * CircleCI: https://circleci.com/docs/2.0/env-vars/#built-in-environment-variables
 */

/**
 * Shorthand to extract an environment variable.
 */
export function env(key: string): string {
  return process.env[key] ?? '';
}

/**
 * Returns true if this is a CI build.
 */
export function isCiBuild(): boolean {
  return !!env('CI');
}

/**
 * Returns true if this is a GitHub Actions build.
 */
export function isGithubActionsBuild(): boolean {
  return !!env('GITHUB_ACTIONS');
}

/**
 * Returns true if this is a CircleCI build.
 * @return {boolean}
 */
export function isCircleciBuild(): boolean {
  return !!env('CIRCLECI');
}

/**
 * Constants for reduced code size.
 */
const isGithubActions = isGithubActionsBuild();
const isCircleci = isCircleciBuild();

/**
 * Used to filter CircleCI PR branches created directly on the amphtml repo
 * (e.g.) PRs created from the GitHub web UI. Must match `push_builds_only`
 * in .circleci/config.yml.
 */
export function isCircleciPushBranch(branchName: string): boolean {
  return branchName == 'main' || /^amp-release-.*$/.test(branchName);
}

/**
 * Returns true if this is a PR build.
 */
export function isPullRequestBuild(): boolean {
  return isGithubActions
    ? env('GITHUB_EVENT_NAME') === 'pull_request'
    : isCircleci
    ? !isCircleciPushBranch(env('CIRCLE_BRANCH'))
    : false;
}

/**
 * Returns true if this is a push build.
 */
export function isPushBuild(): boolean {
  return isGithubActions
    ? env('GITHUB_EVENT_NAME') === 'push'
    : isCircleci
    ? isCircleciPushBranch(env('CIRCLE_BRANCH'))
    : false;
}

/**
 * Returns the name of the PR branch.
 */
export function ciPullRequestBranch(): string {
  return isGithubActions
    ? env('GITHUB_HEAD_REF')
    : isCircleci
    ? env('CIRCLE_BRANCH')
    : '';
}

/**
 * Returns the commit SHA being tested by a PR build.
 */
export function ciPullRequestSha(): string {
  return isGithubActions
    ? require(env('GITHUB_EVENT_PATH')).pull_request.head.sha
    : isCircleci
    ? env('CIRCLE_SHA1')
    : '';
}

/**
 * Returns the branch for push builds.
 */
export function ciPushBranch(): string {
  return isGithubActions
    ? env('GITHUB_REF')
    : isCircleci
    ? env('CIRCLE_BRANCH')
    : '';
}

/**
 * Returns the commit SHA being tested by a push build.
 */
export function ciCommitSha(): string {
  return isGithubActions
    ? env('GITHUB_SHA')
    : isCircleci
    ? env('CIRCLE_SHA1')
    : '';
}

/**
 * Returns the ID of the current build.
 */
export function ciBuildId(): string {
  return isGithubActions
    ? env('GITHUB_RUN_ID')
    : isCircleci
    ? env('CIRCLE_WORKFLOW_ID')
    : '';
}

/**
 * Returns the URL of the current build.
 */
export function ciBuildUrl(): string {
  return isGithubActions
    ? `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}` // prettier-ignore
    : isCircleci
    ? `https://app.circleci.com/pipelines/workflows/${env('CIRCLE_WORKFLOW_ID')}` // prettier-ignore
    : '';
}

/**
 * Returns the ID of the current job.
 */
export function ciJobId(): string {
  return isGithubActions
    ? env('GITHUB_RUN_NUMBER')
    : isCircleci
    ? env('CIRCLE_JOB')
    : '';
}

/**
 * Returns the URL of the current job.
 */
export function ciJobUrl(): string {
  return isGithubActions
    ? // TODO(rsimha): Try to reverse engineer the GH Actions job URL from the build URL.
      `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}` // prettier-ignore
    : isCircleci
    ? env('CIRCLE_BUILD_URL')
    : '';
}

/**
 * Returns the merge commit for a CircleCI PR build. CIRCLECI_MERGE_COMMIT is
 * populated by .circleci/fetch_merge_commit.sh.
 */
export function circleciPrMergeCommit(): string {
  return isCircleci ? env('CIRCLECI_MERGE_COMMIT') : '';
}

/**
 * Returns an identifier that is unique to each CircleCI job. This is different
 * from the workflow ID, which is common across all jobs in a workflow.
 */
export function circleciBuildNumber(): string {
  return isCircleci ? env('CIRCLE_BUILD_NUM') : '';
}

/**
 * Returns the repo slug for the ongoing build.
 */
export function ciRepoSlug(): string {
  return isGithubActions
    ? env('GITHUB_REPOSITORY')
    : isCircleci
    ? `${env('CIRCLE_PROJECT_USERNAME')}/${env('CIRCLE_PROJECT_REPONAME')}`
    : '';
}

/**
 * Returns the commit SHA being tested by a push or PR build.
 */
export function ciBuildSha(): string {
  return isPullRequestBuild() ? ciPullRequestSha() : ciCommitSha();
}
