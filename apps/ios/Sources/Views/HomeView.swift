import SwiftUI
import Models
import Components

struct HomeView: View {
    // Make mock data internal instead of private
    let mockMembers: [HouseholdMember] = [
        HouseholdMember(
            id: "1",
            name: "John",
            avatarUrl: nil,
            status: HouseholdMember.Status.home
        ),
        HouseholdMember(
            id: "2",
            name: "Sarah",
            avatarUrl: nil,
            status: HouseholdMember.Status.work
        ),
        HouseholdMember(
            id: "3",
            name: "Kids",
            avatarUrl: nil,
            status: HouseholdMember.Status.sleeping
        ),
        HouseholdMember(
            id: "4",
            name: "Guest",
            avatarUrl: nil,
            status: HouseholdMember.Status.away
        )
    ]

    let mockDevices: [Device] = [
        Device(
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
                canVolume: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "2",
            friendlyName: "Bar Lamp",
            status: "On",
            protocolName: "zigbee",
            type: "Light",
            description: "Bar area lamp",
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
                canVolume: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "3",
            friendlyName: "Spotlights",
            status: "On",
            protocolName: "zigbee",
            type: "Light",
            description: "Ceiling spotlights",
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
                canVolume: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "4",
            friendlyName: "Nest Mini",
            status: "Playing",
            protocolName: "wifi",
            type: "Speaker",
            description: "Smart speaker",
            categories: ["Speaker"],
            location: Device.Location(room: "Living Room", floor: "Ground", zone: nil),
            lastOnline: nil,
            metadata: Device.Metadata(iconUrl: nil, manufacturer: "Google", model: "Nest Mini", firmwareVersion: nil, hardwareVersion: nil),
            capabilities: Device.Capabilities(
                canBattery: false,
                canColor: false,
                canDim: false,
                canHumidity: false,
                canMotion: false,
                canOccupancy: false,
                canPlay: true,
                canPower: true,
                canTemperature: false,
                canToggle: true,
                canVolume: true
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "5",
            friendlyName: "Kitchen Spotlights",
            status: "Off",
            protocolName: "zigbee",
            type: "Light",
            description: "Kitchen ceiling lights",
            categories: ["Light"],
            location: Device.Location(room: "Kitchen", floor: "Ground", zone: nil),
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
                canVolume: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "6",
            friendlyName: "Fridge",
            status: "Closed",
            protocolName: "wifi",
            type: "Appliance",
            description: "Smart fridge",
            categories: ["Appliance"],
            location: Device.Location(room: "Kitchen", floor: "Ground", zone: nil),
            lastOnline: nil,
            metadata: Device.Metadata(iconUrl: nil, manufacturer: nil, model: nil, firmwareVersion: nil, hardwareVersion: nil),
            capabilities: Device.Capabilities(
                canBattery: false,
                canColor: false,
                canDim: false,
                canHumidity: false,
                canMotion: true,
                canOccupancy: false,
                canPlay: false,
                canPower: true,
                canTemperature: true,
                canToggle: false,
                canVolume: false
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        ),
        Device(
            id: "camera1",
            friendlyName: "Living Room Camera",
            status: "Online",
            protocolName: "wifi",
            type: "Camera",
            description: "Security camera",
            categories: ["Camera"],
            location: Device.Location(room: "Living Room", floor: "Ground", zone: nil),
            lastOnline: nil,
            metadata: Device.Metadata(iconUrl: nil, manufacturer: nil, model: nil, firmwareVersion: nil, hardwareVersion: nil),
            capabilities: Device.Capabilities(
                canBattery: false,
                canColor: false,
                canDim: false,
                canHumidity: false,
                canMotion: true,
                canOccupancy: true,
                canPlay: false,
                canPower: true,
                canTemperature: false,
                canToggle: true,
                canVolume: true
            ),
            networkInfo: nil,
            created: "",
            updated: ""
        )
    ]

    private var devicesByRoom: [String: [Device]] {
        Dictionary(grouping: mockDevices) { device in
            device.location.room ?? "Unassigned"
        }
    }

    private var cameras: [Device] {
        mockDevices.filter { $0.type.lowercased() == "camera" }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Household Members
                HouseholdMembers(members: mockMembers)
                    .padding(.horizontal)

                // Cameras Section
                if !cameras.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Cameras")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        LazyVGrid(
                            columns: [
                                GridItem(.adaptive(minimum: 300, maximum: 500), spacing: 16)
                            ],
                            spacing: 16
                        ) {
                            ForEach(cameras) { camera in
                                CameraFeedCard(device: camera)
                            }
                        }
                        .padding(.horizontal)
                    }
                }

                // Rooms
                LazyVGrid(
                    columns: [
                        GridItem(.adaptive(minimum: 300, maximum: 500), spacing: 16)
                    ],
                    spacing: 16
                ) {
                    ForEach(Array(devicesByRoom.keys.sorted()), id: \.self) { room in
                        if let roomDevices = devicesByRoom[room] {
                            NavigationLink(destination: RoomDetailView(room: room, devices: roomDevices)) {
                                RoomOverviewCard(room: room, devices: roomDevices)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .navigationTitle("Home")
        .background(Color(uiColor: .systemBackground))
    }
}

struct RoomOverviewCard: View {
    let room: String
    let devices: [Device]

    private var temperatureDevice: Device? {
        devices.first { $0.capabilities.canTemperature }
    }

    private var humidityDevice: Device? {
        devices.first { $0.capabilities.canHumidity }
    }

    private var previewDevices: [Device] {
        Array(devices.prefix(4))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Room Header
            HStack {
                HStack(spacing: 12) {
                    Image(systemName: roomIcon)
                        .font(.title2)
                    Text(room)
                        .font(.title2)
                        .fontWeight(.bold)
                }

                Spacer()

                // Temperature and Humidity if available
                if temperatureDevice != nil || humidityDevice != nil {
                    HStack(spacing: 16) {
                        if temperatureDevice != nil {
                            HStack(spacing: 4) {
                                Image(systemName: "thermometer")
                                    .foregroundColor(.red)
                                Text("22.8°C")
                            }
                        }

                        if humidityDevice != nil {
                            HStack(spacing: 4) {
                                Image(systemName: "humidity.fill")
                                    .foregroundColor(.blue)
                                Text("57%")
                            }
                        }
                    }
                    .font(.subheadline)
                }
            }

            // Device Grid Preview
            if !previewDevices.isEmpty {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    ForEach(previewDevices) { device in
                        DevicePreviewCard(device: device)
                    }
                }
            } else {
                Text("No devices in this room")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
        .background(Color(uiColor: .systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private var roomIcon: String {
        switch room.lowercased() {
        case _ where room.lowercased().contains("living"):
            return "sofa.fill"
        case _ where room.lowercased().contains("kitchen"):
            return "refrigerator.fill"
        case _ where room.lowercased().contains("bed"):
            return "bed.double.fill"
        case _ where room.lowercased().contains("office"):
            return "desktopcomputer"
        case _ where room.lowercased().contains("bath"):
            return "shower.fill"
        default:
            return "house.fill"
        }
    }
}

struct DevicePreviewCard: View {
    let device: Device

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Circle()
                    .fill(Color(uiColor: .secondarySystemBackground))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: deviceIcon)
                            .font(.system(size: 16))
                            .foregroundColor(deviceColor)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(device.friendlyName)
                        .font(.subheadline)
                        .lineLimit(1)

                    if let value = deviceValue {
                        Text(value)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
    }

    private var deviceIcon: String {
        if device.type.lowercased().contains("light") {
            return "lightbulb.fill"
        } else if device.type.lowercased().contains("speaker") {
            return "speaker.wave.2.fill"
        } else if device.type.lowercased().contains("blind") ||
                  device.type.lowercased().contains("shutter") {
            return "blinds.horizontal.closed"
        } else if device.type.lowercased().contains("fridge") {
            return "refrigerator"
        } else {
            return "power"
        }
    }

    private var deviceColor: Color {
        if device.type.lowercased().contains("light") {
            return .yellow
        } else if device.type.lowercased().contains("speaker") {
            return .blue
        } else if device.type.lowercased().contains("blind") ||
                  device.type.lowercased().contains("shutter") {
            return .purple
        } else {
            return .gray
        }
    }

    private var deviceValue: String? {
        if device.status.lowercased() == "on" {
            return "On"
        } else if device.status.lowercased() == "off" {
            return "Off"
        } else if device.status.lowercased() == "playing" {
            return "Playing"
        } else if device.status.lowercased() == "closed" {
            return "Closed"
        } else if device.status.lowercased() == "open" {
            return "Open · 100%"
        }
        return device.status
    }
}

#Preview {
    HomeView()
}