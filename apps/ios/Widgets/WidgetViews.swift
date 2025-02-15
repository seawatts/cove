import SwiftUI
import WidgetKit
import Models
import AppIntents

// MARK: - Device Status View
struct DeviceStatusView: View {
    let entry: DeviceStatusEntry

    var body: some View {
        Group {
            if entry.devices.isEmpty {
                Text("No devices")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(entry.devices.prefix(3)) { device in
                        DeviceRow(device: device)
                    }
                }
                .padding()
            }
        }
    }
}

struct DeviceRow: View {
    let device: Device
    @State private var isPerformingAction = false

    var body: some View {
        HStack {
            Image(systemName: deviceIcon)
                .foregroundColor(deviceColor)
                .symbolEffect(.bounce, value: isPerformingAction)

            VStack(alignment: .leading) {
                Text(device.friendlyName)
                    .font(.caption)
                    .fontWeight(.medium)
                Text(device.status)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if device.capabilities.canPower {
                Button(intent: ToggleDeviceIntent(deviceId: device.id, currentStatus: device.status)) {
                    Image(systemName: device.status == "on" ? "power.circle.fill" : "power.circle")
                        .foregroundColor(device.status == "on" ? .green : .secondary)
                }
                .buttonStyle(.plain)
                .onChange(of: device.status) { _, _ in
                    withAnimation {
                        isPerformingAction = true
                    }
                    // Reset animation after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        withAnimation {
                            isPerformingAction = false
                        }
                    }
                }
            }
        }
    }

    private var deviceIcon: String {
        switch device.type.lowercased() {
        case "light": return "lightbulb"
        case "switch": return "switch.2"
        case "thermostat": return "thermometer"
        case "sensor": return "sensor"
        default: return "cube"
        }
    }

    private var deviceColor: Color {
        switch device.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

// MARK: - Room Overview View
struct RoomOverviewView: View {
    let entry: RoomOverviewEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(entry.roomName)
                .font(.headline)
                .padding(.bottom, 4)

            HStack(spacing: 16) {
                MetricView(
                    icon: "thermometer",
                    value: String(format: "%.1f°", entry.temperature),
                    label: "Temperature"
                )

                MetricView(
                    icon: "humidity",
                    value: String(format: "%.0f%%", entry.humidity),
                    label: "Humidity"
                )

                MetricView(
                    icon: "bolt",
                    value: String(format: "%.1f kWh", entry.energyUsage),
                    label: "Energy"
                )
            }
        }
        .padding()
    }
}

struct MetricView: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title2)
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Quick Controls View
struct QuickControlsView: View {
    let entry: QuickControlsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                CircularQuickControl(entry: entry)
            case .accessoryRectangular:
                RectangularQuickControl(entry: entry)
            case .systemSmall:
                SmallQuickControl(entry: entry)
            case .systemMedium:
                MediumQuickControl(entry: entry)
            default:
                EmptyView()
            }
        }
    }
}

struct CircularQuickControl: View {
    let entry: QuickControlsEntry

    var body: some View {
        if let device = entry.favoriteDevices.first {
            VStack {
                Button(intent: ToggleDeviceIntent(deviceId: device.id, currentStatus: device.status)) {
                    Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                        .font(.title2)
                        .foregroundColor(device.status.lowercased() == "on" ? .green : .secondary)
                }
                Text(device.friendlyName)
                    .font(.caption2)
                    .lineLimit(1)
            }
        } else {
            Image(systemName: "house")
                .font(.title2)
        }
    }
}

struct RectangularQuickControl: View {
    let entry: QuickControlsEntry

    var body: some View {
        HStack {
            ForEach(Array(entry.favoriteDevices.prefix(3))) { device in
                VStack {
                    Button(intent: ToggleDeviceIntent(deviceId: device.id, currentStatus: device.status)) {
                        Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                            .font(.body)
                            .foregroundColor(device.status.lowercased() == "on" ? .green : .secondary)
                    }
                    Text(device.friendlyName)
                        .font(.caption2)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal)
    }
}

struct SmallQuickControl: View {
    let entry: QuickControlsEntry

    var body: some View {
        VStack(spacing: 8) {
            Text("Quick Controls")
                .font(.caption)
                .fontWeight(.medium)

            ForEach(Array(entry.favoriteDevices.prefix(2))) { device in
                HStack {
                    Image(systemName: deviceIcon(for: device))
                        .foregroundColor(deviceColor(for: device))

                    Text(device.friendlyName)
                        .font(.caption2)
                        .lineLimit(1)

                    Spacer()

                    Button(intent: ToggleDeviceIntent(deviceId: device.id, currentStatus: device.status)) {
                        Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                            .foregroundColor(device.status.lowercased() == "on" ? .green : .secondary)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(8)
            }
        }
        .padding(12)
    }

    private func deviceIcon(for device: Device) -> String {
        switch device.type.lowercased() {
        case "light": return "lightbulb"
        case "switch": return "switch.2"
        case "thermostat": return "thermometer"
        case "sensor": return "sensor"
        default: return "cube"
        }
    }

    private func deviceColor(for device: Device) -> Color {
        switch device.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

struct MediumQuickControl: View {
    let entry: QuickControlsEntry

    var body: some View {
        VStack(spacing: 8) {
            Text("Quick Controls")
                .font(.caption)
                .fontWeight(.medium)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 8) {
                ForEach(Array(entry.favoriteDevices.prefix(4))) { device in
                    HStack {
                        Image(systemName: deviceIcon(for: device))
                            .foregroundColor(deviceColor(for: device))

                        Text(device.friendlyName)
                            .font(.caption2)
                            .lineLimit(1)

                        Spacer()

                        Button(intent: ToggleDeviceIntent(deviceId: device.id, currentStatus: device.status)) {
                            Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                                .foregroundColor(device.status.lowercased() == "on" ? .green : .secondary)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(8)
                }
            }
        }
        .padding(12)
    }

    private func deviceIcon(for device: Device) -> String {
        switch device.type.lowercased() {
        case "light": return "lightbulb"
        case "switch": return "switch.2"
        case "thermostat": return "thermometer"
        case "sensor": return "sensor"
        default: return "cube"
        }
    }

    private func deviceColor(for device: Device) -> Color {
        switch device.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}
