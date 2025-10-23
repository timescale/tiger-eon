import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Config } from './config';
import {
  EnvironmentVariable,
  ConfigWithMcpServer,
  ConfigWithDockerProfile,
  McpConfig,
} from '../types';
import * as configUtils from '../utils/config';
// Mock dependencies
jest.mock('../utils/config');
jest.mock('../utils/log');

const mockUpsertEnvironmentVariables = configUtils.upsertEnvironmentVariables as jest.MockedFunction<typeof configUtils.upsertEnvironmentVariables>;
const mockUpsertMcpConfig = configUtils.upsertMcpConfig as jest.MockedFunction<typeof configUtils.upsertMcpConfig>;
const mockUpsertDockerProfile = configUtils.upsertDockerProfile as jest.MockedFunction<typeof configUtils.upsertDockerProfile>;

// Test implementation classes
class BasicConfig extends Config {
  readonly name = 'basic-config';
  readonly description = 'Basic configuration for testing';
  required = false;
  private apiKey = '';
  private databaseUrl = '';

  protected async internalValidate(): Promise<boolean> {
    return this.apiKey.length > 0 && this.databaseUrl.length > 0;
  }

  async collect(): Promise<void> {
    this.apiKey = 'test-api-key';
    this.databaseUrl = 'postgres://localhost:5432/test';
    this.isConfigured = true;
  }

  protected getVariables(): EnvironmentVariable[] {
    return [
      { key: 'API_KEY', value: this.apiKey },
      { key: 'DATABASE_URL', value: this.databaseUrl },
    ];
  }

  // Test helper methods
  setConfigured(configured: boolean): void {
    this.isConfigured = configured;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setDatabaseUrl(url: string): void {
    this.databaseUrl = url;
  }
}

class McpServerConfig extends Config implements ConfigWithMcpServer {
  readonly name = 'mcp-server-config';
  readonly description = 'Configuration with MCP server';
  required = true;
  readonly mcpName = 'test-server';
  readonly mcpConfig: McpConfig = {
    url: 'http://localhost:3000/mcp',
    disabled: false,
    tool_prefix: 'test',
  };
  private token = '';

  protected async internalValidate(): Promise<boolean> {
    return this.token.length > 0;
  }

  async collect(): Promise<void> {
    this.token = 'test-token';
    this.isConfigured = true;
  }

  protected getVariables(): EnvironmentVariable[] {
    return [
      { key: 'MCP_TOKEN', value: this.token },
    ];
  }

  // Test helper methods
  setConfigured(configured: boolean): void {
    this.isConfigured = configured;
  }

  setToken(token: string): void {
    this.token = token;
  }
}

class FullConfig extends Config implements ConfigWithMcpServer, ConfigWithDockerProfile {
  readonly name = 'full-config';
  readonly description = 'Configuration with both MCP server and Docker profile';
  required = true;
  readonly mcpName = 'full-server';
  readonly mcpConfig: McpConfig = {
    url: 'http://localhost:4000/mcp',
    disabled: false,
  };
  readonly dockerProfile = 'full-profile';
  enableDockerProfile = true;
  private credentials = '';

  protected async internalValidate(): Promise<boolean> {
    return this.credentials.length > 0;
  }

  async collect(): Promise<void> {
    this.credentials = 'test-credentials';
    this.isConfigured = true;
  }

  protected getVariables(): EnvironmentVariable[] {
    return [
      { key: 'FULL_CREDENTIALS', value: this.credentials },
    ];
  }

  // Test helper methods
  setConfigured(configured: boolean): void {
    this.isConfigured = configured;
  }

  setCredentials(creds: string): void {
    this.credentials = creds;
  }
}

describe('Config class', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('BasicConfig (extends Config only)', () => {
    let config: BasicConfig;

    beforeEach(() => {
      config = new BasicConfig();
    });

    describe('validation', () => {
      it('should return true for non-required config when not configured', async () => {
        config.setConfigured(false);

        const result = await config.validate();

        expect(result).toBe(true);
      });

      it('should return false for required config when not configured', async () => {
        // Create a required config
        class RequiredConfig extends BasicConfig {
          required = true;
        }
        const requiredConfig = new RequiredConfig();
        requiredConfig.setConfigured(false);

        const result = await requiredConfig.validate();

        expect(result).toBe(false);
      });

      it('should return false when internal validation fails', async () => {
        config.setConfigured(true);
        config.setApiKey(''); // Invalid - empty key

        const result = await config.validate();

        expect(result).toBe(false);
      });

      it('should return true when internal validation passes', async () => {
        config.setConfigured(true);
        config.setApiKey('valid-key');
        config.setDatabaseUrl('postgres://localhost:5432/test');

        const result = await config.validate();

        expect(result).toBe(true);
      });
    });

    describe('collection', () => {
      it('should set configuration values and mark as configured', async () => {
        expect(config['isConfigured']).toBe(false);

        await config.collect();

        expect(config['isConfigured']).toBe(true);
        expect(config['apiKey']).toBe('test-api-key');
        expect(config['databaseUrl']).toBe('postgres://localhost:5432/test');
      });
    });

    describe('disabling', () => {
      it('should mark config as not configured', () => {
        config.setConfigured(true);

        config.disable();

        expect(config['isConfigured']).toBe(false);
      });
    });

    describe('persisting', () => {
      it('should persist variables when configured', async () => {
        config.setConfigured(true);
        config.setApiKey('test-key');
        config.setDatabaseUrl('test-url');

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'API_KEY', value: 'test-key' },
          { key: 'DATABASE_URL', value: 'test-url' },
        ]);
      });

      it('should persist empty variables when not configured', async () => {
        config.setConfigured(false);

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'API_KEY' },
          { key: 'DATABASE_URL' },
        ]);
      });
    });

    describe('isAlreadyConfigured', () => {
      it('should return true when all required variables exist with values', () => {
        const currentVariables: EnvironmentVariable[] = [
          { key: 'API_KEY', value: 'existing-key' },
          { key: 'DATABASE_URL', value: 'existing-url' },
          { key: 'OTHER_VAR', value: 'other-value' },
        ];

        const result = config.isAlreadyConfigured(currentVariables);

        expect(result).toBe(true);
      });

      it('should return false when some variables are missing', () => {
        const currentVariables: EnvironmentVariable[] = [
          { key: 'API_KEY', value: 'existing-key' },
        ];

        const result = config.isAlreadyConfigured(currentVariables);

        expect(result).toBe(false);
      });

      it('should return false when variables exist but have empty values', () => {
        const currentVariables: EnvironmentVariable[] = [
          { key: 'API_KEY', value: '' },
          { key: 'DATABASE_URL', value: 'existing-url' },
        ];

        const result = config.isAlreadyConfigured(currentVariables);

        expect(result).toBe(false);
      });
    });
  });

  describe('McpServerConfig (extends Config + ConfigWithMcpServer)', () => {
    let config: McpServerConfig;

    beforeEach(() => {
      config = new McpServerConfig();
    });

    describe('validation', () => {
      it('should validate MCP configuration correctly', async () => {
        config.setConfigured(true);
        config.setToken('valid-token');

        const result = await config.validate();

        expect(result).toBe(true);
      });

      it('should fail validation when token is empty', async () => {
        config.setConfigured(true);
        config.setToken('');

        const result = await config.validate();

        expect(result).toBe(false);
      });
    });

    describe('collection', () => {
      it('should collect MCP server configuration', async () => {
        await config.collect();

        expect(config['isConfigured']).toBe(true);
        expect(config['token']).toBe('test-token');
      });
    });

    describe('disabling', () => {
      it('should disable config without affecting MCP properties', () => {
        config.setConfigured(true);

        config.disable();

        expect(config['isConfigured']).toBe(false);
        expect(config.mcpName).toBe('test-server');
        expect(config.mcpConfig.url).toBe('http://localhost:3000/mcp');
      });
    });

    describe('persisting', () => {
      it('should persist variables and MCP config when configured', async () => {
        config.setConfigured(true);
        config.setToken('test-token');

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'MCP_TOKEN', value: 'test-token' },
        ]);
        expect(mockUpsertMcpConfig).toHaveBeenCalledWith({
          'test-server': {
            url: 'http://localhost:3000/mcp',
            disabled: false,
            tool_prefix: 'test',
          },
        });
      });

      it('should persist disabled MCP config when not configured', async () => {
        config.setConfigured(false);

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'MCP_TOKEN' },
        ]);
        expect(mockUpsertMcpConfig).toHaveBeenCalledWith({
          'test-server': {
            url: 'http://localhost:3000/mcp',
            disabled: true,
            tool_prefix: 'test',
          },
        });
      });
    });
  });

  describe('FullConfig (extends Config + ConfigWithMcpServer + ConfigWithDockerProfile)', () => {
    let config: FullConfig;

    beforeEach(() => {
      config = new FullConfig();
    });

    describe('validation', () => {
      it('should validate full configuration correctly', async () => {
        config.setConfigured(true);
        config.setCredentials('valid-credentials');

        const result = await config.validate();

        expect(result).toBe(true);
      });

      it('should fail validation when credentials are empty', async () => {
        config.setConfigured(true);
        config.setCredentials('');

        const result = await config.validate();

        expect(result).toBe(false);
      });
    });

    describe('collection', () => {
      it('should collect full configuration', async () => {
        await config.collect();

        expect(config['isConfigured']).toBe(true);
        expect(config['credentials']).toBe('test-credentials');
        expect(config.enableDockerProfile).toBe(true);
      });
    });

    describe('disabling', () => {
      it('should disable config and Docker profile', () => {
        config.setConfigured(true);
        config.enableDockerProfile = true;

        config.disable();

        expect(config['isConfigured']).toBe(false);
        expect(config.enableDockerProfile).toBe(false);
      });

      it('should only disable config when Docker profile already disabled', () => {
        config.setConfigured(true);
        config.enableDockerProfile = false;

        config.disable();

        expect(config['isConfigured']).toBe(false);
        expect(config.enableDockerProfile).toBe(false);
      });
    });

    describe('persisting', () => {
      it('should persist variables, MCP config, and Docker profile when configured', async () => {
        config.setConfigured(true);
        config.setCredentials('test-credentials');
        config.enableDockerProfile = true;

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'FULL_CREDENTIALS', value: 'test-credentials' },
        ]);
        expect(mockUpsertMcpConfig).toHaveBeenCalledWith({
          'full-server': {
            url: 'http://localhost:4000/mcp',
            disabled: false,
          },
        });
        expect(mockUpsertDockerProfile).toHaveBeenCalledWith('full-profile', true);
      });

      it('should persist disabled MCP config and Docker profile when not configured', async () => {
        config.setConfigured(false);
        config.enableDockerProfile = false;

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'FULL_CREDENTIALS' },
        ]);
        expect(mockUpsertMcpConfig).toHaveBeenCalledWith({
          'full-server': {
            url: 'http://localhost:4000/mcp',
            disabled: true,
          },
        });
        expect(mockUpsertDockerProfile).toHaveBeenCalledWith('full-profile', false);
      });

      it('should handle Docker profile enabled state independently of config state', async () => {
        config.setConfigured(true);
        config.setCredentials('test-credentials');
        config.enableDockerProfile = false; // Docker disabled but config enabled

        await config.persist();

        expect(mockUpsertEnvironmentVariables).toHaveBeenCalledWith([
          { key: 'FULL_CREDENTIALS', value: 'test-credentials' },
        ]);
        expect(mockUpsertMcpConfig).toHaveBeenCalledWith({
          'full-server': {
            url: 'http://localhost:4000/mcp',
            disabled: false,
          },
        });
        expect(mockUpsertDockerProfile).toHaveBeenCalledWith('full-profile', false);
      });
    });

    describe('multiple interface interactions', () => {
      it('should handle both MCP and Docker functionality together', async () => {
        config.setConfigured(true);
        config.enableDockerProfile = true;

        // Test that both interfaces work together
        expect(config.mcpName).toBe('full-server');
        expect(config.dockerProfile).toBe('full-profile');
        expect(config.enableDockerProfile).toBe(true);

        // Test disable affects both
        config.disable();
        expect(config['isConfigured']).toBe(false);
        expect(config.enableDockerProfile).toBe(false);

        // Test persist handles both
        await config.persist();
        expect(mockUpsertMcpConfig).toHaveBeenCalled();
        expect(mockUpsertDockerProfile).toHaveBeenCalled();
      });
    });
  });

  describe('abstract class enforcement', () => {
    it('should require implementation of abstract methods', () => {
      // This is a compile-time check, but we can verify the methods exist
      const config = new BasicConfig();

      expect(typeof config.collect).toBe('function');
      expect(typeof config['internalValidate']).toBe('function');
      expect(typeof config['getVariables']).toBe('function');
      expect(typeof config.name).toBe('string');
    });
  });

  describe('error handling', () => {
    let config: BasicConfig;

    beforeEach(() => {
      config = new BasicConfig();
    });

    it('should handle persist errors gracefully', async () => {
      config.setConfigured(true);
      mockUpsertEnvironmentVariables.mockRejectedValue(new Error('Write failed'));

      // Should not throw, but let the error propagate to be handled by caller
      await expect(config.persist()).rejects.toThrow('Write failed');
    });

    it('should handle validation errors gracefully', async () => {
      config.setConfigured(true);
      // Create a config that will throw during validation
      const errorConfig = new class extends BasicConfig {
        protected async internalValidate(): Promise<boolean> {
          throw new Error('Validation error');
        }
      }();
      errorConfig.setConfigured(true);

      // The error should propagate up since validate() doesn't catch errors from internalValidate
      await expect(errorConfig.validate()).rejects.toThrow('Validation error');
    });
  });
});