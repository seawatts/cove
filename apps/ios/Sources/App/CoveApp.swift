import SwiftUI
import UserNotifications
import Services

@main
struct CoveApp: App {
    @State private var hasRequestedNotifications = false

    var body: some Scene {
        WindowGroup {
            SplashScreen()
                .task {
                    if !hasRequestedNotifications {
                        do {
                            let granted = try await NotificationService.shared.requestAuthorization()
                            hasRequestedNotifications = true
                            print("Notification authorization \(granted ? "granted" : "denied")")
                        } catch {
                            print("Failed to request notification authorization: \(error.localizedDescription)")
                        }
                    }
                }
        }
    }
}
