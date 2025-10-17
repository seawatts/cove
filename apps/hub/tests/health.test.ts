import './setup';
import { describe, expect, it } from 'bun:test';
import { HubDaemon } from '../src/daemon';
import { getHealth, getSystemInfo, resetStartTime } from '../src/health';

describe('Health Check', () => {
  it('should return health status', () => {
    resetStartTime();
    const daemon = new HubDaemon('test-hub');
    const health = getHealth(daemon);

    expect(health.status).toBe('healthy');
    expect(health.version).toBeDefined();
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.components).toBeDefined();
    expect(health.stats).toBeDefined();
    expect(health.timestamp).toBeInstanceOf(Date);
  });

  it('should return system info', () => {
    const info = getSystemInfo();

    expect(info.platform).toBeDefined();
    expect(info.arch).toBeDefined();
    expect(info.memory).toBeDefined();
    expect(info.memory.total).toBeGreaterThan(0);
  });

  it('should track uptime correctly', async () => {
    resetStartTime();
    const daemon = new HubDaemon('test-hub');
    const health1 = getHealth(daemon);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    const health2 = getHealth(daemon);

    expect(health2.uptime).toBeGreaterThanOrEqual(health1.uptime);
  });

  it('should include hub-specific health information', () => {
    const daemon = new HubDaemon('test-hub');
    const health = getHealth(daemon);

    expect(health.components).toBeDefined();
    expect(health.components.database).toBeDefined();
    expect(health.components.discovery).toBeDefined();
    expect(health.components.adapters).toBeDefined();
  });
});
