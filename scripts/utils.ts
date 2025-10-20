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
