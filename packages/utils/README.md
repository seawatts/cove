# @cove/utils

Utilities for the Cove home automation platform.

## Rust-Style Pattern Matching

This package provides Rust-style `Option<T>` and `Result<T, E>` types with exhaustive pattern matching for safer error handling.

### Option<T>

Represents an optional value that may or may not exist.

#### Basic Usage

```typescript
import { Option } from '@cove/utils';

// Create Some
const some = Option.some(42);
const none = Option.none();

// Create from potentially null/undefined
const opt = Option.from(maybeNull);

// Pattern matching (exhaustive)
const result = Option.match(opt, {
  some: (value) => value * 2,
  none: () => 0
});
```

#### Utility Methods

```typescript
// Transform values
const doubled = Option.map(opt, x => x * 2);

// Chain operations
const result = Option.flatMap(opt, x => x > 3 ? Option.some(x * 2) : Option.none());

// Extract values
const value = Option.unwrap(some); // throws if None
const safe = Option.unwrapOr(none, 0); // returns 0 if None

// Filter
const filtered = Option.filter(opt, x => x > 10);

// Async operations
const asyncDoubled = await Option.mapAsync(opt, async x => x * 2);
```

### Result<T, E>

Represents the result of an operation that can fail.

#### Basic Usage

```typescript
import { Result } from '@cove/utils';

// Create variants
const ok = Result.ok(42);
const err = Result.err('error message');

// Wrap functions that might throw
const result = Result.from(() => {
  return computeSomething();
});

// Pattern matching (exhaustive)
const value = Result.match(result, {
  ok: (value) => value,
  err: (error) => handleError(error)
});
```

#### Utility Methods

```typescript
// Transform values
const doubled = Result.map(result, x => x * 2);

// Transform errors
const betterError = Result.mapErr(result, e => `Error: ${e}`);

// Chain operations
const chained = Result.flatMap(result, x =>
  x > 3 ? Result.ok(x * 2) : Result.err('too small')
);

// Extract values
const value = Result.unwrap(ok); // throws if Err
const safe = Result.unwrapOr(err, 0); // returns 0 if Err

// Convert to Option
const opt = Result.toOption(result);
```

#### Async Integration

```typescript
// Wrap promises
const result = await Result.fromPromise(fetchUserData());

// Async transformations
const transformed = await Result.mapAsync(result, async data => process(data));

// Chain async operations
const final = await Result.flatMapAsync(result, async data =>
  await saveToDatabase(data)
);
```

### ResultAsync<T, E>

Chain async operations without awaiting intermediate results.

```typescript
import { ResultAsync } from '@cove/utils/async-result';

// Create from promise
const asyncResult = ResultAsync.fromPromise(fetchUserData());

// Chain operations
const processed = await ResultAsync.flatMap(asyncResult, async user =>
  ResultAsync.fromPromise(saveUser(user))
);

// Map operations
const transformed = await ResultAsync.map(asyncResult, user => ({
  ...user,
  processed: true
}));
```

### Error Discrimination

Both class-based and tagged union errors are supported.


**Class-based errors** support two approaches:

**Approach 1: Keys as error types (clean but not exhaustive):**

```typescript
class NetworkError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Keys ARE the error type names
Result.matchExhaustive(result, {
  ok: (value) => value,
  NetworkError: (e: NetworkError) => handleNetworkError(e),  // e is properly typed!
  ValidationError: (e: ValidationError) => handleValidationError(e),  // e is properly typed!
  err: (e) => handleUnknownError(e),  // fallback
});
```

**Approach 2: instanceof checks (type-safe and explicit):**

```typescript
// Type-safe error handling with instanceof
Result.match(result, {
  ok: (value) => value,
  err: (error) => {
    if (error instanceof NetworkError) {
      // TypeScript knows error.statusCode exists here
      return handleNetworkError(error);
    }
    if (error instanceof ValidationError) {
      // TypeScript knows error.field exists here
      return handleValidationError(error);
    }
    // Handle unknown errors
    return handleUnknownError(error);
  }
});
```

**Note:** TypeScript cannot enforce exhaustive matching at compile time for class-based errors (the constructor name isn't available in the type system). For truly exhaustive matching, use tagged unions instead.

**Tagged union errors** are matched by `type` field in a switch:

```typescript
type BusinessError =
  | { type: 'insufficient_funds'; accountId: string; balance: number }
  | { type: 'rate_limit_exceeded'; limit: number; retryAfter: number }

Result.match(result, {
  ok: (value) => value,
  err: (error) => {
    switch (error.type) {
      case 'insufficient_funds':
        return handleInsufficientFunds(error);
      case 'rate_limit_exceeded':
        return handleRateLimit(error);
      default: {
        const _exhaustive: never = error;
        throw _exhaustive;
      }
    }
  }
});
```

### Real-World Example

```typescript
import { Result, ResultAsync } from '@cove/utils';

// Async function with Result return type
async function fetchDevice(id: string): Promise<Result<Device, string>> {
  return Result.fromPromise(fetch(`/api/devices/${id}`));
}

// Process with error handling
async function updateDevice(id: string, data: DeviceData) {
  // Fetch device
  const deviceResult = await fetchDevice(id);

  // Transform and save
  const saveResult = await Result.flatMapAsync(deviceResult, async device => {
    const updated = { ...device, ...data };
    return Result.fromPromise(saveDevice(updated));
  });

  // Handle result
  return Result.match(saveResult, {
    ok: (device) => ({ success: true, device }),
    err: (error) => ({ success: false, error })
  });
}
```

### Benefits

- **Type Safety**: Exhaustive pattern matching ensures all cases are handled
- **No Unchecked Exceptions**: Errors are part of the type system
- **Composable**: Easy to chain operations
- **Async-Friendly**: Built-in support for async operations
- **Familiar**: Similar to Rust's `Result` and `Option` types
