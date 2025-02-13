import SwiftUI
import Charts
import Models

public struct GradientAreaChart: View {
    let data: [TimeSeriesData]
    let title: String
    let subtitle: String
    let trendPercentage: Double
    let gradientColors: [Color]
    let valueFormatter: (Double) -> String

    public init(
        data: [TimeSeriesData],
        title: String,
        subtitle: String,
        trendPercentage: Double,
        gradientColors: [Color] = [
            Color(red: 0.2, green: 0.4, blue: 0.8),
            Color(red: 0.1, green: 0.2, blue: 0.4)
        ],
        valueFormatter: @escaping (Double) -> String = { "\($0)" }
    ) {
        self.data = data
        self.title = title
        self.subtitle = subtitle
        self.trendPercentage = trendPercentage
        self.gradientColors = gradientColors
        self.valueFormatter = valueFormatter
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title and Subtitle
            Text(title)
                .font(.title2)
                .fontWeight(.bold)

            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Chart
            Chart {
                ForEach(data) { item in
                    AreaMark(
                        x: .value("Date", item.date),
                        y: .value("Value", item.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    LineMark(
                        x: .value("Date", item.date),
                        y: .value("Value", item.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(gradientColors[0])
                }
            }
            .frame(height: 200)
            .chartXAxis {
                AxisMarks(position: .bottom) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisTick(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisValueLabel()
                        .foregroundStyle(Color.secondary)
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisTick(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.gray.opacity(0.3))
                    AxisValueLabel()
                        .foregroundStyle(Color.secondary)
                }
            }

            // Trend
            HStack(spacing: 4) {
                Text("Trending \(trendPercentage >= 0 ? "up" : "down") by \(String(format: "%.1f", abs(trendPercentage)))% this month")
                    .font(.headline)

                Image(systemName: trendPercentage >= 0 ? "arrow.up.right" : "arrow.down.right")
                    .font(.headline)
            }
            .foregroundColor(trendPercentage >= 0 ? .green : .red)

            Text("January - June 2024")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(uiColor: .systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }
}

#Preview {
    let calendar = Calendar.current
    let today = Date()
    let mockData: [TimeSeriesData] = (0..<6).map { monthsAgo in
        let date = calendar.date(byAdding: .month, value: -monthsAgo, to: today)!
        let value = Double.random(in: 18...26)
        return TimeSeriesData(date: date, value: value)
    }.reversed()

    return VStack {
        GradientAreaChart(
            data: mockData,
            title: "Temperature",
            subtitle: "Living Room temperature over time",
            trendPercentage: 5.2,
            gradientColors: [
                Color(red: 0.2, green: 0.4, blue: 0.8),
                Color(red: 0.1, green: 0.2, blue: 0.4)
            ]
        ) { value in
            String(format: "%.1f°C", value)
        }

        GradientAreaChart(
            data: mockData,
            title: "Humidity",
            subtitle: "Living Room humidity over time",
            trendPercentage: -2.1,
            gradientColors: [
                Color(red: 0.2, green: 0.6, blue: 0.4),
                Color(red: 0.1, green: 0.3, blue: 0.2)
            ]
        ) { value in
            String(format: "%.0f%%", value)
        }
    }
    .padding()
    .background(Color(uiColor: .systemBackground))
}