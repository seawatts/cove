import Foundation
import HomeKit

enum DeviceCategory: String, CaseIterable {
    case lock
    case thermostat
    case light
    case outlet
    case sensor
    case camera
    case doorbell
    case fan
    case switch_
    case other

    var icon: String {
        switch self {
        case .lock: return "lock.fill"
        case .thermostat: return "thermometer"
        case .light: return "lightbulb.fill"
        case .outlet: return "poweroutlet.type.b.fill"
        case .sensor: return "sensor.fill"
        case .camera: return "camera.fill"
        case .doorbell: return "bell.fill"
        case .fan: return "fan.fill"
        case .switch_: return "switch.2"
        case .other: return "cube.box.fill"
        }
    }

    var title: String {
        switch self {
        case .lock: return "Smart Lock"
        case .thermostat: return "Thermostat"
        case .light: return "Light"
        case .outlet: return "Smart Outlet"
        case .sensor: return "Sensor"
        case .camera: return "Camera"
        case .doorbell: return "Video Doorbell"
        case .fan: return "Fan"
        case .switch_: return "Switch"
        case .other: return "Device"
        }
    }

    static func from(hmCategory: HMAccessoryCategory) -> DeviceCategory {
        switch hmCategory {
        case .securitySystem: return .lock
        case .thermostat: return .thermostat
        case .lightbulb: return .light
        case .outlet: return .outlet
        case .sensor: return .sensor
        case .videoDoorbell: return .doorbell
        case .fan: return .fan
        case .switch: return .switch_
        case .camera: return .camera
        default: return .other
        }
    }
}

struct DeviceModel: Identifiable, Hashable {
    let id: UUID
    let name: String
    let manufacturer: String
    let model: String
    let category: DeviceCategory
    let firmwareVersion: String?

    static func from(accessory: HMAccessory) -> DeviceModel {
        DeviceModel(
            id: UUID(),
            name: accessory.name,
            manufacturer: accessory.manufacturer ?? "Unknown",
            model: accessory.model ?? "Unknown",
            category: .from(hmCategory: accessory.category),
            firmwareVersion: accessory.firmwareVersion
        )
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: DeviceModel, rhs: DeviceModel) -> Bool {
        lhs.id == rhs.id
    }
}

struct DeviceCatalog {
    static let supportedDevices: [String: DeviceCategory] = [
        "U100": .lock,          // Aqara U100
        "A1": .lock,           // August Smart Lock
        "YRD256": .lock,       // Yale Assure Lock
        "DoorLock": .lock,     // Generic Lock
        "Light": .light,       // Generic Light
        "Outlet": .outlet,     // Generic Outlet
        "Camera": .camera,     // Generic Camera
        "Thermostat": .thermostat, // Generic Thermostat
        // Add more devices as needed
    ]

    static func isSupported(model: String) -> Bool {
        supportedDevices[model] != nil
    }

    static func category(for model: String) -> DeviceCategory {
        supportedDevices[model] ?? .other
    }
}