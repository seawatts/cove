import SwiftUI
import ActivityKit
import WidgetKit

struct DeviceActivityView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>
    @State private var isAnimating = false
    @State private var brightness: Double = 0.5
    @State private var isRefreshing = false

    var body: some View {
        switch context.displaySource {
        case .notification:
            NotificationActivityView(context: context)
        case .dynamic:
            DynamicIslandActivityView(context: context)
                .modifier(ShakeEffect(animatableData: isAnimating ? 1 : 0))
        @unknown default:
            EmptyView()
        }
    }
}

// MARK: - Dynamic Island Views
struct DynamicIslandActivityView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>
    @State private var isExpanded = false

    var body: some View {
        switch context.dynamicIslandExpandedDisplayState {
        case .expanded:
            ExpandedDeviceView(context: context)
                .transition(.move(edge: .top).combined(with: .opacity))
        case .minimal:
            MinimalDeviceView(context: context)
                .transition(.scale.combined(with: .opacity))
        case .compact:
            CompactDeviceView(context: context)
                .transition(.slide)
        @unknown default:
            EmptyView()
        }
    }
}

struct MinimalDeviceView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>
    @State private var isPressed = false

    var body: some View {
        HStack {
            Image(systemName: deviceIcon)
                .foregroundColor(statusColor)
                .symbolEffect(.bounce, value: isPressed)
            Text(context.attributes.deviceName)
                .font(.caption2)
                .lineLimit(1)
        }
        .padding(.horizontal, 4)
        .contentTransition(.symbolEffect(.replace))
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                isPressed.toggle()
            }
            handleTap()
        }
    }

    private func handleTap() {
        if context.attributes.capabilities.canPower {
            context.intent(DeviceActivityAttributes.DeviceAction.toggle.rawValue)
        }
    }

    private var deviceIcon: String {
        switch context.attributes.deviceType.lowercased() {
        case "light": return "lightbulb.fill"
        case "speaker": return "speaker.wave.2.fill"
        case "blind", "shutter": return "blinds.horizontal.closed"
        case "fridge": return "refrigerator"
        default: return "power"
        }
    }

    private var statusColor: Color {
        switch context.state.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

struct CompactDeviceView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>
    @State private var isRefreshing = false

    var body: some View {
        HStack {
            Image(systemName: deviceIcon)
                .foregroundColor(statusColor)
                .symbolEffect(.bounce, value: isRefreshing)

            VStack(alignment: .leading) {
                Text(context.attributes.deviceName)
                    .font(.caption2)
                    .lineLimit(1)
                Text(context.state.status.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if let powerUsage = context.state.powerUsage {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .imageScale(.small)
                    Text(String(format: "%.1f W", powerUsage))
                }
                .font(.caption2)
                .foregroundColor(.secondary)
                .transition(.scale.combined(with: .opacity))
            }

            if context.attributes.capabilities.canPower {
                Button(action: {
                    context.intent(DeviceActivityAttributes.DeviceAction.toggle.rawValue)
                }) {
                    Image(systemName: context.state.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                        .foregroundColor(context.state.status.lowercased() == "on" ? .green : .secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .contentTransition(.symbolEffect(.replace))
        .onTapGesture {
            withAnimation {
                isRefreshing = true
            }
            context.intent(DeviceActivityAttributes.DeviceAction.refresh.rawValue)

            // Reset animation after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                withAnimation {
                    isRefreshing = false
                }
            }
        }
    }

    private var deviceIcon: String {
        switch context.attributes.deviceType.lowercased() {
        case "light": return "lightbulb.fill"
        case "speaker": return "speaker.wave.2.fill"
        case "blind", "shutter": return "blinds.horizontal.closed"
        case "fridge": return "refrigerator"
        default: return "power"
        }
    }

    private var statusColor: Color {
        switch context.state.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

struct ExpandedDeviceView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>
    @State private var brightness: Double
    @State private var isRefreshing = false

    init(context: ActivityViewContext<DeviceActivityAttributes>) {
        self.context = context
        _brightness = State(initialValue: context.state.brightness ?? 0.5)
    }

    var body: some View {
        VStack(spacing: 12) {
            // Header with animation
            HStack {
                Image(systemName: deviceIcon)
                    .font(.title2)
                    .foregroundColor(statusColor)
                    .symbolEffect(.bounce, value: isRefreshing)

                VStack(alignment: .leading) {
                    Text(context.attributes.deviceName)
                        .font(.headline)
                    if let room = context.attributes.room {
                        Text(room)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                if context.attributes.capabilities.canPower {
                    Button(action: {
                        context.intent(DeviceActivityAttributes.DeviceAction.toggle.rawValue)
                    }) {
                        Text(context.state.status.capitalized)
                            .font(.subheadline)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(statusColor.opacity(0.2))
                            .foregroundColor(statusColor)
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Brightness slider if supported
            if context.attributes.capabilities.canDim {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Brightness")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack {
                        Image(systemName: "sun.min")
                            .imageScale(.small)

                        Slider(value: $brightness, in: 0...1) { isEditing in
                            if !isEditing {
                                context.intent(DeviceActivityAttributes.DeviceAction.setBrightness.rawValue)
                            }
                        }

                        Image(systemName: "sun.max")
                            .imageScale(.small)
                    }
                    .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }

            // Metrics with animations
            HStack(spacing: 16) {
                if let powerUsage = context.state.powerUsage {
                    MetricView(
                        icon: "bolt.fill",
                        value: String(format: "%.1f W", powerUsage),
                        label: "Power",
                        trend: context.state.energyTrend
                    )
                }

                if let temperature = context.state.temperature {
                    MetricView(
                        icon: "thermometer",
                        value: String(format: "%.1f°", temperature),
                        label: "Temperature",
                        trend: context.state.temperatureTrend
                    )
                }

                if let humidity = context.state.humidity {
                    MetricView(
                        icon: "humidity.fill",
                        value: String(format: "%.0f%%", humidity),
                        label: "Humidity",
                        trend: context.state.humidityTrend
                    )
                }

                if let motionDetected = context.state.motionDetected, motionDetected {
                    MetricView(
                        icon: "person.motion",
                        value: "Active",
                        label: "Motion",
                        showTrend: false
                    )
                }
            }
            .padding(.vertical, 4)

            // Battery level if available
            if let batteryLevel = context.state.batteryLevel {
                HStack {
                    Image(systemName: batteryIcon(for: batteryLevel))
                        .foregroundColor(batteryColor(for: batteryLevel))
                    Text("\(Int(batteryLevel))%")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Last updated with refresh button
            HStack {
                Text("Updated \(context.state.lastUpdated.formatted(.relative(presentation: .named)))")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Button(action: {
                    withAnimation {
                        isRefreshing = true
                    }
                    context.intent(DeviceActivityAttributes.DeviceAction.refresh.rawValue)

                    // Reset animation after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                        withAnimation {
                            isRefreshing = false
                        }
                    }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .imageScale(.small)
                        .foregroundColor(.secondary)
                        .rotationEffect(.degrees(isRefreshing ? 360 : 0))
                }
            }
        }
        .padding()
        .contentTransition(.symbolEffect(.replace))
    }

    private func batteryIcon(for level: Double) -> String {
        switch level {
        case 0..<20: return "battery.0"
        case 20..<40: return "battery.25"
        case 40..<60: return "battery.50"
        case 60..<80: return "battery.75"
        default: return "battery.100"
        }
    }

    private func batteryColor(for level: Double) -> Color {
        switch level {
        case 0..<20: return .red
        case 20..<40: return .orange
        default: return .green
        }
    }

    private var deviceIcon: String {
        switch context.attributes.deviceType.lowercased() {
        case "light": return "lightbulb.fill"
        case "speaker": return "speaker.wave.2.fill"
        case "blind", "shutter": return "blinds.horizontal.closed"
        case "fridge": return "refrigerator"
        default: return "power"
        }
    }

    private var statusColor: Color {
        switch context.state.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

// MARK: - Notification View
struct NotificationActivityView: View {
    let context: ActivityViewContext<DeviceActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: deviceIcon)
                    .font(.title2)
                    .foregroundColor(statusColor)

                VStack(alignment: .leading) {
                    Text(context.attributes.deviceName)
                        .font(.headline)
                    if let room = context.attributes.room {
                        Text(room)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                Text(context.state.status.capitalized)
                    .font(.subheadline)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(8)
            }

            if let powerUsage = context.state.powerUsage {
                HStack {
                    Image(systemName: "bolt.fill")
                    Text(String(format: "%.1f W", powerUsage))
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            }

            Text("Updated \(context.state.lastUpdated.formatted(.relative(presentation: .named)))")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }

    private var deviceIcon: String {
        switch context.attributes.deviceType.lowercased() {
        case "light": return "lightbulb.fill"
        case "speaker": return "speaker.wave.2.fill"
        case "blind", "shutter": return "blinds.horizontal.closed"
        case "fridge": return "refrigerator"
        default: return "power"
        }
    }

    private var statusColor: Color {
        switch context.state.status.lowercased() {
        case "on": return .green
        case "off": return .secondary
        case "error": return .red
        default: return .secondary
        }
    }
}

// MARK: - Supporting Views
struct MetricView: View {
    let icon: String
    let value: String
    let label: String
    var trend: Double? = nil
    var showTrend: Bool = true
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.body)
                .symbolEffect(.bounce, value: isAnimating)

            Text(value)
                .font(.caption)
                .fontWeight(.medium)

            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)

            if showTrend, let trend = trend {
                HStack(spacing: 2) {
                    Image(systemName: trend > 0 ? "arrow.up" : "arrow.down")
                        .imageScale(.small)
                    Text(String(format: "%.1f", abs(trend)))
                        .font(.caption2)
                }
                .foregroundColor(trend > 0 ? .red : .green)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                isAnimating = true
            }
        }
    }
}

// MARK: - Animation Modifiers
struct ShakeEffect: GeometryEffect {
    var animatableData: Double

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(animatableData * .pi * 2), y: 0))
    }
}

extension AnyTransition {
    static var slideAndFade: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        )
    }
}