import SwiftUI
import Models
import Components
import Charts

struct RoomAnalyticsView: View {
    let room: String
    let devices: [Device]
    @State private var selectedTimeRange: TimeRange = .day
    @State private var selectedDate = Date()

    enum TimeRange: String, CaseIterable {
        case hour = "Hour"
        case day = "Day"
        case week = "Week"
        case month = "Month"
    }

    // Computed properties for device types
    private var temperatureDevices: [Device] {
        devices.filter { $0.capabilities.canTemperature }
    }

    private var humidityDevices: [Device] {
        devices.filter { $0.capabilities.canHumidity }
    }

    private var energyDevices: [Device] {
        devices.filter { $0.capabilities.canEnergyMonitoring }
    }

    private var motionDevices: [Device] {
        devices.filter { $0.capabilities.canMotion }
    }

    private var occupancyDevices: [Device] {
        devices.filter { $0.capabilities.canOccupancy }
    }

    // Mock data generators based on time range
    private var temperatureData: [TimeSeriesData] {
        let calendar = Calendar.current
        let count: Int
        let component: Calendar.Component

        switch selectedTimeRange {
        case .hour:
            count = 60
            component = .minute
        case .day:
            count = 24
            component = .hour
        case .week:
            count = 7
            component = .day
        case .month:
            count = 30
            component = .day
        }

        return (0..<count).map { unitsAgo in
            let date = calendar.date(byAdding: component, value: -unitsAgo, to: selectedDate)!
            let baseTemp = 22.0
            let variation = Double.random(in: -2...2)
            return TimeSeriesData(date: date, value: baseTemp + variation)
        }.reversed()
    }

    private var humidityData: [TimeSeriesData] {
        let calendar = Calendar.current
        let count: Int
        let component: Calendar.Component

        switch selectedTimeRange {
        case .hour:
            count = 60
            component = .minute
        case .day:
            count = 24
            component = .hour
        case .week:
            count = 7
            component = .day
        case .month:
            count = 30
            component = .day
        }

        return (0..<count).map { unitsAgo in
            let date = calendar.date(byAdding: component, value: -unitsAgo, to: selectedDate)!
            let baseHumidity = 45.0
            let variation = Double.random(in: -5...5)
            return TimeSeriesData(date: date, value: baseHumidity + variation)
        }.reversed()
    }

    private var energyData: [TimeSeriesData] {
        let calendar = Calendar.current
        let count: Int
        let component: Calendar.Component

        switch selectedTimeRange {
        case .hour:
            count = 60
            component = .minute
        case .day:
            count = 24
            component = .hour
        case .week:
            count = 7
            component = .day
        case .month:
            count = 30
            component = .day
        }

        return (0..<count).map { unitsAgo in
            let date = calendar.date(byAdding: component, value: -unitsAgo, to: selectedDate)!
            let baseValue = 1.5
            let variation = Double.random(in: -0.5...0.5)
            return TimeSeriesData(date: date, value: baseValue + variation)
        }.reversed()
    }

    private var motionEvents: [Components.MotionEvent] {
        let calendar = Calendar.current
        let count: Int
        let interval: TimeInterval

        switch selectedTimeRange {
        case .hour:
            count = 12
            interval = 300 // 5 minutes
        case .day:
            count = 48
            interval = 1800 // 30 minutes
        case .week:
            count = 168
            interval = 3600 // 1 hour
        case .month:
            count = 720
            interval = 3600 // 1 hour
        }

        return (0..<count).map { unitsAgo in
            let date = calendar.date(byAdding: .minute, value: -Int(interval / 60) * unitsAgo, to: selectedDate)!
            return Components.MotionEvent(
                date: date,
                type: Bool.random() ? .motion : .occupancy,
                duration: Double.random(in: 10...60)
            )
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Time Range Selector
                Picker("Time Range", selection: $selectedTimeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Date Selector
                DatePicker(
                    "Select Date",
                    selection: $selectedDate,
                    displayedComponents: [.date]
                )
                .datePickerStyle(.graphical)
                .padding()
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)

                // Environmental Charts
                if !temperatureDevices.isEmpty || !humidityDevices.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Environmental")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        if !temperatureDevices.isEmpty {
                            TemperatureChart(
                                data: temperatureData,
                                title: "Average Temperature",
                                subtitle: "Room temperature from \(temperatureDevices.count) sensors",
                                trendPercentage: 1.5
                            )
                        }

                        if !humidityDevices.isEmpty {
                            HumidityChart(
                                data: humidityData,
                                title: "Average Humidity",
                                subtitle: "Room humidity from \(humidityDevices.count) sensors",
                                trendPercentage: -2.5
                            )
                        }
                    }
                }

                // Energy Usage
                if !energyDevices.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Energy")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        EnergyUsageChart(
                            data: energyData,
                            title: "Total Energy Usage",
                            subtitle: "Combined power consumption from \(energyDevices.count) devices",
                            trendPercentage: -8.5
                        )
                    }
                }

                // Motion & Occupancy
                if !motionDevices.isEmpty || !occupancyDevices.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Activity")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        MotionEventsChart(
                            events: motionEvents,
                            title: "Room Activity",
                            subtitle: "Motion and occupancy events from \(motionDevices.count + occupancyDevices.count) sensors"
                        )
                    }
                }
            }
            .padding()
        }
        .navigationTitle("\(room) Analytics")
        .navigationBarTitleDisplayMode(.large)
    }
}

#Preview {
    NavigationView {
        RoomAnalyticsView(
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