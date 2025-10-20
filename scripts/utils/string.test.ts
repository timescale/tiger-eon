import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { parseConnectionString, validateTokenHasCorrectPrefix } from './string';

describe('string utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('parseConnectionString', () => {
    it('should parse a complete PostgreSQL connection string correctly', () => {
      const connectionString =
        'postgresql://username:password123@localhost:5432/mydatabase';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: 'username',
        password: 'password123',
        host: 'localhost',
        port: 5432,
        database: 'mydatabase',
      });
    });

    it('should parse connection string without password', () => {
      const connectionString = 'postgresql://admin@db.example.com:5433/testdb';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: 'admin',
        password: '',
        host: 'db.example.com',
        port: 5433,
        database: 'testdb',
      });
    });

    it('should parse connection string with complex password containing special characters', () => {
      const connectionString =
        'postgresql://user:p$ssw0rd!#$%@hostname:5432/database_name';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: 'user',
        password: 'p$ssw0rd!#$%',
        host: 'hostname',
        port: 5432,
        database: 'database_name',
      });
    });

    it('should parse connection string with underscores and hyphens in names', () => {
      const connectionString =
        'postgresql://test_user:my-password@test-db.company.com:5432/my_database_2024';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: 'test_user',
        password: 'my-password',
        host: 'test-db.company.com',
        port: 5432,
        database: 'my_database_2024',
      });
    });

    it('should parse connection string with numeric username', () => {
      const connectionString = 'postgresql://12345:secret@192.168.1.100:5432/db1';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: '12345',
        password: 'secret',
        host: '192.168.1.100',
        port: 5432,
        database: 'db1',
      });
    });

    it('should throw error for invalid connection string format', () => {
      const invalidConnectionString = 'invalid-connection-string';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        'Invalid connection string format: invalid-connection-string',
      );
    });

    it('should throw error for connection string missing protocol', () => {
      const invalidConnectionString = 'username:password@localhost:5432/database';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        `Invalid connection string format: ${invalidConnectionString}`,
      );
    });

    it('should throw error for connection string missing host', () => {
      const invalidConnectionString = 'postgresql://username:password@:5432/database';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        `Invalid connection string format: ${invalidConnectionString}`,
      );
    });

    it('should throw error for connection string missing port', () => {
      const invalidConnectionString = 'postgresql://username:password@localhost:/database';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        `Invalid connection string format: ${invalidConnectionString}`,
      );
    });

    it('should throw error for connection string missing database', () => {
      const invalidConnectionString = 'postgresql://username:password@localhost:5432/';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        `Invalid connection string format: ${invalidConnectionString}`,
      );
    });

    it('should throw error for connection string with non-numeric port', () => {
      const invalidConnectionString = 'postgresql://username:password@localhost:abc/database';

      expect(() => parseConnectionString(invalidConnectionString)).toThrow(
        `Invalid connection string format: ${invalidConnectionString}`,
      );
    });

    it('should handle connection string with query parameters by ignoring them', () => {
      const connectionString =
        'postgresql://user:pass@host:5432/db?ssl=true&timeout=30';

      const result = parseConnectionString(connectionString);

      expect(result).toEqual({
        user: 'user',
        password: 'pass',
        host: 'host',
        port: 5432,
        database: 'db',
      });
    });
  });

  describe('validateTokenHasCorrectPrefix', () => {
    it('should return true when token has correct prefix', () => {
      const token = 'sk-ant-api03-1234567890abcdef';
      const expectedPrefix = 'sk-ant-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe(true);
    });

    it('should return true when token starts exactly with expected prefix', () => {
      const token = 'xoxb-123456789-abcdefghijk';
      const expectedPrefix = 'xoxb-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe(true);
    });

    it('should return true when token is exactly the prefix', () => {
      const token = 'prefix';
      const expectedPrefix = 'prefix';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe(true);
    });

    it('should return error message when token has incorrect prefix', () => {
      const token = 'wrong-prefix-1234567890';
      const expectedPrefix = 'sk-ant-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'sk-ant-'");
    });

    it('should return error message when token is completely different', () => {
      const token = 'totally-different-token';
      const expectedPrefix = 'xapp-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'xapp-'");
    });

    it('should return error message when token is empty string', () => {
      const token = '';
      const expectedPrefix = 'sk-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'sk-'");
    });

    it('should return error message when token is shorter than prefix', () => {
      const token = 'sk';
      const expectedPrefix = 'sk-ant-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'sk-ant-'");
    });

    it('should handle case-sensitive prefix validation', () => {
      const token = 'SK-ANT-1234567890';
      const expectedPrefix = 'sk-ant-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'sk-ant-'");
    });

    it('should validate with complex prefix containing special characters', () => {
      const token = 'api_key_v2.1-test_token_123';
      const expectedPrefix = 'api_key_v2.1-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe(true);
    });

    it('should return error for token with partial prefix match', () => {
      const token = 'sk-an-incomplete-prefix';
      const expectedPrefix = 'sk-ant-';

      const result = validateTokenHasCorrectPrefix(token, expectedPrefix);

      expect(result).toBe("Please enter a valid token, should begin with 'sk-ant-'");
    });
  });
});