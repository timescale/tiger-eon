import { log } from './log';
import { confirm } from '@inquirer/prompts';
import { exists } from './file';

export async function startServices(): Promise<void> {
  console.log('\n=== Starting Services ===');

  if (!(await exists('./start.sh'))) {
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
