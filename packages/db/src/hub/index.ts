/**
 * Hub Database Module - Client-Safe Exports
 *
 * This file exports ONLY client-safe utilities, types, and schemas.
 * For server-only database operations, use '@cove/db/hub/server' instead.
 *
 * Safe for use in:
 * - Client Components ('use client')
 * - Server Components
 * - Server Actions
 * - API Routes
 *
 * Exports:
 * - Schema tables and relations (Drizzle types only)
 * - TypeScript types (auto-inferred)
 * - Zod validation schemas
 * - Utility functions (transformers)
 */

// Export all schema tables and relations (types only, safe for client)
export * from './schema';
// Export Zod validation schemas (safe for client)
export * from './schemas';
// Export utility functions (safe for client)
export * from './transformers';
// Export all types (safe for client)
export type * from './types';

// NOTE: For database client operations, use '@cove/db/hub/server'
// This prevents bundling Node.js/Bun APIs into client bundles
