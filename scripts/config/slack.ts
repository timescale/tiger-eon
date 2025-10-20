import { input, select } from '@inquirer/prompts';
import { UninitializedConfigError } from '../errors';
import { EnvironmentVariable, SlackAppConfig, SlackTokens } from '../types';
import {
  copyToClipboard,
  downloadJson,
  log,
  openBrowser,
  validateTokenHasCorrectPrefix,
} from '../utils';
import { Config } from './config';

abstract class SlackConfig extends Config {
  private config: SlackAppConfig;
  private tokens: SlackTokens | undefined;
  constructor(name: string, config: SlackAppConfig) {
    super({ name: `Slack ${name} App`, required: true });
    this.config = config;
  }
  async collect(): Promise<void> {
    const manifest = await downloadJson(this.config.manifestUrl);

    const customName = await input({
      message: `App name (press Enter for '${this.config.name}'):`,
      default: this.config.name,
    });

    const customDescription = await input({
      message: `App description (press Enter for '${this.config.description}'):`,
      default: this.config.description,
    });

    // Update manifest with custom values
    manifest.display_information.name = customName;
    manifest.display_information.description = customDescription;
    if (manifest.features?.bot_user) {
      manifest.features.bot_user.display_name = customName;
    }

    console.log('\nSlack App Creation Steps:');
    console.log(
      '1. Click "Create New App" → "From a manifest" → Choose your workspace',
    );

    // Open Slack API page
    const openSlack = await select({
      message: 'Open Slack API page?',
      choices: [
        { name: 'Yes, open https://api.slack.com/apps/', value: true },
        { name: "No, I'll navigate manually", value: false },
      ],
    });

    if (openSlack) {
      await openBrowser('https://api.slack.com/apps/');
    }

    await input({
      message:
        'Press Enter after selecting your workspace and clicking Next...',
    });

    console.log(
      '\n2. Copy the manifest below and paste it into the App creation wizard:',
    );
    console.log('----------------------------------------');
    console.log(JSON.stringify(manifest, null, 2));
    console.log('----------------------------------------');
    console.log('(The manifest has been copied to clipboard if supported)\n');

    // Try to copy to clipboard if available
    try {
      await copyToClipboard(JSON.stringify(manifest, null, 2));
      console.log('(Copied to clipboard)\n');
    } catch {}

    await input({ message: 'Press Enter after creating the app...' });

    // Get App-Level Token
    console.log('\n3. Navigate to: Basic Information → App-Level Tokens');
    console.log(
      '4. Click "Generate Token and Scopes" → Enter a Token Name → Add "connections:write" scope → Generate\n',
    );

    const appToken = await input({
      message: `Please paste your ${this.config.name} App-Level Token (starts with 'xapp-'):`,
      validate: (val) => validateTokenHasCorrectPrefix(val, 'xapp-'),
    });

    // Get Bot Token
    console.log(
      '\n5. Navigate to: App Home → Show Tabs → Enable the Messages tab setting',
    );
    console.log(
      '6. Check "Allow users to send Slash commands and messages from the messages tab"',
    );
    console.log('7. Navigate to: Install App → Click "Install to [Workspace]"');
    console.log('8. After installation, copy the "Bot User OAuth Token"\n');

    const botToken = await input({
      message: `Please paste your ${this.config.name} Bot User OAuth Token (starts with 'xoxb-'):`,
      validate: (val) => validateTokenHasCorrectPrefix(val, 'xoxb-'),
    });

    this.tokens = { botToken, appToken };
  }
  async validate(): Promise<boolean> {
    if (!this.tokens) {
      throw new UninitializedConfigError();
    }
    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        headers: {
          Authorization: `Bearer ${this.tokens?.botToken}`,
        },
      });

      const data = (await response.json()) as any;
      return data.ok === true;
    } catch (error) {
      return false;
    }
  }

  getVariables(): EnvironmentVariable[] {
    return [
      {
        key: `SLACK_${this.config.type.toUpperCase()}_APP_TOKEN`,
        value: this.tokens?.appToken,
      },
      {
        key: `SLACK_${this.config.type.toUpperCase()}_BOT_TOKEN`,
        value: this.tokens?.botToken,
      },
    ];
  }
}

export class AgentSlackConfig extends SlackConfig {
  constructor() {
    super('Agent', {
      name: 'eon',
      description: 'TigerData Knowledge Base Agent',
      manifestUrl:
        'https://raw.githubusercontent.com/timescale/tiger-agents-for-work/main/slack-manifest.json',
      type: 'agent',
    });
  }
}

export class IngestSlackConfig extends SlackConfig {
  constructor() {
    super('Ingest', {
      name: 'tiger-slack-ingest',
      description: 'Receives all messages/reactions from public channels',
      manifestUrl:
        'https://raw.githubusercontent.com/timescale/tiger-slack/main/slack-app-manifest.json',
      type: 'ingest',
    });
  }
}
