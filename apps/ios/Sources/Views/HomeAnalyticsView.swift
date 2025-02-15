import SwiftUI
import Models
import Components
import Charts

struct HomeAnalyticsView: View {
    let devices: [Device]
    @State private var selectedTimeRange: TimeRange = .day
    @State private var selectedDate = Date()
    @State private var selectedTab = 0
    @State private var selectedRate: EnergyRate

    // Energy rates for different times of day
    private let availableRates = [
        EnergyRate(
            name: "Standard Rate",
            baseRate: 0.12,
            currency: "USD"
        ),
        EnergyRate(
            name: "Time of Use",
            baseRate: 0.10,
            peakRate: 0.20,
            peakHoursStart: 17, // 5 PM
            peakHoursEnd: 21,   // 9 PM
            currency: "USD"
        ),
        EnergyRate(
            name: "Day/Night Rate",
            baseRate: 0.15,
            peakRate: 0.08,
            peakHoursStart: 23, // 11 PM
            peakHoursEnd: 7,    // 7 AM
            currency: "USD"
        )
    ]

    init(devices: [Device]) {
        self.devices = devices
        // Set initial rate
        _selectedRate = State(initialValue: EnergyRate(
            name: "Standard Rate",
            baseRate: 0.12,
            currency: "USD"
        ))
    }

    enum TimeRange: String, CaseIterable {
        case hour = "Hour"
        case day = "Day"
        case week = "Week"
        case month = "Month"
    }

    // Device groupings
    private var devicesByRoom: [String: [Device]] {
        Dictionary(grouping: devices) { $0.location.room ?? "Unassigned" }
    }

    private var batteryDevices: [Device] {
        devices.filter { $0.capabilities.canBattery }
    }

    private var energyDevices: [Device] {
        devices.filter { $0.capabilities.canEnergyMonitoring }
    }

    // Mock data generators
    private var batteryData: [String: [TimeSeriesData]] {
        let calendar = Calendar.current
        let today = Date()

        return Dictionary(uniqueKeysWithValues: batteryDevices.map { device in
            let data = (0..<24).map { hoursAgo in
                let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
                let baseLevel = 100.0 - (Double(hoursAgo) * (Double.random(in: 2...4) / 24.0))
                let variation = Double.random(in: -1...1)
                return TimeSeriesData(date: date, value: max(0, min(100, baseLevel + variation)))
            }.reversed().map { $0 }
            return (device.id, data)
        })
    }

    private var energyDataByRoom: [String: [TimeSeriesData]] {
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

        return Dictionary(uniqueKeysWithValues: devicesByRoom.keys.map { room in
            let data = (0..<count).map { unitsAgo in
                let date = calendar.date(byAdding: component, value: -unitsAgo, to: selectedDate)!
                let baseValue = Double.random(in: 1...3)
                let variation = Double.random(in: -0.5...0.5)
                return TimeSeriesData(date: date, value: baseValue + variation)
            }.reversed().map { $0 }
            return (room, data)
        })
    }

    private var totalEnergyData: [TimeSeriesData] {
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
            let baseValue = Double(energyDevices.count) * Double.random(in: 1...2)
            let variation = Double.random(in: -1...1)
            return TimeSeriesData(date: date, value: baseValue + variation)
        }.reversed()
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

                // Rate Plan Selector
                VStack(alignment: .leading) {
                    Text("Energy Rate Plan")
                        .font(.headline)
                        .padding(.horizontal)

                    Picker("Rate Plan", selection: $selectedRate) {
                        ForEach(availableRates, id: \.name) { rate in
                            Text(rate.name).tag(rate)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                }

                // Tab View for different analytics
                Picker("Analytics Type", selection: $selectedTab) {
                    Text("Energy").tag(0)
                    Text("Battery").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                if selectedTab == 0 {
                    // Energy Analytics
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Total Energy Cost")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        EnergyCostChart(
                            data: totalEnergyData,
                            rate: selectedRate,
                            title: "Home Energy Cost",
                            subtitle: "Combined cost from \(energyDevices.count) devices"
                        )

                        // Add Monthly Projections
                        EnergyCostProjection(
                            historicalData: totalEnergyData,
                            rate: selectedRate,
                            monthsToProject: 3
                        )

                        Text("Energy Cost by Room")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        ForEach(Array(energyDataByRoom.keys.sorted()), id: \.self) { room in
                            if let data = energyDataByRoom[room] {
                                let roomDevices = devicesByRoom[room]?.filter { $0.capabilities.canEnergyMonitoring } ?? []
                                if !roomDevices.isEmpty {
                                    EnergyCostChart(
                                        data: data,
                                        rate: selectedRate,
                                        title: room,
                                        subtitle: "\(roomDevices.count) devices"
                                    )
                                }
                            }
                        }

                        // Usage Charts
                        Text("Energy Usage")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        EnergyUsageChart(
                            data: totalEnergyData,
                            title: "Home Energy Consumption",
                            subtitle: "Combined power usage from \(energyDevices.count) devices",
                            trendPercentage: -5.2
                        )

                        ForEach(Array(energyDataByRoom.keys.sorted()), id: \.self) { room in
                            if let data = energyDataByRoom[room] {
                                let roomDevices = devicesByRoom[room]?.filter { $0.capabilities.canEnergyMonitoring } ?? []
                                if !roomDevices.isEmpty {
                                    EnergyUsageChart(
                                        data: data,
                                        title: "\(room) Usage",
                                        subtitle: "\(roomDevices.count) devices",
                                        trendPercentage: Double.random(in: -10...10)
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Battery Analytics
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Battery Levels")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        ForEach(batteryDevices) { device in
                            if let data = batteryData[device.id] {
                                BatteryLevelChart(
                                    data: data,
                                    title: device.friendlyName,
                                    subtitle: "\(device.type) in \(device.location.room ?? "Unknown")",
                                    trendPercentage: Double.random(in: -5...5)
                                )
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Home Analytics")
        .navigationBarTitleDisplayMode(.large)
    }
}

#Preview {
    NavigationView {
        HomeAnalyticsView(devices: [
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
                    canEnergyMonitoring: true
                ),
                networkInfo: nil,
                created: "",
                updated: ""
            )
        ])
    }
}