/**
 * Script to clean up duplicate devices in the database
 * Keeps the most recent device for each IP+protocol combination per user
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '../src/client';
import { Devices } from '../src/schema';

async function cleanupDuplicateDevices() {
  console.log('Starting duplicate device cleanup...\n');

  // Get all users
  const allDevices = await db.query.Devices.findMany({
    orderBy: [desc(Devices.createdAt)],
  });

  console.log(`Total devices in database: ${allDevices.length}`);

  // Group devices by IP + protocol (userId is often null for discovered devices)
  const deviceGroups = new Map<string, typeof allDevices>();
  for (const device of allDevices) {
    if (device.ipAddress && device.protocol) {
      // Group by IP + protocol, handling null userId
      const key = `${device.userId || 'no-user'}:${device.ipAddress}:${device.protocol}`;
      const group = deviceGroups.get(key) || [];
      group.push(device);
      deviceGroups.set(key, group);
    }
  }

  console.log(`Device groups found: ${deviceGroups.size}\n`);

  // Find and remove duplicates
  let totalDeleted = 0;
  for (const [key, group] of deviceGroups) {
    if (group.length > 1) {
      const [keep, ...toDelete] = group;

      if (!keep) {
        console.log(`\nSkipping group ${key} - no device to keep`);
        continue;
      }

      console.log(`\nFound ${group.length} devices for ${key}`);
      console.log(
        `  Keeping: ${keep.id} (${keep.name}) - created ${keep.createdAt}`,
      );

      for (const device of toDelete) {
        console.log(
          `  Deleting: ${device.id} (${device.name}) - created ${device.createdAt}`,
        );
        await db.delete(Devices).where(eq(Devices.id, device.id));
        totalDeleted++;
      }
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log(`Total duplicates removed: ${totalDeleted}`);
  console.log(`Remaining devices: ${allDevices.length - totalDeleted}`);
}

cleanupDuplicateDevices()
  .then(() => {
    console.log('\nScript finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  });
