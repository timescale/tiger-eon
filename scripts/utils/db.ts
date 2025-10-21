import { password } from '@inquirer/prompts';
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
    // using the tiger cli, we can only get a connection string with
    // a password if the service was created on the same machine
    // otherwise, there is no way to fetch the password.
    // in that case, the getServiceDetails(serviceId, true // with password) will fail
    // so we will fallback to calling getConnectionString(serviceId, false) then prompt user
    // for password
    log.info('Fetching service details with password...');
    const serviceDetails = await tiger.getServiceDetails(
      service.service_id,
      true,
    );

    return {
      serviceId: service.service_id,
      host: serviceDetails.host,
      port: serviceDetails.port,
      database: serviceDetails.database,
      user: serviceDetails.role,
      password: serviceDetails.password || '',
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
        const serviceDetails = await tiger.getServiceDetails(
          service.service_id,
          false,
        );

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
          host: serviceDetails.host,
          port: serviceDetails.port,
          database: serviceDetails.database,
          user: serviceDetails.role,
          password: userPassword,
        };
      } catch (fallbackError) {
        throw new Error(`Failed to get service details: ${fallbackError}`);
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
      password: response.password,
    };
  } catch (error) {
    log.error(`${error}`);
    process.exit(1);
  }
};
