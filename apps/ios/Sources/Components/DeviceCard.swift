import SwiftUI
import Models

public struct DeviceCard: View {
    public let device: Device

    public init(device: Device) {
        self.device = device
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 8) {
                if let iconUrl = device.metadata.iconUrl,
                   !iconUrl.isEmpty {
                    AsyncImage(url: URL(string: iconUrl)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Image(systemName: "exclamationmark.circle")
                            .foregroundColor(.secondary)
                    }
                    .frame(width: 20, height: 20)
                } else {
                    Image(systemName: "exclamationmark.circle")
                        .foregroundColor(.secondary)
                        .frame(width: 20, height: 20)
                }

                Text(device.friendlyName)
                    .font(.headline)
                    .lineLimit(1)
            }

            // Status and Protocol
            HStack(spacing: 8) {
                StatusBadge(status: device.status)
                Badge(text: device.protocolName, color: .secondary.opacity(0.2))
            }

            // Categories
            FlowLayout(spacing: 4) {
                ForEach(device.categories, id: \.self) { category in
                    Badge(text: category, color: .blue.opacity(0.2))
                }
            }

            // Location
            if let room = device.location.room {
                let locationParts = [
                    room,
                    device.location.floor,
                    device.location.zone
                ].compactMap { $0 }.filter { !$0.isEmpty }

                if !locationParts.isEmpty {
                    Text(locationParts.joined(separator: " • "))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            // Network Info
            if let networkInfo = device.networkInfo {
                Text(networkInfo.primaryAddress)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Footer
            HStack {
                Text("Last online: \(formatDate(device.lastOnline))")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
    }

    private func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString,
              let date = ISO8601DateFormatter().date(from: dateString) else {
            return "Never"
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

public struct Badge: View {
    public let text: String
    public let color: Color

    public init(text: String, color: Color) {
        self.text = text
        self.color = color
    }

    public var body: some View {
        Text(text)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .cornerRadius(8)
    }
}

public struct StatusBadge: View {
    public let status: String

    public init(status: String) {
        self.status = status
    }

    public var body: some View {
        Badge(
            text: status,
            color: status == "Online" ? .green.opacity(0.2) :
                  status == "Offline" ? .red.opacity(0.2) :
                  .secondary.opacity(0.2)
        )
    }
}

public struct FlowLayout: Layout {
    public let spacing: CGFloat

    public init(spacing: CGFloat) {
        self.spacing = spacing
    }

    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }

    public func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, line) in result.lines.enumerated() {
            let y = bounds.minY + result.lineOffsets[index]
            var x = bounds.minX

            for elementIndex in line {
                let view = subviews[elementIndex]
                let size = view.sizeThatFits(.unspecified)
                view.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += size.width + spacing
            }
        }
    }

    struct FlowResult {
        var lines: [[Int]] = []
        var lineOffsets: [CGFloat] = []
        var size: CGSize = .zero

        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            guard !subviews.isEmpty else { return }

            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0
            var currentLine: [Int] = []

            for (index, view) in subviews.enumerated() {
                let size = view.sizeThatFits(.unspecified)

                if x + size.width > width && !currentLine.isEmpty {
                    lines.append(currentLine)
                    lineOffsets.append(y)
                    y += lineHeight + spacing
                    x = 0
                    lineHeight = 0
                    currentLine = []
                }

                currentLine.append(index)
                x += size.width + spacing
                lineHeight = max(lineHeight, size.height)
                self.size.width = max(self.size.width, x)
            }

            if !currentLine.isEmpty {
                lines.append(currentLine)
                lineOffsets.append(y)
                y += lineHeight
            }

            self.size.height = y
        }
    }
}

#Preview {
    DeviceCard(
        device: Device(
            id: "1",
            friendlyName: "Floor Lamp",
            status: "On",
            protocolName: "zigbee",
            type: "Light",
            description: "Floor lamp",
            categories: ["Light"],
            location: Device.Location(room: "Living Room", floor: "Ground", zone: nil),
            lastOnline: nil,
            metadata: Device.Metadata(iconUrl: nil, manufacturer: nil, model: nil, firmwareVersion: nil, hardwareVersion: nil),
            capabilities: Device.Capabilities(
                canBattery: false,
                canColor: false,
                canDim: true,
                canHumidity: false,
                canMotion: false,
                canOccupancy: false,
                canPlay: false,
                canPower: true,
                canTemperature: false,
                canToggle: true,
                canVolume: false,
                canEnergyMonitoring: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        )
    )
    .padding()
}