import SwiftUI
import Models
import Charts

public struct CostProjection {
    let month: Date
    let projectedUsage: Double
    let projectedCost: Double
    let actualUsage: Double?
    let actualCost: Double?
}

public struct EnergyCostProjection: View {
    let historicalData: [TimeSeriesData]
    let rate: EnergyRate
    let monthsToProject: Int
    @State private var selectedProjection: CostProjection?

    public init(
        historicalData: [TimeSeriesData],
        rate: EnergyRate,
        monthsToProject: Int = 3
    ) {
        self.historicalData = historicalData
        self.rate = rate
        self.monthsToProject = monthsToProject
    }

    private func calculateAverageUsageByHour() -> [Int: Double] {
        var usageByHour: [Int: (total: Double, count: Int)] = [:]

        for point in historicalData {
            let hour = Calendar.current.component(.hour, from: point.date)
            let current = usageByHour[hour] ?? (total: 0, count: 0)
            usageByHour[hour] = (total: current.total + point.value, count: current.count + 1)
        }

        return usageByHour.mapValues { $0.total / Double($0.count) }
    }

    private func calculateDailyCost(averageUsageByHour: [Int: Double]) -> Double {
        var totalCost = 0.0

        for hour in 0..<24 {
            let usage = averageUsageByHour[hour] ?? 0
            let isPeakHour = rate.peakHoursStart.map { startHour in
                rate.peakHoursEnd.map { endHour in
                    if startHour <= endHour {
                        return hour >= startHour && hour < endHour
                    } else {
                        return hour >= startHour || hour < endHour
                    }
                } ?? false
            } ?? false

            let applicableRate = isPeakHour ? (rate.peakRate ?? rate.baseRate) : rate.baseRate
            totalCost += usage * applicableRate
        }

        return totalCost
    }

    private var projections: [CostProjection] {
        let calendar = Calendar.current
        let averageUsageByHour = calculateAverageUsageByHour()
        let dailyCost = calculateDailyCost(averageUsageByHour: averageUsageByHour)
        let dailyUsage = averageUsageByHour.values.reduce(0, +)

        return (0..<monthsToProject).map { monthOffset in
            let month = calendar.date(byAdding: .month, value: monthOffset, to: Date())!
            let daysInMonth = calendar.range(of: .day, in: .month, for: month)?.count ?? 30

            // Add some variation to make projections more realistic
            let variationFactor = Double.random(in: 0.9...1.1)
            let projectedUsage = dailyUsage * Double(daysInMonth) * variationFactor
            let projectedCost = dailyCost * Double(daysInMonth) * variationFactor

            return CostProjection(
                month: month,
                projectedUsage: projectedUsage,
                projectedCost: projectedCost,
                actualUsage: monthOffset == 0 ? dailyUsage * Double(calendar.component(.day, from: Date())) : nil,
                actualCost: monthOffset == 0 ? dailyCost * Double(calendar.component(.day, from: Date())) : nil
            )
        }
    }

    public var body: some View {
        let averageHourlyUsage = calculateAverageUsageByHour()

        return VStack(alignment: .leading, spacing: 16) {
            Text("Cost Projections")
                .font(.title2)
                .fontWeight(.bold)

            Text("Based on your current usage patterns")
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Monthly breakdown
            VStack(spacing: 12) {
                ForEach(projections, id: \.month) { projection in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(projection.month, format: .dateTime.month(.wide))
                                .font(.headline)

                            if let actualCost = projection.actualCost {
                                Text("Current: \(String(format: "%.2f", actualCost)) \(rate.currency)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing) {
                            Text(String(format: "%.2f \(rate.currency)", projection.projectedCost))
                                .font(.headline)

                            Text(String(format: "%.1f kWh", projection.projectedUsage))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(12)
                }
            }

            // Savings tips based on rate plan
            VStack(alignment: .leading, spacing: 8) {
                Text("Savings Tips")
                    .font(.headline)

                if let peakRate = rate.peakRate, let start = rate.peakHoursStart, let end = rate.peakHoursEnd {
                    HStack {
                        Image(systemName: "clock.fill")
                            .foregroundColor(.orange)
                        Text("Shift high-power activities outside peak hours (\(start):00-\(end):00)")
                    }

                    HStack {
                        Image(systemName: "dollarsign.circle.fill")
                            .foregroundColor(.green)
                        Text("Potential savings of \(String(format: "%.2f", (peakRate - rate.baseRate) * averageHourlyUsage.values.reduce(0, +))) \(rate.currency)/day by avoiding peak rates")
                    }
                }

                HStack {
                    Image(systemName: "lightbulb.fill")
                        .foregroundColor(.yellow)
                    Text("Use smart scheduling to optimize device usage")
                }
            }
            .padding()
            .background(Color(uiColor: .secondarySystemBackground))
            .cornerRadius(12)
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
        EnergyCostProjection(
            historicalData: mockData,
            rate: rate,
            monthsToProject: 3
        )
    }
    .padding()
    .background(Color(uiColor: .secondarySystemBackground))
}