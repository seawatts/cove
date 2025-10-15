#!/usr/bin/env tsx

/**
 * Cleanup Duplicate Hub Devices
 *
 * This script removes duplicate hub devices from the database,
 * keeping only the most recent one per unique hub configuration.
 */

import { eq } from 'drizzle-orm';
import { db } from '../src/client';
import { DeviceEvents, DeviceStateHistory, Devices } from '../src/schema';

async function cleanupDuplicateHubs() {
  console.log('🔍 Finding duplicate hub devices...');

  // Find all hub devices
  const hubDevices = await db.query.Devices.findMany({
    orderBy: (devices, { desc }) => [desc(devices.createdAt)],
    where: eq(Devices.deviceType, 'hub'),
  });

  if (hubDevices.length === 0) {
    console.log('✅ No hub devices found');
    return;
  }

  console.log(`Found ${hubDevices.length} hub device(s)`);

  if (hubDevices.length === 1) {
    console.log('✅ Only one hub device exists, no cleanup needed');
    console.log(`   Hub: ${hubDevices[0]?.name} (${hubDevices[0]?.id})`);
    return;
  }

  // Group hubs by name/hostname to identify duplicates
  const hubGroups = new Map<string, typeof hubDevices>();

  for (const hub of hubDevices) {
    const key = hub.name || 'unknown';
    const group = hubGroups.get(key) || [];
    group.push(hub);
    hubGroups.set(key, group);
  }

  console.log(`\n📊 Found ${hubGroups.size} unique hub configuration(s)`);

  for (const [name, hubs] of hubGroups.entries()) {
    if (hubs.length === 1) {
      console.log(`\n✅ ${name}: 1 device (no duplicates)`);
      continue;
    }

    console.log(`\n⚠️  ${name}: ${hubs.length} devices (duplicates found)`);

    // Keep the most recent one
    const [keeper, ...toDelete] = hubs;

    if (!keeper) {
      console.log('   ❌ Error: No keeper device found');
      continue;
    }

    console.log(`   ✅ Keeping: ${keeper.id} (created: ${keeper.createdAt})`);

    for (const duplicate of toDelete) {
      console.log(
        `   🗑️  Deleting: ${duplicate.id} (created: ${duplicate.createdAt})`,
      );

      try {
        // Move related data to keeper device

        // Update DeviceEvents
        const eventCount = await db
          .update(DeviceEvents)
          .set({ deviceId: keeper.id })
          .where(eq(DeviceEvents.deviceId, duplicate.id));

        if (eventCount) {
          console.log(`      Moved ${eventCount} event(s)`);
        }

        // Update DeviceStateHistory
        const stateCount = await db
          .update(DeviceStateHistory)
          .set({ deviceId: keeper.id })
          .where(eq(DeviceStateHistory.deviceId, duplicate.id));

        if (stateCount) {
          console.log(`      Moved ${stateCount} state history record(s)`);
        }

        // Update devices that reference this as their hub
        const managedDeviceCount = await db
          .update(Devices)
          .set({ hubId: keeper.id })
          .where(eq(Devices.hubId, duplicate.id));

        if (managedDeviceCount) {
          console.log(`      Updated ${managedDeviceCount} managed device(s)`);
        }

        // Delete the duplicate
        await db.delete(Devices).where(eq(Devices.id, duplicate.id));
        console.log('      ✅ Deleted duplicate hub device');
      } catch (error) {
        console.error(
          `      ❌ Error processing duplicate ${duplicate.id}:`,
          error,
        );
      }
    }
  }

  console.log('\n✅ Cleanup complete!');

  // Show final count
  const finalCount = await db.query.Devices.findMany({
    where: eq(Devices.deviceType, 'hub'),
  });

  console.log(`\n📊 Final hub device count: ${finalCount.length}`);

  for (const hub of finalCount) {
    console.log(`   - ${hub.name} (${hub.id})`);
  }
}

// Run the cleanup
cleanupDuplicateHubs()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  });
