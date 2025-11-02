# Cove Alerting System

A comprehensive alerting system for Hub V2 that monitors telemetry data and provides real-time notifications when thresholds are crossed.

## Features

### Alert Types

1. **Threshold Alerts** - Trigger when a value crosses a specific threshold
   - Operators: `>`, `<`, `≥`, `≤`
   - Example: Alert when CO2 > 1000 ppm

2. **Range Alerts** - Trigger when a value falls outside an acceptable range
   - Example: Alert when temperature is outside 65-75°F range

3. **Rate of Change Alerts** - Trigger when a value changes too quickly
   - Example: Alert when temperature increases by >5°/minute

### Severity Levels

- **Info** (Blue) - Informational alerts
- **Warning** (Orange) - Warning-level alerts requiring attention
- **Critical** (Red) - Critical alerts requiring immediate action

### Alert Visualization

#### On Charts
- **Threshold Lines** - Static horizontal lines showing alert thresholds
- **Shaded Regions** - Highlighted zones indicating alert ranges
- **Event Markers** - Colored dots on the timeline showing when alerts triggered
- **Color Coding** - Visual indicators matching severity levels

#### Real-time Notifications
- **Toast Notifications** - Pop-up alerts via WebSocket when alerts trigger
- **Auto-dismiss** - Notifications auto-dismiss based on severity (info: 6s, warning: 8s, critical: 10s)
- **Rich Content** - Shows alert name, message, current value, and threshold

## Architecture

### Backend (Hub V2)

#### Database Schema

**`alertConfigs` Table**
```sql
- id: Primary key
- entityId: Entity being monitored
- homeId: Home association
- name: Alert name
- enabled: Whether alert is active
- severity: 'info' | 'warning' | 'critical'
- alertType: 'threshold' | 'range' | 'rate_of_change'
- field: Telemetry field to monitor (e.g., 'co2', 'temperature')

-- Threshold config
- thresholdValue: Numeric threshold
- thresholdOperator: 'gt' | 'lt' | 'gte' | 'lte'

-- Range config
- rangeMin: Minimum acceptable value
- rangeMax: Maximum acceptable value

-- Rate of change config
- rateThreshold: Maximum rate of change per second
- rateWindow: Time window in milliseconds

- createdAt, updatedAt: Timestamps
```

**`alertHistory` Table**
```sql
- id: Primary key
- alertConfigId: Reference to alert config
- entityId, homeId: Entity and home references
- severity: Alert severity at trigger time
- message: Human-readable alert message
- value: Value that triggered the alert
- threshold: Threshold that was crossed (if applicable)
- triggeredAt: When alert was triggered
- resolvedAt: When alert was resolved (null if still active)
- acknowledged: Whether user has acknowledged the alert
```

#### Core Services

**`AlertService`** (`apps/hub-v2/src/core/alert-service.ts`)
- Manages alert configurations (CRUD operations)
- Evaluates telemetry data against alert conditions
- Tracks active alerts
- Automatically resolves alerts when conditions normalize
- Records alert history
- Publishes alert events to EventBus

**`StateStore` Integration**
- Integrated into telemetry recording pipeline
- Evaluates alerts on every telemetry write
- Minimal performance impact (in-memory config cache)

**EventBus Events**
- `alert/triggered` - Broadcast when alert triggers
- `alert/resolved` - Broadcast when alert resolves
- `alert/${alertId}` - Alert-specific events

#### API (tRPC)

**`alerts` Router** (`apps/hub-v2/src/api/routers/alerts.ts`)

Procedures:
- `list` - Get alert configs for an entity
- `get` - Get a specific alert config
- `create` - Create new alert config
- `update` - Update alert config
- `delete` - Delete alert config
- `getHistory` - Get alert history with filters
- `getActiveAlerts` - Get currently active alerts
- `acknowledge` - Acknowledge an alert

**WebSocket Support**
- Real-time event streaming at `/events`
- Broadcasts `alert_triggered` and `alert_resolved` messages
- Auto-reconnection support

### Frontend (Web App)

#### Components

**`ChartWidget`** - Enhanced telemetry charts
- Location: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/widgets/chart-widget.tsx`
- Features:
  - Fetches alert configs for displayed entity/field
  - Renders threshold reference lines
  - Renders shaded regions for range alerts
  - Displays alert event markers on timeline
  - Color-coded by severity

**`AlertConfigForm`** - Alert configuration form
- Location: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/alert-config-form.tsx`
- Features:
  - Type-specific fields (threshold, range, rate of change)
  - Form validation with Zod schema
  - Severity and field selection
  - Enable/disable toggle

**`AlertSettingsDialog`** - Alert management dialog
- Location: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/alert-settings-dialog.tsx`
- Features:
  - List all alerts for an entity
  - Create new alerts
  - Edit existing alerts
  - Delete alerts
  - Visual severity indicators

**`AlertHistoryPanel`** - Alert history viewer
- Location: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/alert-history-panel.tsx`
- Features:
  - Scrollable alert history
  - Filter by: unacknowledged, unresolved, severity
  - Acknowledge alerts
  - Shows trigger and resolution times
  - Displays values and thresholds

**`AlertNotificationProvider`** - Real-time notifications
- Location: `apps/web-app/src/components/providers/alert-notification-provider.tsx`
- Features:
  - WebSocket connection to hub
  - Toast notifications for new alerts
  - Severity-based styling and duration
  - Auto-reconnection on disconnect

#### Hooks

**`useHubWebSocket`** - WebSocket connection hook
- Location: `apps/web-app/src/hooks/use-hub-websocket.ts`
- Features:
  - Manages WebSocket lifecycle
  - Auto-reconnection with configurable delay
  - Type-safe message handlers
  - Connection status tracking

## Usage

### Creating an Alert (UI)

1. Navigate to a device page with sensors
2. Find the sensor you want to monitor
3. Click the "Alerts" button
4. Click "New Alert" tab
5. Fill in the form:
   - Name: "High CO2 Alert"
   - Field: "co2"
   - Severity: "Warning"
   - Alert Type: "Threshold"
   - Operator: ">"
   - Threshold Value: 1000
6. Click "Save Alert"

### Creating an Alert (API)

```typescript
import { hubApi } from '~/lib/hub-trpc/client';

const createAlert = hubApi.alerts.create.useMutation();

await createAlert.mutateAsync({
  entityId: 'entity_123',
  homeId: 'home_456',
  name: 'High CO2 Alert',
  field: 'co2',
  severity: 'warning',
  alertType: 'threshold',
  thresholdValue: 1000,
  thresholdOperator: 'gt',
  enabled: true,
});
```

### Viewing Alert History

```typescript
import { hubApi } from '~/lib/hub-trpc/client';

const { data: history } = hubApi.alerts.getHistory.useQuery({
  entityId: 'entity_123',
  limit: 50,
  unacknowledged: true, // Optional: only unacknowledged
  unresolved: true,     // Optional: only unresolved
});
```

### Acknowledging an Alert

```typescript
import { hubApi } from '~/lib/hub-trpc/client';

const acknowledge = hubApi.alerts.acknowledge.useMutation();

await acknowledge.mutateAsync({
  alertId: 'alert_event_789',
});
```

## Integration Guide

### Adding Alert Support to a New Page

1. **Import the AlertSettingsDialog**:
```tsx
import { AlertSettingsDialog } from './_components/alert-settings-dialog';
```

2. **Add the button to your UI**:
```tsx
<AlertSettingsDialog
  entityId={entity.id}
  homeId={entity.homeId}
  entityName={entity.name}
  availableFields={['co2', 'temperature', 'humidity']}
/>
```

3. **Add the AlertHistoryPanel** (optional):
```tsx
import { AlertHistoryPanel } from './_components/alert-history-panel';

<AlertHistoryPanel entityId={entity.id} />
```

### Enabling Real-time Notifications

Add the `AlertNotificationProvider` to your app layout:

```tsx
// In app/layout.tsx or app/(app)/layout.tsx
import { AlertNotificationProvider } from '~/components/providers/alert-notification-provider';

export default function Layout({ children }) {
  return (
    <AlertNotificationProvider>
      {children}
    </AlertNotificationProvider>
  );
}
```

### Customizing Alert Visualization

The chart widget automatically displays alerts for any entity/field combination. To customize:

1. **Change colors**: Modify `getAlertSeverityColor()` in `packages/types/src/alert.ts`
2. **Adjust reference line styles**: Edit the `ReferenceLine` components in `chart-widget.tsx`
3. **Customize event markers**: Modify the custom `dot` renderer in `chart-widget.tsx`

## Testing

### Manual Testing

1. **Create a test alert**:
   - Set a low threshold (e.g., CO2 > 500)
   - Ensure entity has telemetry data

2. **Trigger the alert**:
   - Wait for new telemetry data to exceed threshold
   - Check for toast notification
   - Verify alert appears in history panel

3. **Verify chart visualization**:
   - Check for threshold line on chart
   - Look for alert event marker at trigger time
   - Confirm color matches severity

4. **Test acknowledgement**:
   - Click "Acknowledge" in history panel
   - Verify badge updates

5. **Test resolution**:
   - Wait for value to return below threshold
   - Check for "Resolved" toast
   - Verify resolvedAt timestamp in history

### Programmatic Testing

Create test alerts via the hub daemon:

```typescript
// In apps/hub-v2/src/__tests__/
import { HubDaemon } from '../daemon';

const daemon = new HubDaemon();
await daemon.initialize();

const alertService = daemon.getAlertService();

// Create test alert
await alertService.createAlertConfig({
  entityId: 'test_entity',
  homeId: 'test_home',
  name: 'Test Alert',
  field: 'co2',
  severity: 'warning',
  alertType: 'threshold',
  thresholdValue: 1000,
  thresholdOperator: 'gt',
  enabled: true,
});

// Simulate telemetry that triggers alert
await daemon.getStateStore().appendTelemetry(
  'test_entity',
  'test_home',
  'co2',
  1500, // Above threshold
  'ppm',
  new Date()
);

// Check active alerts
const activeAlerts = await alertService.getActiveAlerts('test_home');
console.log(activeAlerts); // Should contain triggered alert
```

## Performance Considerations

- **Alert Evaluation**: O(n) where n = number of alert configs per entity/field combination
- **Memory**: Alert configs cached in-memory for fast evaluation
- **Database**: Indexes on frequently queried fields (entityId, homeId, triggeredAt, severity)
- **WebSocket**: Minimal overhead, events only sent when alerts trigger/resolve

## Future Enhancements

- [ ] Email/SMS notifications
- [ ] Alert templates
- [ ] Snooze functionality
- [ ] Alert groups/categories
- [ ] Custom notification channels (Slack, Discord, etc.)
- [ ] Alert metrics and analytics
- [ ] Machine learning-based anomaly detection
- [ ] Multi-condition alerts (AND/OR logic)
- [ ] Alert scheduling (only trigger during certain hours)

## Troubleshooting

### Alerts Not Triggering

1. Check alert is enabled: `alertConfig.enabled === true`
2. Verify telemetry data is being recorded for the field
3. Check AlertService logs: `debug('cove:hub-v2:alert-service')`
4. Ensure StateStore has AlertService injected

### WebSocket Notifications Not Showing

1. Verify WebSocket connection: Check browser console
2. Ensure `AlertNotificationProvider` is in component tree
3. Check hub logs for WebSocket connections
4. Verify hub is running and accessible at `NEXT_PUBLIC_HUB_URL`

### Chart Visualizations Not Appearing

1. Verify alert configs exist for entity/field combination
2. Check that `alertConfigs` query is successful
3. Ensure chart component is using latest version with alert support
4. Check browser console for rendering errors

## Support

For issues or questions:
- Check hub logs: `apps/hub-v2/logs/hub.log`
- Enable debug logging: Set `DEBUG=cove:hub-v2:*`
- Review database migrations: `apps/hub-v2/drizzle/`
- Open an issue with detailed reproduction steps

