import { EnvironmentVariable, McpConfig, McpConfigGroup } from '../types';
import { log } from '../utils/log';

export interface ConfigParams {
  description?: string;
  name: string;
  required?: boolean;
}
export abstract class Config {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  protected isConfigured: boolean;

  constructor({ description, name, required }: ConfigParams) {
    this.description = description;
    this.name = name;
    this.required = required || false;
    this.isConfigured = false;
  }

  protected abstract internalValidate(): Promise<boolean>;
  abstract collect(): Promise<void>;

  async validate(): Promise<boolean> {
    if (!this.isConfigured) {
      if (!this.required) {
        log.info(`${this.name} is not configured, skipping validation`);
        return true;
      }
      log.error(`${this.name} is not configured and is required`);
      return false;
    }

    return this.internalValidate();
  }
  abstract getVariables(): EnvironmentVariable[];

  isAlreadyConfigured(currentVariables: EnvironmentVariable[]): boolean {
    const expectedVariables = this.getVariables();

    return expectedVariables.every((variable) =>
      currentVariables.some((x) => x.key === variable.key && !!x.value),
    );
  }
}

export interface ConfigWithMcpServerParams extends ConfigParams, McpConfig {
  mcpName: string;
}

export abstract class ConfigWithMcpServer extends Config {
  readonly mcpConfig: McpConfig;
  readonly mcpName: string;

  constructor({
    mcpName,
    tool_prefix,
    url,
    ...baseConfig
  }: ConfigWithMcpServerParams) {
    super({ ...baseConfig });
    this.mcpConfig = { tool_prefix, url };
    this.mcpName = mcpName;
  }
  getMcpConfigGroup(): McpConfigGroup {
    return {
      [this.mcpName]: { ...this.mcpConfig, disabled: !this.isConfigured },
    };
  }
}
