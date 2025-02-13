import Foundation
import SwiftUI

public struct HouseholdMember: Identifiable {
    public let id: String
    public let name: String
    public let avatarUrl: String?
    public let status: Status

    public init(id: String, name: String, avatarUrl: String?, status: Status) {
        self.id = id
        self.name = name
        self.avatarUrl = avatarUrl
        self.status = status
    }

    public enum Status: String {
        case home = "home"
        case away = "away"
        case work = "work"
        case sleeping = "sleeping"

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