import { UninitializedConfigError } from '../common/errors';
import { TigerCLI } from '../common/tiger';
import { DatabaseConfigParameters, EnvironmentVariable } from '../common/types';
import { log, parseConnectionString } from '../common/utils';
import { Config } from './config';
import { confirm, select, password } from '@inquirer/prompts';

async function selectExistingService(
  tiger: TigerCLI,
  service: any,
): Promise<DatabaseConfigParameters> {
  log.success(`Selected service: ${service.service_id}`);

  try {
    // Try to get connection string with password
    log.info('Fetching connection string with password...');
    const connectionString = await tiger.getConnectionString(
      service.service_id,
      true,
    );

    const config = parseConnectionString(connectionString);
    return {
      serviceId: service.service_id,
      ...config,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (
      errorMsg.toLowerCase().includes('keyring') ||
      errorMsg.toLowerCase().includes('password')
    ) {
      log.warning(
        'Password not found in keyring, fetching connection string without password...',
      );
      log.warning('Database password is required for proper functionality.');
      log.warning(
        'If no password is provided, services will not be started at the end of setup.',
      );

      try {
        const connectionString = await tiger.getConnectionString(
          service.service_id,
          false,
        );
        const config = parseConnectionString(connectionString);

        console.log();
        const userPassword = await password({
          message: 'Enter database password (or press Enter to skip):',
        });

        if (!userPassword) {
          log.warning(
            'No password provided. Database connection will not work.',
          );
          log.warning(
            'Services will not be started at the end of setup process.',
          );
          log.warning(
            'You can manually set the password later in the .env file.',
          );
        }

        return {
          serviceId: service.service_id,
          ...config,
          password: userPassword,
        };
      } catch (fallbackError) {
        throw new Error(`Failed to get connection string: ${fallbackError}`);
      }
    } else {
      throw error;
    }
  }
}

async function createNewTigerService(
  tiger: TigerCLI,
): Promise<DatabaseConfigParameters> {
  log.info('Creating new Tiger database...');

  try {
    const response = await tiger.createService();

    log.success(
      `Tiger database created with service ID: ${response.service_id}`,
    );

    return {
      serviceId: response.service_id,
      host: response.host || response.endpoint?.host,
      port: response.port || response.endpoint?.port,
      database: response.database,
      user: response.role,
      password: response.initial_password,
    };
  } catch (error) {
    log.error(`${error}`);
    process.exit(1);
  }
}

export class DatabaseConfig extends Config {
  private config: DatabaseConfigParameters | undefined;
  private tiger: TigerCLI;

  constructor() {
    super({ name: 'Database', required: true });
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
  }
  async validate(): Promise<boolean> {
    if (!this.config) {
      throw new UninitializedConfigError();
    }
    if (this.config.serviceId) {
      await this.tiger.waitForServiceReady(this.config.serviceId);
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
