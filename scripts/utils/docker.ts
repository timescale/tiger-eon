import { spawn } from 'child_process';

export const composePull = async (): Promise<void> => {
  const pullProcess = spawn('docker', ['compose', 'pull'], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    pullProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker compose pull failed with exit code ${code}`));
      }
    });

    pullProcess.on('error', (error) => {
      reject(error);
    });
  });
};

export const composeUp = async (): Promise<void> => {
  // Then start the services
  const startProcess = spawn('docker', ['compose', 'up', '-d', '--build'], {
    stdio: 'inherit',
  });

  return new Promise<void>((resolve, reject) => {
    startProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker compose up failed with exit code ${code}`));
      }
    });

    startProcess.on('error', (error) => {
      reject(error);
    });
  });
};
