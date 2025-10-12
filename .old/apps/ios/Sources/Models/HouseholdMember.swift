import Foundation
import SwiftUI

public struct HouseholdMember: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let avatarUrl: URL?
    public let status: Status
    public let location: Location?

    public init(id: String, name: String, avatarUrl: URL?, status: Status, location: Location? = nil) {
        self.id = id
        self.name = name
        self.avatarUrl = avatarUrl
        self.status = status
        self.location = location
    }

    public struct Location: Hashable {
        public let latitude: Double
        public let longitude: Double
        public let address: String

        public init(latitude: Double, longitude: Double, address: String) {
            self.latitude = latitude
            self.longitude = longitude
            self.address = address
        }
    }

    public enum Status: String, Hashable {
        case home
        case away
        case work
        case sleeping

        public var icon: String {
            switch self {
            case .home: return "house.fill"
            case .away: return "mappin.and.ellipse"
            case .work: return "briefcase.fill"
            case .sleeping: return "moon.fill"
            }
        }

        public var color: Color {
            switch self {
            case .home: return .green
            case .away: return .gray
            case .work: return .blue
            case .sleeping: return .purple
            }
        }
    }
}