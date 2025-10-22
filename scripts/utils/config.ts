import { readFile, rename, writeFile } from 'fs/promises';
import { EnvironmentVariable, McpConfigGroup } from '../types';

import { select } from '@inquirer/prompts';
import { log } from './log';
import { startServices } from './services';

const ENV_FILE = '.env';
const MCP_CONFIG_FILE = 'mcp_config.json';
const DOCKER_PROFILES_VARIABLE_KEY = 'COMPOSE_PROFILES';

export const upsertEnvironmentVariables = async (
  variables: EnvironmentVariable[],
): Promise<void> => {
  const existingVariables = await getEnvironmentVariables();

  for (const { key, value } of variables) {
    const existingLineIndex = existingVariables.findIndex((x) => x.key === key);
    if (existingLineIndex !== -1) {
      // config with same key exists, update value
      existingVariables[existingLineIndex].value = value;
    } else {
      // otherwise, add a new entry
      existingVariables.push({ key, value });
    }
  }

  // Write the updated content back to the file
  const finalContent = existingVariables
    .map((x) => `${x.key}=${x.value ? x.value : ''}`)
    .join('\n');

  await writeFile(ENV_FILE, finalContent, 'utf-8');
};

export const getEnvironmentVariables = async (): Promise<
  EnvironmentVariable[]
> => {
  try {
    const envContent = await readFile(ENV_FILE, 'utf-8');

    // Parse the content into EnvironmentVariable objects
    const variables: EnvironmentVariable[] = [];
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Find the first = to split key and value
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex === -1) {
        continue; // Skip lines without =
      }

      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();

      variables.push({ key, value });
    }

    return variables;
  } catch (error) {
    return [];
  }
};

export const checkExistingConfig = async (): Promise<EnvironmentVariable[]> => {
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
          name: 'Keep existing configuration',
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
      log.info('Keeping existing configuration.');
      await startServices();
      process.exit(0);
    }

    // for each config, we will see if values already exist and if they do, the user can skip the section
    return currentEnvironmentVariables;
  } catch (error) {
    // .env doesn't exist, continue
    return [];
  }
};

export const getMcpConfig = async (): Promise<McpConfigGroup> => {
  let mcpConfig: McpConfigGroup;
  try {
    mcpConfig = JSON.parse(
      await readFile(MCP_CONFIG_FILE, 'utf-8'),
    ) as McpConfigGroup;

    return mcpConfig;
  } catch {
    return {};
  }
};

export const upsertMcpConfig = async (
  newMcpConfigs: McpConfigGroup,
): Promise<void> => {
  try {
    const existingMcpConfig = await getMcpConfig();

    for (const [name, config] of Object.entries(newMcpConfigs)) {
      existingMcpConfig[name] = config;
      log.success(
        `${config.disabled ? 'Disabled' : 'Enabled'} ${name} MCP server`,
      );
    }

    await writeFile(
      MCP_CONFIG_FILE,
      JSON.stringify(existingMcpConfig, null, 2),
    );
  } catch (error) {
    log.warning(
      'Could not update mcp_config.json - you may need to configure it manually',
    );
  }
};

export const upsertDockerProfile = async (
  profile: string,
  enabled: boolean,
) => {
  const variables = await getEnvironmentVariables();
  const dockerProfileVariable = variables.find(
    (x) => x.key === DOCKER_PROFILES_VARIABLE_KEY,
  ) || { key: DOCKER_PROFILES_VARIABLE_KEY };

  let profiles = new Set(
    (dockerProfileVariable.value || '')
      .split(',')
      .filter((x) => !!x)
      .map((x) => x.trim()),
  );

  if (enabled) {
    if (profiles.has(profile)) {
      log.info(`Docker profile ${profile} already enabled`);
      return;
    }

    profiles.add(profile);
    log.info(`Docker profile ${profile} enabled`);
  } else {
    if (!profiles.has(profile)) {
      log.info(`Docker profile ${profile} already disabled`);
      return;
    }

    profiles.delete(profile);
    log.info(`Docker profile ${profile} disabled`);
  }

  await upsertEnvironmentVariables([
    {
      key: DOCKER_PROFILES_VARIABLE_KEY,
      value: Array.from(profiles).join(','),
    },
  ]);
};
