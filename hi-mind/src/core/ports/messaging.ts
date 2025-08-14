export type NormalizedSlackMessage = {
  platform: 'slack';
  conversationType: 'channel' | 'group' | 'im' | 'mpim';
  channelId: string;
  channelName?: string;
  ts: string;
  userId?: string;
  text?: string;
  blocks?: unknown;
  files?: Array<{
    id: string;
    name?: string;
    mimetype?: string;
    filetype?: string;
    size?: number;
    permalink?: string;
    urlPrivate?: string;
    urlPrivateDownload?: string;
  }>;
  threadTs?: string;
  parentTs?: string;
  permalink?: string;
  subtype?: string;
  eventId?: string;
  raw: unknown;
};

export interface IntentDispatcher {
  handleIntentMessage(message: NormalizedSlackMessage): Promise<void>;
}

export interface PassiveDispatcher {
  ingestPassiveMessage(message: NormalizedSlackMessage): Promise<void>;
  handleUpdateOrDelete?(message: NormalizedSlackMessage): Promise<void>;
}
