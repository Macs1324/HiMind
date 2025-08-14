export { SlackBoltApp } from './bolt';
export { SlackClient } from './client';
export { SlackIngestService } from './ingest_service';
export { normalizeSlackMessage, classifyMessage } from './formatters';
export { getSlackConfig, validateSlackConfig, type SlackConfig } from './config';

// Re-export types from core ports
export type { NormalizedSlackMessage, IntentDispatcher, PassiveDispatcher } from '@/core/ports/messaging';

// Re-export official Slack types for convenience
export type { SlackEvent, AppMentionEvent, FileShareMessageEvent, MessageChangedEvent, MessageDeletedEvent } from '@slack/bolt';
