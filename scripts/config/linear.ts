import { UninitializedConfigError } from '../common/errors';
import { EnvironmentVariable } from '../common/types';
import { log, openBrowser } from '../common/utils';
import { confirm, input } from '@inquirer/prompts';
import { Config } from './config';

export class LinearConfig extends Config {
  private apiKey: string | undefined;
  constructor() {
    super({ name: 'Linear' });
  }

  async collect(): Promise<void> {
    const shouldOpen = await confirm({
      message: 'Open Linear to create API key?',
      default: true,
    });

    if (shouldOpen) {
      await openBrowser('https://linear.app/settings/account/security');
    }

    console.log('Create a Linear API key\n');

    this.apiKey = await input({ message: 'LINEAR_API_KEY:' });
  }
  async validate(): Promise<boolean> {
    if (!this.apiKey) {
      throw new UninitializedConfigError();
    }

    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ query: `{ viewer { name email }}` }),
      });

      const payload = await res.json();

      if (!res.ok) {
        const errors = payload.errors
          ? payload.errors.map((error: any) => error.message)
          : [];
        log.error('Failed to validate Linear token', {
          status: res.status,
          statusText: res.statusText,
          errors,
        });

        return false;
      }
      log.info(
        `Validated Linear Token, belongs to name: ${payload.data?.name || 'N/A'}, email: ${payload.data?.email || 'N/A'}`,
      );
    } catch {
      return false;
    }

    return true;
  }
  getVariables(): EnvironmentVariable[] {
    return [{ key: 'LINEAR_API_KEY', value: this.apiKey }];
  }
}
