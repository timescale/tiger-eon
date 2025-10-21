import { spawn } from 'child_process';
import { TigerService } from './types';

/// This is a wrapper for the TigerCLI https://github.com/timescale/tiger-cli
export class TigerCLI {
  constructor(private tigerCmd: string) {}

  async execCommand(
    args: string[],
    options: { captureOutput?: boolean } = {},
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      const child = spawn(this.tigerCmd, args, {
        stdio: options.captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      });

      let stdout = '';
      let stderr = '';

      if (options.captureOutput) {
        child.stdout?.on('data', (data) => (stdout += data.toString()));
        child.stderr?.on('data', (data) => (stderr += data.toString()));
      }

      child.on('close', (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });
    });
  }

  async checkAuth(): Promise<boolean> {
    const result = await this.execCommand(['auth', 'status'], {
      captureOutput: true,
    });
    return result.exitCode === 0;
  }

  async login(): Promise<void> {
    console.log('Not authenticated with Tiger, starting login...');
    await this.execCommand(['auth', 'login']);
  }

  async listServices(): Promise<TigerService[]> {
    const result = await this.execCommand(['service', 'list', '-o', 'json'], {
      captureOutput: true,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list services: ${result.stderr}`);
    }

    if (!result.stdout.trim()) {
      return [];
    }

    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`Failed to parse service list: ${result.stdout}`);
    }
  }

  async getConnectionString(
    serviceId: string,
    withPassword = true,
  ): Promise<string> {
    const args = ['db', 'connection-string', serviceId];
    if (withPassword) {
      args.push('--with-password');
    }

    const result = await this.execCommand(args, { captureOutput: true });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get connection string: ${result.stderr}`);
    }

    return result.stdout.trim();
  }

  async createService(): Promise<any> {
    const result = await this.execCommand(
      [
        'service',
        'create',
        '--no-wait',
        '--name',
        'tiger-eon',
        '--with-password',
        '-o',
        'json',
      ],
      { captureOutput: true },
    );

    if (result.exitCode !== 0) {
      const error = result.stderr;

      if (error.toLowerCase().includes('free service limit')) {
        throw new Error(
          'You have reached your free service limit. Please delete an existing service or upgrade to a paid plan.\n\n' +
            `To delete an existing service, run: ${this.tigerCmd} service delete <service-id>\n` +
            `To list your services, run: ${this.tigerCmd} service list`,
        );
      }

      throw new Error(`Failed to create Tiger service: ${error}`);
    }

    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(
        `Failed to parse service creation response: ${result.stdout}`,
      );
    }
  }

  async getServiceStatus(serviceId: string): Promise<string> {
    const result = await this.execCommand(
      ['service', 'describe', '-o', 'json', serviceId],
      { captureOutput: true },
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get service status: ${result.stderr}`);
    }

    try {
      const service = JSON.parse(result.stdout);
      return service.status;
    } catch (error) {
      throw new Error(`Failed to parse service status: ${result.stdout}`);
    }
  }

  async waitForServiceReady(serviceId: string): Promise<void> {
    console.log('Waiting for Tiger database to be ready...');

    while (true) {
      try {
        const status = await this.getServiceStatus(serviceId);

        if (status === 'READY') {
          console.log('✓ Tiger database is ready');
          return;
        }

        process.stdout.write('.');
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds
      } catch (error) {
        throw new Error(`Error checking service status: ${error}`);
      }
    }
  }
}
