/**
 * System Router
 * Hub system management including version checks and upgrades
 */

import { createHubRouter, publicProcedure } from '../trpc';

interface NpmRegistryResponse {
  'dist-tags': {
    latest: string;
  };
  versions: Record<string, unknown>;
}

/**
 * Compare two semver version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export const systemRouter = createHubRouter({
  /**
   * Check for available updates from npm registry
   */
  checkForUpdates: publicProcedure.query(async () => {
    try {
      // Get current version from package.json
      const packageJsonPath = new URL(
        '../../../../../apps/hub/package.json',
        import.meta.url,
      ).pathname;
      const packageJson = await Bun.file(packageJsonPath).json();
      const currentVersion = packageJson.version as string;

      // Fetch latest version from npm registry
      const response = await fetch(
        'https://registry.npmjs.org/@cove/hub/latest',
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch npm registry: ${response.statusText}`);
      }

      const data = (await response.json()) as NpmRegistryResponse;
      const latestVersion = data['dist-tags'].latest;

      // Compare versions
      const updateAvailable =
        compareVersions(latestVersion, currentVersion) > 0;

      return {
        currentVersion,
        latestVersion,
        updateAvailable,
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw new Error(
        `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }),

  /**
   * Get current hub version
   */
  getCurrentVersion: publicProcedure.query(async () => {
    try {
      const packageJsonPath = new URL(
        '../../../../../apps/hub/package.json',
        import.meta.url,
      ).pathname;
      const packageJson = await Bun.file(packageJsonPath).json();

      return {
        version: packageJson.version as string,
      };
    } catch (error) {
      console.error('Error getting current version:', error);
      throw new Error(
        `Failed to get current version: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }),

  /**
   * Trigger hub upgrade
   */
  upgradeHub: publicProcedure.mutation(async () => {
    try {
      // Run bun update @cove/hub
      const proc = Bun.spawn(['bun', 'update', '@cove/hub'], {
        stderr: 'pipe',
        stdout: 'pipe',
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`Upgrade failed: ${stderr}`);
      }

      const stdout = await new Response(proc.stdout).text();

      // Signal the hub to restart
      // We'll use exit code 42 to indicate restart needed
      process.nextTick(() => {
        process.exit(42);
      });

      return {
        message: 'Upgrade successful. Hub will restart shortly.',
        output: stdout,
        success: true,
      };
    } catch (error) {
      console.error('Error upgrading hub:', error);
      throw new Error(
        `Failed to upgrade hub: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }),
});
