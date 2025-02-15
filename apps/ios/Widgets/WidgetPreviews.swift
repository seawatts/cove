import SwiftUI
import WidgetKit
import Models

struct DeviceStatusWidget_Previews: PreviewProvider {
    static var previews: some View {
        DeviceStatusView(entry: DeviceStatusEntry(
            date: Date(),
            devices: Device.samples
        ))
        .previewContext(WidgetPreviewContext(family: .systemSmall))

        DeviceStatusView(entry: DeviceStatusEntry(
            date: Date(),
            devices: Device.samples
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}

struct RoomOverviewWidget_Previews: PreviewProvider {
    static var previews: some View {
        RoomOverviewView(entry: RoomOverviewEntry(
            date: Date(),
            temperature: 22.5,
            humidity: 45.0,
            energyUsage: 1.2,
            roomName: "Living Room"
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))

        RoomOverviewView(entry: RoomOverviewEntry(
            date: Date(),
            temperature: 22.5,
            humidity: 45.0,
            energyUsage: 1.2,
            roomName: "Living Room"
        ))
        .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}

struct QuickControlsWidget_Previews: PreviewProvider {
    static var previews: some View {
        QuickControlsView(entry: QuickControlsEntry(
            date: Date(),
            favoriteDevices: Device.samples
        ))
        .previewContext(WidgetPreviewContext(family: .accessoryCircular))

        QuickControlsView(entry: QuickControlsEntry(
            date: Date(),
            favoriteDevices: Device.samples
        ))
        .previewContext(WidgetPreviewContext(family: .accessoryRectangular))
    }
}
