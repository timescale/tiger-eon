import { access } from 'fs/promises';
import { DatabaseConfigParameters } from './types';
import { confirm } from '@inquirer/prompts';

const colors = {
  RED: '\x1b[0;31m',
  GREEN: '\x1b[0;32m',
  YELLOW: '\x1b[1;33m',
  BLUE: '\x1b[0;34m',
  NC: '\x1b[0m',
};

export const log = {
  info: (msg: string, params?: any) =>
    console.log(`${colors.BLUE}ℹ${colors.NC} ${msg}`, params),
  success: (msg: string, params?: any) =>
    console.log(`${colors.GREEN}✓${colors.NC} ${msg}`, params),
  warning: (msg: string, params?: any) =>
    console.log(`${colors.YELLOW}⚠${colors.NC} ${msg}`, params),
  error: (msg: string, params?: any) =>
    console.log(`${colors.RED}✗${colors.NC} ${msg}`, params),
};

export const introMessage = () => {
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

export const parseConnectionString = (
  connectionString: string,
): DatabaseConfigParameters => {
  const match = connectionString.match(
    /postgresql:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/([^?]+)/,
  );

  if (!match) {
    throw new Error(`Invalid connection string format: ${connectionString}`);
  }

  return {
    user: match[1],
    password: match[2] || '',
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
};

export const openBrowser = async (url: string): Promise<void> => {
  const { spawn } = await import('child_process');

  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      spawn('open', [url], { detached: true });
    } else if (platform === 'linux') {
      spawn('xdg-open', [url], { detached: true });
    } else {
      console.log(`Please manually open: ${url}`);
    }
  } catch (error) {
    console.log(`Please manually open: ${url}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
};

export const copyToClipboard = async (text: string): Promise<void> => {
  const { spawn } = await import('child_process');
  const platform = process.platform;

  return new Promise((resolve, reject) => {
    let proc: any;

    if (platform === 'darwin') {
      proc = spawn('pbcopy');
    } else if (platform === 'linux') {
      // Try xclip first, then wl-copy
      proc = spawn('xclip', ['-selection', 'clipboard']);
      proc.on('error', () => {
        proc = spawn('wl-copy');
      });
    } else {
      return reject(new Error('Clipboard not supported on this platform'));
    }

    proc.stdin.write(text);
    proc.stdin.end();

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Failed to copy to clipboard'));
      }
    });
  });
};

export const downloadJson = async (url: string): Promise<any> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to download from ${url}: ${error}`);
  }
};

export const validateTokenHasCorrectPrefix = (
  value: string,
  expectedPrefix: string,
): true | string =>
  value.startsWith(expectedPrefix) ||
  `Please enter a valid token, should begin with '${expectedPrefix}'`;

export async function startServices(): Promise<void> {
  console.log('\n=== Starting Services ===');

  try {
    await access('./start.sh');
  } catch (error) {
    log.error('start.sh not found!');
    return;
  }

  const shouldStart = await confirm({
    message: 'Do you want to start the selected services now?',
    default: true,
  });

  if (!shouldStart) {
    log.info('Skipping service startup.');
    console.log('\n🎉 Tiger Agent setup complete!\n');
    console.log('To start services later, run:');
    console.log('• ./start.sh\n');
    console.log('Once started, you can:');
    console.log('• Check logs: docker compose logs -f tiger-agent');
    console.log('• View services: docker compose ps');
    console.log('• Stop services: docker compose down');
    return;
  }

  log.info('Starting Tiger Agent services...');

  try {
    const { spawn } = await import('child_process');
    const startProcess = spawn('./start.sh', [], { stdio: 'inherit' });

    await new Promise<void>((resolve, reject) => {
      startProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n🎉 Tiger Agent setup complete!\n');
          console.log('Services started. You can now:');
          console.log('• Check logs: docker compose logs -f app');
          console.log('• View services: docker compose ps');
          console.log('• Stop services: docker compose down');
          console.log('\nYour Tiger Agent is ready to use in Slack!');
          resolve();
        } else {
          reject(new Error(`start.sh failed with exit code ${code}`));
        }
      });

      startProcess.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    log.error(
      `Failed to start services: ${error instanceof Error ? error.message : error}`,
    );
    console.log('\n🎉 Tiger Agent setup complete!\n');
    console.log(
      'Configuration written successfully, but service startup failed.',
    );
    console.log('You can manually start services later by running: ./start.sh');
  }
}
