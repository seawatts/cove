import SwiftUI
import Models
import Charts

public struct BatteryLevelChart: View {
    let data: [TimeSeriesData]
    let title: String
    let subtitle: String
    let trendPercentage: Double
    @State private var selectedPoint: TimeSeriesData?

    public init(
        data: [TimeSeriesData],
        title: String = "Battery Level",
        subtitle: String = "Battery level over time",
        trendPercentage: Double
    ) {
        self.data = data
        self.title = title
        self.subtitle = subtitle
        self.trendPercentage = trendPercentage
    }

    private func batteryColor(for level: Double) -> Color {
        switch level {
        case 0..<20:
            return .red
        case 20..<40:
            return .orange
        default:
            return .green
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)

            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(.secondary)

            Chart {
                // Warning threshold areas
                RectangleMark(
                    xStart: .value("Start", data.first?.date ?? Date()),
                    xEnd: .value("End", data.last?.date ?? Date()),
                    yStart: .value("Low", 0),
                    yEnd: .value("Critical", 20)
                )
                .foregroundStyle(.red.opacity(0.1))

                RectangleMark(
                    xStart: .value("Start", data.first?.date ?? Date()),
                    xEnd: .value("End", data.last?.date ?? Date()),
                    yStart: .value("Low", 20),
                    yEnd: .value("Warning", 40)
                )
                .foregroundStyle(.orange.opacity(0.1))

                // Battery level line
                LineMark(
                    x: .value("Date", data.first?.date ?? Date()),
                    y: .value("Level", 100)
                )
                .foregroundStyle(.gray.opacity(0.3))

                ForEach(data) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Level", point.value)
                    )
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    .foregroundStyle(batteryColor(for: point.value))

                    PointMark(
                        x: .value("Date", point.date),
                        y: .value("Level", point.value)
                    )
                    .foregroundStyle(batteryColor(for: point.value))
                    .opacity(selectedPoint?.id == point.id ? 1 : 0.8)
                }
            }
            .frame(height: 200)
            .chartYScale(domain: 0...100)
            .chartXAxis {
                AxisMarks(position: .bottom) { _ in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel(format: .dateTime.hour())
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel {
                        let v = value.as(Double.self) ?? 0
                        Text("\(Int(v))%")
                    }
                }
            }
            .chartOverlay { proxy in
                GeometryReader { geometry in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let x = value.location.x - geometry[proxy.plotAreaFrame].origin.x
                                    guard let date = proxy.value(atX: x, as: Date.self) else { return }

                                    // Find closest point
                                    selectedPoint = data.min(by: {
                                        abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date))
                                    })
                                }
                                .onEnded { _ in
                                    selectedPoint = nil
                                }
                        )
                }
            }

            if let selected = selectedPoint {
                HStack {
                    Image(systemName: "battery.100")
                        .foregroundColor(batteryColor(for: selected.value))
                    Text("\(Int(selected.value))%")
                        .foregroundColor(batteryColor(for: selected.value))
                    Text("at")
                    Text(selected.date.formatted(date: .omitted, time: .shortened))

                    if selected.value < 20 {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                    }
                }
                .font(.caption)
                .padding(.vertical, 4)
            }

            // Trend indicator
            HStack(spacing: 4) {
                Image(systemName: trendPercentage >= 0 ? "arrow.up.right" : "arrow.down.right")
                Text(trendPercentage >= 0 ? "Increased" : "Decreased")
                Text("\(String(format: "%.1f", abs(trendPercentage)))%")
                Text("in discharge rate")
            }
            .font(.caption)
            .foregroundColor(trendPercentage >= 0 ? .red : .green)
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
    let mockData: [TimeSeriesData] = (0..<24).map { hoursAgo in
        let date = calendar.date(byAdding: .hour, value: -hoursAgo, to: today)!
        let baseLevel = 100.0 - (Double(hoursAgo) * 3.5) // Simulate battery drain
        let variation = Double.random(in: -2...2)
        return TimeSeriesData(date: date, value: max(0, min(100, baseLevel + variation)))
    }.reversed()

    return VStack {
        BatteryLevelChart(
            data: mockData,
            title: "Device Battery",
            subtitle: "Battery level over the last 24 hours",
            trendPercentage: -4.2
        )
    }
    .padding()
    .background(Color(uiColor: .secondarySystemBackground))
}