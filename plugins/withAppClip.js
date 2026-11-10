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
 * Clip UI: plugins/app-clip/ClipApp.swift + ContentView.swift — a tiny,
 *   dependency-free SwiftUI app (today's quote + Get the Full App overlay).
 *   It does NOT embed React Native: the first clip shared the main target's
 *   AppDelegate and pods and came out 40 MB thinned, over Apple's 15 MB App
 *   Clip limit (ITMS-90865, Nov 10 2026). A React Native clip cannot fit
 *   under 15 MB — do NOT re-add RN to the clip target.
 *
 * What the plugin does at prebuild time:
 *   1. Writes ios/HustleHeartMotivationClip/Info.plist + .entitlements
 *      (parent-application-identifiers + on-demand-install-capable +
 *      associated-domains applinks:beatrackfam.info), the
 *      AppIcon asset catalog, and the two SwiftUI source files.
 *   2. Adds the HustleHeartMotivationClip native target
 *      (product type com.apple.product-type.application.on-demand-install-capable)
 *      with Sources (ClipApp.swift + ContentView.swift), Frameworks
 *      (StoreKit, for the App Store overlay), and Resources (the asset
 *      catalog + shared PrivacyInfo.xcprivacy). No bundle script, no JS
 *      entry, no pods for the clip.
 *   3. Adds an "Embed App Clips" copy phase to the main target and makes the
 *      main target depend on the clip, so `xcodebuild archive` of the main
 *      scheme builds the clip and embeds it at AppClips/ inside the .app.
 *   4. Sets the Release PROVISIONING_PROFILE_SPECIFIER per target in the
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
 * Experience. The `applinks:beatrackfam.info` associated domain IS now in the
 * clip entitlements (written by this plugin at prebuild); the clip App ID in
 * the portal still needs Associated Domains enabled for it to take effect.
 * Adding invocation needs: (a) the `appclips:beatrackfam.info`
 * associated-domain entitlement on the clip (and the App ID), (b) the AASA
 * file with an `appclips` section, (c) an App Clip Experience configured in
 * App Store Connect under the parent app.
 *
 * SIZE: App Clips must be under 15 MB thinned. The first (React Native)
 * clip was 40 MB and Apple rejected it (ITMS-90865, Nov 10 2026). This
 * SwiftUI clip has no RN runtime, no pods, and no JS bundle — the same
 * shape as the main app's and Rewards' clips, which are a few MB.
 */
const { withXcodeProject, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CLIP_TARGET_NAME = 'HustleHeartMotivationClip';
const CLIP_BUNDLE_ID = 'com.beatrackfaminc.motivation.HustleandHeartMotivation';
const CLIP_PROFILE_NAME = 'BeaTrackFam Motivation App Clip';
const MAIN_PROFILE_NAME = 'BeaTrackFam Motivation App Store';
const MAIN_TARGET_DIR = 'HustleHeartMotivation';

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
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:beatrackfam.info</string>
	</array>
</dict>
</plist>
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
      // The clip's SwiftUI sources (plugins/app-clip/ templates — the
      // source of truth; the generated copies are disposable).
      const templatesDir = path.join(config.modRequest.projectRoot, 'plugins', 'app-clip');
      for (const file of ['ClipApp.swift', 'ContentView.swift']) {
        fs.copyFileSync(path.join(templatesDir, file), path.join(clipDir, file));
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
      CLANG_ENABLE_MODULES: 'YES',
      MARKETING_VERSION: `"${marketingVersion}"`,
      CURRENT_PROJECT_VERSION: `"${currentProjectVersion}"`,
      VERSIONING_SYSTEM: '"apple-generic"',
      LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"'],
      OTHER_LDFLAGS: ['"$(inherited)"'],
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
    // Sources: the clip's own SwiftUI files (written by withAppClipFiles).
    // addSourceFile stores the full relative path, but the clip's PBXGroup
    // already carries path = HustleHeartMotivationClip, so the full path
    // resolves doubled — use bare basenames in this group (same bug as the
    // main clip's sources, Nov 10 2026).
    xcodeProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetUuid);
    for (const swiftFile of ['ClipApp.swift', 'ContentView.swift']) {
      const added = xcodeProject.addSourceFile(
        `${CLIP_TARGET_NAME}/${swiftFile}`,
        { target: targetUuid },
        groupUuid
      );
      if (added && added.fileRef) {
        const ref = xcodeProject.pbxFileReferenceSection()[added.fileRef];
        if (ref) ref.path = `"${swiftFile}"`;
      }
    }

    // Frameworks: StoreKit only (App Store overlay in ContentView).
    xcodeProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetUuid);
    xcodeProject.addFramework('StoreKit.framework', { target: targetUuid });
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
  config = withAppClipXcodeProject(config);
  return config;
};

module.exports = createRunOncePlugin(withAppClip, 'with-app-clip', '1.0.0');
