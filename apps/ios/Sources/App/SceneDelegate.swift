import UIKit
import SwiftUI

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        let contentView = TabView {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            ContentView()
                .tabItem {
                    Label("Devices", systemImage: "rectangle.grid.2x2.fill")
                }
        }

        if let windowScene = scene as? UIWindowScene {
            let window = UIWindow(windowScene: windowScene)
            window.rootViewController = UIHostingController(rootView: contentView)
            self.window = window
            window.makeKeyAndVisible()
        }
    }
}