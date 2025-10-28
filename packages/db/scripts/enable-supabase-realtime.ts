import { sql } from 'drizzle-orm';
import { db } from '../src/client';

const tablesToEnableRealtime = [
  'entityStates',
  'entityStateHistories',
  'events',
  'devices',
  'entities',
] as const;

// RLS policies for realtime authorization
const realtimePolicies = [
  // Policy for authenticated users to read postgres changes on entityStates table
  {
    condition: `
      realtime.messages.extension = 'postgres_changes'
      AND realtime.topic() LIKE 'entityStates-%'
      AND EXISTS (
        SELECT 1 FROM public."entityStates" es
        JOIN public.entities e ON e.id = es."entityId"
        JOIN public.devices d ON d.id = e."deviceId"
        JOIN public.users u ON u."homeId" = d."homeId"
        WHERE u.id = (SELECT requesting_user_id())
        AND es."entityId" = split_part(realtime.topic(), '-', 2)
      )
    `,
    name: 'authenticated_can_read_entityStates_changes',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to read postgres changes on entityStateHistories table
  {
    condition: `
      realtime.messages.extension = 'postgres_changes'
      AND realtime.topic() LIKE 'entityStateHistories-%'
      AND EXISTS (
        SELECT 1 FROM public."entityStateHistories" esh
        JOIN public.users u ON u."homeId" = esh."homeId"
        WHERE u.id = (SELECT requesting_user_id())
        AND esh."homeId" = split_part(realtime.topic(), '-', 2)
      )
    `,
    name: 'authenticated_can_read_entityStateHistories_changes',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to read postgres changes on events table
  {
    condition: `
      realtime.messages.extension = 'postgres_changes'
      AND realtime.topic() LIKE 'events-%'
      AND EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.users u ON u."homeId" = e."homeId"
        WHERE u.id = (SELECT requesting_user_id())
        AND e."homeId" = split_part(realtime.topic(), '-', 2)
      )
    `,
    name: 'authenticated_can_read_events_changes',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to read postgres changes on devices table
  {
    condition: `
      realtime.messages.extension = 'postgres_changes'
      AND realtime.topic() LIKE 'devices-%'
      AND EXISTS (
        SELECT 1 FROM public.devices d
        JOIN public.users u ON u."homeId" = d."homeId"
        WHERE u.id = (SELECT requesting_user_id())
        AND d."homeId" = split_part(realtime.topic(), '-', 2)
      )
    `,
    name: 'authenticated_can_read_devices_changes',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to read postgres changes on entities table
  {
    condition: `
      realtime.messages.extension = 'postgres_changes'
      AND realtime.topic() LIKE 'entities-%'
      AND EXISTS (
        SELECT 1 FROM public.entities e
        JOIN public.devices d ON d.id = e."deviceId"
        JOIN public.users u ON u."homeId" = d."homeId"
        WHERE u.id = (SELECT requesting_user_id())
        AND e.id = split_part(realtime.topic(), '-', 2)
      )
    `,
    name: 'authenticated_can_read_entities_changes',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to send broadcast messages
  {
    condition: `
      realtime.messages.extension = 'broadcast'
      AND (
        realtime.topic() LIKE 'entityStates-%'
        OR realtime.topic() LIKE 'entityStateHistories-%'
        OR realtime.topic() LIKE 'events-%'
        OR realtime.topic() LIKE 'devices-%'
        OR realtime.topic() LIKE 'entities-%'
      )
    `,
    name: 'authenticated_can_send_broadcast',
    operation: 'insert',
    table: 'realtime.messages',
    target: 'authenticated',
  },
  // Policy for authenticated users to read broadcast messages
  {
    condition: `
      realtime.messages.extension = 'broadcast'
      AND (
        realtime.topic() LIKE 'entityStates-%'
        OR realtime.topic() LIKE 'entityStateHistories-%'
        OR realtime.topic() LIKE 'events-%'
        OR realtime.topic() LIKE 'devices-%'
        OR realtime.topic() LIKE 'entities-%'
      )
    `,
    name: 'authenticated_can_read_broadcast',
    operation: 'select',
    table: 'realtime.messages',
    target: 'authenticated',
  },
];

async function isTableInPublication(tableName: string): Promise<boolean> {
  const result = (await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = ${tableName}
    ) as exists;
  `)) as Array<{ exists: boolean }>;
  return result[0]?.exists ?? false;
}

async function enableRealtimeForTable(tableName: string) {
  console.log(`Checking realtime status for table: ${tableName}`);

  const isAlreadyEnabled = await isTableInPublication(tableName);
  if (isAlreadyEnabled) {
    console.log(`Table ${tableName} is already enabled for realtime`);
    return;
  }

  console.log(`Enabling realtime for table: ${tableName}`);
  await db.execute(sql`
    ALTER PUBLICATION supabase_realtime ADD TABLE "public"."${sql.raw(tableName)}";
  `);
  console.log(`Realtime enabled for table: ${tableName}`);
}

async function isPolicyExists(policyName: string): Promise<boolean> {
  const result = (await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE policyname = ${policyName}
      AND schemaname = 'realtime'
      AND tablename = 'messages'
    ) as exists;
  `)) as Array<{ exists: boolean }>;
  return result[0]?.exists ?? false;
}

async function createRealtimePolicy(policy: (typeof realtimePolicies)[0]) {
  console.log(`Checking policy: ${policy.name}`);

  const policyExists = await isPolicyExists(policy.name);
  if (policyExists) {
    console.log(`Policy ${policy.name} already exists`);
    return;
  }

  console.log(`Creating policy: ${policy.name}`);

  // Build the policy SQL manually to avoid Drizzle parameter issues
  const operationClause =
    policy.operation === 'select' ? 'USING' : 'WITH CHECK';
  const policySql = `
    CREATE POLICY "${policy.name}"
    ON ${policy.table}
    FOR ${policy.operation}
    TO ${policy.target}
    ${operationClause} (${policy.condition});
  `;

  await db.execute(sql.raw(policySql));
  console.log(`Policy ${policy.name} created successfully`);
}

async function setupRealtimePolicies() {
  console.log('Setting up realtime authorization policies...');

  try {
    // Enable RLS on realtime.messages table if not already enabled
    await db.execute(sql`
      ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    `);
    console.log('RLS enabled on realtime.messages table');

    // Create all policies
    for (const policy of realtimePolicies) {
      await createRealtimePolicy(policy);
    }

    console.log(
      'All realtime authorization policies have been set up successfully',
    );
  } catch (error) {
    console.error('Error setting up realtime policies:', error);
    throw error;
  }
}

async function disablePublicRealtimeAccess() {
  console.log('Disabling public access to realtime...');

  try {
    // This would typically be done in Supabase dashboard, but we can document it here
    // The setting "Allow public access" should be disabled in Realtime Settings
    console.log(
      'IMPORTANT: Please disable "Allow public access" in Supabase Realtime Settings',
    );
    console.log(
      'This ensures only authenticated users with proper RLS policies can access realtime',
    );
  } catch (error) {
    console.error('Error configuring public access:', error);
    throw error;
  }
}

async function setupAllRealtime() {
  try {
    // Process tables sequentially to avoid deadlocks
    for (const table of tablesToEnableRealtime) {
      await enableRealtimeForTable(table);
    }
    console.log('All realtime subscriptions have been set up successfully');

    // Set up authorization policies
    await setupRealtimePolicies();

    // Disable public access
    await disablePublicRealtimeAccess();
  } catch (error) {
    console.error('Error setting up realtime subscriptions:', error);
    throw error;
  }
}

setupAllRealtime()
  .then(() => {
    console.log('Realtime setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Realtime setup failed:', error);
    process.exit(1);
  });
