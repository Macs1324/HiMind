import { NextResponse } from 'next/server';
import { initializeSlack } from '@/lib/init-slack';

// This runs in Node.js runtime, not Edge runtime
let slackInitialized = false;

export async function GET() {
  // Initialize Slack only once
  if (!slackInitialized) {
    try {
      await initializeSlack();
      slackInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Slack:', error);
    }
  }

  return NextResponse.json({ 
    status: 'healthy',
    slack: slackInitialized ? 'running' : 'failed',
    timestamp: new Date().toISOString()
  });
}
