import { sql } from 'drizzle-orm';
import { db } from '../src/client';

type PolicyOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';

interface Policy {
  name: string;
  operation: PolicyOperation;
  using?: string;
  withCheck?: string;
}

interface PolicyConfig {
  tableName: string;
  policies: Policy[];
}

// Create the requesting_user_id function as per Clerk docs
const createRequestingUserIdFunction = async () => {
  console.log('Creating requesting_user_id function...');
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION requesting_user_id()
    RETURNS text
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $$
      SELECT NULLIF(
        current_setting('request.jwt.claims', true)::json->>'sub',
        ''
      )::text;
    $$;
  `);
  console.log('requesting_user_id function created successfully');
};

// Common policy conditions using the requesting_user_id function
const policyConditions = {
  deviceHomeAccess: (columnName = 'deviceId') =>
    `EXISTS (
      SELECT 1 FROM devices
      JOIN users ON users."homeId" = devices."homeId"
      WHERE devices.id = ("${columnName}")::text
      AND users.id = (SELECT requesting_user_id())
    )`,
  entityHomeAccess: (columnName = 'entityId') =>
    `EXISTS (
      SELECT 1 FROM entities
      JOIN devices ON devices.id = entities."deviceId"
      JOIN users ON users."homeId" = devices."homeId"
      WHERE entities.id = ("${columnName}")::text
      AND users.id = (SELECT requesting_user_id())
    )`,
  homeOwnership: (columnName = 'homeId') =>
    `EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT requesting_user_id())
      AND users."homeId" = ("${columnName}")::text
    )`,
  userHomeAccess: (columnName = 'homeId') =>
    `EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT requesting_user_id())
      AND users."homeId" = ("${columnName}")::text
    )`,
  userOwnership: (columnName = 'userId') =>
    `(SELECT requesting_user_id()) = ("${columnName}")::text`,
} as const;

// Helper to create a policy for home ownership
const createHomeOwnershipPolicy = (
  operation: PolicyOperation,
  columnName: string,
): Policy => ({
  name: `Users can ${operation === 'ALL' ? 'access' : operation.toLowerCase()} records for their home`,
  operation,
  using:
    operation === 'INSERT'
      ? undefined
      : policyConditions.userHomeAccess(columnName),
  withCheck:
    operation === 'INSERT'
      ? policyConditions.userHomeAccess(columnName)
      : undefined,
});

// Helper to create a policy for user ownership
const createUserOwnershipPolicy = (
  operation: PolicyOperation,
  columnName: string,
): Policy => ({
  name: `User can ${operation === 'ALL' ? 'access' : operation.toLowerCase()} their own records`,
  operation,
  using:
    operation === 'INSERT'
      ? undefined
      : policyConditions.userOwnership(columnName),
  withCheck:
    operation === 'INSERT'
      ? policyConditions.userOwnership(columnName)
      : undefined,
});

const createPolicy = async (tableName: string, policy: Policy) => {
  const { name, operation, using, withCheck } = policy;

  // First drop the policy if it exists
  await db.execute(sql`
    DROP POLICY IF EXISTS ${sql.raw(`"${name}"`)} ON "public"."${sql.raw(tableName)}";
  `);

  // Then create the new policy
  const policySql = sql`
    CREATE POLICY ${sql.raw(`"${name}"`)}
    ON "public"."${sql.raw(tableName)}"
    ${operation === 'ALL' ? sql`FOR ALL` : sql`FOR ${sql.raw(operation)}`}
    TO authenticated
    ${using ? sql`USING (${sql.raw(using)})` : sql``}
    ${withCheck ? sql`WITH CHECK (${sql.raw(withCheck)})` : sql``}
  `;

  await db.execute(policySql);
};

// Unused function - kept for potential future use
// const dropPolicy = async (tableName: string, policyName: string) => {
//   await db.execute(sql`
//     DROP POLICY IF EXISTS ${sql.raw(`"${policyName}"`)} ON "public"."${sql.raw(tableName)}";
//   `);
// };

const enableRLS = async (tableName: string) => {
  console.log(`Enabling RLS for table: ${tableName}`);
  await db.execute(sql`
    ALTER TABLE "public"."${sql.raw(tableName)}" ENABLE ROW LEVEL SECURITY;
  `);
  console.log(`RLS enabled for table: ${tableName}`);
};

const policyConfigs: Record<string, PolicyConfig> = {
  devices: {
    policies: [createHomeOwnershipPolicy('ALL', 'homeId')],
    tableName: 'devices',
  },
  entities: {
    policies: [
      {
        name: 'Users can access entities for their home devices',
        operation: 'SELECT',
        using: policyConditions.deviceHomeAccess('deviceId'),
      },
      {
        name: 'Users can insert entities for their home devices',
        operation: 'INSERT',
        withCheck: policyConditions.deviceHomeAccess('deviceId'),
      },
      {
        name: 'Users can update entities for their home devices',
        operation: 'UPDATE',
        using: policyConditions.deviceHomeAccess('deviceId'),
        withCheck: policyConditions.deviceHomeAccess('deviceId'),
      },
      {
        name: 'Users can delete entities for their home devices',
        operation: 'DELETE',
        using: policyConditions.deviceHomeAccess('deviceId'),
      },
    ],
    tableName: 'entities',
  },
  entityStateHistories: {
    policies: [
      {
        name: 'Users can view entity state history for their home',
        operation: 'SELECT',
        using: policyConditions.userHomeAccess('homeId'),
      },
    ],
    tableName: 'entityStateHistories',
  },
  entityStates: {
    policies: [
      {
        name: 'Users can access entity states for their home entities',
        operation: 'SELECT',
        using: policyConditions.entityHomeAccess('entityId'),
      },
      {
        name: 'Users can insert entity states for their home entities',
        operation: 'INSERT',
        withCheck: policyConditions.entityHomeAccess('entityId'),
      },
      {
        name: 'Users can update entity states for their home entities',
        operation: 'UPDATE',
        using: policyConditions.entityHomeAccess('entityId'),
        withCheck: policyConditions.entityHomeAccess('entityId'),
      },
    ],
    tableName: 'entityStates',
  },
  events: {
    policies: [createHomeOwnershipPolicy('ALL', 'homeId')],
    tableName: 'events',
  },
  homes: {
    policies: [
      createHomeOwnershipPolicy('SELECT', 'id'),
      createHomeOwnershipPolicy('UPDATE', 'id'),
      {
        name: 'Users can insert homes',
        operation: 'INSERT',
        withCheck: `(SELECT requesting_user_id()) = "createdBy"::text`,
      },
    ],
    tableName: 'homes',
  },
  rooms: {
    policies: [createHomeOwnershipPolicy('ALL', 'homeId')],
    tableName: 'rooms',
  },
  users: {
    policies: [
      createUserOwnershipPolicy('SELECT', 'id'),
      createUserOwnershipPolicy('UPDATE', 'id'),
      {
        name: 'Users can insert their own user record',
        operation: 'INSERT',
        withCheck: `(SELECT requesting_user_id()) = "id"::text`,
      },
    ],
    tableName: 'users',
  },
};

async function withErrorHandling<T>(
  operation: () => Promise<T>,
  successMessage: string,
  errorMessage: string,
): Promise<T> {
  try {
    const result = await operation();
    console.log(successMessage);
    return result;
  } catch (error) {
    console.error(errorMessage, error);
    throw error;
  }
}

async function setupTablePolicies(config: PolicyConfig) {
  return withErrorHandling(
    async () => {
      await enableRLS(config.tableName);
      await Promise.all(
        config.policies.map((policy) => createPolicy(config.tableName, policy)),
      );
    },
    `Policies for ${config.tableName} set up successfully`,
    `Error setting up policies for ${config.tableName}`,
  );
}

// Unused function - kept for potential future use
// async function dropTablePolicies(config: PolicyConfig) {
//   return withErrorHandling(
//     async () => {
//       await Promise.all(
//         config.policies.map((policy) =>
//           dropPolicy(config.tableName, policy.name),
//         ),
//       );
//     },
//     `Policies for ${config.tableName} dropped successfully`,
//     `Error dropping policies for ${config.tableName}`,
//   );
// }

async function setupAllPolicies() {
  return withErrorHandling(
    async () => {
      // Create the requesting_user_id function
      await createRequestingUserIdFunction();

      // Process tables sequentially to avoid deadlocks
      for (const config of Object.values(policyConfigs)) {
        await setupTablePolicies(config);
      }
    },
    'All policies have been set up successfully',
    'Error setting up policies',
  );
}

// Unused function - kept for potential future use
// async function dropAllPolicies() {
//   return withErrorHandling(
//     async () => {
//       await Promise.all(Object.values(policyConfigs).map(dropTablePolicies));
//     },
//     'All policies have been dropped successfully',
//     'Error dropping policies',
//   );
// }

setupAllPolicies()
  .then(() => {
    console.log('Policy setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Policy setup failed:', error);
    process.exit(1);
  });
