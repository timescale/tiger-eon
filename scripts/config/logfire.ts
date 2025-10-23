import { input } from '@inquirer/prompts';
import { EnvironmentVariable } from '../types';
import { Config } from './config';

export class LogfireConfig extends Config {
  readonly name = 'Logfire';
  readonly description = 'Logfire provides observability and monitoring.';

  private token: string | undefined;
  private environment: string | undefined;

  async collect(): Promise<void> {
    console.log(
      'Logfire provides observability and monitoring. Tiger Agent will work without it.',
    );
    this.token = await input({
      message: 'Enter your Logfire Token (or press Enter to skip):',
    });

    this.environment = await input({
      message: 'Enter your environment (or press Enter to skip):',
      default: 'development',
    });
    this.isConfigured = true;
  }

  protected internalValidate(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getVariables(): EnvironmentVariable[] {
    return [
      { key: 'INSTRUMENT', value: 'true' },
      { key: 'LOGFIRE_TOKEN', value: this.token },
      { key: 'LOGFIRE_ENVIRONMENT', value: this.environment },
      {
        key: 'LOGFIRE_TRACES_ENDPOINT',
        value: 'https://logfire-api.pydantic.dev/v1/traces',
      },
      {
        key: 'LOGFIRE_LOGS_ENDPOINT',
        value: 'https://logfire-api.pydantic.dev/v1/logs',
      },
    ];
  }
}
