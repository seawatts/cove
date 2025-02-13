import SwiftUI

struct SplashScreen: View {
    @State private var isActive = false
    @State private var size = 0.8
    @State private var opacity = 0.5

    var body: some View {
        if isActive {
            TabView {
                HomeView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }

                ContentView()
                    .tabItem {
                        Label("Devices", systemImage: "rectangle.grid.2x2.fill")
                    }
            }
        } else {
            VStack {
                VStack {
                    Image(systemName: "house.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    Text("Cove")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                }
                .scaleEffect(size)
                .opacity(opacity)
                .onAppear {
                    withAnimation(.easeIn(duration: 1.2)) {
                        self.size = 0.9
                        self.opacity = 1.0
                    }
                }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    withAnimation {
                        self.isActive = true
                    }
                }
            }
        }
    }
}

#Preview {
    SplashScreen()
}