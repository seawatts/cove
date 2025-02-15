import AppIntents
import WidgetKit
import Models
import Services

struct ToggleDeviceIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Device"

    @Parameter(title: "Device ID")
    var deviceId: String

    @Parameter(title: "Current Status")
    var currentStatus: String

    init() {
        self.deviceId = ""
        self.currentStatus = ""
    }

    init(deviceId: String, currentStatus: String) {
        self.deviceId = deviceId
        self.currentStatus = currentStatus
    }

    func perform() async throws -> some IntentResult {
        let newStatus = currentStatus.lowercased() == "on" ? "off" : "on"
        try await APIService.shared.updateDeviceStatus(deviceId: deviceId, status: newStatus)
        return .result()
    }
}

// MARK: - Widget Support
extension ToggleDeviceIntent {
    static var widgetDescription: LocalizedStringResource {
        "Toggle device power state"
    }

    static var widgetTitle: LocalizedStringResource {
        "Toggle Power"
    }

    static var parameterSummary: some ParameterSummary {
        Summary("Toggle \(\.$deviceId) power state")
    }
}

struct DeviceControlAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ToggleDeviceIntent(),
            phrases: ["Toggle \(.applicationName) device"],
            shortTitle: "Toggle Device",
            systemImageName: "power.circle"
        )
    }
}
