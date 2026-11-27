// Metro config — Expo defaults, plus a macOS-only resolver shim for the
// react-native-macos target (see macos/ and .github/workflows/macos-build.yml).
//
// WHY THIS FILE EXISTS: until now the project had no metro.config.js and
// Expo used its built-in defaults. This file calls getDefaultConfig(),
// which IS those defaults (SDK 57's default resolver platforms already
// include 'macos', so .macos.ts/.macos.tsx variants resolve with no
// further config). The only addition is a resolveRequest wrapper that
// activates EXCLUSIVELY for platform === 'macos' bundles:
//
//   - 'react-native' (and its subpaths) resolve to 'react-native-macos',
//     the standard react-native-macos metro mapping. react-native-macos
//     is a fork of RN 0.83 while the app runs RN 0.86 on ios/android —
//     see the version-mismatch note in the macOS workflow header.
//   - 'react-native-iap' resolves to a local inert stub: StoreKit IAP
//     has no react-native-macos build, and lib/purchases.macos.ts
//     already keeps the paywall store-disconnected on Mac. The stub
//     exists so any shared file that still names the module can
//     resolve on macOS instead of failing the whole bundle.
//
// iOS / Android / web bundles pass through to Expo's resolver untouched.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const MACOS_MODULE_STUBS = {
  'react-native-iap': path.resolve(__dirname, 'src/macos-stubs/react-native-iap.ts'),
};

const upstreamResolveRequest =
  typeof config.resolver.resolveRequest === 'function'
    ? config.resolver.resolveRequest
    : null;

const resolveDefault = (context, moduleName, platform) =>
  upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

const RNSCREENS_MACOS_STUB = path.resolve(
  __dirname,
  'src/macos-stubs/rnscreens-tabs.tsx',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'macos') {
    if (moduleName === 'react-native') {
      return context.resolveRequest(context, 'react-native-macos', platform);
    }
    if (moduleName.startsWith('react-native/')) {
      return context.resolveRequest(
        context,
        `react-native-macos/${moduleName.slice('react-native/'.length)}`,
        platform,
      );
    }
    if (Object.prototype.hasOwnProperty.call(MACOS_MODULE_STUBS, moduleName)) {
      return { type: 'sourceFile', filePath: MACOS_MODULE_STUBS[moduleName] };
    }
    try {
      return resolveDefault(context, moduleName, platform);
    } catch (e) {
      // react-native-screens ships a tail of native components
      // (native-tabs host/screen, the experimental "gamma" stack
      // header, …) for ios/android/web only — no .macos or .native
      // file exists, so resolution can NEVER succeed for them on
      // macOS. They are all native view components the macOS build
      // never renders (the macOS layout is a sidebar + <Slot />), so
      // an inert component stub is the correct resolution.
      if (context.originModulePath.includes('react-native-screens/')) {
        return { type: 'sourceFile', filePath: RNSCREENS_MACOS_STUB };
      }
      throw e;
    }
  }
  return resolveDefault(context, moduleName, platform);
};

module.exports = config;
