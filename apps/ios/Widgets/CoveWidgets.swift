import WidgetKit
import SwiftUI

@main
struct CoveWidgets: WidgetBundle {
    var body: some Widget {
        DeviceStatusWidget()
        RoomOverviewWidget()
        QuickControlsWidget()
    }
}

// MARK: - Device Status Widget
struct DeviceStatusWidget: Widget {
    let kind: String = "DeviceStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DeviceStatusProvider()) { entry in
            DeviceStatusView(entry: entry)
        }
        .configurationDisplayName("Device Status")
        .description("Shows the status of your devices")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Room Overview Widget
struct RoomOverviewWidget: Widget {
    let kind: String = "RoomOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RoomOverviewProvider()) { entry in
            RoomOverviewView(entry: entry)
        }
        .configurationDisplayName("Room Overview")
        .description("Shows room temperature, humidity, and energy usage")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Quick Controls Widget
struct QuickControlsWidget: Widget {
    let kind: String = "QuickControlsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickControlsProvider()) { entry in
            QuickControlsView(entry: entry)
        }
        .configurationDisplayName("Quick Controls")
        .description("Control your favorite devices")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}