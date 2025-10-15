#!/usr/bin/env bun

/**
 * Script to update device ownership (userId and orgId)
 * Usage: bun scripts/update-device-ownership.ts <deviceId> <newUserId> <newOrgId>
 */

import { eq } from '@cove/db';
import { db } from '@cove/db/client';
import { Devices } from '@cove/db/schema';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // List all devices
    console.log('📋 Listing all devices...\n');

    const devices = await db.query.Devices.findMany({
      columns: {
        id: true,
        ipAddress: true,
        name: true,
        orgId: true,
        protocol: true,
        userId: true,
      },
      limit: 20,
      orderBy: (devices, { desc }) => [desc(devices.createdAt)],
    });

    if (!devices || devices.length === 0) {
      console.log('No devices found');
      process.exit(0);
    }

    console.log('Recent devices:');
    console.log('─'.repeat(100));
    for (const device of devices) {
      console.log(
        `ID: ${device.id}\n` +
          `Name: ${device.name}\n` +
          `Protocol: ${device.protocol}\n` +
          `IP: ${device.ipAddress || 'N/A'}\n` +
          `User ID: ${device.userId || 'NULL'}\n` +
          `Org ID: ${device.orgId || 'NULL'}\n` +
          '─'.repeat(100),
      );
    }

    console.log(
      '\n💡 Usage: bun scripts/update-device-ownership.ts <deviceId> <newUserId> <newOrgId>',
    );
    process.exit(0);
  }

  if (args.length !== 3) {
    console.error(
      '❌ Usage: bun scripts/update-device-ownership.ts <deviceId> <newUserId> <newOrgId>',
    );
    process.exit(1);
  }

  const [deviceId, newUserId, newOrgId] = args;

  console.log('🔄 Updating device ownership...');
  console.log(`Device ID: ${deviceId}`);
  console.log(`New User ID: ${newUserId}`);
  console.log(`New Org ID: ${newOrgId}\n`);

  // Update the device
  const result = await db
    .update(Devices)
    .set({
      orgId: newOrgId,
      userId: newUserId,
    })
    .where(eq(Devices.id, deviceId))
    .returning();

  if (!result || result.length === 0) {
    console.error('❌ Device not found');
    process.exit(1);
  }

  console.log('✅ Device ownership updated successfully!');
  console.log('\nUpdated device:');
  console.log(JSON.stringify(result[0], null, 2));
}

main().catch(console.error);
