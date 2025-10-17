/**
 * Cove Home Automation - Shared Types
 *
 * Re-exports database types and provides additional UI-specific types
 */

// Re-export all database types (source of truth)
export * from '@cove/db';

// Discovery types (not in database)
export * from './discovery';

// Entity types (not in database)
export * from './entity';

// Event types (not in database)
export * from './events';

// Widget types (UI-specific, not in database)
export * from './widget';
