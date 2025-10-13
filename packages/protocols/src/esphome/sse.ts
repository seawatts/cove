/**
 * ESPHome SSE (Server-Sent Events) Client
 * Alternative to Native API - uses the ESPHome web server's /events endpoint
 *
 * This provides real-time sensor updates via HTTP SSE instead of protobuf over TCP
 */

import { debug } from '@cove/logger';
import type { Device, DeviceMetric } from '@cove/types';

const log = debug('cove:protocol:esphome-sse');

interface ESPHomeSSEEvent {
  id: string;
  name: string;
  value: number | string | boolean;
  state: string;
  uom?: string; // unit of measurement
  icon?: string;
  entity_category?: number;
}

interface ESPHomeConnection {
  ipAddress: string;
  controller: AbortController;
  connected: boolean;
}

export class ESPHomeSSEAdapter {
  readonly name = 'ESPHome SSE';
  readonly protocol = 'esphome' as const;
  private connections: Map<string, ESPHomeConnection> = new Map();
  private onMetric?: (metric: Omit<DeviceMetric, 'id'>) => void;

  async initialize(): Promise<void> {
    log('Initializing ESPHome SSE adapter');
  }

  async connect(device: Device): Promise<void> {
    log(
      'Connecting to ESPHome device via SSE: %s at %s',
      device.name,
      device.ipAddress,
    );

    if (!device.ipAddress) {
      throw new Error('ESPHome device requires IP address');
    }

    const controller = new AbortController();

    this.connections.set(device.id, {
      connected: false,
      controller,
      ipAddress: device.ipAddress,
    });

    // Start SSE connection
    this.startSSEStream(device, controller.signal);
  }

  private async startSSEStream(
    device: Device,
    signal: AbortSignal,
  ): Promise<void> {
    const url = `http://${device.ipAddress}/events`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const connection = this.connections.get(device.id);
      if (connection) {
        connection.connected = true;
      }

      log(`SSE stream connected for ${device.name}`);

      // Read the stream
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          log(`SSE stream ended for ${device.name}`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          this.processSSELine(device, line);
        }
      }

      reader.releaseLock();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        log(`SSE stream aborted for ${device.name}`);
      } else {
        log(`SSE stream error for ${device.name}:`, error);
        throw error;
      }
    } finally {
      const connection = this.connections.get(device.id);
      if (connection) {
        connection.connected = false;
      }
    }
  }

  private processSSELine(device: Device, line: string): void {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);

      try {
        const event = JSON.parse(data) as ESPHomeSSEEvent;

        // Filter for sensor events only (value can be number, string, or boolean)
        if (event.id?.startsWith('sensor-') && event.value !== undefined) {
          this.handleSensorUpdate(device, event);
        }
      } catch {
        // Not JSON or malformed, ignore
      }
    }
  }

  private handleSensorUpdate(device: Device, event: ESPHomeSSEEvent): void {
    // Map ESPHome sensor IDs to metric types
    const metricType = this.mapSensorToMetricType(event.id);

    // Convert value to number if it's not already
    const value =
      typeof event.value === 'number'
        ? event.value
        : Number.parseFloat(String(event.value));

    if (Number.isNaN(value)) {
      log(`Skipping non-numeric sensor: ${event.name} = ${event.value}`);
      return;
    }

    if (metricType && this.onMetric) {
      const metric: Omit<DeviceMetric, 'id'> = {
        deviceId: device.id,
        metricType,
        timestamp: new Date(),
        unit: event.uom,
        value,
      };

      this.onMetric(metric);

      log(`Sensor update: ${event.name} = ${value} ${event.uom || ''}`);
    } else {
      log(`Unknown sensor type: ${event.id} (${event.name})`);
    }
  }

  private mapSensorToMetricType(sensorId: string): string | null {
    const mappings: Record<string, string> = {
      'sensor-ammonia': 'nh3',
      'sensor-carbon_monoxide': 'co',
      'sensor-co2': 'co2',
      'sensor-dps310_pressure': 'pressure',
      'sensor-esp_temperature': 'mcu_temperature',
      'sensor-ethanol': 'ethanol',
      'sensor-hydrogen': 'h2',
      'sensor-methane': 'ch4',
      'sensor-nitrogen_dioxide': 'no2',
      'sensor-pm__1_m_weight_concentration': 'pm1',
      'sensor-pm__2_5_m_weight_concentration': 'pm25',
      'sensor-pm__10_m_weight_concentration': 'pm10',
      'sensor-rssi': 'wifi_signal',
      'sensor-sen55_humidity': 'humidity',
      'sensor-sen55_nox': 'nox',
      'sensor-sen55_temperature': 'temperature',
      'sensor-sen55_voc': 'voc',
    };

    return mappings[sensorId] || null;
  }

  async disconnect(device: Device): Promise<void> {
    log(`Disconnecting from ESPHome device: ${device.name}`);

    const connection = this.connections.get(device.id);
    if (connection) {
      connection.controller.abort();
      this.connections.delete(device.id);
    }
  }

  async pollState(_device: Device): Promise<void> {
    // SSE provides real-time updates, no polling needed
  }

  async subscribeToUpdates(
    device: Device,
    onUpdate: (metric: Omit<DeviceMetric, 'id'>) => void,
  ): Promise<void> {
    log(`Subscribing to updates for device: ${device.name}`);
    this.onMetric = onUpdate;
  }
}
