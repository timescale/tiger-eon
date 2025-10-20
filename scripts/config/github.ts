import { confirm, input } from '@inquirer/prompts';
import { UninitializedConfigError } from '../errors';
import { EnvironmentVariable, McpConfigGroup } from '../types';
import { openBrowser } from '../utils';
import { ConfigWithMcpServer } from './config';
import { log } from '../utils/log';
import { validateTokenHasCorrectPrefix } from '../utils/string';

export class GithubConfig extends ConfigWithMcpServer {
  private static privateScopes = ['repo', 'read:org'];
  private static publicScopes = ['repo:status', 'public_repo'];

  private organization: string | undefined;
  private token: string | undefined;

  constructor() {
    super({
      mcpName: 'github',
      url: 'http://tiger-gh-mcp-server/mcp',
      name: 'GitHub',
      description:
        'This will configure the Tiger GitHub MCP server (https://github.com/timescale/tiger-gh-mcp-server)',
    });
  }

  async collect(): Promise<void> {
    this.organization = await input({ message: 'GITHUB_ORG:' });

    const hasPrivateAccess = await confirm({
      message: 'Do you want to include access to private repositories?',
      default: false,
    });

    const scopes = hasPrivateAccess
      ? GithubConfig.privateScopes.join(',')
      : GithubConfig.publicScopes.join(',');

    const url = `https://github.com/settings/tokens/new?description=Tiger%20Agent&scopes=${scopes}`;

    const shouldOpen = await confirm({
      message: 'Open GitHub to create personal access token?',
      default: true,
    });

    if (shouldOpen) {
      await openBrowser(url);
    }

    console.log(
      `Create a GitHub personal access token with '${scopes}' scopes\n`,
    );

    this.token = await input({
      message: 'GITHUB_TOKEN:',
      validate: (val) => validateTokenHasCorrectPrefix(val, 'ghp_'),
    });
    this.isConfigured = true;
  }
  async validate(): Promise<boolean> {
    if (!this.token || !this.organization) {
      throw new UninitializedConfigError();
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          Authorization: `token ${this.token}`,
        },
      });

      if (!res.ok) {
        log.error('Failed to validate Github token', {
          status: res.status,
          statusText: res.statusText,
        });
        return false;
      }
      const scopes = (res.headers.get('X-OAuth-Scopes') || '')
        .split(',')
        .map((x) => x.trim());

      if (GithubConfig.privateScopes.every((x) => scopes.includes(x))) {
        log.success('Validated token has private repo scopes');
      } else if (GithubConfig.publicScopes.every((x) => scopes.includes(x))) {
        log.success('Validated token has public repo scopes');
      } else {
        log.error('Invalid Github token, missing required scopes', { scopes });
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }
  getVariables(): EnvironmentVariable[] {
    return [
      { key: 'GITHUB_ORG', value: this.organization },
      { key: 'GITHUB_TOKEN', value: this.token },
    ];
  }
}
