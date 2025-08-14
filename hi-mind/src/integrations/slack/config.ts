export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
  autoJoinChannels: boolean;
  backfillEnabled: boolean;
  backfillDelay: number; // milliseconds
  maxBackfillMessages: number;
  rateLimitDelay: number; // milliseconds
}

export function getSlackConfig(): SlackConfig {
  return {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    autoJoinChannels: process.env.SLACK_AUTO_JOIN_CHANNELS !== 'false',
    backfillEnabled: process.env.SLACK_BACKFILL_ENABLED !== 'false',
    backfillDelay: parseInt(process.env.SLACK_BACKFILL_DELAY || '5000'),
    maxBackfillMessages: parseInt(process.env.SLACK_MAX_BACKFILL_MESSAGES || '100'),
    rateLimitDelay: parseInt(process.env.SLACK_RATE_LIMIT_DELAY || '1000'),
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
