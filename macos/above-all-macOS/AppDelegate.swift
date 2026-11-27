import SwiftUI
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
struct HustleHeartMacApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    Window("Hustle & Heart Motivation", id: "main") {
      ReactNativeView(factory: appDelegate.reactNativeFactory)
    }
    .defaultSize(width: 1280, height: 720)
  }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
  private let reactNativeDelegate: ReactNativeDelegate
  let reactNativeFactory: RCTReactNativeFactory

  override init() {
    super.init()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
  }
}

// MARK: - React Native Delegate

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Expo entry point (matches ios/HustleHeartMotivation: module name "main",
    // bundle root at the expo-router entry file, NOT the vanilla
    // template's "index").
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "node_modules/expo-router/entry")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - React Native SwiftUI View

struct ReactNativeView: NSViewRepresentable {
  let factory: RCTReactNativeFactory

  func makeNSView(context: Context) -> NSView {
    // "main" is the module name the Expo JS entry registers under
    // (same as ios/HustleHeartMotivation's AppDelegate).
    factory.rootViewFactory.view(withModuleName: "main")
  }

  func updateNSView(_ nsView: NSView, context: Context) {}
}
