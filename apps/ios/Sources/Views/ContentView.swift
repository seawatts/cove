import SwiftUI
import Components
import Models

struct ContentView: View {
    @State private var devices: [Device] = []
    @State private var isLoading = false
    @State private var error: Error?
    @State private var scrollOffset: CGFloat = 0
    @State private var viewID = UUID() // Used to maintain scroll position
    @State private var currentTask: Task<Void, Never>?
    @State private var searchText = ""
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
                                    NavigationLink(destination: Text("Device Details")) {
                                        SwipeableDeviceCard(
                                            device: device,
                                            onPowerToggle: {
                                                // TODO: Implement power toggle
                                                print("Toggle power for device: \(device.id)")
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
                            .id(viewID) // Preserve scroll position
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
            let fetchedDevices = try await APIService.shared.fetchDevices()
            // Check for cancellation before updating UI
            guard !Task.isCancelled else { return }

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
            let fetchedDevices = try await APIService.shared.fetchDevices()
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