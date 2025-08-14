export { SlackBoltApp } from "./bolt";
export {
  getSlackConfig,
  validateSlackConfig,
  type SlackConfig,
} from "./config";

// Re-export official Slack types for convenience
export type { SocketModeClient } from "@slack/socket-mode";
export type { WebClient } from "@slack/web-api";
