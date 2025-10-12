import SwiftUI
import Models
import Components
import MapKit

struct HomeView: View {
    // Make mock data internal instead of private
    let mockMembers: [HouseholdMember] = [
        HouseholdMember(
            id: "1",
            name: "John",
            avatarUrl: nil,
            status: HouseholdMember.Status.home,
            location: HouseholdMember.Location(
                latitude: 37.7749,
                longitude: -122.4194,
                address: "123 Main St, San Francisco, CA"
            )
        ),
        HouseholdMember(
            id: "2",
            name: "Sarah",
            avatarUrl: nil,
            status: HouseholdMember.Status.work,
            location: HouseholdMember.Location(
                latitude: 37.7833,
                longitude: -122.4167,
                address: "456 Market St, San Francisco, CA"
            )
        ),
        HouseholdMember(
            id: "3",
            name: "Kids",
            avatarUrl: nil,
            status: HouseholdMember.Status.sleeping,
            location: HouseholdMember.Location(
                latitude: 37.7694,
                longitude: -122.4862,
                address: "789 School Ave, San Francisco, CA"
            )
        ),
        HouseholdMember(
            id: "4",
            name: "Guest",
            avatarUrl: nil,
            status: HouseholdMember.Status.away,
            location: nil
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
                canVolume: false,
                canEnergyMonitoring: false
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
                canVolume: false,
                canEnergyMonitoring: false
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
                canVolume: false,
                canEnergyMonitoring: false
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
                canVolume: true,
                canEnergyMonitoring: false
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
                canVolume: false,
                canEnergyMonitoring: false
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
                canVolume: false,
                canEnergyMonitoring: true
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
                canVolume: true,
                canEnergyMonitoring: false
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
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Analytics Link
                    if !mockDevices.isEmpty {
                        NavigationLink(destination: HomeAnalyticsView(devices: mockDevices)) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Analytics")
                                        .font(.title2)
                                        .fontWeight(.bold)

                                    Text("View home-wide analytics and insights")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                Image(systemName: "chart.xyaxis.line")
                                    .font(.title2)
                            }
                            .padding()
                            .background(Color(uiColor: .secondarySystemBackground))
                            .cornerRadius(16)
                        }
                        .buttonStyle(PlainButtonStyle())
                        .padding(.horizontal)
                    }

                    // Household Members
                    VStack(alignment: .leading) {
                        Text("Household")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                ForEach(mockMembers) { member in
                                    NavigationLink(destination: PersonDetailView(member: member)) {
                                        MemberAvatar(member: member)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Cameras Section
                    if !cameras.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Cameras")
                                .font(.title2)
                                .fontWeight(.bold)
                                .padding(.horizontal)

                            LazyVGrid(
                                columns: [
                                    GridItem(.adaptive(minimum: 300, maximum: .infinity), spacing: 16)
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
                            GridItem(.adaptive(minimum: 300, maximum: .infinity), spacing: 16)
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

struct PersonDetailView: View {
    let member: HouseholdMember
    @State private var region: MKCoordinateRegion

    init(member: HouseholdMember) {
        self.member = member
        if let location = member.location {
            _region = State(initialValue: MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: location.latitude,
                    longitude: location.longitude
                ),
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            ))
        } else {
            _region = State(initialValue: MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            ))
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                HStack(spacing: 20) {
                    Circle()
                        .fill(Color(uiColor: .secondarySystemBackground))
                        .frame(width: 80, height: 80)
                        .overlay(
                            Text(member.name.prefix(1))
                                .font(.title)
                                .foregroundColor(.primary)
                        )

                    VStack(alignment: .leading, spacing: 4) {
                        Text(member.name)
                            .font(.title)
                            .fontWeight(.bold)

                        HStack {
                            Circle()
                                .fill(statusColor)
                                .frame(width: 10, height: 10)
                            Text(member.status.rawValue.capitalized)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)

                // Location Section
                if let location = member.location {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Location")
                            .font(.title2)
                            .fontWeight(.bold)

                        Text(location.address)
                            .foregroundColor(.secondary)

                        Map(coordinateRegion: $region, annotationItems: [member]) { member in
                            MapMarker(coordinate: CLLocationCoordinate2D(
                                latitude: location.latitude,
                                longitude: location.longitude
                            ))
                        }
                        .frame(height: 300)
                        .cornerRadius(16)
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(16)
                }
            }
            .padding()
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(uiColor: .systemBackground))
    }

    private var statusColor: Color {
        switch member.status {
        case .home:
            return .green
        case .away:
            return .orange
        case .work:
            return .blue
        case .sleeping:
            return .purple
        }
    }
}

#Preview {
    HomeView()
}