import { EnvironmentVariable, McpConfig, McpConfigGroup } from '../types';
import { log } from '../utils/log';

export abstract class Config {
  abstract readonly name: string;
  readonly description: string = '';
  readonly required: boolean = false;
  protected isConfigured = false;

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

    const isValid = await this.internalValidate();
    if (!isValid) {
      log.error(`${this.name} configuration failed validation`);
      return false;
    }
    log.success(`${this.name} configuration validated`);

    return true;
  }

  disable(): void {
    this.isConfigured = false;
  }

  getVariables(): EnvironmentVariable[] {
    const variables = this.getVariablesInternal();
    return this.isConfigured
      ? variables
      : variables.map(({ key }) => ({ key: key }));
  }

  abstract getVariablesInternal(): EnvironmentVariable[];

  isAlreadyConfigured(currentVariables: EnvironmentVariable[]): boolean {
    const expectedVariables = this.getVariablesInternal();

    return expectedVariables.every((variable) =>
      currentVariables.some((x) => x.key === variable.key && !!x.value),
    );
  }
}

export abstract class ConfigWithMcpServer extends Config {
  abstract readonly mcpConfig: McpConfig;
  abstract readonly mcpName: string;

  getMcpConfigGroup(): McpConfigGroup {
    return {
      [this.mcpName]: {
        ...this.mcpConfig,
        disabled: !this.isConfigured,
      },
    };
  }
}
