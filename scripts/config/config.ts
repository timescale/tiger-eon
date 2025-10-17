import { EnvironmentVariable } from '../common/types';

export abstract class Config {
  readonly name: string;
  readonly required: boolean;

  constructor({ name, required }: { name: string; required?: boolean }) {
    this.name = name;
    this.required = required || false;
  }

  abstract collect(): Promise<void>;
  abstract validate(): Promise<boolean>;
  abstract getVariables(): EnvironmentVariable[];

  isAlreadyConfigured(currentVariables: EnvironmentVariable[]): boolean {
    const expectedVariables = this.getVariables();

    return expectedVariables.every((variable) =>
      currentVariables.some((x) => x.key === variable.key),
    );
  }
}
