import { log } from './log';
import { confirm } from '@inquirer/prompts';
import { composePull, composeUp } from './docker';

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
    // let's pull latest images first
    composePull();

    composeUp();

    setupComplete(true);
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
