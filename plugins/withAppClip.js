/**
 * Expo config plugin: withAppClip
 *
 * Adds an iOS App Clip target to the generated Xcode project so it SURVIVES
 * `expo prebuild` (ios/ is regenerated on every build — a hand-added Xcode
 * target would be wiped). Registered in app.json.
 *
 * Clip target: "HustleHeartMotivationClip"
 * Clip bundle ID: com.beatrackfaminc.motivation.HustleandHeartMotivation
 *   — the App ID ALREADY exists in the Developer portal (name: "Hustle And
 *     Heart Motivation App Clip"). Do NOT change this ID.
 * Clip JS entry: clip/index.tsx (a minimal Today-quote screen — no router,
 *   no tabs, no IAP/audio/notifications; it reuses lib/quotes + lib/i18n +
 *   lib/themes + the bundled quote libraries). The clip target shares the
 *   main target's AppDelegate.swift, so the same "main" module name is used;
 *   the clip's bundle phase builds clip/index.tsx into main.jsbundle.
 *
 * What the plugin does at prebuild time:
 *   1. Writes ios/HustleHeartMotivationClip/Info.plist + .entitlements
 *      (parent-application-identifiers + on-demand-install-capable).
 *   2. Adds the HustleHeartMotivationClip native target
 *      (product type com.apple.product-type.application.on-demand-install-capable)
 *      with Sources (shared AppDelegate.swift), Frameworks, Resources
 *      (shared PrivacyInfo.xcprivacy) and a "Bundle React Native code and
 *      images" phase identical to the main target's. The entry file is set
 *      per-target via the ENTRY_FILE build setting, so the shared bundle
 *      script builds clip/index.tsx for the clip and the normal
 *      expo-router entry for the main app.
 *   3. Adds an "Embed App Clips" copy phase to the main target and makes the
 *      main target depend on the clip, so `xcodebuild archive` of the main
 *      scheme builds the clip and embeds it at AppClips/ inside the .app.
 *   4. Appends a matching target block to the Podfile so `pod install`
 *      links the same pods to the clip.
 *   5. Sets the Release PROVISIONING_PROFILE_SPECIFIER per target in the
 *      project (main -> "BeaTrackFam Motivation App Store", clip ->
 *      "BeaTrackFam Motivation App Clip"). This MUST be per-target in the
 *      project: the workflow used to pass PROVISIONING_PROFILE_SPECIFIER on
 *      the xcodebuild command line, which would force the clip onto the main
 *      app's profile and fail signing. The workflow no longer passes it;
 *      the effective signing of the main target is unchanged (same Manual
 *      style, same profile, same certificate identity).
 *
 * PORTAL PREREQUISITE (Joey): the clip App ID already exists, but the
 * provisioning profile "BeaTrackFam Motivation App Clip" (App Store
 * distribution, for the clip App ID above, including the Nov 6 Apple
 * Distribution certificate) must exist in the Developer portal before the
 * archive will sign. The workflow uses -allowProvisioningUpdates, so once
 * the profile exists the build fetches it. If that profile is ever renamed,
 * update CLIP_PROFILE_NAME below AND the ExportOptions.plist entry in
 * .github/workflows/ios-build.yml to match, character for character.
 *
 * NOT YET WIRED (follow-up, not a build blocker): the clip has no invocation
 * URL yet — no `appclips:` associated domain and no apple-app-site-association
 * entry on beatrackfam.info, so it can't be launched from a link/QR code in
 * production. It can still be tested on-device via a TestFlight Local
 * Experience. Adding invocation needs: (a) the `appclips:beatrackfam.info`
 * associated-domain entitlement on the clip (and the App ID), (b) the AASA
 * file with an `appclips` section, (c) an App Clip Experience configured in
 * App Store Connect under the parent app.
 *
 * SIZE: App Clips have a 15 MB limit. The clip's JS bundle is minimal, but
 * the clip target links the same native modules as the main app, so the
 * native binary is the thing to watch — only the macOS archive run can
 * measure it. If the archive exceeds 15 MB, the fix is a reduced Podfile
 * target for the clip (link only the modules the clip JS actually uses).
 */
const { withXcodeProject, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CLIP_TARGET_NAME = 'HustleHeartMotivationClip';
const CLIP_BUNDLE_ID = 'com.beatrackfaminc.motivation.HustleandHeartMotivation';
const CLIP_PROFILE_NAME = 'BeaTrackFam Motivation App Clip';
const MAIN_PROFILE_NAME = 'BeaTrackFam Motivation App Store';
const MAIN_TARGET_DIR = 'HustleHeartMotivation';
const CLIP_ENTRY_FILE = 'clip/index.tsx';

/** Contents.json for the clip's own AppIcon set: a single 1024x1024 icon,
 *  exactly what Expo generates for the main app. Xcode derives the smaller
 *  sizes at build time. Without its own icon set, App Store Connect
 *  rejects the clip bundle (90022/90023/90713) — the clip is validated
 *  as its own bundle. */
const CLIP_APPICON_CONTENTS_JSON = JSON.stringify(
  {
    images: [
      {
        filename: 'App-Icon-1024x1024@1x.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      },
    ],
    info: { author: 'xcode', version: 1 },
  },
  null,
  2
);

/** Fallback for the "Bundle React Native code and images" script if the main
 *  target's phase can't be read at prebuild time. Copied from the script
 *  Expo generates for this project (SDK 57); re-check on SDK upgrades. */
const FALLBACK_BUNDLE_SCRIPT = [
  'export NODE_BINARY=node',
  'if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then',
  '  source "$PODS_ROOT/../.xcode.env"',
  'fi',
  'if [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then',
  '  source "$PODS_ROOT/../.xcode.env.local"',
  'fi',
  '',
  '# The project root by default is one level up from the ios directory',
  'export PROJECT_ROOT="$PROJECT_DIR"/..',
  '',
  'if [[ "$CONFIGURATION" = *Debug* ]]; then',
  '  export SKIP_BUNDLING=1',
  'fi',
  'if [[ -z "$ENTRY_FILE" ]]; then',
  '  # Set the entry JS file using the bundler\'s entry resolution.',
  '  export ENTRY_FILE="$("$NODE_BINARY" -e "require(\'expo/scripts/resolveAppEntry\')" "$PROJECT_ROOT" ios absolute | tail -n 1)"',
  'fi',
  '',
  'if [[ -z "$CLI_PATH" ]]; then',
  '  # Use Expo CLI',
  '  export CLI_PATH="$("$NODE_BINARY" --print "require.resolve(\'@expo/cli\', { paths: [require.resolve(\'expo/package.json\')] })")"',
  'fi',
  'if [[ -z "$BUNDLE_COMMAND" ]]; then',
  '  # Default Expo CLI command for bundling',
  '  export BUNDLE_COMMAND="export:embed"',
  'fi',
  '',
  '# Source .xcode.env.updates if it exists to allow',
  '# SKIP_BUNDLING to be unset if needed',
  'if [[ -f "$PODS_ROOT/../.xcode.env.updates" ]]; then',
  '  source "$PODS_ROOT/../.xcode.env.updates"',
  'fi',
  '# Source local changes to allow overrides',
  '# if needed',
  'if [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then',
  '  source "$PODS_ROOT/../.xcode.env.local"',
  'fi',
  '',
  ' `"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`',
  '',
].join('\n');

const CLIP_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>Hustle &amp; Heart</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>NSAppClip</key>
	<dict>
		<key>NSAppClipRequestEphemeralUserNotification</key>
		<false/>
		<key>NSAppClipRequestLocationConfirmation</key>
		<false/>
	</dict>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>arm64</string>
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UILaunchScreen</key>
	<dict/>
	<key>UIUserInterfaceStyle</key>
	<string>Dark</string>
</dict>
</plist>
`;

const CLIP_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.on-demand-install-capable</key>
	<true/>
	<key>com.apple.developer.parent-application-identifiers</key>
	<array>
		<string>$(AppIdentifierPrefix)com.beatrackfaminc.motivation</string>
	</array>
</dict>
</plist>
`;

/** Podfile target block for the clip. Mirrors the main target's block
 *  (same autolinking commands, same use_react_native! args) but WITHOUT a
 *  post_install hook — the main target's post_install already runs
 *  react_native_post_install over every target. Re-check against the
 *  generated Podfile's main block if the Expo/RN autolinking commands
 *  change in a future SDK. */
const PODFILE_CLIP_TARGET = `
target "${CLIP_TARGET_NAME}" do
  use_expo_modules!

  if ENV['EXPO_USE_COMMUNITY_AUTOLINKING'] == '1'
    config_command = ['node', '-e', "process.argv=['', '', 'config'];require('@react-native-community/cli').run()"];
  else
    config_command = [
      'node',
      '--no-warnings',
      '--eval',
      'require(\\'expo/bin/autolinking\\')',
      'expo-modules-autolinking',
      'react-native-config',
      '--json',
      '--platform',
      'ios'
    ]
  end

  config = use_native_modules!(config_command)

  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
    # An absolute path to your application root.
    :app_path => "#{Pod::Config.instance.installation_root}/..",
    :privacy_file_aggregation_enabled => podfile_properties['apple.privacyManifestAggregationEnabled'] != 'false',
  )

end
`;

// ---------------------------------------------------------------------------
// Small pbxproj helpers (modeled on the expo-widgets plugin's approach).
// ---------------------------------------------------------------------------

/** Strip one layer of pbxproj quoting/escaping from a stored string value. */
function unquote(value) {
  const s = String(value ?? '');
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function findFileRef(xcodeProject, wantedPath) {
  const section = xcodeProject.pbxFileReferenceSection();
  for (const key of Object.keys(section)) {
    if (key.endsWith('_comment')) continue;
    const ref = section[key];
    if (ref && unquote(ref.path) === wantedPath) return key;
  }
  return null;
}

/** Add a build file for an EXISTING file ref to one of the target's phases,
 *  with its own PBXBuildFile uuid (Xcode creates one per target membership —
 *  reusing the main target's build file uuid across targets is not valid). */
function addSharedFileToPhase(xcodeProject, { fileRef, basename, group, targetUuid, addToPhase }) {
  const buildFile = {
    uuid: xcodeProject.generateUuid(),
    fileRef,
    basename,
    group,
    target: targetUuid,
  };
  xcodeProject.addToPbxBuildFileSection(buildFile);
  addToPhase(buildFile);
  return buildFile;
}

function getBuildPhaseByName(xcodeProject, targetUuid, isa, name) {
  const target = xcodeProject.pbxNativeTargetSection()[targetUuid];
  const section = xcodeProject.hash.project.objects[isa] || {};
  for (const entry of target.buildPhases || []) {
    const obj = section[entry.value];
    if (obj && unquote(obj.name) === name) return obj;
  }
  return null;
}

/** Read the main target's "Bundle React Native code and images" phase so the
 *  clip's phase is an exact copy (the ENTRY_FILE build setting is what makes
 *  it bundle clip/index.tsx instead of the expo-router entry). */
function getMainBundlePhase(xcodeProject, mainTargetUuid) {
  const phase = getBuildPhaseByName(
    xcodeProject,
    mainTargetUuid,
    'PBXShellScriptBuildPhase',
    'Bundle React Native code and images'
  );
  if (!phase) return null;
  const script = unquote(phase.shellScript);
  if (!script.includes('react-native-xcode.sh')) return null;
  return {
    shellScript: script,
    shellPath: unquote(phase.shellPath) || '/bin/sh',
    inputPaths: Array.isArray(phase.inputPaths) ? phase.inputPaths : [],
    outputPaths: Array.isArray(phase.outputPaths) ? phase.outputPaths : [],
  };
}

function setReleaseProfileSpecifier(xcodeProject, targetUuid, profileName) {
  const target = xcodeProject.pbxNativeTargetSection()[targetUuid];
  if (!target) return;
  const list = xcodeProject.pbxXCConfigurationList()[target.buildConfigurationList];
  if (!list) return;
  for (const cfg of list.buildConfigurations || []) {
    const conf = xcodeProject.pbxXCBuildConfigurationSection()[cfg.value];
    if (conf && conf.name === 'Release') {
      conf.buildSettings.PROVISIONING_PROFILE_SPECIFIER = `"${profileName}"`;
    }
  }
}

// ---------------------------------------------------------------------------
// Mod 1: write the clip's Info.plist + entitlements into ios/ at prebuild.
// ---------------------------------------------------------------------------
const withAppClipFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const clipDir = path.join(config.modRequest.platformProjectRoot, CLIP_TARGET_NAME);
      fs.mkdirSync(clipDir, { recursive: true });
      fs.writeFileSync(path.join(clipDir, 'Info.plist'), CLIP_INFO_PLIST, 'utf8');
      fs.writeFileSync(
        path.join(clipDir, `${CLIP_TARGET_NAME}.entitlements`),
        CLIP_ENTITLEMENTS,
        'utf8'
      );
      // The clip's own app icon (ASC validates the clip as its own bundle:
      // no icon set -> 90022/90023/90713). Copy the main app icon into the
      // clip's asset catalog; Xcode derives the smaller sizes at build
      // time, exactly as for the main app's 1024-only set.
      const iconSrc = config.icon
        ? path.resolve(config.modRequest.projectRoot, config.icon)
        : null;
      const appiconDir = path.join(clipDir, 'Images.xcassets', 'AppIcon.appiconset');
      fs.mkdirSync(appiconDir, { recursive: true });
      if (iconSrc && fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, path.join(appiconDir, 'App-Icon-1024x1024@1x.png'));
      }
      fs.writeFileSync(path.join(appiconDir, 'Contents.json'), CLIP_APPICON_CONTENTS_JSON, 'utf8');
      return config;
    },
  ]);

// ---------------------------------------------------------------------------
// Mod 2: append the clip target block to the Podfile.
// ---------------------------------------------------------------------------
const withAppClipPodfile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let content = fs.readFileSync(podfilePath, 'utf8');
      if (!content.includes(`target "${CLIP_TARGET_NAME}" do`)) {
        content += PODFILE_CLIP_TARGET;
        fs.writeFileSync(podfilePath, content, 'utf8');
      }
      return config;
    },
  ]);

// ---------------------------------------------------------------------------
// Mod 3: add the App Clip target to the Xcode project.
// ---------------------------------------------------------------------------
const withAppClipXcodeProject = (config) =>
  withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const mainTargetUuid = xcodeProject.getFirstTarget().uuid;

    // Idempotent: prebuild regenerates the project, but a second plugin pass
    // on an already-modified project must not duplicate the target.
    if (xcodeProject.findTargetKey(CLIP_TARGET_NAME)) return config;

    const marketingVersion = config.ios?.version ?? config.version ?? '1.0';
    const currentProjectVersion = config.ios?.buildNumber ?? '1';
    const deploymentTarget = config.ios?.deploymentTarget ?? '16.4';

    // --- Build configurations for the clip target ---
    const commonSettings = {
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      PRODUCT_BUNDLE_IDENTIFIER: `"${CLIP_BUNDLE_ID}"`,
      INFOPLIST_FILE: `${CLIP_TARGET_NAME}/Info.plist`,
      CODE_SIGN_ENTITLEMENTS: `"${CLIP_TARGET_NAME}/${CLIP_TARGET_NAME}.entitlements"`,
      IPHONEOS_DEPLOYMENT_TARGET: `"${deploymentTarget}"`,
      // Xcode requires the clip's UIDeviceFamily to EQUAL the parent app's
      // (Universal 1,2 here) — iPhone-only '"1"' fails ValidateEmbeddedBinary
      // at archive (Rewards run 50, Nov 10 2026). A universal clip must meet
      // ASC's iPad rules: full icon set, all-four iPad orientations, and an
      // iPad launch screen — all three are in the clip's Info.plist/icon set.
      TARGETED_DEVICE_FAMILY: '"1,2"',
      // The clip's own icon set (written by withAppClipFiles). Without
      // this, the clip bundle has no icon at all (90022/90713).
      ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
      SWIFT_VERSION: '5.0',
      SWIFT_OBJC_BRIDGING_HEADER: `"${MAIN_TARGET_DIR}/${MAIN_TARGET_DIR}-Bridging-Header.h"`,
      CLANG_ENABLE_MODULES: 'YES',
      MARKETING_VERSION: `"${marketingVersion}"`,
      CURRENT_PROJECT_VERSION: `"${currentProjectVersion}"`,
      VERSIONING_SYSTEM: '"apple-generic"',
      LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"'],
      OTHER_LDFLAGS: ['"$(inherited)"', '"-ObjC"', '"-lc++"'],
      // The per-target JS entry: the shared bundle script only resolves the
      // expo-router entry when ENTRY_FILE is unset, so this is what makes
      // the clip bundle clip/index.tsx. Absolute via $(PROJECT_DIR) so the
      // script's working directory can't mis-resolve it.
      ENTRY_FILE: '"$(PROJECT_DIR)/../clip/index.tsx"',
    };
    const debugSettings = { ...commonSettings, SWIFT_OPTIMIZATION_LEVEL: '"-Onone"' };
    const releaseSettings = {
      ...commonSettings,
      PROVISIONING_PROFILE_SPECIFIER: `"${CLIP_PROFILE_NAME}"`,
    };
    const xcConfigList = xcodeProject.addXCConfigurationList(
      [
        { name: 'Debug', isa: 'XCBuildConfiguration', buildSettings: debugSettings },
        { name: 'Release', isa: 'XCBuildConfiguration', buildSettings: releaseSettings },
      ],
      'Release',
      `Build configuration list for PBXNativeTarget "${CLIP_TARGET_NAME}"`
    );

    // --- Product file + native target ---
    const productFile = xcodeProject.addProductFile(CLIP_TARGET_NAME, {
      basename: `${CLIP_TARGET_NAME}.app`,
      group: 'Embed App Clips',
      explicitFileType: 'wrapper.application',
      settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
      includeInIndex: 0,
      path: `${CLIP_TARGET_NAME}.app`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    });
    const targetUuid = xcodeProject.generateUuid();
    const target = {
      uuid: targetUuid,
      pbxNativeTarget: {
        isa: 'PBXNativeTarget',
        name: CLIP_TARGET_NAME,
        productName: CLIP_TARGET_NAME,
        productReference: productFile.fileRef,
        productType: '"com.apple.product-type.application.on-demand-install-capable"',
        buildConfigurationList: xcConfigList.uuid,
        buildPhases: [],
        buildRules: [],
        dependencies: [],
      },
    };
    xcodeProject.addToPbxNativeTargetSection(target);

    // Register the target on the project + TargetAttributes (as Xcode does).
    xcodeProject.addToPbxProjectSection(target);
    const project = xcodeProject.pbxProjectSection()[xcodeProject.getFirstProject().uuid];
    if (!project.attributes.TargetAttributes) project.attributes.TargetAttributes = {};
    project.attributes.TargetAttributes[targetUuid] = { LastSwiftMigration: 1250 };

    // Building the main target builds the clip first. The fresh Expo
    // project has no PBXTargetDependency / PBXContainerItemProxy sections
    // at all, and xcode's addTargetDependency silently no-ops when they
    // are missing — so create them first (this also affects the widgets
    // plugin's dependency, which hits the same silent skip).
    const objects = xcodeProject.hash.project.objects;
    objects.PBXTargetDependency ??= {};
    objects.PBXContainerItemProxy ??= {};
    xcodeProject.addTargetDependency(mainTargetUuid, [targetUuid]);

    // PBXGroup for the clip's own files (Info.plist + entitlements).
    const { uuid: groupUuid } = xcodeProject.addPbxGroup(
      ['Info.plist', `${CLIP_TARGET_NAME}.entitlements`],
      CLIP_TARGET_NAME,
      CLIP_TARGET_NAME
    );
    const groups = xcodeProject.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(groupUuid, key);
      }
    });

    // --- Build phases for the clip target ---
    // Sources: the shared AppDelegate.swift (same file, its own build file).
    xcodeProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
    const appDelegateRef = findFileRef(xcodeProject, `${MAIN_TARGET_DIR}/AppDelegate.swift`);
    if (!appDelegateRef) {
      throw new Error(
        `withAppClip: could not find ${MAIN_TARGET_DIR}/AppDelegate.swift in the Xcode project`
      );
    }
    addSharedFileToPhase(xcodeProject, {
      fileRef: appDelegateRef,
      basename: 'AppDelegate.swift',
      group: 'Sources',
      targetUuid,
      addToPhase: (f) => xcodeProject.addToPbxSourcesBuildPhase(f),
    });

    // Frameworks (empty — pods link via the xcconfig) and Resources.
    xcodeProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);
    xcodeProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    const privacyRef = findFileRef(xcodeProject, `${MAIN_TARGET_DIR}/PrivacyInfo.xcprivacy`);
    if (privacyRef) {
      addSharedFileToPhase(xcodeProject, {
        fileRef: privacyRef,
        basename: 'PrivacyInfo.xcprivacy',
        group: 'Resources',
        targetUuid,
        addToPhase: (f) => xcodeProject.addToPbxResourcesBuildPhase(f),
      });
    }

    // The clip's own asset catalog (its app icon, written by
    // withAppClipFiles) — into the clip's Resources phase so it lands in
    // the clip bundle. addResourceFile can't be used here: it crashes in
    // node-xcode's correctForResourcesPath when the project has no PBXGroup
    // named "Resources" (Expo projects don't). So create the file ref with
    // addFile and attach it to the phase the same way PrivacyInfo is.
    const xcassetsFile = xcodeProject.addFile(
      `${CLIP_TARGET_NAME}/Images.xcassets`,
      groupUuid
    );
    if (xcassetsFile) {
      // addFile stores the full relative path, but the clip's PBXGroup
      // already carries path = HustleHeartMotivationClip, so the full path
      // resolves doubled (…/HustleHeartMotivationClip/HustleHeartMotivationClip/…)
      // and actool can't find the AppIcon set (archive failed on this,
      // Nov 10, 2026). The clip's other files use bare basenames in this
      // group — match that.
      const xcassetsRef = xcodeProject.pbxFileReferenceSection()[xcassetsFile.fileRef];
      if (xcassetsRef) xcassetsRef.path = '"Images.xcassets"';
      addSharedFileToPhase(xcodeProject, {
        fileRef: xcassetsFile.fileRef,
        basename: xcassetsFile.basename,
        group: 'Resources',
        targetUuid,
        addToPhase: (f) => xcodeProject.addToPbxResourcesBuildPhase(f),
      });
    }

    // Bundle script: an exact copy of the main target's phase. ENTRY_FILE
    // (set above as a build setting) is what swaps in the clip entry.
    const mainBundle = getMainBundlePhase(xcodeProject, mainTargetUuid);
    const bundleScript = mainBundle ? mainBundle.shellScript : FALLBACK_BUNDLE_SCRIPT;
    xcodeProject.addBuildPhase([], 'PBXShellScriptBuildPhase', 'Bundle React Native code and images', targetUuid, {
      shellPath: mainBundle ? mainBundle.shellPath : '/bin/sh',
      shellScript: bundleScript,
      inputPaths: mainBundle ? mainBundle.inputPaths : ['$(SRCROOT)/.xcode.env', '$(SRCROOT)/.xcode.env.local'],
      outputPaths: mainBundle ? mainBundle.outputPaths : [],
    });
    const clipTarget = xcodeProject.pbxNativeTargetSection()[targetUuid];
    const bundlePhaseEntry = clipTarget.buildPhases[clipTarget.buildPhases.length - 1];
    const bundlePhase =
      xcodeProject.hash.project.objects.PBXShellScriptBuildPhase[bundlePhaseEntry.value];
    if (bundlePhase) bundlePhase.alwaysOutOfDate = 1;

    // --- Embed the clip in the main app ---
    if (!xcodeProject.pbxBuildFileSection()[productFile.uuid]) {
      xcodeProject.addToPbxBuildFileSection(productFile);
    }
    xcodeProject.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      'Embed App Clips',
      mainTargetUuid,
      'dynamic_library',
      '"$(CONTENTS_FOLDER_PATH)/AppClips"'
    );
    const embedPhase = getBuildPhaseByName(
      xcodeProject,
      mainTargetUuid,
      'PBXCopyFilesBuildPhase',
      'Embed App Clips'
    );
    if (embedPhase && !embedPhase.files.some((f) => f.value === productFile.uuid)) {
      embedPhase.files.push({
        value: productFile.uuid,
        comment: `${CLIP_TARGET_NAME}.app in Embed App Clips`,
      });
    }

    // --- Per-target Release profiles (see header: the workflow must NOT
    // pass PROVISIONING_PROFILE_SPECIFIER on the command line, or it would
    // force the clip onto the main app's profile). ---
    setReleaseProfileSpecifier(xcodeProject, mainTargetUuid, MAIN_PROFILE_NAME);
    setReleaseProfileSpecifier(xcodeProject, targetUuid, CLIP_PROFILE_NAME);

    return config;
  });

const withAppClip = (config) => {
  config = withAppClipFiles(config);
  config = withAppClipPodfile(config);
  config = withAppClipXcodeProject(config);
  return config;
};

module.exports = createRunOncePlugin(withAppClip, 'with-app-clip', '1.0.0');
