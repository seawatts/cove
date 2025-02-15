import SwiftUI
import Components
import Models
import Services

// Move DeviceDetailView code here since it's in the same module
struct DeviceDetailView: View {
    let device: Device
    @State private var sliderValue: Double = 0.5
    // @State private var hasLiveActivity = false

    // Mock energy data - in a real app this would come from your backend
    private var energyData: [TimeSeriesData] {
        let calendar = Calendar.current
        let today = Date()
        return (0..<7).map { daysAgo in
            let date = calendar.date(byAdding: .day, value: -daysAgo, to: today)!
            let baseValue = 1.5 // Base kWh
            let variation = Double.random(in: -0.5...0.5)
            return TimeSeriesData(date: date, value: baseValue + variation)
        }.reversed()
    }

    // Mock temperature data
    private var temperatureData: [TimeSeriesData] {
        let calendar = Calendar.current
        let today = Date()
        return (0..<24).map { hoursAgo in
            let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
            let baseTemp = 22.0
            let variation = Double.random(in: -2...2)
            return TimeSeriesData(date: date, value: baseTemp + variation)
        }.reversed()
    }

    // Mock humidity data
    private var humidityData: [TimeSeriesData] {
        let calendar = Calendar.current
        let today = Date()
        return (0..<24).map { hoursAgo in
            let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
            let baseHumidity = 45.0
            let variation = Double.random(in: -5...5)
            return TimeSeriesData(date: date, value: baseHumidity + variation)
        }.reversed()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Device Header
                HStack(spacing: 16) {
                    Circle()
                        .fill(Color(uiColor: .secondarySystemBackground))
                        .frame(width: 60, height: 60)
                        .overlay(
                            Image(systemName: deviceIcon)
                                .font(.system(size: 30))
                                .foregroundColor(deviceColor)
                        )

                    VStack(alignment: .leading, spacing: 4) {
                        Text(device.friendlyName)
                            .font(.title2)
                            .fontWeight(.bold)

                        Text(device.type)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    if device.capabilities.canPower {
                        Button(action: {
                            togglePower()
                        }) {
                            Image(systemName: device.status.lowercased() == "on" ? "power.circle.fill" : "power.circle")
                                .font(.system(size: 30))
                                .foregroundColor(device.status.lowercased() == "on" ? .green : .secondary)
                        }
                    }
                }
                .padding()
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)

                // Live Activity Toggle
                /*if ActivityAuthorizationInfo().areActivitiesEnabled {
                    Toggle(isOn: $hasLiveActivity) {
                        Label("Live Activity", systemImage: "sparkles")
                    }
                    .onChange(of: hasLiveActivity) { _, newValue in
                        if newValue {
                            LiveActivityManager.shared.startDeviceActivity(for: device)
                        } else {
                            LiveActivityManager.shared.stopDeviceActivity(deviceId: device.id)
                        }
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(16)
                }*/

                // Charts Section
                if device.capabilities.canEnergyMonitoring ||
                   device.capabilities.canTemperature ||
                   device.capabilities.canHumidity {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Analytics")
                            .font(.title2)
                            .fontWeight(.bold)

                        if device.capabilities.canEnergyMonitoring {
                            EnergyUsageChart(
                                data: energyData,
                                title: "Energy Consumption",
                                subtitle: "Daily power usage",
                                trendPercentage: -8.5
                            )
                        }

                        if device.capabilities.canTemperature {
                            TemperatureChart(
                                data: temperatureData,
                                title: "Temperature",
                                subtitle: "Last 24 hours",
                                trendPercentage: 1.5
                            )
                        }

                        if device.capabilities.canHumidity {
                            HumidityChart(
                                data: humidityData,
                                title: "Humidity",
                                subtitle: "Last 24 hours",
                                trendPercentage: -2.5
                            )
                        }
                    }
                }

                // Device Controls
                VStack(alignment: .leading, spacing: 16) {
                    Text("Controls")
                        .font(.title2)
                        .fontWeight(.bold)

                    if device.capabilities.canDim {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Brightness")
                                .font(.headline)

                            HStack {
                                Image(systemName: "sun.min")
                                Slider(value: $sliderValue)
                                Image(systemName: "sun.max")
                            }
                        }
                        .padding()
                        .background(Color(uiColor: .secondarySystemBackground))
                        .cornerRadius(12)
                    }
                }

                // Device Info
                VStack(alignment: .leading, spacing: 16) {
                    Text("Information")
                        .font(.title2)
                        .fontWeight(.bold)

                    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                        GridRow {
                            Text("Status")
                                .foregroundColor(.secondary)
                            Text(device.status)
                        }

                        GridRow {
                            Text("Protocol")
                                .foregroundColor(.secondary)
                            Text(device.protocolName)
                        }

                        if let room = device.location.room {
                            GridRow {
                                Text("Room")
                                    .foregroundColor(.secondary)
                                Text(room)
                            }
                        }

                        if let manufacturer = device.metadata.manufacturer {
                            GridRow {
                                Text("Manufacturer")
                                    .foregroundColor(.secondary)
                                Text(manufacturer)
                            }
                        }

                        if let model = device.metadata.model {
                            GridRow {
                                Text("Model")
                                    .foregroundColor(.secondary)
                                Text(model)
                            }
                        }
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(12)
                }

                // Test Notifications (Debug only)
                #if DEBUG
                VStack(alignment: .leading, spacing: 16) {
                    Text("Test Notifications")
                        .font(.title2)
                        .fontWeight(.bold)

                    VStack(spacing: 12) {
                        Button(action: {
                            NotificationService.shared.scheduleDeviceStatusChangeNotification(
                                for: device,
                                newStatus: device.status.lowercased() == "on" ? "Off" : "On"
                            )
                        }) {
                            HStack {
                                Image(systemName: "bell.badge")
                                Text("Test Status Change")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }

                        Button(action: {
                            NotificationService.shared.scheduleDeviceOfflineNotification(for: device)
                        }) {
                            HStack {
                                Image(systemName: "bell.slash")
                                Text("Test Offline")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }

                        if device.capabilities.canMotion {
                            Button(action: {
                                NotificationService.shared.scheduleMotionDetectedNotification(for: device)
                            }) {
                                HStack {
                                    Image(systemName: "bell.motion")
                                    Text("Test Motion")
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.orange)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                        }
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(12)
                }
                #endif
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(uiColor: .systemBackground))
        .onDisappear {
            /*if hasLiveActivity {
                LiveActivityManager.shared.stopDeviceActivity(deviceId: device.id)
                hasLiveActivity = false
            }*/
        }
    }

    private func togglePower() {
        Task {
            do {
                let newStatus = device.status.lowercased() == "on" ? "off" : "on"
                try await APIService.shared.updateDeviceStatus(deviceId: device.id, status: newStatus)

                // Update Live Activity if active
                /*if hasLiveActivity {
                    let state = DeviceActivityAttributes.ContentState(
                        status: newStatus,
                        lastUpdated: Date(),
                        powerUsage: nil,
                        temperature: nil,
                        humidity: nil,
                        motionDetected: nil
                    )
                    LiveActivityManager.shared.updateDeviceActivity(deviceId: device.id, with: state)
                }*/
            } catch {
                print("Failed to toggle device power: \(error.localizedDescription)")
            }
        }
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
}

struct ContentView: View {
    @State private var devices: [Device] = []
    @State private var isLoading = false
    @State private var error: Error?
    @State private var scrollOffset: CGFloat = 0
    @State private var viewID = UUID()
    @State private var currentTask: Task<Void, Never>?
    @State private var searchText = ""
    @State private var isOffline = false
    @Namespace private var animation

    let columns = [
        GridItem(.adaptive(minimum: 300), spacing: 16)
    ]

    var filteredDevices: [Device] {
        if searchText.isEmpty {
            return devices
        }

        let searchTerms = searchText.lowercased().split(separator: " ")
        return devices.filter { device in
            let searchableText = [
                device.friendlyName,
                device.type,
                device.location.room,
                device.status,
                device.protocolName
            ]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")

            return searchTerms.allSatisfy { term in
                searchableText.contains(term)
            }
        }
    }

    var body: some View {
        NavigationView {
            Group {
                if isLoading && devices.isEmpty {
                    ProgressView("Loading devices...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .transition(.opacity.combined(with: .scale))
                } else if let error = error {
                    ErrorView(error: error) {
                        Task {
                            await loadDevices()
                        }
                    }
                    .transition(.opacity.combined(with: .slide))
                } else {
                    ScrollView {
                        if devices.isEmpty {
                            VStack(spacing: 16) {
                                Image(systemName: "rectangle.grid.1x2")
                                    .font(.system(size: 48))
                                    .foregroundColor(.secondary)
                                    .matchedGeometryEffect(id: "emptyIcon", in: animation)
                                Text("No devices found")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .transition(.opacity.combined(with: .scale))
                        } else if filteredDevices.isEmpty {
                            VStack(spacing: 16) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 48))
                                    .foregroundColor(.secondary)
                                    .matchedGeometryEffect(id: "searchIcon", in: animation)
                                Text("No matching devices")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                Text("Try adjusting your search")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding(.top, 100)
                            .transition(.opacity.combined(with: .scale))
                        } else {
                            LazyVGrid(columns: columns, spacing: 16) {
                                ForEach(filteredDevices) { device in
                                    NavigationLink(destination: DeviceDetailView(device: device)) {
                                        SwipeableDeviceCard(
                                            device: device,
                                            onPowerToggle: {
                                                toggleDevicePower(device)
                                            },
                                            onSettings: {
                                                // TODO: Implement settings
                                                print("Open settings for device: \(device.id)")
                                            }
                                        )
                                        .matchedGeometryEffect(id: device.id, in: animation)
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                    .transition(.asymmetric(
                                        insertion: .scale.combined(with: .opacity),
                                        removal: .opacity
                                    ))
                                }
                            }
                            .padding()
                            .id(viewID)
                            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: filteredDevices)
                        }
                    }
                    .overlay(
                        Group {
                            if isLoading {
                                ProgressView()
                                    .padding()
                                    .background(Color(uiColor: .systemBackground))
                                    .cornerRadius(8)
                                    .shadow(radius: 4)
                                    .transition(.scale.combined(with: .opacity))
                            }
                        }
                    )
                }
            }
            .navigationTitle("Devices")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isOffline {
                        Label("Offline Mode", systemImage: "wifi.slash")
                            .foregroundColor(.orange)
                    }
                }
            }
            .searchable(
                text: $searchText,
                placement: .navigationBarDrawer,
                prompt: "Search by name, type, room..."
            )
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isLoading)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: error != nil)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: searchText)
            .task {
                // Cancel any existing task before starting a new one
                currentTask?.cancel()
                if devices.isEmpty {
                    currentTask = Task {
                        await loadDevices()
                    }
                }
            }
            .refreshable {
                // Cancel any existing task before starting a new one
                currentTask?.cancel()
                currentTask = Task {
                    await refreshDevices()
                }
                await currentTask?.value
            }
            .onDisappear {
                // Cancel any ongoing task when the view disappears
                currentTask?.cancel()
            }
        }
    }

    private func refreshDevices() async {
        guard !Task.isCancelled else { return }
        isLoading = true

        do {
            var fetchedDevices: [Device]

            // Try online fetch first
            if let onlineDevices = try? await APIService.shared.fetchDevices() {
                fetchedDevices = onlineDevices
                isOffline = false
                // Sync fetched devices to local storage
                try await DataManager.shared.syncDevices(fetchedDevices)
            } else {
                // Fallback to offline storage
                fetchedDevices = try DataManager.shared.getOfflineDevices()
                isOffline = true
            }

            // Check for cancellation before updating UI
            guard !Task.isCancelled else { return }

            // Check for status changes and trigger notifications
            for device in fetchedDevices {
                if let existingDevice = devices.first(where: { $0.id == device.id }) {
                    // Check for status changes
                    if existingDevice.status != device.status {
                        NotificationService.shared.scheduleDeviceStatusChangeNotification(for: device, newStatus: device.status)
                    }

                    // Check for device going offline
                    if existingDevice.lastOnline != device.lastOnline && device.status.lowercased() == "offline" {
                        NotificationService.shared.scheduleDeviceOfflineNotification(for: device)
                    }

                    // Check for motion events if device supports motion
                    if device.capabilities.canMotion && existingDevice.lastOnline != device.lastOnline {
                        NotificationService.shared.scheduleMotionDetectedNotification(for: device)
                    }
                }
            }

            // Only update if the devices have actually changed
            if fetchedDevices != devices {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    devices = fetchedDevices
                    viewID = UUID() // Reset scroll position if data changed
                }
            }
        } catch {
            // Check for cancellation before updating UI
            guard !Task.isCancelled else { return }
            self.error = error
        }

        // Final cancellation check before updating loading state
        guard !Task.isCancelled else { return }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isLoading = false
        }
    }

    private func loadDevices() async {
        guard !Task.isCancelled else { return }
        isLoading = true
        error = nil

        do {
            var fetchedDevices: [Device]

            // Try online fetch first
            if let onlineDevices = try? await APIService.shared.fetchDevices() {
                fetchedDevices = onlineDevices
                isOffline = false
                // Sync fetched devices to local storage
                try await DataManager.shared.syncDevices(fetchedDevices)
            } else {
                // Fallback to offline storage
                fetchedDevices = try DataManager.shared.getOfflineDevices()
                isOffline = true
            }

            // Check for cancellation before updating UI
            guard !Task.isCancelled else { return }

            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                devices = fetchedDevices
            }
        } catch {
            // Check for cancellation before updating UI
            guard !Task.isCancelled else { return }
            self.error = error
        }

        // Final cancellation check before updating loading state
        guard !Task.isCancelled else { return }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isLoading = false
        }
    }

    private func toggleDevicePower(_ device: Device) {
        Task {
            do {
                let newStatus = device.status.lowercased() == "on" ? "off" : "on"
                try await APIService.shared.updateDeviceStatus(deviceId: device.id, status: newStatus)
                await refreshDevices()
            } catch {
                // Handle offline toggle
                if let index = devices.firstIndex(where: { $0.id == device.id }) {
                    let newStatus = device.status.lowercased() == "on" ? "off" : "on"
                    let updatedDevice = Device(
                        id: device.id,
                        friendlyName: device.friendlyName,
                        status: newStatus,
                        protocolName: device.protocolName,
                        type: device.type,
                        description: device.description,
                        categories: device.categories,
                        location: device.location,
                        lastOnline: device.lastOnline,
                        metadata: device.metadata,
                        capabilities: device.capabilities,
                        networkInfo: device.networkInfo,
                        created: device.created,
                        updated: ISO8601DateFormatter().string(from: Date())
                    )
                    devices[index] = updatedDevice

                    // Update offline storage
                    try? await DataManager.shared.syncDevices(devices)
                }
            }
        }
    }
}

#Preview {
    ContentView()
}

struct ErrorView: View {
    let error: Error
    let retryAction: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.red)
            Text("Error loading devices")
                .font(.headline)
            Text(error.localizedDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Retry") {
                retryAction()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Equatable conformance for Device
extension Device: Equatable {
    public static func == (lhs: Device, rhs: Device) -> Bool {
        lhs.id == rhs.id &&
        lhs.friendlyName == rhs.friendlyName &&
        lhs.status == rhs.status &&
        lhs.protocolName == rhs.protocolName &&
        lhs.lastOnline == rhs.lastOnline
    }
}