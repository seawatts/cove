# Cove Logger

A flexible logging package for the Cove platform with namespace-based filtering and configurable log levels.

## Features

- **Namespace-based filtering**: Control which parts of your application log output
- **Log level filtering**: Filter logs by severity (debug, info, warn, error)
- **Environment variable configuration**: Configure logging via environment variables
- **Multiple destinations**: Support for console, files, and custom destinations
- **Color output**: Colored output in development mode
- **Async buffering**: Non-blocking log writes with batching

## Installation

```bash
# Already part of monorepo
# No installation needed
```

## Usage

### Environment Variables

#### `DEBUG`

Controls which namespaces are enabled for logging. Supports wildcard patterns.

```bash
# Enable all namespaces
DEBUG='*'

# Enable all cove namespaces
DEBUG='cove:*'

# Enable specific namespaces (comma-separated)
DEBUG='cove:hub:daemon,cove:hub:registry'

# Multiple wildcard patterns
DEBUG='cove:*,@cove/logger:*'
```

**Default**: `cove:*`

#### `LOG_LEVEL`

Controls the minimum log level that will be output. Only logs at or above this level will be shown.

```bash
# Show all logs
LOG_LEVEL=debug

# Show info, warn, and error logs (default)
LOG_LEVEL=info

# Show only warnings and errors
LOG_LEVEL=warn

# Show only errors
LOG_LEVEL=error
```

**Default**: `info`

**Valid values**: `debug`, `info`, `warn`, `error`

### Examples

```bash
# Show only warnings and errors from all namespaces
LOG_LEVEL=warn DEBUG='*' bun run apps/hub/src/index.ts

# Show debug logs only from ESPHome driver
LOG_LEVEL=debug DEBUG='cove:hub:esphome:*' bun run apps/hub/src/index.ts

# Show info+ from all cove namespaces
LOG_LEVEL=info DEBUG='cove:*' bun run apps/hub/src/index.ts

# Development mode: show all debug logs
LOG_LEVEL=debug DEBUG='cove:*' bun run apps/hub/src/index.ts
```

## Programmatic API

### Basic Usage

```typescript
import { debug, info, warn, error } from '@cove/logger';

// Create loggers for specific namespaces
const logDebug = debug('cove:my-module');
const logInfo = info('cove:my-module');
const logWarn = warn('cove:my-module');
const logError = error('cove:my-module');

// Use the loggers
logDebug('Detailed debug information');
logInfo('General information');
logWarn('Warning message');
logError('Error occurred');
```

### Advanced Usage

```typescript
import { defaultLogger } from '@cove/logger';

// Change log level at runtime
defaultLogger.setMinLogLevel('debug');

// Enable/disable specific namespaces
defaultLogger.enableNamespace('cove:hub:esphome:*');
defaultLogger.disableNamespace('cove:hub:registry');

// Add custom destinations
defaultLogger.addDestination(myCustomDestination);
```

## Logger Instances

### Creating a Custom Logger

```typescript
import { Logger } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';

const logger = new Logger({
  defaultNamespace: 'my-app',
  minLogLevel: 'info',
  destinations: [new ConsoleDestination()],
  enabledNamespaces: new Set(['my-app:*']),
});

// Use the custom logger
const logDebug = logger.debug('my-app:module');
logDebug('This will only show if namespace is enabled and level allows');
```

## Namespace Patterns

Namespaces use a hierarchical format: `scope:module:submodule`

### Common Patterns

- `cove:hub:daemon` - Hub daemon logs
- `cove:hub:registry` - Registry logs
- `cove:hub:state-store` - State store logs
- `cove:hub:esphome:*` - All ESPHome driver logs
- `cove:hub:esphome:discovery` - ESPHome discovery logs
- `cove:*` - All cove logs

### Wildcard Support

The logger supports wildcard patterns:

- `*` - Matches all namespaces
- `cove:*` - Matches all namespaces starting with `cove:`
- `cove:hub:*` - Matches all namespaces starting with `cove:hub:`

## Log Levels

The logger uses four log levels in order of severity:

1. **debug** - Detailed diagnostic information
2. **info** - General informational messages
3. **warn** - Warning messages
4. **error** - Error conditions

When a log level is set, only logs at or above that level are output.

## Destinations

### Console Destination

```typescript
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { defaultLogger } from '@cove/logger';

defaultLogger.addDestination(new ConsoleDestination());
```

### Rolling File Destination

```typescript
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import { defaultLogger } from '@cove/logger';

defaultLogger.addDestination(
  new RollingFileDestination({
    filepath: './logs/app.log',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    createDirectory: true,
  })
);
```

### Custom Destinations

```typescript
import type { LogDestination, LogMessage } from '@cove/logger';

class MyCustomDestination implements LogDestination {
  write(message: LogMessage): void {
    // Custom logging logic
  }
}

defaultLogger.addDestination(new MyCustomDestination());
```

## Platform Integration

### Hub V2

The logger is automatically configured in `apps/hub/src/index.ts` with:

- Console destination
- Rolling file destination (`./logs/hub.log`)
- Environment-based configuration

### Hub V1

Same configuration as Hub V2, but in `apps/hub/src/index.ts`.

## TypeScript Types

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMessage {
  level: LogLevel;
  namespace: string;
  args: unknown[];
  timestamp: Date;
}

export interface LogDestination {
  write(message: LogMessage): void;
}

export interface LoggerProps {
  defaultNamespace?: string;
  enabledNamespaces?: Set<string>;
  useColors?: boolean;
  destinations?: LogDestination[];
  flushInterval?: number;
  minLogLevel?: LogLevel;
}
```

## Best Practices

1. **Use descriptive namespaces**: Follow the pattern `scope:module:submodule`
2. **Set appropriate log levels**: Use debug for development, info for production
3. **Avoid logging in loops**: Use debug level for verbose information
4. **Use structured logging**: Pass objects and arrays as arguments
5. **Respect privacy**: Don't log sensitive information

## Troubleshooting

### No logs appearing

1. Check that the namespace is enabled:
   ```bash
   DEBUG='your:namespace:*'
   ```

2. Check that the log level is low enough:
   ```bash
   LOG_LEVEL=debug
   ```

3. Ensure destinations are configured:
   ```typescript
   defaultLogger.addDestination(new ConsoleDestination());
   ```

### Too many logs

1. Increase the minimum log level:
   ```bash
   LOG_LEVEL=warn
   ```

2. Narrow the namespace pattern:
   ```bash
   DEBUG='cove:hub:daemon'
   ```

### Logs appearing out of order

The logger uses async buffering for performance. Logs are batched and flushed every 50ms. For immediate output, use `console.log` directly (not recommended).

## License

Part of the Cove platform.

