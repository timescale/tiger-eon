import { DatabaseConfigParameters } from '../types';

export const parseConnectionString = (
  connectionString: string,
): DatabaseConfigParameters => {
  const match = connectionString.match(
    /postgresql:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/([^?]+)/,
  );

  if (!match) {
    throw new Error(`Invalid connection string format: ${connectionString}`);
  }

  return {
    user: match[1],
    password: match[2] || '',
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
};

export const validateTokenHasCorrectPrefix = (
  value: string,
  expectedPrefix: string,
): true | string =>
  value.startsWith(expectedPrefix) ||
  `Please enter a valid token, should begin with '${expectedPrefix}'`;
