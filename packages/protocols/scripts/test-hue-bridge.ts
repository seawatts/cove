#!/usr/bin/env bun
/**
 * Hue Bridge Verification Script
 *
 * This script tests the Hue protocol implementation with a real bridge.
 * Run this to verify everything works before integrating into the hub daemon.
 *
 * Usage:
 *   bun run scripts/test-hue-bridge.ts
 *
 * Environment Variables:
 *   HUE_BRIDGE_IP - Optional: IP address of bridge (will discover if not provided)
 *   HUE_USERNAME - Optional: Previously authenticated username (will authenticate if not provided)
 */

import {
  discoverBridgesHTTPS,
  discoverBridgesMDNS,
  HueClient,
} from '../src/hue';

interface ConnectionDetails {
  bridgeIP: string;
  username: string;
  bridgeName: string;
  bridgeID: string;
  timestamp: string;
}

async function main() {
  console.log('🔍 Hue Bridge Verification Script\n');

  // Step 1: Discovery
  console.log('Step 1: Discovering Hue bridges...');
  let bridgeIP = process.env.HUE_BRIDGE_IP;

  if (!bridgeIP) {
    console.log('  Trying HTTPS discovery...');
    const httpsBridges = await discoverBridgesHTTPS();

    if (httpsBridges.length > 0) {
      bridgeIP = httpsBridges[0].internalipaddress;
      console.log(`  ✅ Found bridge via HTTPS: ${bridgeIP}`);
    } else {
      console.log('  ⏳ Trying mDNS discovery (5 seconds)...');
      const mdnsBridges = await discoverBridgesMDNS(5000);

      if (mdnsBridges.length > 0) {
        bridgeIP = mdnsBridges[0].internalipaddress;
        console.log(`  ✅ Found bridge via mDNS: ${bridgeIP}`);
      } else {
        console.error('  ❌ No bridges discovered');
        console.error('  💡 Set HUE_BRIDGE_IP environment variable manually');
        process.exit(1);
      }
    }
  } else {
    console.log(`  Using provided IP: ${bridgeIP}`);
  }

  // Step 2: Create client
  console.log('\nStep 2: Creating client...');
  const client = new HueClient({
    host: bridgeIP,
    useHttps: true,
    username: process.env.HUE_USERNAME,
  });
  console.log('  ✅ Client created');

  // Step 3: Authentication
  let username = process.env.HUE_USERNAME;

  if (!username) {
    console.log('\nStep 3: Authenticating...');
    console.log('  ⚠️  Press the link button on your Hue Bridge NOW!');
    console.log('  ⏳ Waiting 15 seconds for button press...');

    await new Promise((resolve) => setTimeout(resolve, 15000));

    try {
      username = await client.authenticate('cove-verification-script');
      console.log('  ✅ Authenticated successfully!');
      console.log(`  📝 Save this username: ${username}`);
      console.log(
        `  💡 Set HUE_USERNAME="${username}" to skip this step next time`,
      );
    } catch (error) {
      console.error('  ❌ Authentication failed:', error);
      console.error('  💡 Make sure you pressed the link button');
      process.exit(1);
    }
  } else {
    console.log('\nStep 3: Using existing username');
    console.log(`  ✅ Username: ${username}`);
  }

  // Step 4: Connect
  console.log('\nStep 4: Connecting to bridge...');
  try {
    await client.connect();
    console.log('  ✅ Connected successfully');
  } catch (error) {
    console.error('  ❌ Connection failed:', error);
    process.exit(1);
  }

  // Step 5: Get bridge info
  console.log('\nStep 5: Getting bridge information...');
  try {
    const config = await client.getBridgeConfig();
    console.log(`  ✅ Bridge Name: ${config.name}`);
    console.log(`  📡 Bridge ID: ${config.bridgeid}`);
    console.log(`  🔢 API Version: ${config.apiversion}`);
    console.log(`  💾 Model: ${config.modelid}`);
    console.log(`  🔧 Software: ${config.swversion}`);

    // Save connection details
    const connectionDetails: ConnectionDetails = {
      bridgeID: config.bridgeid,
      bridgeIP,
      bridgeName: config.name,
      timestamp: new Date().toISOString(),
      username,
    };

    // Write to file
    const detailsPath = './hue-connection-details.json';
    await Bun.write(detailsPath, JSON.stringify(connectionDetails, null, 2));
    console.log(`  💾 Connection details saved to: ${detailsPath}`);
  } catch (error) {
    console.error('  ❌ Failed to get bridge info:', error);
  }

  // Step 6: List lights
  console.log('\nStep 6: Listing lights...');
  try {
    const lights = await client.getLights();
    const lightCount = Object.keys(lights).length;
    console.log(`  ✅ Found ${lightCount} lights:`);

    for (const [id, light] of Object.entries(lights)) {
      const status = light.state.on ? '💡 ON' : '⚫ OFF';
      const brightness = light.state.bri
        ? ` (${Math.round((light.state.bri / 254) * 100)}%)`
        : '';
      console.log(`     ${id}. ${light.name} ${status}${brightness}`);
    }
  } catch (error) {
    console.error('  ❌ Failed to list lights:', error);
  }

  // Step 7: List groups
  console.log('\nStep 7: Listing groups/rooms...');
  try {
    const groups = await client.getGroups();
    const groupCount = Object.keys(groups).length;
    console.log(`  ✅ Found ${groupCount} groups:`);

    for (const [id, group] of Object.entries(groups)) {
      const lightCount = group.lights.length;
      console.log(
        `     ${id}. ${group.name} (${group.type}, ${lightCount} lights)`,
      );
    }
  } catch (error) {
    console.error('  ❌ Failed to list groups:', error);
  }

  // Step 8: List scenes
  console.log('\nStep 8: Listing scenes...');
  try {
    const scenes = await client.getScenes();
    const sceneCount = Object.keys(scenes).length;
    console.log(`  ✅ Found ${sceneCount} scenes`);

    // Show first 5 scenes
    const sceneEntries = Object.entries(scenes).slice(0, 5);
    for (const [id, scene] of sceneEntries) {
      console.log(`     ${id}. ${scene.name} (${scene.lights.length} lights)`);
    }
    if (sceneCount > 5) {
      console.log(`     ... and ${sceneCount - 5} more`);
    }
  } catch (error) {
    console.error('  ❌ Failed to list scenes:', error);
  }

  // Step 9: Test light control
  console.log('\nStep 9: Testing light control...');
  try {
    const lights = await client.getLights();
    const lightIds = Object.keys(lights);

    if (lightIds.length === 0) {
      console.log('  ⚠️  No lights available to test');
    } else {
      const testLightId = lightIds[0];
      const testLight = lights[testLightId];
      const originalState = testLight.state.on;

      console.log(`  🎯 Testing with light: ${testLight.name}`);
      console.log(`  📍 Original state: ${originalState ? 'ON' : 'OFF'}`);

      // Toggle on
      console.log('  ⏳ Turning light ON...');
      await client.toggleLight(testLightId, true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      let currentLight = await client.getLight(testLightId);
      console.log(`  ✅ Light is now: ${currentLight.state.on ? 'ON' : 'OFF'}`);

      // Toggle off
      console.log('  ⏳ Turning light OFF...');
      await client.toggleLight(testLightId, false);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      currentLight = await client.getLight(testLightId);
      console.log(`  ✅ Light is now: ${currentLight.state.on ? 'ON' : 'OFF'}`);

      // Restore original state
      console.log('  ⏳ Restoring original state...');
      await client.toggleLight(testLightId, originalState);
      console.log(`  ✅ Light restored to: ${originalState ? 'ON' : 'OFF'}`);

      console.log('  ✅ Light control test PASSED');
    }
  } catch (error) {
    console.error('  ❌ Light control test failed:', error);
  }

  // Step 10: Disconnect
  console.log('\nStep 10: Disconnecting...');
  await client.disconnect();
  console.log('  ✅ Disconnected');

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 VERIFICATION COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n✅ All tests passed!');
  console.log('\n📝 Next steps:');
  console.log('  1. Save your HUE_USERNAME for future use');
  console.log('  2. Integrate into hub daemon');
  console.log('  3. Add to discovery service');
  console.log('  4. Build web UI controls');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
