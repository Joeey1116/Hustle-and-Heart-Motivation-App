import SwiftUI

/// Entry point for the Hustle & Heart Motivation App Clip
/// (com.beatrackfaminc.motivation.HustleandHeartMotivation).
///
/// The clip is a deliberately tiny, dependency-free SwiftUI app — it does NOT
/// embed React Native. The first clip was a full React Native app sharing the
/// main target's AppDelegate and pods: 40 MB thinned, over Apple's 15 MB App
/// Clip limit (ITMS-90865, Nov 10 2026). This version shows today's
/// motivational quote and hands the user off to the full app (App Store
/// overlay / deep link), nothing more.
///
/// The clip is generated into ios/HustleHeartMotivationClip by the
/// `plugins/withAppClip` config plugin on every `expo prebuild`; edit the
/// templates under `plugins/app-clip/`, never the generated copy.
@main
struct HustleHeartMotivationClipApp: App {
  @State private var invocationURL: URL?

  var body: some Scene {
    WindowGroup {
      ContentView(invocationURL: invocationURL)
        // App Clip invocation: the URL from the App Clip Code / NFC tag /
        // link that launched the clip (configured as an App Clip experience
        // in App Store Connect).
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
          if let url = activity.webpageURL {
            invocationURL = url
          }
        }
        .onOpenURL { url in
          invocationURL = url
        }
    }
  }
}
