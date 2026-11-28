/**
 * Expo config plugin: with-tvos-signing
 *
 * tvOS rollout (Nov 27, 2026, replicating the Flight Journal pilot).
 * Applies ONLY when EXPO_TV=1 (the tvOS workflow's prebuild); a complete
 * no-op for iOS/Android/macOS/web, so iOS prebuild output is unchanged.
 *
 * WHY: @react-native-tvos/config-tv converts the generated ios/ project
 * to tvOS in place (SDKROOT=appletvos, TARGETED_DEVICE_FAMILY=3,
 * Podfile platform :tvos) but says nothing about signing. The Mac/iOS
 * signing discipline for this repo is: manual signing, and the
 * provisioning profile scoped IN THE PROJECT on the app target's
 * Release configuration — NEVER passed on the xcodebuild command line
 * (a command-line PROVISIONING_PROFILE_SPECIFIER applies to every
 * target, including SPM/CocoaPods targets that cannot carry profiles;
 * the macOS build failed exactly that way in the sister apps).
 *
 * The tvOS profile shares the iOS profile NAME in the portal
 * ("Hustle And Heart Motivation", tvOS platform), so the same specifier
 * string is correct for the converted tvOS target. Note the spelling:
 * "And", matching plugins/withAppClip.js's MAIN_PROFILE_NAME — NOT the
 * Mac profile's "&" spelling.
 *
 * This plugin is registered AFTER @react-native-tvos/config-tv in
 * app.json so its Xcode-project mod runs on the already-converted
 * project. It survives prebuild regeneration because it IS a prebuild
 * plugin — the workflow never hand-patches the generated project.
 */
const { withXcodeProject, createRunOncePlugin } = require('@expo/config-plugins');

const TV_PROFILE_NAME = 'Hustle And Heart Motivation';
const DEVELOPMENT_TEAM = '4ZLR77R534';

const withTvosSigning = (config) => {
  if (process.env.EXPO_TV !== '1' && process.env.EXPO_TV !== 'true') {
    return config;
  }
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const mainTargetUuid = project.getFirstTarget().uuid;
    const target = project.pbxNativeTargetSection()[mainTargetUuid];
    if (!target) return config;
    const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
    if (!list) return config;
    for (const cfg of list.buildConfigurations || []) {
      const conf = project.pbxXCBuildConfigurationSection()[cfg.value];
      if (!conf) continue;
      conf.buildSettings.CODE_SIGN_STYLE = 'Manual';
      conf.buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
      if (conf.name === 'Release') {
        conf.buildSettings.PROVISIONING_PROFILE_SPECIFIER = `"${TV_PROFILE_NAME}"`;
      }
    }
    return config;
  });
};

module.exports = createRunOncePlugin(withTvosSigning, 'with-tvos-signing', '1.0.0');
