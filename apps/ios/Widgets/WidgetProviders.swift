import WidgetKit
import SwiftUI
import Models

// MARK: - Sample Data
extension Device {
    static let samples = [
        Device(
            id: "light1",
            friendlyName: "Living Room Light",
            status: "on",
            protocolName: "zigbee",
            type: "light",
            description: "Main light",
            categories: ["light"],
            location: Location(room: "Living Room", floor: "1st Floor", zone: "Main"),
            lastOnline: "2024-03-19T12:00:00Z",
            metadata: Metadata(iconUrl: nil, manufacturer: "Philips", model: "Hue", firmwareVersion: "1.0", hardwareVersion: "1.0"),
            capabilities: Capabilities(
                canBattery: false,
                canColor: true,
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
            created: "2024-01-01T00:00:00Z",
            updated: "2024-03-19T12:00:00Z"
        ),
        Device(
            id: "thermostat1",
            friendlyName: "Living Room Thermostat",
            status: "on",
            protocolName: "zigbee",
            type: "thermostat",
            description: "Smart thermostat",
            categories: ["climate"],
            location: Location(room: "Living Room", floor: "1st Floor", zone: "Main"),
            lastOnline: "2024-03-19T12:00:00Z",
            metadata: Metadata(iconUrl: nil, manufacturer: "Nest", model: "Learning Thermostat", firmwareVersion: "1.0", hardwareVersion: "1.0"),
            capabilities: Capabilities(
                canBattery: false,
                canColor: false,
                canDim: false,
                canHumidity: true,
                canMotion: false,
                canOccupancy: true,
                canPlay: false,
                canPower: true,
                canTemperature: true,
                canToggle: true,
                canVolume: false,
                canEnergyMonitoring: true
            ),
            networkInfo: nil,
            created: "2024-01-01T00:00:00Z",
            updated: "2024-03-19T12:00:00Z"
        )
    ]
}

// MARK: - Device Status Provider
struct DeviceStatusEntry: TimelineEntry {
    let date: Date
    let devices: [Device]
}

struct DeviceStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> DeviceStatusEntry {
        DeviceStatusEntry(date: Date(), devices: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (DeviceStatusEntry) -> Void) {
        let entry = DeviceStatusEntry(date: Date(), devices: Device.samples)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DeviceStatusEntry>) -> Void) {
        let currentDate = Date()
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let entry = DeviceStatusEntry(date: currentDate, devices: Device.samples)
        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }
}

// MARK: - Room Overview Provider
struct RoomOverviewEntry: TimelineEntry {
    let date: Date
    let temperature: Double
    let humidity: Double
    let energyUsage: Double
    let roomName: String
}

struct RoomOverviewProvider: TimelineProvider {
    func placeholder(in context: Context) -> RoomOverviewEntry {
        RoomOverviewEntry(date: Date(), temperature: 21.0, humidity: 45.0, energyUsage: 0.0, roomName: "Living Room")
    }

    func getSnapshot(in context: Context, completion: @escaping (RoomOverviewEntry) -> Void) {
        let entry = RoomOverviewEntry(
            date: Date(),
            temperature: 22.5,
            humidity: 45.0,
            energyUsage: 1.2,
            roomName: "Living Room"
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RoomOverviewEntry>) -> Void) {
        let currentDate = Date()
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 5, to: currentDate)!
        let entry = RoomOverviewEntry(
            date: currentDate,
            temperature: 22.5,
            humidity: 45.0,
            energyUsage: 1.2,
            roomName: "Living Room"
        )
        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }
}

// MARK: - Quick Controls Provider
struct QuickControlsEntry: TimelineEntry {
    let date: Date
    let favoriteDevices: [Device]
}

struct QuickControlsProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickControlsEntry {
        QuickControlsEntry(date: Date(), favoriteDevices: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickControlsEntry) -> Void) {
        let entry = QuickControlsEntry(date: Date(), favoriteDevices: Device.samples)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickControlsEntry>) -> Void) {
        let currentDate = Date()
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 30, to: currentDate)!
        let entry = QuickControlsEntry(date: currentDate, favoriteDevices: Device.samples)
        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }
}
