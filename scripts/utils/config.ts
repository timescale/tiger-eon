import { access, readFile, rename, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { EnvironmentVariable } from '../types';

import { select } from '@inquirer/prompts';
import { log } from './log';

export const upsertEnvironmentVariables = async (
  variables: EnvironmentVariable[],
): Promise<void> => {
  const envPath = '.env';
  let envContent = '';

  // Check if .env file exists and read it
  try {
    await access(envPath, constants.F_OK);
    envContent = await readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist, start with empty content
    envContent = '';
  }

  // Split content into lines and process each variable
  let lines = envContent.split('\n');

  for (const variable of variables) {
    if (!variable.value) {
      continue; // Skip variables without values
    }

    const keyPattern = new RegExp(`^${variable.key}=`);
    const newLine = `${variable.key}=${variable.value}`;

    // Find if the key already exists
    const existingLineIndex = lines.findIndex((line) => keyPattern.test(line));

    if (existingLineIndex !== -1) {
      // Replace existing line
      lines[existingLineIndex] = newLine;
    } else {
      // Add new line (avoid adding empty lines at the end)
      if (lines.length === 1 && lines[0] === '') {
        lines[0] = newLine;
      } else {
        lines.push(newLine);
      }
    }
  }

  // Write the updated content back to the file
  const finalContent = lines.join('\n');
  await writeFile(envPath, finalContent, 'utf-8');
};

export const getEnvironmentVariables = async (): Promise<
  EnvironmentVariable[]
> => {
  const envPath = '.env';

  try {
    await access(envPath, constants.F_OK);
    const envContent = await readFile(envPath, 'utf-8');

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

      // Only add if key is not empty
      if (key) {
        variables.push({ key, value });
      }
    }

    return variables;
  } catch {
    // File doesn't exist, return empty array
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
};

async function upsertMcpConfig(selectedServices: string[]): Promise<void> {
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
