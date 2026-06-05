import { Octokit as OctokitCore } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

import { VERSION } from "./version.js";
import type { EndpointDefaults } from "@octokit/types";
import { RequestError } from "@octokit/request-error";

export { RequestError } from "@octokit/request-error";
export type {
  PageInfoForward,
  PageInfoBackward,
} from "@octokit/plugin-paginate-graphql";

/**
 * Maximum number of automatic retries for throttled requests (both primary and
 * secondary rate limits). The throttle plugin invokes the handlers below once
 * per limit hit, passing the running `retryCount`; we keep retrying until this
 * budget is exhausted instead of the previous single-retry behavior.
 */
const MAX_RATE_LIMIT_RETRIES = 3;

export const Octokit = OctokitCore.plugin(
  restEndpointMethods,
  paginateRest,
  paginateGraphQL,
  retry,
  throttling,
).defaults({
  userAgent: `octokit.js/${VERSION}`,
  throttle: {
    onRateLimit,
    onSecondaryRateLimit,
  },
});

export type Octokit = InstanceType<typeof Octokit>;

/**
 * Decide whether a throttled request should be retried. A non-retriable client
 * error surfaced as a 4xx `RequestError` (other than 403/429, which are the
 * rate-limit signals themselves) is never replayed -- doing so only burns more
 * of the rate-limit budget -- while transient limits are retried until
 * `MAX_RATE_LIMIT_RETRIES` is reached.
 */
function shouldRetryRateLimit(
  options: Required<EndpointDefaults>,
  octokit: InstanceType<typeof OctokitCore>,
): boolean {
  const lastError = (options.request as { lastError?: unknown }).lastError;
  if (
    lastError instanceof RequestError &&
    lastError.status >= 400 &&
    lastError.status < 500 &&
    lastError.status !== 403 &&
    lastError.status !== 429
  ) {
    octokit.log.warn(
      `Not retrying ${options.method} ${options.url}: non-retriable client error ${lastError.status}`,
    );
    return false;
  }

  return options.request.retryCount < MAX_RATE_LIMIT_RETRIES;
}

/* v8 ignore next no need to test internals of the throttle plugin -- @preserve */
function onRateLimit(
  retryAfter: number,
  options: Required<EndpointDefaults>,
  octokit: InstanceType<typeof OctokitCore>,
) {
  octokit.log.warn(
    `Request quota exhausted for request ${options.method} ${options.url}`,
  );

  if (shouldRetryRateLimit(options, octokit)) {
    octokit.log.info(
      `Retrying after ${retryAfter} seconds (attempt ${options.request.retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})!`,
    );
    return true;
  }
}

/* v8 ignore next no need to test internals of the throttle plugin -- @preserve */
function onSecondaryRateLimit(
  retryAfter: number,
  options: Required<EndpointDefaults>,
  octokit: InstanceType<typeof OctokitCore>,
) {
  octokit.log.warn(
    `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
  );

  if (shouldRetryRateLimit(options, octokit)) {
    octokit.log.info(
      `Retrying after ${retryAfter} seconds (attempt ${options.request.retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})!`,
    );
    return true;
  }
}

// Rate-limit retry budget is centralized in MAX_RATE_LIMIT_RETRIES above.
