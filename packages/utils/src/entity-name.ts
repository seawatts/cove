/**
 * Entity Display Name Utilities
 * Provides smart fallback logic for displaying friendly entity names
 */

/**
 * Format a device class into a user-friendly display name
 */
function formatDeviceClass(deviceClass: string): string {
  // Map common device classes to friendly names
  const deviceClassMap: Record<string, string> = {
    air_quality: 'Air Quality',

    // Battery and connectivity
    battery: 'Battery',

    // Environmental sensors
    co2: 'CO₂',
    connectivity: 'Connectivity',
    current: 'Current',

    // Binary sensors
    door: 'Door',
    energy: 'Energy',
    garage_door: 'Garage Door',
    humidity: 'Humidity',

    // Light sensors
    illuminance: 'Light Level',
    light: 'Light',
    lock: 'Lock',

    // Motion sensors
    motion: 'Motion',
    occupancy: 'Occupancy',
    opening: 'Opening',
    pm10: 'PM10',
    pm25: 'PM2.5',

    // Power sensors
    power: 'Power',
    precipitation: 'Precipitation',
    presence: 'Presence',

    // Pressure sensors
    pressure: 'Pressure',
    // Temperature sensors
    temperature: 'Temperature',
    voltage: 'Voltage',
    wind_direction: 'Wind Direction',

    // Weather sensors
    wind_speed: 'Wind Speed',
    window: 'Window',
  };

  return (
    deviceClassMap[deviceClass] ||
    deviceClass.charAt(0).toUpperCase() + deviceClass.slice(1)
  );
}

/**
 * Parse entity key to extract a reasonable display name
 */
function parseKeyForDisplay(key: string): string {
  // Split by dots to get entity type and identifier
  const parts = key.split('.');
  if (parts.length < 2) return key;

  const entityType = parts[0];
  const identifier = parts[1];

  if (!identifier) {
    return key; // Return original key if no identifier found
  }

  // Remove common prefixes and suffixes
  let displayName = identifier
    .replace(/^(sensor|binary_sensor|light|switch|button|number)_/, '') // Remove entity type prefix
    .replace(/_(sensor|light|switch|button)$/, '') // Remove entity type suffix
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word

  // Add entity type context if it's not obvious
  if (
    entityType === 'binary_sensor' &&
    !displayName.toLowerCase().includes('sensor')
  ) {
    displayName += ' Sensor';
  }

  return displayName;
}

/**
 * Get the best display name for an entity with smart fallback logic
 */
export function getEntityDisplayName(entity: {
  name?: string | null;
  deviceClass?: string | null;
  key: string;
}): string {
  // 1. Use name if available (highest priority)
  if (entity.name?.trim()) {
    return entity.name.trim();
  }

  // 2. Try deviceClass with formatting (second priority)
  if (entity.deviceClass?.trim()) {
    return formatDeviceClass(entity.deviceClass.trim());
  }

  // 3. Parse key as fallback (last resort)
  return parseKeyForDisplay(entity.key);
}

/**
 * Get a short display name (useful for compact UI elements)
 */
export function getEntityShortDisplayName(entity: {
  name?: string | null;
  deviceClass?: string | null;
  key: string;
}): string {
  const fullName = getEntityDisplayName(entity);

  // If it's too long, try to shorten it
  if (fullName.length > 20) {
    // Try device class first for short names
    if (entity.deviceClass) {
      const shortDeviceClass = formatDeviceClass(entity.deviceClass);
      if (shortDeviceClass.length <= 20) {
        return shortDeviceClass;
      }
    }

    // Otherwise truncate the full name
    return `${fullName.substring(0, 17)}...`;
  }

  return fullName;
}
