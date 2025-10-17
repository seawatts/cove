#!/usr/bin/env tsx

import { spawn } from 'node:child_process';
import { watch as fsWatch } from 'node:fs';
import { debounce } from 'lodash-es';

// Function to run type generation
async function generateTypes() {
  console.log('🔄 Generating types...');
  try {
    const process = spawn('bun', ['gen-supabase-types'], {
      shell: true,
      stdio: 'inherit',
    });

    await new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Types generated successfully');
          resolve(code);
        } else {
          console.error('❌ Type generation failed');
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error('Error generating types:', error);
  }
}

// Debounced version of generateTypes to avoid multiple runs
const debouncedGenerateTypes = debounce(generateTypes, 1000);

// Start TypeScript compiler in watch mode
const tsc = spawn('tsc', ['--watch', '--preserveWatchOutput'], {
  shell: true,
  stdio: 'inherit',
});

// Watch for changes in schema files
const watcher = fsWatch('src/schema.ts', (event, filename) => {
  console.log(`📁 ${event} detected in ${filename}`);
  debouncedGenerateTypes();
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (watcher) watcher.close();
  tsc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  if (watcher) watcher.close();
  tsc.kill();
  process.exit(0);
});

// Initial type generation
generateTypes();
