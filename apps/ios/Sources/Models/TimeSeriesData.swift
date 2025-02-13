import Foundation

public struct TimeSeriesData: Identifiable {
    public let id = UUID()
    public let date: Date
    public let value: Double

    public init(date: Date, value: Double) {
        self.date = date
        self.value = value
    }
}