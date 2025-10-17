import { confirm, input } from '@inquirer/prompts';
import { UninitializedConfigError } from '../common/errors';
import { EnvironmentVariable } from '../common/types';
import {
  log,
  openBrowser,
  validateTokenHasCorrectPrefix,
} from '../common/utils';
import { Config } from './config';

export class AnthropicConfig extends Config {
  private apiKey: string | undefined;
  constructor() {
    super({ name: 'Anthropic', required: true });
  }

  async collect(): Promise<void> {
    const shouldOpen = await confirm({
      message: 'Open Anthropic Console to create API key?',
      default: true,
    });

    if (shouldOpen) {
      await openBrowser('https://console.anthropic.com/settings/keys');
    }

    console.log('Create an Anthropic API key\n');

    this.apiKey = await input({
      message: 'ANTHROPIC_API_KEY:',
      validate: (val) => validateTokenHasCorrectPrefix(val, 'sk-ant'),
    });
  }
  async validate(): Promise<boolean> {
    if (!this.apiKey) {
      throw new UninitializedConfigError();
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as any;

      if (data.type === 'error') {
        return false;
      }

      log.success('Anthropic API key validated');
      return true;
    } catch (error) {
      return false;
    }
  }
  getVariables(): EnvironmentVariable[] {
    return [{ key: 'ANTHROPIC_API_KEY', value: this.apiKey }];
  }
}
