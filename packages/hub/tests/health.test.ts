import './setup';
import { describe, expect, it } from 'bun:test';
import { getHealth, getSystemInfo, resetStartTime } from '../src/health';

describe('Health Check', () => {
  it('should return health status', () => {
    resetStartTime();
    const health = getHealth();

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
    const health1 = getHealth();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    const health2 = getHealth();

    expect(health2.uptime).toBeGreaterThanOrEqual(health1.uptime);
  });
});
