import SwiftUI
import Models
import Charts

public struct MotionEvent: Identifiable {
    public let id = UUID()
    public let date: Date
    public let type: EventType
    public let duration: TimeInterval

    public init(date: Date, type: EventType, duration: TimeInterval) {
        self.date = date
        self.type = type
        self.duration = duration
    }

    public enum EventType {
        case motion
        case occupancy
    }
}

public struct MotionEventsChart: View {
    let events: [MotionEvent]
    let title: String
    let subtitle: String
    @State private var selectedEvent: MotionEvent?

    public init(
        events: [MotionEvent],
        title: String = "Motion & Occupancy",
        subtitle: String = "Activity timeline"
    ) {
        self.events = events
        self.title = title
        self.subtitle = subtitle
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
                ForEach(events) { event in
                    RectangleMark(
                        xStart: .value("Start", event.date),
                        xEnd: .value("End", event.date.addingTimeInterval(event.duration)),
                        y: .value("Type", event.type == .motion ? "Motion" : "Occupancy")
                    )
                    .foregroundStyle(event.type == .motion ? Color.orange : Color.purple)
                    .opacity(selectedEvent?.id == event.id ? 1.0 : 0.7)
                }
            }
            .frame(height: 100)
            .chartXAxis {
                AxisMarks(position: .bottom) { _ in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel(format: .dateTime.hour())
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisValueLabel()
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

                                    // Find closest event
                                    selectedEvent = events.min(by: { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) })
                                }
                                .onEnded { _ in
                                    selectedEvent = nil
                                }
                        )
                }
            }

            if let selected = selectedEvent {
                HStack {
                    Image(systemName: selected.type == .motion ? "sensor.fill" : "person.fill")
                    Text(selected.type == .motion ? "Motion detected" : "Room occupied")
                    Text(selected.date, style: .time)
                    Text("(\(Int(selected.duration))s)")
                }
                .foregroundColor(selected.type == .motion ? .orange : .purple)
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
    let mockEvents: [MotionEvent] = (0..<48).map { minutesAgo in
        let date = calendar.date(byAdding: .minute, value: -minutesAgo * 30, to: today)!
        return MotionEvent(
            date: date,
            type: Bool.random() ? .motion : .occupancy,
            duration: Double.random(in: 10...60)
        )
    }

    return VStack {
        MotionEventsChart(
            events: mockEvents,
            title: "Room Activity",
            subtitle: "Motion and occupancy events"
        )
    }
    .padding()
    .background(Color(uiColor: .secondarySystemBackground))
}