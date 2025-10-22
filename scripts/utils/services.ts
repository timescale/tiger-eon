import { log } from './log';
import { confirm } from '@inquirer/prompts';
import { exists } from './file';

const setupComplete = (startedServices: boolean) => {
  console.log('\n🎉 Tiger Agent setup complete!\n');

  log.info(
    startedServices ? 'Started all services' : 'Skipped service startup.',
  );

  console.log('To control service containers, you can:');
  console.log('• Start services: docker compose up -d --build');
  console.log('• Stop services: docker compose down');
  console.log('• Check logs: docker compose logs -f tiger-agent');
  console.log('• View services: docker compose ps');

  if (startedServices) {
    console.log('\nYour Tiger Agent is ready to use in Slack!');
  }
};

export async function startServices(): Promise<void> {
  console.log('\n=== Starting Services ===');

  const shouldStart = await confirm({
    message: 'Do you want to start the selected services now?',
    default: true,
  });

  if (!shouldStart) {
    setupComplete(false);
    return;
  }

  log.info('Starting Tiger Agent services...');

  try {
    const { spawn } = await import('child_process');

    // First pull the latest images
    const pullProcess = spawn('docker', ['compose', 'pull'], {
      stdio: 'inherit',
    });

    await new Promise<void>((resolve, reject) => {
      pullProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`docker compose pull failed with exit code ${code}`),
          );
        }
      });

      pullProcess.on('error', (error) => {
        reject(error);
      });
    });

    // Then start the services
    const startProcess = spawn('docker', ['compose', 'up', '-d', '--build'], {
      stdio: 'inherit',
    });

    await new Promise<void>((resolve, reject) => {
      startProcess.on('close', (code) => {
        if (code === 0) {
          setupComplete(true);
          resolve();
        } else {
          reject(new Error(`docker compose up failed with exit code ${code}`));
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
    console.log(
      'You can manually start services later by running: docker compose up -d --build',
    );
  }
}
