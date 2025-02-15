import ActivityKit
import SwiftUI

public struct DeviceActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var status: String
        public var lastUpdated: Date
        public var powerUsage: Double?
        public var temperature: Double?
        public var humidity: Double?
        public var motionDetected: Bool?
        public var brightness: Double?
        public var isResponsive: Bool
        public var batteryLevel: Double?
        public var lastMotionTimestamp: Date?
        public var energyTrend: Double?
        public var temperatureTrend: Double?
        public var humidityTrend: Double?

        public init(
            status: String,
            lastUpdated: Date,
            powerUsage: Double? = nil,
            temperature: Double? = nil,
            humidity: Double? = nil,
            motionDetected: Bool? = nil,
            brightness: Double? = nil,
            isResponsive: Bool = true,
            batteryLevel: Double? = nil,
            lastMotionTimestamp: Date? = nil,
            energyTrend: Double? = nil,
            temperatureTrend: Double? = nil,
            humidityTrend: Double? = nil
        ) {
            self.status = status
            self.lastUpdated = lastUpdated
            self.powerUsage = powerUsage
            self.temperature = temperature
            self.humidity = humidity
            self.motionDetected = motionDetected
            self.brightness = brightness
            self.isResponsive = isResponsive
            self.batteryLevel = batteryLevel
            self.lastMotionTimestamp = lastMotionTimestamp
            self.energyTrend = energyTrend
            self.temperatureTrend = temperatureTrend
            self.humidityTrend = humidityTrend
        }
    }

    public enum DeviceAction: String, Codable {
        case toggle
        case setBrightness
        case refresh
    }

    public var deviceId: String
    public var deviceName: String
    public var deviceType: String
    public var room: String?
    public var capabilities: DeviceCapabilities
    public var groupId: String?
    public var priority: Int

    public init(
        deviceId: String,
        deviceName: String,
        deviceType: String,
        room: String? = nil,
        capabilities: DeviceCapabilities,
        groupId: String? = nil,
        priority: Int = 0
    ) {
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.deviceType = deviceType
        self.room = room
        self.capabilities = capabilities
        self.groupId = groupId
        self.priority = priority
    }
}

public struct DeviceCapabilities: Codable, Hashable {
    public var canPower: Bool
    public var canDim: Bool
    public var canTemperature: Bool
    public var canHumidity: Bool
    public var canMotion: Bool
    public var canEnergy: Bool
    public var canBattery: Bool
}