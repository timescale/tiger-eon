import { confirm, input } from '@inquirer/prompts';
import { EnvironmentVariable } from '../types';
import { openBrowser } from '../utils';
import { Config } from './config';
import { validateTokenHasCorrectPrefix } from '../utils/string';
import { log } from '../utils/log';

export class AnthropicConfig extends Config {
  readonly name = 'Anthropic';
  readonly description =
    'Configure the Anthropic API key, this is needed for the agent.';
  readonly required = true;

  private apiKey: string | undefined;

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
    this.isConfigured = true;
  }

  protected async internalValidate(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.apiKey || '',
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

  getVariablesInternal(): EnvironmentVariable[] {
    return [{ key: 'ANTHROPIC_API_KEY', value: this.apiKey }];
  }
}
