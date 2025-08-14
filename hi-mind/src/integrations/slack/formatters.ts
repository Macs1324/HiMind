import { NormalizedSlackMessage } from '@/core/ports/messaging';
import { SlackEvent } from '@slack/bolt';

export function normalizeSlackMessage(
  event: SlackEvent,
  conversationType: 'channel' | 'group' | 'im' | 'mpim'
): NormalizedSlackMessage {
  // Debug: Log message details to track truncation
  const eventAny = event as any;
  const text = eventAny.text || '';
  const textLength = text.length;
  
  if (textLength > 0) {
    console.log(`📝 Normalizing message: ${textLength} chars, starts: "${text.substring(0, 50)}${textLength > 50 ? '...' : ''}"`);
    
    // Check for truncation indicators
    if (text.endsWith('...')) {
      console.warn(`⚠️  WARNING: Message appears to be truncated! Ends with "..."`);
    }
  }

  const normalized: NormalizedSlackMessage = {
    platform: 'slack',
    conversationType,
    channelId: (event as any).channel || (event as any).channel_id || '',
    channelName: (event as any).channel_name,
    ts: (event as any).ts || (event as any).event_ts || '',
    userId: (event as any).user || (event as any).user_id,
    text: text, // Use the extracted text variable
    blocks: (event as any).blocks,
    files: (event as any).files?.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      filetype: file.filetype,
      size: file.size,
      permalink: file.permalink,
      urlPrivate: file.url_private,
      urlPrivateDownload: file.url_private_download,
    })) || [],
    threadTs: (event as any).thread_ts,
    parentTs: (event as any).parent_user_id,
    permalink: (event as any).permalink,
    subtype: (event as any).subtype,
    eventId: (event as any).event_id,
    raw: event,
  };

  return normalized;
}

export function classifyMessage(
  event: SlackEvent,
  conversationType: 'channel' | 'group' | 'im' | 'mpim'
): 'intent' | 'passive' {
  // Intentful interactions
  if (
    conversationType === 'im' || // Direct messages
    event.type === 'app_mention' || // App mentions
    (event as any).command || // Slash commands
    (event as any).actions || // Interactive components
    (event as any).type === 'shortcut' // Global shortcuts (check raw type)
  ) {
    return 'intent';
  }

  // Passive messages
  return 'passive';
}
