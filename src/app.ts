import { App as DefaultApp } from "@octokit/app";
import { OAuthApp as DefaultOAuthApp } from "@octokit/oauth-app";

import { Octokit } from "./octokit.js";

export const App = DefaultApp.defaults({ Octokit });
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({
  Octokit: App as unknown as typeof Octokit,
});
export type OAuthApp = InstanceType<typeof OAuthApp>;

export { createNodeMiddleware } from "@octokit/app";
