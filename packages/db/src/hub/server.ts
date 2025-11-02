/**
 * Hub Database Server-Only Exports
 *
 * This file contains exports that should ONLY be used in server-side code.
 * It includes the database client wrapper with migration capabilities.
 *
 * ⚠️ WARNING: Do NOT import this in client components!
 * Use '@cove/db/hub' instead for client-safe utilities and types.
 */

// Export server-only database client
export { type HubDatabaseClient, HubDatabaseWrapper } from './client';
