import SwiftUI
import Models
import Components

struct RoomDetailView: View {
    let room: String
    let devices: [Device]
    @State private var temperature: Double = 22.8
    @State private var humidity: Double = 57.0

    // Add computed properties for temperature and humidity devices
    private var temperatureDevice: Device? {
        devices.first { $0.capabilities.canTemperature }
    }

    private var humidityDevice: Device? {
        devices.first { $0.capabilities.canHumidity }
    }

    // Mock time series data
    private var temperatureData: [TimeSeriesData] {
        let calendar = Calendar.current
        let today = Date()
        return (0..<6).map { monthsAgo in
            let date = calendar.date(byAdding: .month, value: -monthsAgo, to: today)!
            let baseTemp = 22.0
            let variation = Double.random(in: -2...4)
            return TimeSeriesData(date: date, value: baseTemp + variation)
        }.reversed()
    }

    private var humidityData: [TimeSeriesData] {
        let calendar = Calendar.current
        let today = Date()
        return (0..<6).map { monthsAgo in
            let date = calendar.date(byAdding: .month, value: -monthsAgo, to: today)!
            let baseHumidity = 57.0
            let variation = Double.random(in: -5...5)
            return TimeSeriesData(date: date, value: baseHumidity + variation)
        }.reversed()
    }

    private var cameras: [Device] {
        devices.filter { $0.type.lowercased() == "camera" }
    }

    private var otherDevices: [Device] {
        devices.filter { $0.type.lowercased() != "camera" }
    }

    private var hasAnalytics: Bool {
        devices.contains { device in
            device.capabilities.canTemperature ||
            device.capabilities.canHumidity ||
            device.capabilities.canEnergyMonitoring ||
            device.capabilities.canMotion ||
            device.capabilities.canOccupancy
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Room Header with Analytics Link
                HStack {
                    HStack(spacing: 12) {
                        Image(systemName: roomIcon)
                            .font(.title2)
                        Text(room)
                            .font(.title)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    if hasAnalytics {
                        NavigationLink(destination: RoomAnalyticsView(room: room, devices: devices)) {
                            Label("Analytics", systemImage: "chart.xyaxis.line")
                                .font(.headline)
                                .foregroundColor(.blue)
                        }
                    }
                }
                .padding()
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)

                // Room Header
                HStack {
                    HStack(spacing: 12) {
                        Image(systemName: roomIcon)
                            .font(.title2)
                        Text(room)
                            .font(.title)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    // Current Temperature and Humidity
                    if hasEnvironmentalSensors {
                        HStack(spacing: 16) {
                            if temperatureDevice != nil {
                                HStack(spacing: 4) {
                                    Image(systemName: "thermometer")
                                        .foregroundColor(.red)
                                    Text(String(format: "%.1f°C", temperature))
                                }
                            }

                            if humidityDevice != nil {
                                HStack(spacing: 4) {
                                    Image(systemName: "humidity.fill")
                                        .foregroundColor(.blue)
                                    Text("\(Int(humidity))%")
                                }
                            }
                        }
                        .font(.headline)
                    }
                }

                // Cameras Section
                if !cameras.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Cameras")
                            .font(.title2)
                            .fontWeight(.bold)

                        ForEach(cameras) { camera in
                            CameraFeedCard(device: camera)
                        }
                    }
                }

                // Environmental Charts
                if hasEnvironmentalSensors {
                    GradientAreaChart(
                        data: temperatureData,
                        title: "Temperature",
                        subtitle: "Room temperature over time",
                        trendPercentage: 5.2,
                        gradientColors: [
                            Color(red: 0.8, green: 0.3, blue: 0.3),
                            Color(red: 0.4, green: 0.1, blue: 0.1)
                        ]
                    ) { value in
                        String(format: "%.1f°C", value)
                    }

                    GradientAreaChart(
                        data: humidityData,
                        title: "Humidity",
                        subtitle: "Room humidity over time",
                        trendPercentage: -2.1,
                        gradientColors: [
                            Color(red: 0.2, green: 0.4, blue: 0.8),
                            Color(red: 0.1, green: 0.2, blue: 0.4)
                        ]
                    ) { value in
                        String(format: "%.0f%%", value)
                    }
                }

                // Other Devices
                if !otherDevices.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Devices")
                            .font(.title2)
                            .fontWeight(.bold)

                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 16) {
                            ForEach(otherDevices) { device in
                                NavigationLink(destination: DeviceDetailView(device: device)) {
                                    DeviceCard(device: device)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hasEnvironmentalSensors: Bool {
        devices.contains { $0.capabilities.canTemperature || $0.capabilities.canHumidity }
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

struct DeviceControlCard: View {
    let device: Device
    @State private var sliderValue: Double = 0.7

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Icon and Name
            HStack(spacing: 12) {
                Circle()
                    .fill(Color(uiColor: .secondarySystemBackground))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: deviceIcon)
                            .font(.system(size: 20))
                            .foregroundColor(deviceColor)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text(device.friendlyName)
                        .font(.headline)

                    if let value = deviceValue {
                        Text(value)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Slider or Status
            if device.capabilities.canDim {
                Slider(value: $sliderValue, in: 0...1)
                    .tint(deviceColor)
            }
        }
        .padding()
        .background(Color(uiColor: .systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
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
        if device.capabilities.canDim {
            return "\(Int(sliderValue * 100))%"
        } else if device.status.lowercased() == "on" {
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
    NavigationView {
        RoomDetailView(
            room: "Living Room",
            devices: [
                Device(
                    id: "1",
                    friendlyName: "Temperature Sensor",
                    status: "Online",
                    protocolName: "zigbee",
                    type: "Sensor",
                    description: "Room sensor",
                    categories: ["Sensor"],
                    location: Device.Location(room: "Living Room", floor: "Ground", zone: nil),
                    lastOnline: nil,
                    metadata: Device.Metadata(iconUrl: nil, manufacturer: nil, model: nil, firmwareVersion: nil, hardwareVersion: nil),
                    capabilities: Device.Capabilities(
                        canBattery: true,
                        canColor: false,
                        canDim: false,
                        canHumidity: true,
                        canMotion: true,
                        canOccupancy: true,
                        canPlay: false,
                        canPower: true,
                        canTemperature: true,
                        canToggle: false,
                        canVolume: false,
                        canEnergyMonitoring: false
                    ),
                    networkInfo: nil,
                    created: "",
                    updated: ""
                )
            ]
        )
    }
}
