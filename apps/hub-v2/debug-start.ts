#!/usr/bin/env bun

import { HubDaemon } from './src/daemon';

console.log('Starting hub daemon...');

const daemon = new HubDaemon({
  dbPath: './data/hub.db',
});

try {
  await daemon.initialize();
  console.log('✓ Daemon initialized');

  await daemon.start();
  console.log('✓ Daemon started');

  const status = daemon.getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));

  // Keep running
  console.log('Hub running. Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await daemon.stop();
    process.exit(0);
  });
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
