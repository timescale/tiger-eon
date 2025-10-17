import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { EnvironmentVariable } from '../common/types';

export async function upsertEnvironmentVariables(variables: EnvironmentVariable[]): Promise<void> {
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
    const existingLineIndex = lines.findIndex(line => keyPattern.test(line));

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
}

export async function getEnvironmentVariables(): Promise<EnvironmentVariable[]> {
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
}