import SwiftUI
import Models

public struct HouseholdMembers: View {
    public let members: [HouseholdMember]

    public init(members: [HouseholdMember]) {
        self.members = members
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Household")
                .font(.title2)
                .fontWeight(.bold)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(members) { member in
                        VStack(spacing: 8) {
                            MemberAvatar(member: member)

                            Text(member.name)
                                .font(.caption)
                                .foregroundColor(.primary)
                        }
                    }
                }
            }
        }
    }
}