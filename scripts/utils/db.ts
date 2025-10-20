import { TigerCLI } from '../tiger';
import { DatabaseConfigParameters } from '../types';
import { log } from './log';
import { parseConnectionString } from './string';

export const selectExistingService = async (
  tiger: TigerCLI,
  service: any,
): Promise<DatabaseConfigParameters> => {
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
};

export const createNewTigerService = async (
  tiger: TigerCLI,
): Promise<DatabaseConfigParameters> => {
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
};
