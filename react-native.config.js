// React Native CLI / codegen config.
//
// Default (every normal invocation — iOS, Android, web, Metro, Expo
// autolinking): EMPTY. Nothing below changes any existing build.
//
// The single exception is the macOS target's `pod install`. macos/
// Podfile sets MOTIVATION_MACOS_POD_INSTALL=1 before any tooling
// runs, and that environment variable is inherited by every process
// CocoaPods spawns (the `react-native config` autolinking call and
// the codegen script). Only then does this file return the override
// below. The iOS Podfile never sets the variable, so iOS codegen and
// autolinking see exactly the empty config — every library below
// stays fully linked and code-generated on iOS/Android.
//
// WHY THE OVERRIDE EXISTS (macOS rollout, Nov 27, 2026):
// The Mac target builds with react-native-macos 0.83, whose codegen
// parser predates syntax that newer libraries' Fabric specs use.
// Codegen runs during `pod install` and aborts on an unparseable
// spec, killing the whole install. Separately, react-native-screens'
// podspec declares only ios/tvos/visionos — it can never link into a
// macOS target (CocoaPods autolinking already skips it for this
// target), and the Mac UI never renders screens' native components
// (sidebar + <Slot /> layout; the Metro config stubs its JS-side
// native components for macos bundles).
// So for the Mac build — and only the Mac build — each library in
// MACOS_CODEGEN_EXCLUSIONS is excluded from Apple-platform
// autolinking/codegen by setting its `ios` platform config to null
// (the RN CLI's documented disable mechanism). The macOS codegen run
// is invoked with the ios target platform (react-native-macos reuses
// the iOS codegen path), and its executor drops any library whose
// platforms.ios is null from codegen generation.
//
// The exclusion list is verified by the faithful local codegen
// simulation (react-native-macos 0.83's
// scripts/generate-codegen-artifacts.js, target platform ios, with
// MOTIVATION_MACOS_POD_INSTALL=1): every library listed here either
// has no macOS podspec platform or its specs fail the 0.83 parser;
// every library NOT listed passes that simulation (exit 0).
//
//   - react-native-screens: podspec has no macOS platform, and its
//     4.26 Fabric specs use syntax the 0.83 parser rejects (e.g.
//     `React.ComponentRef<...>` in the gamma stack-header spec).
//   - FBReactNativeSpec: the codegen library name shared by the
//     app's react-native 0.86 core specs. 0.86's core sources include
//     the new VirtualView spec, whose `onModeChange` event the 0.83
//     parser cannot determine arguments for, aborting the run. This
//     is also the WRONG core spec set for the Mac target: the fork
//     ships its own FBReactNativeSpec under
//     react-native-macos/React/FBReactNativeSpec, consumed by the
//     Mac target via the React-RCTFBReactNativeSpec pod in the
//     fork's react_native_pods.rb — app-level codegen generation of
//     the core spec is skipped by the executor when it already
//     exists. Excluding the 0.86 copy from the library list loses
//     nothing on macOS.
const MACOS_CODEGEN_EXCLUSIONS = [
  'react-native-screens',
  'FBReactNativeSpec',
];

const isMacosPodInstall =
  process.env.MOTIVATION_MACOS_POD_INSTALL === '1';

module.exports = isMacosPodInstall
  ? {
      dependencies: Object.fromEntries(
        MACOS_CODEGEN_EXCLUSIONS.map((name) => [
          name,
          { platforms: { ios: null } },
        ]),
      ),
    }
  : {};
