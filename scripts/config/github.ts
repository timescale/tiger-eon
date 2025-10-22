import { confirm, input } from '@inquirer/prompts';
import {
  ConfigWithDockerProfile,
  ConfigWithMcpServer,
  EnvironmentVariable,
} from '../types';
import { openBrowser } from '../utils';
import { log } from '../utils/log';
import { validateTokenHasCorrectPrefix } from '../utils/string';
import { Config } from './config';

export class GithubConfig
  extends Config
  implements ConfigWithMcpServer, ConfigWithDockerProfile
{
  readonly dockerProfile = 'github';
  enableDockerProfile = false;
  readonly name = 'GitHub';
  readonly description =
    'This will configure the Tiger GitHub MCP server (https://github.com/timescale/tiger-gh-mcp-server)';
  readonly mcpName = 'github';
  readonly mcpConfig = {
    url: 'http://tiger-gh-mcp-server/mcp',
  };

  private static privateScopes = ['repo', 'read:org'];
  private static publicScopes = ['repo:status', 'public_repo'];

  private organization: string | undefined;
  private token: string | undefined;

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
    this.enableDockerProfile = true;
  }

  protected async internalValidate(): Promise<boolean> {
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

  getDockerProfile(): string {
    return 'github';
  }
}
