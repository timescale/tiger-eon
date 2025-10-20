import { EnvironmentVariable } from '../types';

export abstract class Config {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;

  constructor({
    description,
    name,
    required,
  }: {
    description?: string;
    name: string;
    required?: boolean;
  }) {
    this.description = description;
    this.name = name;
    this.required = required || false;
  }

  abstract collect(): Promise<void>;
  abstract validate(): Promise<boolean>;
  abstract getVariables(): EnvironmentVariable[];

  isAlreadyConfigured(currentVariables: EnvironmentVariable[]): boolean {
    const expectedVariables = this.getVariables();

    return expectedVariables.every((variable) =>
      currentVariables.some((x) => x.key === variable.key && !!x.value),
    );
  }
}
