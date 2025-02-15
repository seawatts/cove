import SwiftUI
import Models
import Foundation

public struct MemberAvatar: View {
    let member: HouseholdMember
    let size: CGFloat

    private var initials: String {
        let components = member.name.components(separatedBy: .whitespacesAndNewlines)
        if components.count > 1 {
            return String(components[0].prefix(1) + components[1].prefix(1))
        }
        return String(member.name.prefix(1))
    }

    private var backgroundColor: Color {
        // Use status color with reduced opacity for background when no image
        member.status.color.opacity(0.15)
    }

    public init(member: HouseholdMember, size: CGFloat = 60) {
        self.member = member
        self.size = size
    }

    public var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(backgroundColor)
                    .frame(width: size, height: size)

                if let avatarUrl = member.avatarUrl {
                    AsyncImage(url: avatarUrl) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        Text(initials)
                            .font(.system(size: size * 0.4, weight: .medium))
                            .foregroundColor(member.status.color)
                    }
                    .frame(width: size - 8, height: size - 8)
                    .clipShape(Circle())
                } else {
                    Text(initials)
                        .font(.system(size: size * 0.4, weight: .medium))
                        .foregroundColor(member.status.color)
                }

                Circle()
                    .fill(member.status.color)
                    .frame(width: size / 4, height: size / 4)
                    .overlay(
                        Circle()
                            .stroke(Color(uiColor: .systemBackground), lineWidth: 2)
                    )
                    .offset(x: size / 3, y: size / 3)
            }

            Text(member.name)
                .font(.caption)
                .lineLimit(1)
        }
    }
}

#Preview {
    HStack(spacing: 20) {
        MemberAvatar(
            member: HouseholdMember(
                id: "1",
                name: "John Smith",
                avatarUrl: nil,
                status: .home
            )
        )

        MemberAvatar(
            member: HouseholdMember(
                id: "2",
                name: "Sarah Jane",
                avatarUrl: URL(string: "https://example.com/avatar.jpg"),
                status: .away
            )
        )

        MemberAvatar(
            member: HouseholdMember(
                id: "3",
                name: "Alex",
                avatarUrl: nil,
                status: .work
            )
        )
    }
    .padding()
}
