/*
import Foundation
import OSLog
import ActivityKit
import Models
import LiveActivity

final class LiveActivityManager {
    static let shared = LiveActivityManager()
    private let logger = Logger(subsystem: "com.cove.app", category: "LiveActivityManager")

    private init() {}

    func startDeviceActivity(for device: Device) {
        let attributes = DeviceActivityAttributes(
            deviceId: device.id,
            deviceName: device.friendlyName,
            deviceType: device.type,
            deviceIcon: getDeviceIcon(for: device)
        )

        let initialState = DeviceActivityAttributes.ContentState(
            status: device.status,
            lastUpdated: Date(),
            powerUsage: nil,
            temperature: nil,
            humidity: nil,
            motionDetected: nil
        )

        do {
            let activity = try Activity.request(
                attributes: attributes,
                contentState: initialState,
                pushType: nil
            )
            logger.info("Started Live Activity for device \(device.id): \(String(describing: activity.id))")
        } catch {
            logger.error("Failed to start Live Activity for device \(device.id): \(error.localizedDescription)")
        }
    }

    func stopDeviceActivity(deviceId: String) {
        Task {
            for activity in Activity<DeviceActivityAttributes>.activities {
                if activity.attributes.deviceId == deviceId {
                    await activity.end(dismissalPolicy: .immediate)
                    logger.info("Stopped Live Activity for device \(deviceId)")
                }
            }
        }
    }

    func updateDeviceActivity(deviceId: String, with state: DeviceActivityAttributes.ContentState) {
        Task {
            for activity in Activity<DeviceActivityAttributes>.activities {
                if activity.attributes.deviceId == deviceId {
                    await activity.update(using: state)
                    logger.info("Updated Live Activity for device \(deviceId)")
                }
            }
        }
    }

    private func getDeviceIcon(for device: Device) -> String {
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
}
*/
