import Foundation
import SwiftData

@Model
public final class OfflineDevice {
    public var id: String
    public var friendlyName: String
    public var status: String
    public var protocolName: String
    public var type: String
    public var deviceDescription: String?
    public var categories: [String]
    public var room: String?
    public var floor: String?
    public var zone: String
    public var lastOnline: Date
    public var manufacturer: String?
    public var model: String?
    public var firmwareVersion: String?
    public var hardwareVersion: String?
    public var canBattery: Bool
    public var canColor: Bool
    public var canDim: Bool
    public var canHumidity: Bool
    public var canMotion: Bool
    public var canOccupancy: Bool
    public var canPlay: Bool
    public var canPower: Bool
    public var canTemperature: Bool
    public var canToggle: Bool
    public var canVolume: Bool
    public var canEnergyMonitoring: Bool
    public var created: Date
    public var updated: Date
    public var isFavorite: Bool

    @Relationship(deleteRule: .cascade) public var energyReadings: [EnergyReading]
    @Relationship(deleteRule: .cascade) public var temperatureReadings: [TemperatureReading]
    @Relationship(deleteRule: .cascade) public var humidityReadings: [HumidityReading]
    @Relationship(deleteRule: .cascade) public var motionEvents: [MotionEvent]

    public init(from device: Device, isFavorite: Bool = false) {
        self.id = device.id
        self.friendlyName = device.friendlyName
        self.status = device.status
        self.protocolName = device.protocolName
        self.type = device.type
        self.deviceDescription = device.description
        self.categories = device.categories
        self.room = device.location.room
        self.floor = device.location.floor
        self.zone = device.location.zone ?? "default"
        self.lastOnline = device.lastOnline.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        self.manufacturer = device.metadata.manufacturer
        self.model = device.metadata.model
        self.firmwareVersion = device.metadata.firmwareVersion
        self.hardwareVersion = device.metadata.hardwareVersion
        self.canBattery = device.capabilities.canBattery
        self.canColor = device.capabilities.canColor
        self.canDim = device.capabilities.canDim
        self.canHumidity = device.capabilities.canHumidity
        self.canMotion = device.capabilities.canMotion
        self.canOccupancy = device.capabilities.canOccupancy
        self.canPlay = device.capabilities.canPlay
        self.canPower = device.capabilities.canPower
        self.canTemperature = device.capabilities.canTemperature
        self.canToggle = device.capabilities.canToggle
        self.canVolume = device.capabilities.canVolume
        self.canEnergyMonitoring = device.capabilities.canEnergyMonitoring
        self.created = ISO8601DateFormatter().date(from: device.created) ?? Date()
        self.updated = ISO8601DateFormatter().date(from: device.updated) ?? Date()
        self.isFavorite = isFavorite
        self.energyReadings = []
        self.temperatureReadings = []
        self.humidityReadings = []
        self.motionEvents = []
    }

    public func toDevice() -> Device {
        Device(
            id: id,
            friendlyName: friendlyName,
            status: status,
            protocolName: protocolName,
            type: type,
            description: deviceDescription ?? "\(type) device",
            categories: categories,
            location: Device.Location(room: room, floor: floor, zone: zone),
            lastOnline: ISO8601DateFormatter().string(from: lastOnline),
            metadata: Device.Metadata(
                iconUrl: nil,
                manufacturer: manufacturer,
                model: model,
                firmwareVersion: firmwareVersion,
                hardwareVersion: hardwareVersion
            ),
            capabilities: Device.Capabilities(
                canBattery: canBattery,
                canColor: canColor,
                canDim: canDim,
                canHumidity: canHumidity,
                canMotion: canMotion,
                canOccupancy: canOccupancy,
                canPlay: canPlay,
                canPower: canPower,
                canTemperature: canTemperature,
                canToggle: canToggle,
                canVolume: canVolume,
                canEnergyMonitoring: canEnergyMonitoring
            ),
            networkInfo: nil,
            created: ISO8601DateFormatter().string(from: created),
            updated: ISO8601DateFormatter().string(from: updated)
        )
    }
}

@Model
public final class EnergyReading {
    public var deviceId: String
    public var timestamp: Date
    public var value: Double

    public init(deviceId: String, timestamp: Date, value: Double) {
        self.deviceId = deviceId
        self.timestamp = timestamp
        self.value = value
    }
}

@Model
public final class TemperatureReading {
    public var deviceId: String
    public var timestamp: Date
    public var value: Double

    public init(deviceId: String, timestamp: Date, value: Double) {
        self.deviceId = deviceId
        self.timestamp = timestamp
        self.value = value
    }
}

@Model
public final class HumidityReading {
    public var deviceId: String
    public var timestamp: Date
    public var value: Double

    public init(deviceId: String, timestamp: Date, value: Double) {
        self.deviceId = deviceId
        self.timestamp = timestamp
        self.value = value
    }
}

@Model
public final class MotionEvent {
    public var deviceId: String
    public var timestamp: Date
    public var duration: TimeInterval?

    public init(deviceId: String, timestamp: Date, duration: TimeInterval? = nil) {
        self.deviceId = deviceId
        self.timestamp = timestamp
        self.duration = duration
    }
}
