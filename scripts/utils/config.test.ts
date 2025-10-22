import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { access, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
  getEnvironmentVariables,
  upsertEnvironmentVariables,
  getMcpConfig,
  upsertMcpConfig,
  upsertDockerProfile,
} from './config';

// Mock fs/promises, fs, and log utility
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('./log');
const mockAccess = access as jest.MockedFunction<typeof access>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('config utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getEnvironmentVariables', () => {
    it('should return empty array when .env file does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('File not found'));

      const result = await getEnvironmentVariables();

      expect(result).toEqual([]);
    });

    it('should parse .env file correctly', async () => {
      const envContent = `
# This is a comment
DATABASE_URL=postgres://localhost:5432/db
API_KEY=sk-1234567890abcdef
EMPTY_LINE_ABOVE=yes

# Another comment
LOG_LEVEL=info
`;
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(envContent);

      const result = await getEnvironmentVariables();

      expect(result).toEqual([
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'API_KEY', value: 'sk-1234567890abcdef' },
        { key: 'EMPTY_LINE_ABOVE', value: 'yes' },
        { key: 'LOG_LEVEL', value: 'info' },
      ]);
    });

    it('should handle lines without equals sign', async () => {
      const envContent = `
DATABASE_URL=postgres://localhost:5432/db
INVALID_LINE_WITHOUT_EQUALS
API_KEY=test-key
`;
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(envContent);

      const result = await getEnvironmentVariables();

      expect(result).toEqual([
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'API_KEY', value: 'test-key' },
      ]);
    });

    it('should handle values with multiple equals signs', async () => {
      const envContent = `CONNECTION_STRING=user=admin;password=secret123;host=localhost`;
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(envContent);

      const result = await getEnvironmentVariables();

      expect(result).toEqual([
        {
          key: 'CONNECTION_STRING',
          value: 'user=admin;password=secret123;host=localhost',
        },
      ]);
    });
  });

  describe('upsertEnvironmentVariables', () => {
    it('should create new .env file with variables', async () => {
      mockAccess.mockRejectedValue(new Error('File not found'));

      const variables = [
        { key: 'API_KEY', value: 'test-key' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
      ];

      await upsertEnvironmentVariables(variables);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=test-key\nDATABASE_URL=postgres://localhost:5432/db',
        'utf-8',
      );
    });

    it('should update existing variables and add new ones', async () => {
      const existingEnv = `API_KEY=old-key\nLOG_LEVEL=debug`;
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(existingEnv);

      const variables = [
        { key: 'API_KEY', value: 'new-key' }, // Update existing
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' }, // Add new
      ];

      await upsertEnvironmentVariables(variables);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=new-key\nLOG_LEVEL=debug\nDATABASE_URL=postgres://localhost:5432/db',
        'utf-8',
      );
    });

    it('should not save a value when value is undefined', async () => {
      const existingEnv = `API_KEY=old-key\nLOG_LEVEL=debug`;
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(existingEnv);

      const variables = [
        { key: 'API_KEY' }, // Update existing using no value
      ];

      await upsertEnvironmentVariables(variables);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=\nLOG_LEVEL=debug',
        'utf-8',
      );
    });
  });

  describe('getMcpConfig', () => {
    it('should return empty object when mcp_config.json does not exist', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await getMcpConfig();

      expect(result).toEqual({});
      expect(mockReadFile).toHaveBeenCalledWith('mcp_config.json', 'utf-8');
    });

    it('should parse mcp_config.json correctly when file exists', async () => {
      const mcpConfigContent = {
        slack: {
          url: 'http://tiger-slack-mcp-server/mcp',
          disabled: true,
        },
        github: {
          url: 'http://tiger-gh-mcp-server/mcp',
          tool_prefix: 'github',
          disabled: false,
        },
        linear: {
          url: 'http://tiger-linear-mcp-server/mcp',
          disabled: true,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mcpConfigContent));

      const result = await getMcpConfig();

      expect(result).toEqual(mcpConfigContent);
      expect(mockReadFile).toHaveBeenCalledWith('mcp_config.json', 'utf-8');
    });

    it('should handle malformed JSON and return empty object', async () => {
      const invalidJsonContent = '{ "slack": { "url": "test", invalid json }';

      mockReadFile.mockResolvedValue(invalidJsonContent);

      const result = await getMcpConfig();

      expect(result).toEqual({});
    });

    it('should handle file read errors and return empty object', async () => {
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      const result = await getMcpConfig();

      expect(result).toEqual({});
    });

    it('should handle empty mcp_config.json file', async () => {
      mockReadFile.mockResolvedValue('{}');

      const result = await getMcpConfig();

      expect(result).toEqual({});
    });

    it('should handle config with minimal service definition', async () => {
      const minimalConfig = {
        basic_service: {
          url: 'http://localhost:3000/mcp',
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(minimalConfig));

      const result = await getMcpConfig();

      expect(result).toEqual(minimalConfig);
    });

    it('should handle config with all optional fields', async () => {
      const fullConfig = {
        comprehensive_service: {
          url: 'http://comprehensive-server/mcp',
          disabled: false,
          tool_prefix: 'comp',
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(fullConfig));

      const result = await getMcpConfig();

      expect(result).toEqual(fullConfig);
    });
  });

  describe('upsertMcpConfig', () => {
    it('should merge new configs with existing configs', async () => {
      const existingConfig = {
        slack: {
          url: 'http://tiger-slack-mcp-server/mcp',
          disabled: true,
        },
        github: {
          url: 'http://tiger-gh-mcp-server/mcp',
          disabled: false,
        },
      };

      const newConfigs = {
        github: {
          url: 'http://tiger-gh-mcp-server/mcp',
          disabled: true, // Update existing
        },
        linear: {
          url: 'http://tiger-linear-mcp-server/mcp',
          disabled: false, // Add new
        },
      };

      const expectedConfig = {
        slack: {
          url: 'http://tiger-slack-mcp-server/mcp',
          disabled: true,
        },
        github: {
          url: 'http://tiger-gh-mcp-server/mcp',
          disabled: true,
        },
        linear: {
          url: 'http://tiger-linear-mcp-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      await upsertMcpConfig(newConfigs);

      expect(mockReadFile).toHaveBeenCalledWith('mcp_config.json', 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(expectedConfig, null, 2),
      );
    });

    it('should add new configs to empty existing config', async () => {
      const existingConfig = {};
      const newConfigs = {
        slack: {
          url: 'http://tiger-slack-mcp-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      await upsertMcpConfig(newConfigs);

      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(newConfigs, null, 2),
      );
    });

    it('should handle configs with all optional properties', async () => {
      const existingConfig = {};
      const newConfigs = {
        comprehensive: {
          url: 'http://comprehensive-server/mcp',
          disabled: true,
          tool_prefix: 'comp',
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      await upsertMcpConfig(newConfigs);

      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(newConfigs, null, 2),
      );
    });

    it('should overwrite existing service completely', async () => {
      const existingConfig = {
        github: {
          url: 'http://old-github-server/mcp',
          disabled: false,
          tool_prefix: 'old-gh',
        },
      };

      const newConfigs = {
        github: {
          url: 'http://new-github-server/mcp',
          disabled: true,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      await upsertMcpConfig(newConfigs);

      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(newConfigs, null, 2),
      );
    });

    it('should handle file read errors gracefully', async () => {
      const newConfigs = {
        test: {
          url: 'http://test-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockRejectedValue(new Error('File not found'));

      await upsertMcpConfig(newConfigs);

      expect(mockReadFile).toHaveBeenCalledWith('mcp_config.json', 'utf-8');
      // When file read fails, it should start with empty config and still write
      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(newConfigs, null, 2),
      );
    });

    it('should handle malformed JSON in existing config', async () => {
      const newConfigs = {
        test: {
          url: 'http://test-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockResolvedValue('{ invalid json }');

      await upsertMcpConfig(newConfigs);

      // When JSON parsing fails, it should start with empty config and still write
      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(newConfigs, null, 2),
      );
    });

    it('should handle write file errors gracefully', async () => {
      const existingConfig = {};
      const newConfigs = {
        test: {
          url: 'http://test-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));
      mockWriteFile.mockRejectedValue(new Error('Permission denied'));

      await upsertMcpConfig(newConfigs);

      expect(mockReadFile).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should handle empty new configs', async () => {
      const existingConfig = {
        slack: {
          url: 'http://slack-server/mcp',
          disabled: false,
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      await upsertMcpConfig({});

      expect(mockWriteFile).toHaveBeenCalledWith(
        'mcp_config.json',
        JSON.stringify(existingConfig, null, 2),
      );
    });
  });

  describe('modifyDockerProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should enable a Docker profile when profile does not exist in COMPOSE_PROFILES', async () => {
      const existingEnv = 'API_KEY=test-key\nLOG_LEVEL=debug';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=test-key\nLOG_LEVEL=debug\nCOMPOSE_PROFILES=github',
        'utf-8',
      );
    });

    it('should enable a Docker profile when COMPOSE_PROFILES exists but is empty', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=test-key\nCOMPOSE_PROFILES=github',
        'utf-8',
      );
    });

    it('should add a Docker profile to existing COMPOSE_PROFILES', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=db';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=test-key\nCOMPOSE_PROFILES=db,github',
        'utf-8',
      );
    });

    it('should not add a Docker profile if it already exists in COMPOSE_PROFILES', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=db,github';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      // Should not call writeFile since profile already exists
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should remove a Docker profile from COMPOSE_PROFILES', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=db,github,linear';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', false);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=test-key\nCOMPOSE_PROFILES=db,linear',
        'utf-8',
      );
    });

    it('should not modify COMPOSE_PROFILES when trying to remove non-existent profile', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=db';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', false);

      // Should not call writeFile since profile doesn't exist
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle empty COMPOSE_PROFILES when trying to remove profile', async () => {
      const existingEnv = 'API_KEY=test-key\nCOMPOSE_PROFILES=';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', false);

      // Should not call writeFile since profile doesn't exist
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle case when no .env file exists and enabling profile', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await upsertDockerProfile('github', true);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'COMPOSE_PROFILES=github',
        'utf-8',
      );
    });

    it('should handle case when no .env file exists and disabling profile', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await upsertDockerProfile('github', false);

      // Should not call writeFile since profile doesn't exist and we're disabling
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle multiple profiles in COMPOSE_PROFILES correctly', async () => {
      const existingEnv = 'COMPOSE_PROFILES=db,github,linear,monitoring';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('linear', false);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'COMPOSE_PROFILES=db,github,monitoring',
        'utf-8',
      );
    });

    it('should handle profiles with whitespace in COMPOSE_PROFILES', async () => {
      const existingEnv = 'COMPOSE_PROFILES= db , github , linear ';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('monitoring', true);

      // Note: The implementation trims whitespace and filters out empty strings
      // Profile names are cleaned up and joined with commas (no spaces)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'COMPOSE_PROFILES=db,github,linear,monitoring',
        'utf-8',
      );
    });

    it('should enable profile when COMPOSE_PROFILES contains only the profile being enabled', async () => {
      const existingEnv = 'COMPOSE_PROFILES=github';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      // Should not call writeFile since profile already exists
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should handle removing the only profile from COMPOSE_PROFILES', async () => {
      const existingEnv = 'COMPOSE_PROFILES=github';
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', false);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'COMPOSE_PROFILES=',
        'utf-8',
      );
    });

    it('should preserve other environment variables when modifying Docker profiles', async () => {
      const existingEnv = `API_KEY=secret123
DATABASE_URL=postgres://localhost:5432/db
COMPOSE_PROFILES=db
LOG_LEVEL=info`;
      mockReadFile.mockResolvedValue(existingEnv);

      await upsertDockerProfile('github', true);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        'API_KEY=secret123\nDATABASE_URL=postgres://localhost:5432/db\nCOMPOSE_PROFILES=db,github\nLOG_LEVEL=info',
        'utf-8',
      );
    });
  });
});
