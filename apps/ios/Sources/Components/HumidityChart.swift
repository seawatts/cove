import SwiftUI
import Models

public struct HumidityChart: View {
    let data: [TimeSeriesData]
    let title: String
    let subtitle: String
    let trendPercentage: Double

    public init(
        data: [TimeSeriesData],
        title: String = "Humidity",
        subtitle: String = "Humidity over time",
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
                Color(red: 0.2, green: 0.4, blue: 0.8), // Cool blue color
                Color(red: 0.1, green: 0.2, blue: 0.4)
            ]
        ) { value in
            String(format: "%.0f%%", value)
        }
    }
}

#Preview {
    let calendar = Calendar.current
    let today = Date()
    let mockData: [TimeSeriesData] = (0..<24).map { hoursAgo in
        let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
        let baseHumidity = 45.0
        let variation = Double.random(in: -5...5)
        return TimeSeriesData(date: date, value: baseHumidity + variation)
    }.reversed()

    return VStack {
        HumidityChart(
            data: mockData,
            title: "Room Humidity",
            subtitle: "Last 24 hours",
            trendPercentage: -2.5
        )
    }
    .padding()
    .background(Color(uiColor: .systemBackground))
}