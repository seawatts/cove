import SwiftUI
import HomeKit

struct AddDeviceView: View {
    @StateObject private var viewModel = AddDeviceViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                if viewModel.isSearching {
                    ProgressView("Searching for accessories...")
                        .progressViewStyle(.circular)
                } else if !viewModel.discoveredDevices.isEmpty {
                    discoveredDevicesView
                } else {
                    addDeviceView
                }
            }
            .padding()
            .navigationTitle("Add Device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }

    private var addDeviceView: some View {
        VStack(spacing: 24) {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.accentColor)

            Text("Add HomeKit Device")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Make sure your device is nearby and ready to pair.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: viewModel.startAccessorySetup) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Add Accessory")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.accentColor)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
        .padding()
    }

    private var discoveredDevicesView: some View {
        List {
            ForEach(viewModel.discoveredDevices) { device in
                DeviceRow(device: device)
            }
        }
    }
}

struct DeviceRow: View {
    let device: DeviceModel

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: device.category.icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(device.name)
                    .font(.headline)

                Text("\(device.manufacturer) \(device.model)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                if let version = device.firmwareVersion {
                    Text("Firmware: \(version)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
    }
}