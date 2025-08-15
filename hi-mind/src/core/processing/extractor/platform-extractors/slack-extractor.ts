// Slack-specific content extractor

import type { PlatformExtractor, RawContent } from '@/core/types/processing'

export interface SlackMessage {
  user: string
  text: string
  ts: string
  thread_ts?: string
  channel: string
  reactions?: Array<{
    name: string
    count: number
    users: string[]
  }>
  replies?: Array<{
    user: string
    ts: string
  }>
  files?: Array<{
    name: string
    filetype: string
    url_private: string
  }>
  attachments?: any[]
  blocks?: any[]
}

export interface SlackChannel {
  id: string
  name: string
  is_channel: boolean
  is_group: boolean
  is_im: boolean
  is_private: boolean
}

export interface SlackUser {
  id: string
  name: string
  real_name?: string
  display_name?: string
  profile?: {
    display_name?: string
    real_name?: string
    email?: string
  }
}

export class SlackExtractor implements PlatformExtractor {
  platform = 'slack'

  async extractContent(rawData: {
    message: SlackMessage
    channel: SlackChannel
    user?: SlackUser
  }): Promise<RawContent> {
    const { message, channel, user } = rawData

    // Extract and clean text content
    const content = this.extractTextContent(message)
    
    // Extract mentions and special formatting
    const mentions = this.extractMentions(message.text)
    const urls = this.extractUrls(message.text)
    
    // Process reactions
    const reactions = this.processReactions(message.reactions || [])
    
    // Determine if this is a thread reply
    const isThreadReply = Boolean(message.thread_ts && message.thread_ts !== message.ts)
    
    return {
      id: message.ts,
      platform: 'slack',
      type: isThreadReply ? 'thread' : 'message',
      content,
      author: {
        id: message.user,
        username: user?.name,
        displayName: this.getUserDisplayName(user)
      },
      metadata: {
        timestamp: this.convertSlackTimestamp(message.ts),
        url: this.generateSlackUrl(channel, message),
        parentId: message.thread_ts !== message.ts ? message.thread_ts : undefined,
        channel: channel.name,
        channelId: channel.id,
        isPrivate: channel.is_private,
        mentions,
        urls,
        reactions,
        hasFiles: Boolean(message.files?.length),
        hasAttachments: Boolean(message.attachments?.length),
        replyCount: message.replies?.length || 0,
        threadRoot: message.thread_ts === message.ts
      },
      raw: rawData
    }
  }

  validateContent(content: RawContent): boolean {
    // Skip messages that are too short or likely spam
    if (content.content.length < 10) return false
    
    // Skip messages that are just emoji reactions
    if (/^[:][a-z_]+[:]\s*$/.test(content.content.trim())) return false
    
    // Skip automated messages (bots, integrations)
    if (this.isAutomatedMessage(content)) return false
    
    // Skip messages with only URLs
    if (this.isOnlyUrls(content.content)) return false
    
    return true
  }

  async enrichContext(content: RawContent): Promise<RawContent> {
    const enrichedMetadata = { ...content.metadata }
    
    // Add channel context
    if (content.metadata.channel) {
      enrichedMetadata.channelContext = this.inferChannelContext(content.metadata.channel)
    }
    
    // Enhance with Slack-specific formatting
    enrichedMetadata.slackFormatting = this.extractSlackFormatting(content.content)
    
    // Add thread context if this is a thread reply
    if (content.metadata.parentId) {
      enrichedMetadata.threadContext = {
        isReply: true,
        parentId: content.metadata.parentId,
        position: 'reply' // Could be enhanced to show position in thread
      }
    }
    
    return {
      ...content,
      metadata: enrichedMetadata
    }
  }

  // ===========================
  // Helper Methods
  // ===========================

  private extractTextContent(message: SlackMessage): string {
    let text = message.text || ''
    
    // Handle blocks (new Slack message format)
    if (message.blocks && message.blocks.length > 0) {
      text = this.extractTextFromBlocks(message.blocks) || text
    }
    
    // Clean up Slack formatting
    text = this.cleanSlackFormatting(text)
    
    // Add file information if present
    if (message.files && message.files.length > 0) {
      const fileInfo = message.files
        .map(file => `[File: ${file.name}${file.filetype ? '.' + file.filetype : ''}]`)
        .join(' ')
      text = `${text}\n\n${fileInfo}`.trim()
    }
    
    // Add attachment information
    if (message.attachments && message.attachments.length > 0) {
      const attachmentInfo = this.extractAttachmentText(message.attachments)
      if (attachmentInfo) {
        text = `${text}\n\n${attachmentInfo}`.trim()
      }
    }
    
    return text.trim()
  }

  private extractTextFromBlocks(blocks: any[]): string {
    return blocks
      .map(block => {
        if (block.type === 'section' && block.text) {
          return block.text.text || ''
        }
        if (block.type === 'rich_text') {
          return this.extractTextFromRichText(block)
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }

  private extractTextFromRichText(richTextBlock: any): string {
    if (!richTextBlock.elements) return ''
    
    return richTextBlock.elements
      .map((element: any) => {
        if (element.type === 'rich_text_section') {
          return element.elements
            ?.map((el: any) => {
              if (el.type === 'text') return el.text
              if (el.type === 'link') return el.url
              if (el.type === 'user') return `@${el.user_id}`
              if (el.type === 'channel') return `#${el.channel_id}`
              return ''
            })
            .join('')
        }
        if (element.type === 'rich_text_preformatted') {
          return '```\n' + element.elements?.map((el: any) => el.text || '').join('') + '\n```'
        }
        if (element.type === 'rich_text_quote') {
          return '> ' + element.elements?.map((el: any) => el.text || '').join('')
        }
        return ''
      })
      .join('\n')
  }

  private cleanSlackFormatting(text: string): string {
    return text
      // Convert user mentions
      .replace(/<@([A-Z0-9]+)(\|[^>]+)?>/g, '@user')
      // Convert channel mentions
      .replace(/<#([A-Z0-9]+)(\|[^>]+)?>/g, '#channel')
      // Convert special mentions
      .replace(/<!(everyone|channel|here)>/g, '@$1')
      // Convert links
      .replace(/<(https?:\/\/[^|>]+)(\|([^>]+))?>/g, (match, url, pipe, label) => {
        return label ? `[${label}](${url})` : url
      })
      // Convert mailto links
      .replace(/<mailto:([^|>]+)(\|([^>]+))?>/g, (match, email, pipe, label) => {
        return label || email
      })
      // Clean up bold/italic formatting
      .replace(/\*([^*]+)\*/g, '*$1*') // Keep bold
      .replace(/_([^_]+)_/g, '_$1_')   // Keep italic
      // Clean up code formatting
      .replace(/`([^`]+)`/g, '`$1`')   // Keep inline code
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractMentions(text: string): string[] {
    const mentions: string[] = []
    
    // User mentions
    const userMentions = text.match(/<@([A-Z0-9]+)/g)
    if (userMentions) {
      mentions.push(...userMentions.map(m => m.replace(/<@/, '').replace(/>.*/, '')))
    }
    
    // Channel mentions
    const channelMentions = text.match(/<#([A-Z0-9]+)/g)
    if (channelMentions) {
      mentions.push(...channelMentions.map(m => m.replace(/<#/, '').replace(/>.*/, '')))
    }
    
    // Special mentions
    const specialMentions = text.match(/<!(everyone|channel|here)>/g)
    if (specialMentions) {
      mentions.push(...specialMentions.map(m => m.replace(/<!(.*?)>/, '$1')))
    }
    
    return mentions
  }

  private extractUrls(text: string): string[] {
    const urls: string[] = []
    
    // Slack-formatted URLs
    const slackUrls = text.match(/<(https?:\/\/[^|>]+)/g)
    if (slackUrls) {
      urls.push(...slackUrls.map(url => url.replace('<', '')))
    }
    
    // Plain URLs
    const plainUrls = text.match(/https?:\/\/[^\s>]+/g)
    if (plainUrls) {
      urls.push(...plainUrls)
    }
    
    return [...new Set(urls)] // Remove duplicates
  }

  private processReactions(reactions: SlackMessage['reactions']): Array<{ emoji: string; count: number; users: string[] }> {
    return (reactions || []).map(reaction => ({
      emoji: reaction.name,
      count: reaction.count,
      users: reaction.users
    }))
  }

  private getUserDisplayName(user?: SlackUser): string {
    if (!user) return 'Unknown User'
    
    return (
      user.profile?.display_name ||
      user.profile?.real_name ||
      user.display_name ||
      user.real_name ||
      user.name ||
      'Unknown User'
    )
  }

  private convertSlackTimestamp(ts: string): string {
    // Slack timestamps are in format "1234567890.123456"
    const timestamp = parseFloat(ts) * 1000
    return new Date(timestamp).toISOString()
  }

  private generateSlackUrl(channel: SlackChannel, message: SlackMessage): string {
    // This would need the workspace URL, which isn't always available
    // For now, create a placeholder URL structure
    const workspace = 'WORKSPACE' // Would need to be passed in or configured
    const channelId = channel.id
    const messageTs = message.ts.replace('.', '')
    
    return `https://${workspace}.slack.com/archives/${channelId}/p${messageTs}`
  }

  private isAutomatedMessage(content: RawContent): boolean {
    const text = content.content.toLowerCase()
    
    // Common bot patterns
    if (text.includes('webhook') || text.includes('bot')) return true
    if (text.includes('automated') || text.includes('notification')) return true
    
    // GitHub/CI integration patterns
    if (text.includes('pull request') && text.includes('merged')) return true
    if (text.includes('build') && (text.includes('passed') || text.includes('failed'))) return true
    
    // Calendar/reminder patterns
    if (text.includes('reminder:') || text.includes('meeting in')) return true
    
    return false
  }

  private isOnlyUrls(text: string): boolean {
    const cleanText = text.replace(/https?:\/\/[^\s]+/g, '').trim()
    return cleanText.length < 10
  }

  private inferChannelContext(channelName: string): {
    type: 'engineering' | 'product' | 'general' | 'support' | 'random' | 'other'
    topics: string[]
  } {
    const name = channelName.toLowerCase()
    
    if (name.includes('eng') || name.includes('dev') || name.includes('tech')) {
      return { type: 'engineering', topics: ['development', 'technical'] }
    }
    
    if (name.includes('product') || name.includes('pm')) {
      return { type: 'product', topics: ['product', 'strategy'] }
    }
    
    if (name.includes('support') || name.includes('help')) {
      return { type: 'support', topics: ['support', 'troubleshooting'] }
    }
    
    if (name.includes('random') || name.includes('off-topic')) {
      return { type: 'random', topics: ['casual', 'social'] }
    }
    
    if (name.includes('general') || name.includes('announce')) {
      return { type: 'general', topics: ['announcements', 'general'] }
    }
    
    return { type: 'other', topics: [channelName] }
  }

  private extractSlackFormatting(text: string): {
    hasBold: boolean
    hasItalic: boolean
    hasCode: boolean
    hasCodeBlocks: boolean
    hasQuotes: boolean
    hasList: boolean
  } {
    return {
      hasBold: /\*[^*]+\*/.test(text),
      hasItalic: /_[^_]+_/.test(text),
      hasCode: /`[^`]+`/.test(text),
      hasCodeBlocks: /```[\s\S]*?```/.test(text),
      hasQuotes: /^>/m.test(text),
      hasList: /^[\s]*[-*+]\s/m.test(text)
    }
  }

  private extractAttachmentText(attachments: any[]): string {
    return attachments
      .map(attachment => {
        const parts: string[] = []
        
        if (attachment.title) parts.push(`Title: ${attachment.title}`)
        if (attachment.text) parts.push(attachment.text)
        if (attachment.fallback) parts.push(attachment.fallback)
        
        return parts.join('\n')
      })
      .filter(Boolean)
      .join('\n\n')
  }
}

// Helper function to create and configure Slack extractor
export function createSlackExtractor(): SlackExtractor {
  return new SlackExtractor()
}