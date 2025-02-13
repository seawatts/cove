import SwiftUI
import Models

public struct MemberAvatar: View {
    public let member: HouseholdMember

    public init(member: HouseholdMember) {
        self.member = member
    }

    public var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                // Avatar Background
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(uiColor: .tertiarySystemBackground))
                    .frame(width: 60, height: 60)
                    .overlay(
                        // Avatar Image or Placeholder
                        Group {
                            if let avatarUrl = member.avatarUrl,
                               let url = URL(string: avatarUrl) {
                                AsyncImage(url: url) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    ProgressView()
                                }
                            } else {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 30))
                                    .foregroundColor(.secondary)
                            }
                        }
                    )

                // Status Indicator
                ZStack {
                    Circle()
                        .fill(Color(uiColor: .systemBackground))
                        .frame(width: 24, height: 24)

                    Circle()
                        .fill(Color(uiColor: .tertiarySystemBackground))
                        .frame(width: 22, height: 22)

                    Image(systemName: member.status.icon)
                        .font(.system(size: 12))
                        .foregroundColor(.primary)
                }
                .offset(x: 4, y: -4)
            }

            Text(member.name)
                .font(.subheadline)
                .foregroundColor(.primary)
                .lineLimit(1)
        }
    }
}

#Preview {
    let mockMember = HouseholdMember(
        id: "1",
        name: "John",
        avatarUrl: nil,
        status: .home
    )

    return VStack {
        MemberAvatar(member: mockMember)
        MemberAvatar(member: mockMember)
            .preferredColorScheme(.dark)
    }
    .padding()
}