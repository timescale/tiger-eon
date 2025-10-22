import { EnvironmentVariable } from '../types';
import {
  upsertDockerProfile,
  upsertEnvironmentVariables,
  upsertMcpConfig,
} from '../utils/config';
import { log } from '../utils/log';
import { hasDockerProfile, hasMcpServer } from '../utils/type';

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

    if (hasDockerProfile(this)) {
      this.enableDockerProfile = false;
    }
  }
  async persist(): Promise<void> {
    const variables = this.getVariables();
    const variablesToUse = this.isConfigured
      ? variables
      : variables.map(({ key }) => ({ key: key }));

    await upsertEnvironmentVariables(variablesToUse);

    if (hasMcpServer(this)) {
      const mcpConfig = {
        [this.mcpName]: {
          ...this.mcpConfig,
          disabled: !this.isConfigured,
        },
      };

      await upsertMcpConfig(mcpConfig);
    }

    if (hasDockerProfile(this)) {
      await upsertDockerProfile(this.dockerProfile, this.enableDockerProfile);
    }
  }

  protected abstract getVariables(): EnvironmentVariable[];

  isAlreadyConfigured(currentVariables: EnvironmentVariable[]): boolean {
    const expectedVariables = this.getVariables();

    return expectedVariables.every((variable) =>
      currentVariables.some((x) => x.key === variable.key && !!x.value),
    );
  }
}
