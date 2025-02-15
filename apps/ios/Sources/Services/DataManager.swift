import Foundation
import SwiftData
import OSLog
import Models

@Observable
public final class DataManager {
    public static let shared = DataManager()
    private let logger = Logger(subsystem: "com.cove.app", category: "DataManager")

    private var modelContainer: ModelContainer?
    private var context: ModelContext?

    private init() {
        do {
            let schema = Schema([
                OfflineDevice.self,
                EnergyReading.self,
                TemperatureReading.self,
                HumidityReading.self,
                MotionEvent.self
            ])
            let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
            modelContainer = try ModelContainer(for: schema, configurations: [modelConfiguration])
            context = ModelContext(modelContainer!)

            // Configure automatic cloud sync if user is signed in
            context?.autosaveEnabled = true
        } catch {
            logger.error("Failed to initialize SwiftData: \(error.localizedDescription)")
        }
    }

    // MARK: - Device Management

    public func syncDevices(_ devices: [Device]) async throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        // Fetch existing devices
        let descriptor = FetchDescriptor<OfflineDevice>()
        let existingDevices = try context.fetch(descriptor)
        let existingDeviceIds = Set(existingDevices.map { $0.id })

        // Update existing devices and add new ones
        for device in devices {
            if existingDeviceIds.contains(device.id) {
                if let existingDevice = existingDevices.first(where: { $0.id == device.id }) {
                    updateOfflineDevice(existingDevice, from: device)
                }
            } else {
                let offlineDevice = OfflineDevice(from: device)
                context.insert(offlineDevice)
            }
        }

        // Remove devices that no longer exist
        let newDeviceIds = Set(devices.map { $0.id })
        for deviceId in existingDeviceIds.subtracting(newDeviceIds) {
            if let deviceToDelete = existingDevices.first(where: { $0.id == deviceId }) {
                context.delete(deviceToDelete)
            }
        }

        try context.save()
    }

    public func updateOfflineDevice(_ offlineDevice: OfflineDevice, from device: Device) {
        offlineDevice.friendlyName = device.friendlyName
        offlineDevice.status = device.status
        offlineDevice.protocolName = device.protocolName
        offlineDevice.type = device.type
        offlineDevice.deviceDescription = device.description
        offlineDevice.categories = device.categories
        offlineDevice.room = device.location.room
        offlineDevice.floor = device.location.floor
        offlineDevice.zone = device.location.zone ?? "default"
        offlineDevice.lastOnline = device.lastOnline.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        offlineDevice.manufacturer = device.metadata.manufacturer
        offlineDevice.model = device.metadata.model
        offlineDevice.firmwareVersion = device.metadata.firmwareVersion
        offlineDevice.hardwareVersion = device.metadata.hardwareVersion
        // Don't update capabilities unless they've changed
        if offlineDevice.canBattery != device.capabilities.canBattery {
            offlineDevice.canBattery = device.capabilities.canBattery
        }
        // ... update other capabilities similarly
        offlineDevice.updated = ISO8601DateFormatter().date(from: device.updated) ?? Date()
    }

    public func getOfflineDevices() throws -> [Device] {
        guard let context = context else { throw DataError.contextNotAvailable }

        let descriptor = FetchDescriptor<OfflineDevice>()
        let offlineDevices = try context.fetch(descriptor)
        return offlineDevices.map { $0.toDevice() }
    }

    public func getFavoriteDevices() throws -> [Device] {
        guard let context = context else { throw DataError.contextNotAvailable }

        let descriptor = FetchDescriptor<OfflineDevice>(
            predicate: #Predicate<OfflineDevice> { device in
                device.isFavorite == true
            }
        )
        let favoriteDevices = try context.fetch(descriptor)
        return favoriteDevices.map { $0.toDevice() }
    }

    public func toggleFavorite(deviceId: String) throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        let descriptor = FetchDescriptor<OfflineDevice>(
            predicate: #Predicate<OfflineDevice> { device in
                device.id == deviceId
            }
        )

        if let device = try context.fetch(descriptor).first {
            device.isFavorite.toggle()
            try context.save()
        }
    }

    // MARK: - Sensor Data Management

    public func addEnergyReading(deviceId: String, value: Double) throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        let reading = EnergyReading(deviceId: deviceId, timestamp: Date(), value: value)
        if let device = try getOfflineDevice(id: deviceId) {
            device.energyReadings.append(reading)
            try context.save()
        }
    }

    public func addTemperatureReading(deviceId: String, value: Double) throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        let reading = TemperatureReading(deviceId: deviceId, timestamp: Date(), value: value)
        if let device = try getOfflineDevice(id: deviceId) {
            device.temperatureReadings.append(reading)
            try context.save()
        }
    }

    public func addHumidityReading(deviceId: String, value: Double) throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        let reading = HumidityReading(deviceId: deviceId, timestamp: Date(), value: value)
        if let device = try getOfflineDevice(id: deviceId) {
            device.humidityReadings.append(reading)
            try context.save()
        }
    }

    public func addMotionEvent(deviceId: String, duration: TimeInterval? = nil) throws {
        guard let context = context else { throw DataError.contextNotAvailable }

        let event = MotionEvent(deviceId: deviceId, timestamp: Date(), duration: duration)
        if let device = try getOfflineDevice(id: deviceId) {
            device.motionEvents.append(event)
            try context.save()
        }
    }

    // MARK: - Helper Methods

    public func getOfflineDevice(id: String) throws -> OfflineDevice? {
        guard let context = context else { throw DataError.contextNotAvailable }

        let descriptor = FetchDescriptor<OfflineDevice>(
            predicate: #Predicate<OfflineDevice> { device in
                device.id == id
            }
        )
        return try context.fetch(descriptor).first
    }
}

// MARK: - Errors

enum DataError: LocalizedError {
    case contextNotAvailable
    case deviceNotFound

    var errorDescription: String? {
        switch self {
        case .contextNotAvailable:
            return "Database context is not available"
        case .deviceNotFound:
            return "Device not found in the database"
        }
    }
}
