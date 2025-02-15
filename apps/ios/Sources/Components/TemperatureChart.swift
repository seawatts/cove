import SwiftUI
import Models

public struct TemperatureChart: View {
    let data: [TimeSeriesData]
    let title: String
    let subtitle: String
    let trendPercentage: Double

    public init(
        data: [TimeSeriesData],
        title: String = "Temperature",
        subtitle: String = "Temperature over time",
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
                Color(red: 0.8, green: 0.3, blue: 0.3), // Warm red color
                Color(red: 0.4, green: 0.1, blue: 0.1)
            ]
        ) { value in
            String(format: "%.1f°C", value)
        }
    }
}

#Preview {
    let calendar = Calendar.current
    let today = Date()
    let mockData: [TimeSeriesData] = (0..<24).map { hoursAgo in
        let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
        let baseTemp = 22.0
        let variation = Double.random(in: -2...2)
        return TimeSeriesData(date: date, value: baseTemp + variation)
    }.reversed()

    return VStack {
        TemperatureChart(
            data: mockData,
            title: "Room Temperature",
            subtitle: "Last 24 hours",
            trendPercentage: 1.5
        )
    }
    .padding()
    .background(Color(uiColor: .systemBackground))
}