import SwiftUI
import Models

public struct SwipeableDeviceCard: View {
    public let device: Device
    public let onPowerToggle: () -> Void
    public let onSettings: () -> Void

    @State private var offset: CGFloat = 0
    @State private var isSwiped = false
    @GestureState private var isDragging = false

    private let swipeThreshold: CGFloat = 50
    private let maxSwipe: CGFloat = 75

    public init(device: Device, onPowerToggle: @escaping () -> Void, onSettings: @escaping () -> Void) {
        self.device = device
        self.onPowerToggle = onPowerToggle
        self.onSettings = onSettings
    }

    public var body: some View {
        ZStack {
            // Background actions
            HStack(spacing: 0) {
                // Left action (Settings)
                Button(action: {
                    withAnimation(.spring()) {
                        offset = 0
                        isSwiped = false
                    }
                    onSettings()
                }) {
                    Image(systemName: "gear")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: maxSwipe)
                }
                .background(Color.blue)
                .opacity(offset < 0 ? 1 : 0)

                Spacer()

                // Right action (Power)
                Button(action: {
                    withAnimation(.spring()) {
                        offset = 0
                        isSwiped = false
                    }
                    onPowerToggle()
                }) {
                    Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: maxSwipe)
                }
                .background(Color.orange)
                .opacity(offset > 0 ? 1 : 0)
            }
            .frame(maxWidth: .infinity)
            .cornerRadius(12)

            // Device card
            DeviceCard(device: device)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(12)
                .offset(x: offset)
                .gesture(
                    DragGesture()
                        .updating($isDragging) { value, state, _ in
                            state = true
                        }
                        .onChanged { value in
                            let translation = value.translation.width
                            // Apply resistance as we drag further
                            offset = isSwiped ? translation : translation / 2
                            // Limit the maximum swipe distance
                            offset = min(max(offset, -maxSwipe), maxSwipe)
                        }
                        .onEnded { value in
                            let translation = value.translation.width
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                if abs(translation) >= swipeThreshold {
                                    // Snap to the edge if we've dragged past threshold
                                    offset = translation > 0 ? maxSwipe : -maxSwipe
                                    isSwiped = true
                                } else {
                                    // Spring back to center
                                    offset = 0
                                    isSwiped = false
                                }
                            }
                        }
                )
                .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isDragging)
        }
    }
}

#Preview {
    SwipeableDeviceCard(
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
        ),
        onPowerToggle: {},
        onSettings: {}
    )
    .padding()
}