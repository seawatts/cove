import Foundation
import OSLog
import Network
import Models

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse(Int)
    case networkError(Error)
    case decodingError(Error)
    case emptyData
    case rspcError(String)
    case noNetworkConnection
    case serviceDiscoveryFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse(let statusCode):
            return "Invalid response from server (Status: \(statusCode))"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .emptyData:
            return "No data received from server"
        case .rspcError(let message):
            return "RSPC Error: \(message)"
        case .noNetworkConnection:
            return "No network connection available"
        case .serviceDiscoveryFailed:
            return "Failed to discover Cove server"
        }
    }
}

public class APIService {
    public static let shared = APIService()
    private let logger = Logger(subsystem: "com.cove.ios", category: "API")
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    private var isNetworkAvailable = false
    private var isMonitorStarted = false
    private let maxRetries = 3
    private let retryDelay: UInt64 = 1_000_000_000 // 1 second in nanoseconds

    private var baseURL: String?
    private let browser: NWBrowser
    private let browserQueue = DispatchQueue(label: "com.cove.browser")

    private init() {
        // Initialize NWBrowser for service discovery
        let parameters = NWParameters()
        parameters.includePeerToPeer = true

        let browserDescriptor: NWBrowser.Descriptor = .bonjour(type: "_cove._tcp", domain: "local")
        browser = NWBrowser(for: browserDescriptor, using: parameters)

        setupNetworkMonitoring()
        setupServiceDiscovery()
    }

    private func setupServiceDiscovery() {
        browser.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                self?.logger.info("Browser is ready")
            case .failed(let error):
                self?.logger.error("Browser failed: \(error)")
            case .cancelled:
                self?.logger.info("Browser was cancelled")
            default:
                break
            }
        }

        browser.browseResultsChangedHandler = { [weak self] results, changes in
            guard let self = self else { return }

            // Look for the first available Cove server
            if let result = results.first(where: { result in
                guard case let NWEndpoint.service(name, _, _, _) = result.endpoint else { return false }
                return name.contains("Cove")
            }), case let NWEndpoint.service(_, _, _, interface) = result.endpoint {
                if let interface = interface {
                    self.logger.info("Found Cove server on interface: \(interface)")
                }

                // Create a connection to resolve the endpoint
                let connection = NWConnection(to: result.endpoint, using: .tcp)
                connection.stateUpdateHandler = { [weak self] state in
                    switch state {
                    case .ready:
                        if let host = connection.currentPath?.remoteEndpoint?.hostname {
                            self?.baseURL = "http://\(host):4000"
                            self?.logger.info("Connected to Cove server at \(host)")
                        }
                        connection.cancel()
                    case .failed(let error):
                        self?.logger.error("Connection failed: \(error)")
                        connection.cancel()
                    default:
                        break
                    }
                }
                connection.start(queue: self.browserQueue)
            }
        } as (Set<NWBrowser.Result>, Set<NWBrowser.Result.Change>) -> Void

        // Start browsing for services
        browser.start(queue: browserQueue)
    }

    public func setupNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isNetworkAvailable = path.status == .satisfied
            self?.isMonitorStarted = true
            let interfaces = path.availableInterfaces.map { $0.type }
            self?.logger.info("Network status changed: \(path.status == .satisfied ? "Connected" : "Disconnected"), Interfaces: \(interfaces)")
        }
        monitor.start(queue: queue)
    }

    public func fetchDevices() async throws -> [Device] {
        // Wait for network monitor to initialize (max 2 seconds)
        for _ in 0..<20 {
            if isMonitorStarted { break }
            try await Task.sleep(nanoseconds: 100_000_000) // 0.1 second
        }

        guard isMonitorStarted else {
            logger.error("Network monitor failed to initialize")
            throw APIError.noNetworkConnection
        }

        guard isNetworkAvailable else {
            logger.error("No network connection available")
            throw APIError.noNetworkConnection
        }

        // Wait for service discovery (max 5 seconds)
        for _ in 0..<50 {
            if baseURL != nil { break }
            try await Task.sleep(nanoseconds: 100_000_000) // 0.1 second
        }

        guard let baseURL = baseURL else {
            logger.error("Failed to discover Cove server")
            throw APIError.serviceDiscoveryFailed
        }

        var lastError: Error?

        // Retry loop
        for attempt in 0..<maxRetries {
            do {
                return try await fetchDevicesAttempt()
            } catch let error as APIError {
                lastError = error
                logger.error("Attempt \(attempt + 1) failed: \(error.localizedDescription)")

                if attempt < maxRetries - 1 {
                    // Wait before retrying, with exponential backoff
                    try await Task.sleep(nanoseconds: retryDelay * UInt64(pow(2.0, Double(attempt))))
                }
            } catch {
                lastError = error
                logger.error("Unexpected error on attempt \(attempt + 1): \(error.localizedDescription)")

                if attempt < maxRetries - 1 {
                    try await Task.sleep(nanoseconds: retryDelay * UInt64(pow(2.0, Double(attempt))))
                }
            }
        }

        throw lastError ?? APIError.networkError(NSError(domain: "Unknown", code: -1))
    }

    private func fetchDevicesAttempt() async throws -> [Device] {
        guard let baseURL = baseURL else {
            throw APIError.serviceDiscoveryFailed
        }

        guard let url = URL(string: "\(baseURL)/rspc/devices") else {
            logger.error("Invalid URL: \(baseURL)/rspc/devices")
            throw APIError.invalidURL
        }

        logger.info("🌐 Fetching devices from: \(url.absoluteString)")

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10  // Reduced from 30
        configuration.timeoutIntervalForResource = 30 // Reduced from 300
        configuration.waitsForConnectivity = true
        let session = URLSession(configuration: configuration)

        do {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.timeoutInterval = 10 // Explicit timeout for the request

            let (data, urlResponse) = try await session.data(for: request)

            guard let httpResponse = urlResponse as? HTTPURLResponse else {
                logger.error("Invalid response type: \(String(describing: urlResponse))")
                throw APIError.invalidResponse(-1)
            }

            logger.info("📡 Response status code: \(httpResponse.statusCode)")

            guard (200...299).contains(httpResponse.statusCode) else {
                if let responseString = String(data: data, encoding: .utf8) {
                    logger.error("❌ Error response: \(responseString)")
                }
                throw APIError.invalidResponse(httpResponse.statusCode)
            }

            guard !data.isEmpty else {
                logger.error("Empty data received")
                throw APIError.emptyData
            }

            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase

            do {
                // First try to decode as a potential error response
                if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let error = errorJson["error"] as? [String: Any],
                   let message = error["message"] as? String {
                    logger.error("🔴 RSPC Error: \(message)")
                    throw APIError.rspcError(message)
                }

                let rspcResponse = try decoder.decode(RspcResponse.self, from: data)

                // Validate that we have actual data
                guard !rspcResponse.result.data.isEmpty else {
                    logger.warning("⚠️ Received empty devices array")
                    return []
                }

                logger.info("✅ Successfully decoded response with \(rspcResponse.result.data.count) devices")
                return rspcResponse.result.data
            } catch {
                logger.error("🔍 JSON Decoding error: \(error)")
                logger.error("🔍 Raw data: \(String(data: data, encoding: .utf8) ?? "unable to read data")")
                throw APIError.decodingError(error)
            }
        } catch {
            logger.error("❌ Network error: \(error)")
            throw error
        }
    }

    public func updateDeviceStatus(deviceId: String, status: String) async throws {
        guard isNetworkAvailable else {
            logger.error("No network connection available")
            throw APIError.noNetworkConnection
        }

        guard let url = URL(string: "\(baseURL)/rspc/devices/\(deviceId)/status") else {
            logger.error("Invalid URL")
            throw APIError.invalidURL
        }

        logger.info("🌐 Updating device \(deviceId) status to: \(status)")

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 30
        configuration.waitsForConnectivity = true
        let session = URLSession(configuration: configuration)

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Create the request body
        let body = ["status": status]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse(-1)
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                if let responseString = String(data: data, encoding: .utf8) {
                    logger.error("❌ Error response: \(responseString)")
                }
                throw APIError.invalidResponse(httpResponse.statusCode)
            }

            // Check for RSPC error response
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let error = errorJson["error"] as? [String: Any],
               let message = error["message"] as? String {
                logger.error("🔴 RSPC Error: \(message)")
                throw APIError.rspcError(message)
            }

            logger.info("✅ Successfully updated device \(deviceId) status to \(status)")
        } catch {
            logger.error("❌ Failed to update device status: \(error.localizedDescription)")
            throw error
        }
    }
}

// RSPC response wrapper
struct RspcResponse: Codable {
    let jsonrpc: String
    let id: String?
    let result: ResultWrapper
}

struct ResultWrapper: Codable {
    let type: String
    let data: [Device]

    enum CodingKeys: String, CodingKey {
        case type
        case data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.type = try container.decode(String.self, forKey: .type)
        self.data = try container.decode([Device].self, forKey: .data)
    }
}
