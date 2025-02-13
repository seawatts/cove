import SwiftUI
import Models

public struct CameraFeedCard: View {
    public let device: Device

    public init(device: Device) {
        self.device = device
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Camera Feed Placeholder
            Rectangle()
                .fill(Color(uiColor: .secondarySystemBackground))
                .aspectRatio(16/9, contentMode: .fit)
                .overlay(
                    Image(systemName: "video.fill")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                )
                .cornerRadius(12)

            // Camera Info
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(device.friendlyName)
                        .font(.headline)

                    Text(device.location.room ?? "Unknown Room")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Status Indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(device.status.lowercased() == "online" ? Color.green : Color.red)
                        .frame(width: 8, height: 8)

                    Text(device.status)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(16)
    }
}