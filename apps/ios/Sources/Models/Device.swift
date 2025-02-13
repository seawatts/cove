import Foundation

public struct Device: Identifiable, Codable {
    public let id: String
    public let friendlyName: String
    public let status: String
    public let protocolName: String
    public let type: String
    public let description: String
    public let categories: [String]
    public let location: Location
    public let lastOnline: String?
    public let metadata: Metadata
    public let capabilities: Capabilities
    public let networkInfo: NetworkInfo?
    public let created: String
    public let updated: String

    public struct Location: Codable {
        public let room: String?
        public let floor: String?
        public let zone: String?

        public init(room: String?, floor: String?, zone: String?) {
            self.room = room
            self.floor = floor
            self.zone = zone
        }
    }

    public struct Metadata: Codable {
        public let iconUrl: String?
        public let manufacturer: String?
        public let model: String?
        public let firmwareVersion: String?
        public let hardwareVersion: String?

        public init(iconUrl: String?, manufacturer: String?, model: String?, firmwareVersion: String?, hardwareVersion: String?) {
            self.iconUrl = iconUrl
            self.manufacturer = manufacturer
            self.model = model
            self.firmwareVersion = firmwareVersion
            self.hardwareVersion = hardwareVersion
        }
    }

    public struct Capabilities: Codable {
        public let canBattery: Bool
        public let canColor: Bool
        public let canDim: Bool
        public let canHumidity: Bool
        public let canMotion: Bool
        public let canOccupancy: Bool
        public let canPlay: Bool
        public let canPower: Bool
        public let canTemperature: Bool
        public let canToggle: Bool
        public let canVolume: Bool

        public init(canBattery: Bool, canColor: Bool, canDim: Bool, canHumidity: Bool, canMotion: Bool, canOccupancy: Bool, canPlay: Bool, canPower: Bool, canTemperature: Bool, canToggle: Bool, canVolume: Bool) {
            self.canBattery = canBattery
            self.canColor = canColor
            self.canDim = canDim
            self.canHumidity = canHumidity
            self.canMotion = canMotion
            self.canOccupancy = canOccupancy
            self.canPlay = canPlay
            self.canPower = canPower
            self.canTemperature = canTemperature
            self.canToggle = canToggle
            self.canVolume = canVolume
        }
    }

    public struct NetworkInfo: Codable {
        public let addresses: [String]
        public let hostname: String
        public let macAddress: String?
        public let port: Int
        public let primaryAddress: String

        public init(addresses: [String], hostname: String, macAddress: String?, port: Int, primaryAddress: String) {
            self.addresses = addresses
            self.hostname = hostname
            self.macAddress = macAddress
            self.port = port
            self.primaryAddress = primaryAddress
        }
    }

    public init(id: String, friendlyName: String, status: String, protocolName: String, type: String, description: String, categories: [String], location: Location, lastOnline: String?, metadata: Metadata, capabilities: Capabilities, networkInfo: NetworkInfo?, created: String, updated: String) {
        self.id = id
        self.friendlyName = friendlyName
        self.status = status
        self.protocolName = protocolName
        self.type = type
        self.description = description
        self.categories = categories
        self.location = location
        self.lastOnline = lastOnline
        self.metadata = metadata
        self.capabilities = capabilities
        self.networkInfo = networkInfo
        self.created = created
        self.updated = updated
    }

    // MARK: - Equatable conformance for Device
    public static func == (lhs: Device, rhs: Device) -> Bool {
        lhs.id == rhs.id &&
        lhs.friendlyName == rhs.friendlyName &&
        lhs.status == rhs.status &&
        lhs.protocolName == rhs.protocolName &&
        lhs.lastOnline == rhs.lastOnline
    }

    // MARK: - CodingKeys
    enum CodingKeys: String, CodingKey {
        case id
        case friendlyName
        case status
        case protocolName = "protocol"
        case type
        case description
        case categories
        case location
        case lastOnline = "last_online"
        case metadata
        case capabilities
        case networkInfo = "network_info"
        case created
        case updated
    }
}