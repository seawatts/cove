import Foundation
import HomeKit

@MainActor
class AddDeviceViewModel: ObservableObject {
    private let homeManager = HMHomeManager()
    private var home: HMHome?

    @Published var isSearching = false
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var discoveredDevices: [DeviceModel] = []

    init() {
        setupHomeKit()
    }

    private func setupHomeKit() {
        // Get the primary home or create one if it doesn't exist
        if let primaryHome = homeManager.primaryHome {
            self.home = primaryHome
        } else {
            homeManager.addHome(withName: "My Home") { [weak self] home, error in
                if let error = error {
                    self?.showError(message: "Failed to create home: \(error.localizedDescription)")
                    return
                }
                self?.home = home
            }
        }
    }

    func startAccessorySetup() {
        guard let home = home else {
            showError(message: "No HomeKit home available")
            return
        }

        isSearching = true

        // Start the native HomeKit accessory setup
        home.addAndSetupAccessories { [weak self] error in
            DispatchQueue.main.async {
                self?.isSearching = false

                if let error = error {
                    self?.showError(message: "Failed to add accessory: \(error.localizedDescription)")
                    return
                }

                // Process newly added accessories
                self?.processNewAccessories(in: home)
            }
        }
    }

    private func processNewAccessories(in home: HMHome) {
        // Get all accessories that were just added
        let newAccessories = home.accessories.filter { accessory in
            !discoveredDevices.contains(where: { $0.name == accessory.name })
        }

        for accessory in newAccessories {
            let device = DeviceModel.from(accessory: accessory)
            discoveredDevices.append(device)

            // Configure the device based on its category
            configureDevice(accessory, category: device.category)
        }
    }

    private func configureLock(_ lock: HMAccessory) {
        // Here you can configure additional settings for the lock
        // For example, setting up notifications, auto-lock timing, etc.

        // Example: Set up notifications for lock state changes
        guard let lockService = lock.services.first(where: { $0.serviceType == HMServiceTypeLockMechanism }),
              let lockStateCharacteristic = lockService.characteristics.first(where: { $0.characteristicType == HMCharacteristicTypeLockCurrentState })
        else {
            return
        }

        lockStateCharacteristic.enableNotification(true) { [weak self] error in
            if let error = error {
                self?.showError(message: "Failed to enable notifications: \(error.localizedDescription)")
            }
        }
    }

    private func showError(message: String) {
        errorMessage = message
        showError = true
    }
}