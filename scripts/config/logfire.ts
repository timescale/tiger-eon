import { input } from '@inquirer/prompts';
import { EnvironmentVariable } from '../common/types';
import { Config } from './config';

export class LogfireConfig extends Config {
  private token: string | undefined;
  private environment: string | undefined;
  async collect(): Promise<void> {
    console.log('Logfire Configuration (Optional)');
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
  }
  validate(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getVariables(): EnvironmentVariable[] {
    return [
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
