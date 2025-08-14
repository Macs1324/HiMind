import { SlackBoltApp } from './bolt';
import { getSlackConfig } from './config';

let slackApp: SlackBoltApp | null = null;

export async function startSlackIntegration() {
  try {
    const config = getSlackConfig();
    
    console.log('🚀 Starting Slack integration...');
    
    slackApp = new SlackBoltApp(
      config.botToken,
      config.appToken
    );
    
    await slackApp.start();
    console.log('✅ Slack integration started successfully');
    
    return slackApp;
  } catch (error) {
    console.error('❌ Failed to start Slack integration:', error);
    throw error;
  }
}

export async function stopSlackIntegration() {
  if (slackApp) {
    try {
      await slackApp.stop();
      slackApp = null;
      console.log('🛑 Slack integration stopped');
    } catch (error) {
      console.error('❌ Error stopping Slack integration:', error);
    }
  }
}

export function getSlackApp(): SlackBoltApp | null {
  return slackApp;
}
