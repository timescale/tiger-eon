import { confirm, input } from '@inquirer/prompts';
import { UninitializedConfigError } from '../common/errors';
import { EnvironmentVariable } from '../common/types';
import {
  log,
  openBrowser,
  validateTokenHasCorrectPrefix,
} from '../common/utils';
import { Config } from './config';

export class GithubConfig extends Config {
  private static privateScopes = ['repo', 'read:org'];
  private static publicScopes = ['repo:status', 'public_repo'];

  private organization: string | undefined;
  private token: string | undefined;

  constructor() {
    super({ name: 'GitHub' });
  }

  async collect(): Promise<void> {
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

    this.organization = await input({ message: 'GITHUB_ORG:' });
    this.token = await input({
      message: 'GITHUB_TOKEN:',
      validate: (val) => validateTokenHasCorrectPrefix(val, 'ghp_'),
    });
  }
  async validate(): Promise<boolean> {
    if (!this.token || !this.organization) {
      throw new UninitializedConfigError();
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${this.token}`,
        },
        body: JSON.stringify({ query: `{ viewer { name email }}` }),
      });

      if (!res.ok) {
        log.error('Failed to validate Github token', {
          status: res.status,
          statusText: res.statusText,
        });
        return false;
      }
      const scopes = (res.headers.get('X-OAuth-Scopes') || '').split(',');

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
