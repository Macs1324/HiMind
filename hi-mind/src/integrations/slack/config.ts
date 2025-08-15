export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
  rateLimitDelay: number; // milliseconds
}

export function getSlackConfig(): SlackConfig {
  return {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    rateLimitDelay: 1000, // Fixed 1 second rate limit
  };
}

export function validateSlackConfig(config: SlackConfig): string[] {
  const errors: string[] = [];

  if (!config.botToken) errors.push('SLACK_BOT_TOKEN is required');
  if (!config.appToken) errors.push('SLACK_APP_TOKEN is required');
  if (!config.signingSecret) errors.push('SLACK_SIGNING_SECRET is required');

  if (config.botToken && !config.botToken.startsWith('xoxb-')) {
    errors.push('SLACK_BOT_TOKEN must start with xoxb-');
  }

  if (config.appToken && !config.appToken.startsWith('xapp-')) {
    errors.push('SLACK_APP_TOKEN must start with xapp-');
  }

  return errors;
}
