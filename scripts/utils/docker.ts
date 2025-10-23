import { spawn } from 'child_process';

export const composeUp = async (): Promise<void> => {
  const startProcess = spawn('docker', ['compose', 'up', '-d'], {
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
