# Protocols Testing

This directory contains tests for all protocol implementations.

## Running Tests

### All Tests
```bash
bun test
```

### Specific Protocol
```bash
# Hue tests (mocked)
bun run test:hue

# ESPHome tests
bun test tests/esphome/
```

### Watch Mode
```bash
bun run test:watch
```

## Hue Integration Tests

Integration tests run against a **real Hue Bridge** and are disabled by default.

### Setup

1. Find your Hue Bridge IP:
```bash
# Option 1: Discovery
curl https://discovery.meethue.com/

# Option 2: Check your router's DHCP table
# Option 3: Use the Hue app
```

2. Set environment variables:
```bash
export HUE_BRIDGE_IP=192.168.1.100
export RUN_HUE_INTEGRATION_TESTS=true
```

3. (Optional) Use existing API key:
```bash
export HUE_USERNAME=your-existing-api-key
```

### Running Integration Tests

```bash
bun run test:hue:integration
```

**First time:** You'll be prompted to press the link button on your bridge.

**Subsequent runs:** Use the saved `HUE_USERNAME` to skip authentication.

### What Gets Tested

- ✅ Bridge discovery
- ✅ Authentication
- ✅ Bridge info retrieval
- ✅ Light listing
- ✅ Light control (toggle, brightness)
- ✅ Group listing
- ✅ Scene listing

**Warning:** Integration tests will control your actual lights!

## Test Structure

### Unit Tests (Mocked)
- `tests/hue/discovery.test.ts` - Discovery functionality
- `tests/hue/client.test.ts` - Client API methods
- `tests/hue/mock-bridge.ts` - Mock Hue Bridge server

### Integration Tests (Real Device)
- `tests/hue/integration.test.ts` - Real bridge tests

## Mock Bridge

The `MockHueBridge` class simulates a real Hue Bridge for testing:

```typescript
import { MockHueBridge } from './hue/mock-bridge';

const bridge = new MockHueBridge({ port: 8080 });
bridge.start();
bridge.pressLinkButton();

const client = new HueClient({
  host: 'localhost',
  port: 8080,
  useHttps: false,
});

await client.authenticate();
await client.connect();

bridge.stop();
```

### Mock Features

- ✅ Authentication flow with link button
- ✅ Light control and state management
- ✅ Group management
- ✅ Scene management
- ✅ Config endpoints
- ✅ Error responses (404, 403, etc.)

## Adding Tests for New Protocols

When adding a new protocol:

1. Create test directory:
```bash
mkdir tests/your-protocol/
```

2. Create test files:
- `setup.ts` - Test configuration (if needed)
- `your-protocol.test.ts` - Unit tests
- `mock-device.ts` - Mock device/server
- `integration.test.ts` - Optional integration tests

3. Follow existing patterns:
- Use Bun's test framework
- Mock external dependencies
- Make integration tests opt-in
- Document setup requirements

## Best Practices

1. **Mock by Default**: Unit tests should use mocks
2. **Integration Opt-In**: Real device tests should require explicit enable
3. **Clean State**: Reset state between tests
4. **Clear Errors**: Provide helpful error messages
5. **Documentation**: Document setup requirements
6. **Safety**: Warn users about side effects (e.g., controlling real lights)

## Troubleshooting

### Tests Fail Immediately
- Check that mock server port is available
- Ensure no other tests are running

### Integration Tests Timeout
- Verify bridge IP is correct
- Check network connectivity
- Ensure bridge is powered on
- Try increasing timeout values

### Authentication Fails
- Make sure link button is pressed within 30 seconds
- Check that bridge isn't already at max users (40)
- Try deleting old API keys from bridge

### "Cannot find module" Errors
- Run `bun install` in package root
- Check that `@cove/logger` and `@cove/types` are available

