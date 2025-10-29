/**
 * Hub API Type Exports
 * Export types for use in web-app or other clients
 */

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from './root';

/**
 * Inference helpers for input types
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type { AppRouter, RouterInputs, RouterOutputs };
export { appRouter } from './root';
