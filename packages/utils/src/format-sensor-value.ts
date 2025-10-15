/**
 * Utility functions for formatting sensor values with dynamic precision
 * Based on value magnitude and unit type
 */

export function formatSensorValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return 'N/A';

  const numValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numValue)) return String(value);

  // Dynamic precision based on magnitude
  let formatted: string;
  if (Math.abs(numValue) >= 1000) {
    formatted = numValue.toFixed(0); // 1234 ppm
  } else if (Math.abs(numValue) >= 10) {
    formatted = numValue.toFixed(1); // 34.8°C
  } else if (Math.abs(numValue) >= 1) {
    formatted = numValue.toFixed(2); // 4.21 ppm
  } else {
    formatted = numValue.toFixed(2); // 0.16 ppm
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format sensor value for chart display (without unit)
 */
export function formatSensorValueForChart(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';

  const numValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numValue)) return String(value);

  // Dynamic precision based on magnitude for chart display
  if (Math.abs(numValue) >= 1000) {
    return `${(numValue / 1000).toFixed(1)}k`; // 1.2k
  }
  if (Math.abs(numValue) >= 10) {
    return numValue.toFixed(1); // 34.8
  }
  if (Math.abs(numValue) >= 1) {
    return numValue.toFixed(2); // 4.21
  }
  return numValue.toFixed(2); // 0.16
}

/**
 * Format sensor value for tooltip display (with unit)
 */
export function formatSensorValueForTooltip(
  value: unknown,
  unit?: string,
): string {
  if (value === null || value === undefined) return 'N/A';

  const numValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numValue)) return String(value);

  // Always show 1 decimal place in tooltips for precision
  const formatted = numValue.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
}
