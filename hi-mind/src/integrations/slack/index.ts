export { SlackClient as SimpleSlackClient } from "./slack.client";
export type { SlackResource } from "./slack.client";
export { startSlackIntegration, stopSlackIntegration, getSlackClient } from "./integration";
export { getSlackConfig, validateSlackConfig, type SlackConfig } from "./config";
export { SlackServiceImpl, type SlackService } from "./slack.service";
export { SlackRepositoryImpl, type SlackRepository } from "./slack.repository";

// Re-export official Slack types for convenience
export type { SocketModeClient } from "@slack/socket-mode";
export type { WebClient } from "@slack/web-api";
