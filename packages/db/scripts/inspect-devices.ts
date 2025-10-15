/**
 * Script to inspect devices in the database
 */

import { desc } from 'drizzle-orm';
import { db } from '../src/client';
import { Devices } from '../src/schema';

async function inspectDevices() {
  console.log('Inspecting devices in database...\n');

  const allDevices = await db.query.Devices.findMany({
    orderBy: [desc(Devices.createdAt)],
  });

  console.log(`Total devices: ${allDevices.length}\n`);

  // Group by various criteria to understand the data
  const byProtocol = new Map<string, number>();
  const byIp = new Map<string, number>();
  const withUserId = allDevices.filter((d) => d.userId).length;
  const withProtocol = allDevices.filter((d) => d.protocol).length;
  const withIp = allDevices.filter((d) => d.ipAddress).length;

  for (const device of allDevices) {
    if (device.protocol) {
      byProtocol.set(
        device.protocol,
        (byProtocol.get(device.protocol) || 0) + 1,
      );
    }
    if (device.ipAddress) {
      byIp.set(device.ipAddress, (byIp.get(device.ipAddress) || 0) + 1);
    }
  }

  console.log('Summary:');
  console.log(`  Devices with userId: ${withUserId}`);
  console.log(`  Devices with protocol: ${withProtocol}`);
  console.log(`  Devices with ipAddress: ${withIp}\n`);

  console.log('By Protocol:');
  for (const [protocol, count] of byProtocol) {
    console.log(`  ${protocol}: ${count}`);
  }

  console.log('\nBy IP Address (showing duplicates):');
  for (const [ip, count] of byIp) {
    if (count > 1) {
      console.log(`  ${ip}: ${count} devices`);
      const devicesWithIp = allDevices.filter((d) => d.ipAddress === ip);
      for (const device of devicesWithIp) {
        console.log(
          `    - ${device.id} (${device.name}) protocol:${device.protocol} userId:${device.userId || 'null'}`,
        );
      }
    }
  }

  console.log('\nRecent devices:');
  for (const device of allDevices.slice(0, 10)) {
    console.log(
      `  ${device.id} | ${device.name} | ${device.deviceType} | protocol:${device.protocol || 'null'} | ip:${device.ipAddress || 'null'} | userId:${device.userId || 'null'}`,
    );
  }
}

inspectDevices()
  .then(() => {
    console.log('\nInspection complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error during inspection:', error);
    process.exit(1);
  });
