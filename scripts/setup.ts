#!/usr/bin/env tsx

import { confirm, select } from '@inquirer/prompts';
import { readFile, writeFile, rename } from 'fs/promises';
import { EnvironmentVariable } from './common/types';
import { introMessage, log, startServices } from './common/utils';
import { configs } from './config';
import {
  getEnvironmentVariables,
  upsertEnvironmentVariables,
} from './utils/env';

async function checkExistingConfig(): Promise<EnvironmentVariable[]> {
  try {
    const currentEnvironmentVariables = await getEnvironmentVariables();

    if (!currentEnvironmentVariables.length) {
      log.info('No .env file, starting with a fresh setup');
      return currentEnvironmentVariables;
    }

    const action = await select({
      message: 'Found existing .env file. What would you like to do?',
      choices: [
        {
          name: 'Modify the existing configuration',
          value: 'modify',
          description:
            'Update your current settings while preserving existing values',
        },
        {
          name: 'Start fresh with new configuration',
          value: 'fresh',
          description: 'Backup current .env and create a new configuration',
        },
        {
          name: 'Keep existing configuration and exit',
          value: 'keep',
          description: 'Leave your current setup unchanged',
        },
      ],
      default: 'modify',
    });

    if (action === 'fresh') {
      const backup = `.env.backup.${Date.now()}`;
      await rename('.env', backup);
      log.success(`Backed up existing .env file to ${backup}`);
      return [];
    } else if (action === 'keep') {
      log.info('Keeping existing configuration. Exiting.');
      process.exit(0);
    }

    // for each config, we will see if values already exist and if they do, the user can skip the section
    return currentEnvironmentVariables;
  } catch (error) {
    // .env doesn't exist, continue
    return [];
  }
}

async function updateMcpConfig(selectedServices: string[]): Promise<void> {
  try {
    const mcpConfig = JSON.parse(await readFile('mcp_config.json', 'utf-8'));

    // Enable/disable services
    for (const [service, config] of Object.entries(mcpConfig)) {
      if (typeof config === 'object' && config !== null) {
        (config as any).disabled = !selectedServices.includes(service);
        log.success(
          `${(config as any).disabled ? 'Disabled' : 'Enabled'} ${service} MCP server`,
        );
      }
    }

    await writeFile('mcp_config.json', JSON.stringify(mcpConfig, null, 2));
  } catch (error) {
    log.warning(
      'Could not update mcp_config.json - you may need to configure it manually',
    );
  }
}

export default async function setup() {
  try {
    introMessage();
    const shouldContinue = await confirm({
      message: 'Do you want to continue with the setup?',
      default: true,
    });
    if (!shouldContinue) {
      log.info('Setup cancelled by user.');
      process.exit(0);
    }

    const existingConfiguration = await checkExistingConfig();

    const configurations = configs();

    for (let config of configurations) {
      log.info(`\n${config.name} Configuration`);

      const isAlreadySetup = config.isAlreadyConfigured(existingConfiguration);

      if (isAlreadySetup) {
        const shouldSkip = await confirm({
          message:
            'This is already configured, do you want to keep existing config?',
          default: true,
        });

        if (shouldSkip) {
          continue;
        }
      }

      if (!config.required) {
        const shouldSetup = await confirm({
          message: 'This service is optional, do you wish to set this up?',
          default: true,
        });

        if (!shouldSetup) {
          continue;
        }
      }

      while (true) {
        await config.collect();

        const isValid = await config.validate();

        if (isValid) {
          break;
        }

        // TODO
      }

      const vars = config.getVariables();
      upsertEnvironmentVariables(vars);
    }

    await startServices();
  } catch (error) {
    log.error(
      `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup();
}
