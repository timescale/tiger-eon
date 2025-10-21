#!/usr/bin/env tsx

// Simple CLI runner that defaults to setup
const command = process.argv[2] || 'setup';

async function main() {
  try {
    const module = await import(`./${command}.ts`);

    if (module.default && typeof module.default === 'function') {
      await module.default();
    } else {
      console.error(`No default export found in ${command}.ts`);
      process.exit(1);
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`Command '${command}' not found`);
      console.log('Available commands: setup');
    } else {
      console.error(`Error: ${error.message || error}`);
    }
    process.exit(1);
  }
}

main();