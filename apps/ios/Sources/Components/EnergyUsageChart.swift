import SwiftUI
import Models

public struct EnergyUsageChart: View {
    let data: [TimeSeriesData]
    let title: String
    let subtitle: String
    let trendPercentage: Double

    public init(
        data: [TimeSeriesData],
        title: String = "Energy Usage",
        subtitle: String = "Power consumption over time",
        trendPercentage: Double
    ) {
        self.data = data
        self.title = title
        self.subtitle = subtitle
        self.trendPercentage = trendPercentage
    }

    public var body: some View {
        GradientAreaChart(
            data: data,
            title: title,
            subtitle: subtitle,
            trendPercentage: trendPercentage,
            gradientColors: [
                Color(red: 0.2, green: 0.8, blue: 0.4), // Green energy color
                Color(red: 0.1, green: 0.4, blue: 0.2)
            ]
        ) { value in
            // Format as kWh with 2 decimal places
            String(format: "%.2f kWh", value)
        }
    }
}

#Preview {
    let calendar = Calendar.current
    let today = Date()
    let mockData: [TimeSeriesData] = (0..<6).map { monthsAgo in
        let date = calendar.date(byAdding: .month, value: -monthsAgo, to: today)!
        let value = Double.random(in: 0.5...2.5) // Random kWh values
        return TimeSeriesData(date: date, value: value)
    }.reversed()

    return VStack {
        EnergyUsageChart(
            data: mockData,
            title: "Daily Energy Usage",
            subtitle: "Kitchen appliances power consumption",
            trendPercentage: -12.5
        )
    }
    .padding()
    .background(Color(uiColor: .systemBackground))
}