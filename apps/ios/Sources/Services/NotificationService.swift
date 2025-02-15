import Foundation
import UserNotifications
import os.log
import Models

public class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    public static let shared = NotificationService()
    private let logger = Logger(subsystem: "com.cove.ios", category: "Notifications")
    private let notificationCenter = UNUserNotificationCenter.current()

    private override init() {
        super.init()
        notificationCenter.delegate = self
    }

    public func requestAuthorization() async throws -> Bool {
        do {
            let options: UNAuthorizationOptions = [.alert, .sound, .badge]
            return try await notificationCenter.requestAuthorization(options: options)
        } catch {
            logger.error("Failed to request notification authorization: \(error.localizedDescription)")
            throw error
        }
    }

    // Delegate method to handle foreground notifications
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show the notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }

    public func scheduleNotification(content: UNMutableNotificationContent, identifier: String) {
        // Add a 1 second delay trigger so we can see the notification
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        notificationCenter.add(request) { error in
            if let error = error {
                self.logger.error("Failed to schedule notification: \(error.localizedDescription)")
            }
        }
    }

    public func scheduleDeviceOfflineNotification(for device: Device) {
        let content = UNMutableNotificationContent()
        content.title = "Device Offline"
        content.body = "\(device.friendlyName) is offline"
        content.sound = .default
        content.categoryIdentifier = "DEVICE_OFFLINE"

        scheduleNotification(
            content: content,
            identifier: "device-offline-\(device.id)"
        )
    }

    public func scheduleMotionDetectedNotification(for device: Device) {
        let content = UNMutableNotificationContent()
        content.title = "Motion Detected"
        content.body = "Motion detected by \(device.friendlyName)"
        content.sound = .default
        content.categoryIdentifier = "MOTION_DETECTED"

        scheduleNotification(
            content: content,
            identifier: "motion-detected-\(device.id)"
        )
    }

    public func scheduleDeviceStatusChangeNotification(for device: Device, newStatus: String) {
        let content = UNMutableNotificationContent()
        content.title = "Device Status Changed"
        content.body = "\(device.friendlyName) is now \(newStatus)"
        content.sound = .default
        content.categoryIdentifier = "STATUS_CHANGE"

        scheduleNotification(
            content: content,
            identifier: "status-change-\(device.id)"
        )
    }

    public func cancelNotifications(for deviceId: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [
            "device-offline-\(deviceId)",
            "motion-detected-\(deviceId)",
            "status-change-\(deviceId)"
        ])
    }

    public func cancelAllNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
    }
}
