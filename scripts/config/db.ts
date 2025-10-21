import { TigerCLI } from '../tiger';
import { DatabaseConfigParameters, EnvironmentVariable } from '../types';
import { createNewTigerService, selectExistingService } from '../utils/db';
import { log } from '../utils/log';
import { Config } from './config';
import { confirm, select } from '@inquirer/prompts';

export class DatabaseConfig extends Config {
  private config: DatabaseConfigParameters | undefined;
  private tiger: TigerCLI;

  constructor() {
    super({
      name: 'Database',
      description:
        'Configure a TimescaleDB instance, where Slack messages + agent events are stored.',
      required: true,
    });
    this.tiger = new TigerCLI(process.env.TIGER_CMD || './download/tiger');
  }

  async collect(): Promise<void> {
    const useTigerCloud = await confirm({
      message: 'Do you want to use a hosted Tiger Cloud Database?',
      default: true,
    });

    if (!useTigerCloud) {
      log.info('Will use local docker-compose database');

      // return a config that targets the docker containers
      this.config = {
        host: 'db',
        port: 5432,
        database: 'tsdb',
        user: 'tsdbadmin',
        password: 'password',
      };
    }

    log.success(
      'Will use Tiger Cloud Database. Note: will use free services if you are on a free plan',
    );

    const isAuthenticated = await this.tiger.checkAuth();
    if (!isAuthenticated) {
      await this.tiger.login();
    }

    const services = await this.tiger.listServices();

    if (
      services.length > 0 &&
      (await confirm({
        message: 'Do you want to use an existing Tiger Cloud instance?',
        default: false,
      }))
    ) {
      console.log('\nAvailable services:');

      type ChoiceValue =
        | { type: 'existing'; service: any; index: number }
        | { type: 'new' };

      const choices: { name: string; value: ChoiceValue }[] = services.map(
        (service, index) => ({
          name: `Service ID: ${service.service_id}
        Created: ${service.created}
        Status: ${service.status}
        Name: ${service.name}
        Host: ${service.host || service.endpoint?.host || 'N/A'}
        Console URL: ${service.console_url || 'N/A'}`,
          value: { type: 'existing' as const, service, index },
        }),
      );

      choices.push({
        name: 'Create a new service',
        value: { type: 'new' as const },
      });

      const selection = await select({
        message: 'Select option:',
        choices,
      });

      if (selection.type === 'new') {
        this.config = await createNewTigerService(this.tiger);
      } else {
        this.config = await selectExistingService(
          this.tiger,
          selection.service,
        );
      }
    } else {
      log.info(
        'No existing tiger-eon services found. Creating a new service...',
      );
      this.config = await createNewTigerService(this.tiger);
    }
    this.isConfigured = true;
  }

  protected async internalValidate(): Promise<boolean> {
    if (this.config!.serviceId) {
      await this.tiger.waitForServiceReady(this.config!.serviceId);
    }
    return true;
  }

  getVariables(): EnvironmentVariable[] {
    return [
      { key: 'PGHOST', value: this.config?.host },
      { key: 'PGPORT', value: `${this.config?.port}` },
      { key: 'PGDATABASE', value: this.config?.database },
      { key: 'PGUSER', value: this.config?.user },
      { key: 'PGPASSWORD', value: this.config?.password },
    ];
  }
}
