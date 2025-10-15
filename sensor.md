Got it. I’ll give you:
	1.	Zod schemas for your traits (capabilities) and the automation graph (triggers → conditions → actions).
	2.	How an Apollo Air 1–style CO₂ monitor maps into this model (multiple sensors, buttons, LEDs), and exactly how you’d see CO₂ over time with your Timescale setup.

⸻

1) Zod schemas

1a) Traits (capabilities) for entities

Use a discriminated union so every entity declares what it can do. Keep this small and composable.

import { z } from "zod";

/** Common helpers */
export const zUnit = z.enum([
  "ppm", "percent", "°C", "°F", "hPa", "lux", "m/s", "dB", "V", "A"
]);
export const zRange = z.tuple([z.number(), z.number()]);
export const zId = z.string().uuid();

/** Numeric sensor (e.g., CO2 ppm, temp, humidity) */
export const SensorNumeric = z.object({
  type: z.literal("SensorNumeric"),
  key: z.string().min(1),               // e.g. 'sensor.co2'
  unit: zUnit,
  decimals: z.number().int().min(0).max(6).default(0),
  range: zRange.optional(),             // e.g. [0, 5000]
  samplingHintMs: z.number().int().positive().optional()
});

/** Binary sensor (e.g., motion, door) */
export const SensorBinary = z.object({
  type: z.literal("SensorBinary"),
  key: z.string(),
  trueLabel: z.string().default("on"),
  falseLabel: z.string().default("off")
});

/** Button (momentary) fires press events; no persisted "on/off" state */
export const Button = z.object({
  type: z.literal("Button"),
  key: z.string(),
  variants: z.array(z.enum(["single", "double", "long"])).default(["single"])
});

/** Light with on/off + optional brightness + color temperature */
export const Light = z.object({
  type: z.literal("Light"),
  key: z.string(),                      // e.g. 'light.apollo_led'
  supports: z.array(z.enum(["on_off","brightness","color_temp"])).default(["on_off"]),
  brightnessRange: zRange.default([1, 254]).optional(),
  colorTempMireds: zRange.optional()    // e.g. [153, 500]
});

/** Battery status capability for portable devices */
export const Battery = z.object({
  type: z.literal("Battery"),
  key: z.string().default("battery"),
  unit: z.literal("percent").default("percent"),
});

/** Lock / Switch samples (easy to extend later) */
export const Switch = z.object({
  type: z.literal("Switch"),
  key: z.string(),
});
export const Lock = z.object({
  type: z.literal("Lock"),
  key: z.string(),
});

/** Full traits schema for an entity (compose capabilities) */
export const Trait = z.discriminatedUnion("type", [
  SensorNumeric, SensorBinary, Button, Light, Battery, Switch, Lock
]);

/** An entity with one or more traits (e.g., a device LED that supports on/off+brightness) */
export const EntityTraits = z.object({
  entityId: zId.optional(),             // DB id if you attach later
  deviceId: zId.optional(),
  kind: z.string(),                     // 'sensor','light','button','lock', etc.
  key: z.string(),                      // global key, e.g. 'sensor.apollo_co2'
  traits: z.array(Trait).min(1),
});
export type EntityTraitsT = z.infer<typeof EntityTraits>;

1b) Automation graph (typed)

Triggers, conditions, actions as discriminated unions; actions call intents (OnOff, SetLevel, etc.). This stays in JSONB, validated by Zod.

// Triggers
const TriggerTime = z.object({
  type: z.literal("time"),
  at: z.string(),                       // cron or ISO time, e.g. '22:00' or '0 22 * * *'
});
const TriggerState = z.object({
  type: z.literal("state"),
  entityKey: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  forMs: z.number().int().positive().optional(),
});
const TriggerNumeric = z.object({
  type: z.literal("numeric"),
  entityKey: z.string(),
  op: z.enum([">", ">=", "<", "<=", "==", "!="]),
  value: z.number(),
  forMs: z.number().int().positive().optional(),
});
export const Trigger = z.discriminatedUnion("type", [TriggerTime, TriggerState, TriggerNumeric]);

// Conditions
const ConditionMode = z.object({
  type: z.literal("mode"),
  key: z.enum(["HOME","AWAY","SLEEP","VACATION","GUEST","CUSTOM"]),
});
const ConditionTimeRange = z.object({
  type: z.literal("time_range"),
  after: z.string(),                    // 'sunset-00:30' or '21:00'
  before: z.string(),                   // '23:00'
});
const ConditionNumeric = z.object({
  type: z.literal("numeric"),
  entityKey: z.string(),
  op: z.enum([">", ">=", "<", "<=", "==", "!="]),
  value: z.number(),
});
export const Condition = z.discriminatedUnion("type", [ConditionMode, ConditionTimeRange, ConditionNumeric]);

// Intents (actions)
const IntentOnOff = z.object({
  name: z.literal("OnOff"),
  entityKey: z.string(),
  on: z.boolean(),
});
const IntentSetLevel = z.object({
  name: z.literal("SetLevel"),
  entityKey: z.string(),
  level: z.number().min(0).max(100),    // % abstraction
});
const IntentSetColorTemp = z.object({
  name: z.literal("SetColorTemp"),
  entityKey: z.string(),
  mireds: z.number().min(100).max(1000),
});
export const Intent = z.discriminatedUnion("name", [IntentOnOff, IntentSetLevel, IntentSetColorTemp]);

// Full automation graph
export const AutomationGraph = z.object({
  version: z.number().int().min(1),
  name: z.string(),
  triggers: z.array(Trigger).min(1),
  conditions: z.array(Condition).optional(),
  actions: z.array(Intent).min(1),
});
export type AutomationGraphT = z.infer<typeof AutomationGraph>;


⸻

2) How an “Apollo Air 1”–style device fits

(I’ll treat it generically: a CO₂ monitor that also reports temp/humidity, exposes a button (or two), and has LEDs you can drive. Communication could be BLE, Wi-Fi/MQTT, or USB serial; your adapter abstracts that detail.)

2a) Device → Entities
	•	Device: device.name = "Apollo Air 1" in room “Living Room”.
	•	Entities (examples):
	•	sensor.apollo_co2 → SensorNumeric (unit ppm, range [400, 5000]).
	•	sensor.apollo_temp → SensorNumeric (unit °C).
	•	sensor.apollo_humidity → SensorNumeric (unit percent).
	•	button.apollo_action → Button (variants: single, long).
	•	light.apollo_led → Light (supports on_off, maybe brightness).
	•	sensor.apollo_battery → SensorNumeric or Battery (if battery-powered).

Example traits payload for the CO₂ entity:

const apolloCo2Entity = EntityTraits.parse({
  kind: "sensor",
  key: "sensor.apollo_co2",
  traits: [{
    type: "SensorNumeric",
    key: "sensor.apollo_co2",
    unit: "ppm",
    decimals: 0,
    range: [400, 5000],
    samplingHintMs: 5000
  }]
});

2b) Adapter loop (edge daemon)

Your adapter (TS/Node) does two things:
	1.	Discovery/registration: creates the device + entities with the traits JSON once.
	2.	Telemetry write loop: every sample → write to:
	•	entity_state (upsert latest), and
	•	entity_state_history (append row; Timescale hypertable).

Pseudocode:

// On telemetry sample from device (e.g., MQTT message or BLE poll):
await setEntityState("uuid-for-sensor.apollo_co2", String(sample.ppm), { quality: sample.qi });
await setEntityState("uuid-for-sensor.apollo_temp", String(sample.celsius));
await setEntityState("uuid-for-sensor.apollo_humidity", String(sample.rh));

If the device exposes a button press, publish an event:

await publishEvent("automation_triggered", {
  entityKey: "button.apollo_action",
  variant: "single",
  ts: new Date().toISOString()
});

If you want to drive the LED (e.g., warn when CO₂ high), your intent handler maps OnOff / SetLevel to the device command (BLE GATT write, MQTT topic, etc.).

2c) Seeing CO₂ “over time”

You already have Timescale:
	•	Raw: entity_state_history keeps per-sample rows (ts, state='1234', attrs).
	•	Hourly chart: entity_state_hourly continuous aggregate materializes mean/min/max/last_state.

Query for the last 24h (rough):

SELECT hour_start, mean, min, max
FROM entity_state_hourly
WHERE entity_id = 'uuid-for-sensor.apollo_co2'
  AND hour_start >= now() - interval '24 hours'
ORDER BY hour_start;

Or hit raw points for a higher-resolution chart:

SELECT ts, state::double precision AS ppm
FROM entity_state_history
WHERE entity_id = 'uuid-for-sensor.apollo_co2'
  AND ts >= now() - interval '6 hours'
ORDER BY ts;

UI pulls that into a simple line chart. (You can also maintain a 5-minute CAGG if you want smoother “today” charts.)

2d) Nice UX you couldn’t do in HA (easily)
	•	Threshold cards: a CO₂ tile that turns amber at ≥1000 ppm, red at ≥1500 ppm; that’s just rendering logic on entity_state.
	•	Policy guardrails: block “space heater ON” if sensor.co2 > 1800 AND sensor.temp > 26°C. This is a policy that pre-flights intents before they hit the device.
	•	Automations with Explain-Why: a rule like “If CO₂ > 1100 for 5 min, turn light.apollo_led on at 100% and notify phone.” The trace shows:
	•	Trigger met (CO₂ > 1100 for 5m),
	•	Condition “mode != SLEEP” true/false,
	•	Actions succeeded (LED on + push sent) with latencies.

Example automation graph:

const co2Warn = AutomationGraph.parse({
  version: 1,
  name: "CO2 High Warn",
  triggers: [{
    type: "numeric",
    entityKey: "sensor.apollo_co2",
    op: ">=",
    value: 1100,
    forMs: 5 * 60 * 1000
  }],
  conditions: [{
    type: "mode",
    key: "HOME"
  }],
  actions: [
    { name: "OnOff", entityKey: "light.apollo_led", on: true },
    { name: "SetLevel", entityKey: "light.apollo_led", level: 100 },
  ]
});
