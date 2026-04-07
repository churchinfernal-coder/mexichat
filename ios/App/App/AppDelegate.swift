import UIKit
import Capacitor
import UserNotifications
import PushKit
import CallKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, PKPushRegistryDelegate {

    var window: UIWindow?
    var callProvider: CXProvider?
    var callController: CXCallController?
    private var voipRegistry: PKPushRegistry?

    // MARK: - App Lifecycle

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Set notification delegate for foreground handling
        UNUserNotificationCenter.current().delegate = self

        // Configure CallKit
        setupCallKit()

        // Register for VoIP pushes (wakes app even when killed)
        setupVoIPPush()

        // Register for remote notifications (APNs)
        application.registerForRemoteNotifications()

        // Define notification categories with actions (for call notifications)
        let answerAction = UNNotificationAction(identifier: "ANSWER_ACTION", title: "Contestar", options: [.foreground])
        let rejectAction = UNNotificationAction(identifier: "REJECT_ACTION", title: "Rechazar", options: [.destructive])
        let callCategory = UNNotificationCategory(
            identifier: "INCOMING_CALL",
            actions: [answerAction, rejectAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        UNUserNotificationCenter.current().setNotificationCategories([callCategory])

        return true
    }

    // MARK: - APNs Token Registration

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Convert token to hex string
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("[AppDelegate] APNs token: \(token.prefix(20))...")

        // Forward to Capacitor's push plugin
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[AppDelegate] APNs registration failed: \(error.localizedDescription)")
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    // MARK: - Foreground Notification Handling

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        let type = userInfo["type"] as? String ?? "message"
        let isCall = type == "call" || type == "incoming_call" || type == "video_call"

        if isCall {
            // Show full call UI via CallKit instead of banner
            let callerName = userInfo["callerName"] as? String ?? "Llamada entrante"
            let callType = userInfo["callType"] as? String ?? "audio"
            let hasVideo = callType == "video"
            reportIncomingCall(callerName: callerName, hasVideo: hasVideo)
            completionHandler([]) // CallKit handles the UI
        } else {
            // Show banner + sound + badge for messages
            if #available(iOS 14.0, *) {
                completionHandler([.banner, .sound, .badge, .list])
            } else {
                completionHandler([.alert, .sound, .badge])
            }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let type = userInfo["type"] as? String ?? "message"
        let isCall = type == "call" || type == "incoming_call" || type == "video_call"

        if response.actionIdentifier == "REJECT_ACTION" {
            // User rejected call from notification
            NotificationCenter.default.post(
                name: Notification.Name("MexiChatRejectCall"),
                object: nil,
                userInfo: userInfo
            )
        } else if response.actionIdentifier == "ANSWER_ACTION" || (isCall && response.actionIdentifier == UNNotificationDefaultActionIdentifier) {
            // User answered call
            NotificationCenter.default.post(
                name: Notification.Name("MexiChatAnswerCall"),
                object: nil,
                userInfo: userInfo
            )
        } else {
            // Regular notification tap — navigate to conversation
            NotificationCenter.default.post(
                name: Notification.Name("MexiChatNavigate"),
                object: nil,
                userInfo: userInfo
            )
        }

        completionHandler()
    }

    // MARK: - CallKit Setup

    private func setupCallKit() {
        let config = CXProviderConfiguration()
        config.localizedName = "MexiChat"
        config.supportsVideo = true
        config.maximumCallsPerGroup = 1
        config.maximumCallGroups = 1
        config.supportedHandleTypes = [.generic]
        config.iconTemplateImageData = nil // Uses app icon

        callProvider = CXProvider(configuration: config)
        callController = CXCallController()
    }

    func reportIncomingCall(callerName: String, hasVideo: Bool, uuid: UUID = UUID()) {
        guard let provider = callProvider else { return }

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerName)
        update.localizedCallerName = callerName
        update.hasVideo = hasVideo
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsHolding = false
        update.supportsDTMF = false

        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                print("[AppDelegate] CallKit reportIncomingCall error: \(error.localizedDescription)")
            } else {
                print("[AppDelegate] CallKit incoming call reported: \(callerName)")
            }
        }
    }

    // MARK: - PushKit VoIP (instant wake for calls)

    private func setupVoIPPush() {
        voipRegistry = PKPushRegistry(queue: DispatchQueue.main)
        voipRegistry?.delegate = self
        voipRegistry?.desiredPushTypes = [.voIP]
    }

    // PushKit delegate — VoIP token received
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        let token = pushCredentials.token.map { String(format: "%02.2hhx", $0) }.joined()
        print("[AppDelegate] VoIP token: \(token.prefix(20))...")
        // Store VoIP token for server-side push (could store in Supabase)
    }

    // PushKit delegate — VoIP push received (MUST report CallKit call or app crashes)
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        guard type == .voIP else {
            completion()
            return
        }

        let data = payload.dictionaryPayload
        let callerName = data["callerName"] as? String ?? "Llamada entrante"
        let callType = data["callType"] as? String ?? "audio"
        let hasVideo = callType == "video"

        print("[AppDelegate] VoIP push received from: \(callerName)")

        // MUST report to CallKit immediately or iOS kills the app
        reportIncomingCall(callerName: callerName, hasVideo: hasVideo)

        completion()
    }

    // MARK: - Badge Management

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Clear badge when app comes to foreground
        application.applicationIconBadgeNumber = 0
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        application.applicationIconBadgeNumber = 0
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    // MARK: - URL Handling

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}