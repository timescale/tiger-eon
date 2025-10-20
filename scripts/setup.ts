#!/usr/bin/env tsx

import { confirm, select } from '@inquirer/prompts';
import { readFile, writeFile, rename } from 'fs/promises';
import { EnvironmentVariable } from './types';
import { configs } from './config';
import { ConfigWithMcpServer } from './config/config';
import { log } from './utils/log';
import {
  checkExistingConfig,
  upsertEnvironmentVariables,
  upsertMcpConfig,
} from './utils/config';
import { startServices } from './utils/services';

const introMessage = () => {
  console.clear();

  console.log('==================================================');
  console.log('     🐅 Tiger Agent Interactive Setup');
  console.log('==================================================');
  console.log('');
  console.log("Hi! I'm eon, a TigerData agent!");
  console.log(
    "I'm going to guide you through the setup with the services you need.",
  );
  console.log('');
  console.log('The core install includes the following:');
  console.log(
    '  - a Slack App for the ingest service that will receive all messages/reactions from public channels',
  );
  console.log(
    '  - a Slack App for the agent that will receive @mentions to it',
  );
  console.log('  - a TimescaleDB instance to store the above data');
  console.log('');
  console.log('This is the workflow that we will use:');
  console.log('1. Choose between using free Tiger Cloud DB or local Docker DB');
  console.log('2. Create Slack App for Ingest & gather tokens');
  console.log('3. Create Slack App for Agent & gather tokens');
  console.log('4. Gather Anthropic API token');
  console.log('5. Determine which optional MCP servers to configure');
  console.log('6. Gather required variables for optional MCP servers');
  console.log('7. Write the .env file');
  console.log('8. Optionally, spin up the selected services');
  console.log('');
};

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
      await upsertEnvironmentVariables(vars);

      if (config instanceof ConfigWithMcpServer) {
        const mcpConfig = config.getMcpConfigGroup();
        await upsertMcpConfig(mcpConfig);
      }
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
