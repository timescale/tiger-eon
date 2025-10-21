import { EnvironmentVariable } from '../types';
import { openBrowser } from '../utils';
import { confirm, input } from '@inquirer/prompts';
import { ConfigWithMcpServer } from './config';
import { log } from '../utils/log';

export class LinearConfig extends ConfigWithMcpServer {
  readonly name = 'Linear';
  readonly description =
    'This will configure the Tiger Linear MCP server (https://github.com/timescale/tiger-linear-mcp-server)';
  readonly mcpName = 'linear';
  readonly mcpConfig = {
    url: 'http://tiger-linear-mcp-server/mcp',
  };

  private apiKey: string | undefined;

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
    this.isConfigured = true;
  }

  protected async internalValidate(): Promise<boolean> {
    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey || '',
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

  getVariablesInternal(): EnvironmentVariable[] {
    return [{ key: 'LINEAR_API_KEY', value: this.apiKey }];
  }
}
