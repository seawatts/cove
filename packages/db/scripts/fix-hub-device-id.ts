#!/usr/bin/env tsx

/**
 * Fix Hub Device ID
 *
 * Fixes the hub device ID from device_hub_hub_* to device_hub_*
 * This happened because we accidentally doubled the 'hub' prefix.
 */

import { eq } from 'drizzle-orm';
import { db } from '../src/client';
import { Devices } from '../src/schema';

async function fixHubDeviceId() {
  console.log('🔍 Finding hub devices with incorrect IDs...');

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

  for (const hub of hubDevices) {
    // Check if the ID has the double 'hub' prefix
    if (hub.id.includes('device_hub_hub_')) {
      const correctId = hub.id.replace('device_hub_hub_', 'device_hub_');

      console.log(`\n⚠️  Found incorrect ID: ${hub.id}`);
      console.log(`   ✅ Correct ID should be: ${correctId}`);

      try {
        // Simply delete the incorrect hub device
        // The daemon will create a new one with the correct ID on next startup
        console.log(
          '   ℹ️  Deleting incorrect hub device (daemon will recreate with correct ID)',
        );

        await db.delete(Devices).where(eq(Devices.id, hub.id));

        console.log('   ✅ Deleted incorrect hub device');
        console.log(
          `   ℹ️  Restart the hub daemon to create new device with correct ID: ${correctId}`,
        );
      } catch (error) {
        console.error(`   ❌ Error fixing device ${hub.id}:`, error);
      }
    } else {
      console.log(`\n✅ ${hub.name} (${hub.id}) - ID is correct`);
    }
  }

  console.log('\n✅ Fix complete!');

  // Show final state
  const finalHubs = await db.query.Devices.findMany({
    where: eq(Devices.deviceType, 'hub'),
  });

  console.log(`\n📊 Final hub device count: ${finalHubs.length}`);
  for (const hub of finalHubs) {
    console.log(`   - ${hub.name} (${hub.id})`);
  }
}

// Run the fix
fixHubDeviceId()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during fix:', error);
    process.exit(1);
  });
