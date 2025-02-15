import SwiftUI
import Models
import Charts

public struct EnergyRate: Hashable {
    public let name: String
    public let baseRate: Double // Cost per kWh
    public let peakRate: Double? // Optional peak rate per kWh
    public let peakHoursStart: Int? // 0-23 hour when peak starts
    public let peakHoursEnd: Int? // 0-23 hour when peak ends
    public let currency: String

    public init(
        name: String,
        baseRate: Double,
        peakRate: Double? = nil,
        peakHoursStart: Int? = nil,
        peakHoursEnd: Int? = nil,
        currency: String = "USD"
    ) {
        self.name = name
        self.baseRate = baseRate
        self.peakRate = peakRate
        self.peakHoursStart = peakHoursStart
        self.peakHoursEnd = peakHoursEnd
        self.currency = currency
    }
}

public struct EnergyCostChart: View {
    let data: [TimeSeriesData]
    let rate: EnergyRate
    let title: String
    let subtitle: String
    @State private var selectedPoint: TimeSeriesData?

    public init(
        data: [TimeSeriesData],
        rate: EnergyRate,
        title: String = "Energy Cost",
        subtitle: String = "Cost over time"
    ) {
        self.data = data
        self.rate = rate
        self.title = title
        self.subtitle = subtitle
    }

    private func calculateCost(for point: TimeSeriesData) -> Double {
        let hour = Calendar.current.component(.hour, from: point.date)
        let isPeakHour = rate.peakHoursStart.map { startHour in
            rate.peakHoursEnd.map { endHour in
                if startHour <= endHour {
                    return hour >= startHour && hour < endHour
                } else {
                    // Handle overnight peak hours (e.g., 22:00 - 06:00)
                    return hour >= startHour || hour < endHour
                }
            } ?? false
        } ?? false

        let applicableRate = isPeakHour ? (rate.peakRate ?? rate.baseRate) : rate.baseRate
        return point.value * applicableRate
    }

    private var costData: [TimeSeriesData] {
        data.map { point in
            TimeSeriesData(
                date: point.date,
                value: calculateCost(for: point)
            )
        }
    }

    private var totalCost: Double {
        costData.reduce(0) { $0 + $1.value }
    }

    private var averageCost: Double {
        totalCost / Double(costData.count)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)

            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Cost summary
            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("Total")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.2f \(rate.currency)", totalCost))
                        .font(.headline)
                }

                VStack(alignment: .leading) {
                    Text("Average")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.2f \(rate.currency)", averageCost))
                        .font(.headline)
                }

                if rate.peakRate != nil {
                    VStack(alignment: .leading) {
                        Text("Rate")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("\(String(format: "%.2f", rate.baseRate))/\(String(format: "%.2f", rate.peakRate ?? 0)) \(rate.currency)")
                            .font(.headline)
                    }
                } else {
                    VStack(alignment: .leading) {
                        Text("Rate")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("\(String(format: "%.2f", rate.baseRate)) \(rate.currency)")
                            .font(.headline)
                    }
                }
            }
            .padding(.vertical, 8)

            Chart {
                ForEach(costData) { point in
                    LineMark(
                        x: .value("Time", point.date),
                        y: .value("Cost", point.value)
                    )
                    .foregroundStyle(Color.green.gradient)

                    AreaMark(
                        x: .value("Time", point.date),
                        y: .value("Cost", point.value)
                    )
                    .foregroundStyle(Color.green.opacity(0.1))

                    if let selected = selectedPoint, selected.id == point.id {
                        PointMark(
                            x: .value("Time", point.date),
                            y: .value("Cost", point.value)
                        )
                        .foregroundStyle(.green)
                    }
                }
            }
            .frame(height: 200)
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
                        let cost = value.as(Double.self) ?? 0
                        Text(String(format: "%.2f", cost))
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
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundColor(.green)
                    Text(String(format: "%.2f \(rate.currency)", calculateCost(for: selected)))
                    Text("at")
                    Text(selected.date.formatted(date: .omitted, time: .shortened))
                    if let peakRate = rate.peakRate {
                        let hour = Calendar.current.component(.hour, from: selected.date)
                        let isPeakHour = rate.peakHoursStart.map { startHour in
                            rate.peakHoursEnd.map { endHour in
                                if startHour <= endHour {
                                    return hour >= startHour && hour < endHour
                                } else {
                                    return hour >= startHour || hour < endHour
                                }
                            } ?? false
                        } ?? false
                        Text(isPeakHour ? "Peak Rate" : "Base Rate")
                            .foregroundColor(isPeakHour ? .orange : .green)
                            .font(.caption)
                    }
                }
                .font(.caption)
                .padding(.vertical, 4)
            }
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
        let baseUsage = Double.random(in: 0.8...2.5) // kWh
        return TimeSeriesData(date: date, value: baseUsage)
    }.reversed()

    let rate = EnergyRate(
        name: "Time of Use",
        baseRate: 0.15,
        peakRate: 0.25,
        peakHoursStart: 17, // 5 PM
        peakHoursEnd: 21,   // 9 PM
        currency: "USD"
    )

    return VStack {
        EnergyCostChart(
            data: mockData,
            rate: rate,
            title: "Daily Energy Cost",
            subtitle: "Cost based on time-of-use pricing"
        )
    }
    .padding()
    .background(Color(uiColor: .secondarySystemBackground))
}