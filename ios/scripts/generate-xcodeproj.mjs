#!/usr/bin/env node
/**
 * Write ios/Disha.xcodeproj from the files on disk.
 *   node ios/scripts/generate-xcodeproj.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ios = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const id = (key) => createHash("md5").update(key).digest("hex").slice(0, 24).toUpperCase();

const sources = readdirSync(resolve(ios, "Disha/Sources")).filter((name) => name.endsWith(".swift")).sort();
const tests = readdirSync(resolve(ios, "DishaTests")).filter((name) => name.endsWith(".swift")).sort();
const resourceDir = resolve(ios, "Disha/Resources");
const resourceNames = readdirSync(resourceDir)
  .filter((name) => !name.startsWith(".") && statSync(resolve(resourceDir, name)).isFile())
  .sort();
const fontDir = resolve(ios, "Disha/Resources/Fonts");
const fontNames = readdirSync(fontDir)
  .filter((name) => !name.startsWith(".") && statSync(resolve(fontDir, name)).isFile())
  .sort();

const app = id("target:Disha");
const test = id("target:DishaTests");
const project = id("project");
const mainGroup = id("group:main");
const dishaGroup = id("group:Disha");
const sourcesGroup = id("group:Sources");
const resourcesGroup = id("group:Resources");
const fontsGroup = id("group:Fonts");
const testsGroup = id("group:Tests");
const productsGroup = id("group:Products");
const appProduct = id("product:Disha.app");
const testProduct = id("product:DishaTests.xctest");
const appSourcesPhase = id("phase:app-sources");
const appResourcesPhase = id("phase:app-resources");
const appFrameworksPhase = id("phase:app-frameworks");
const testSourcesPhase = id("phase:test-sources");
const testFrameworksPhase = id("phase:test-frameworks");
const proxy = id("proxy");
const dependency = id("dependency");
const variant = id("variant:InfoPlist");
const assets = id("file:Assets");
const plist = id("file:Info.plist");
const privacy = id("file:Privacy");
const enStrings = id("file:en-strings");
const hiStrings = id("file:hi-strings");

const projectList = id("configList:project");
const appList = id("configList:app");
const testList = id("configList:test");
const configs = {
  projectDebug: id("config:project-debug"),
  projectRelease: id("config:project-release"),
  appDebug: id("config:app-debug"),
  appRelease: id("config:app-release"),
  testDebug: id("config:test-debug"),
  testRelease: id("config:test-release"),
};

function fileRef(key, name, type) {
  return { ref: id(`file:${key}`), build: id(`build:${key}`), name, type };
}

const swiftFiles = sources.map((name) => fileRef(`src:${name}`, name, "sourcecode.swift"));
const testFiles = tests.map((name) => fileRef(`test:${name}`, name, "sourcecode.swift"));
const dataFiles = resourceNames.map((name) => fileRef(`res:${name}`, name, name.endsWith(".json") ? "text.json" : "text"));
const fontFiles = fontNames.map((name) => fileRef(`font:${name}`, name, name.endsWith(".ttf") ? "file" : "text"));

const lines = [];
const w = (s = "") => lines.push(s);

w("// !$*UTF8*$!");
w("{");
w("\tarchiveVersion = 1;");
w("\tclasses = {");
w("\t};");
w("\tobjectVersion = 56;");
w("\tobjects = {");
w("");
w("/* Begin PBXBuildFile section */");
for (const file of [...swiftFiles, ...dataFiles, ...fontFiles]) {
  w(`\t\t${file.build} /* ${file.name} in Sources */ = {isa = PBXBuildFile; fileRef = ${file.ref} /* ${file.name} */; };`);
}
for (const file of testFiles) {
  w(`\t\t${file.build} /* ${file.name} in Sources */ = {isa = PBXBuildFile; fileRef = ${file.ref} /* ${file.name} */; };`);
}
w(`\t\t${id("build:assets")} /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = ${assets} /* Assets.xcassets */; };`);
w(`\t\t${id("build:privacy")} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${privacy} /* PrivacyInfo.xcprivacy */; };`);
w(`\t\t${id("build:strings")} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${variant} /* InfoPlist.strings */; };`);
w("/* End PBXBuildFile section */");
w("");
w("/* Begin PBXContainerItemProxy section */");
w(`\t\t${proxy} /* PBXContainerItemProxy */ = {`);
w("\t\t\tisa = PBXContainerItemProxy;");
w(`\t\t\tcontainerPortal = ${project} /* Project object */;`);
w("\t\t\tproxyType = 1;");
w(`\t\t\tremoteGlobalIDString = ${app};`);
w("\t\t\tremoteInfo = Disha;");
w("\t\t};");
w("/* End PBXContainerItemProxy section */");
w("");
w("/* Begin PBXFileReference section */");
w(`\t\t${id("file:storekit")} /* Disha.storekit */ = {isa = PBXFileReference; lastKnownFileType = text; path = Disha.storekit; sourceTree = "<group>"; };`);
w(`\t\t${appProduct} /* Disha.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Disha.app; sourceTree = BUILT_PRODUCTS_DIR; };`);
w(`\t\t${testProduct} /* DishaTests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = DishaTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };`);
w(`\t\t${assets} /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };`);
w(`\t\t${plist} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };`);
w(`\t\t${privacy} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`);
w(`\t\t${enStrings} /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/InfoPlist.strings; sourceTree = "<group>"; };`);
w(`\t\t${hiStrings} /* hi */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = hi; path = hi.lproj/InfoPlist.strings; sourceTree = "<group>"; };`);
for (const file of swiftFiles) {
  w(`\t\t${file.ref} /* ${file.name} */ = {isa = PBXFileReference; lastKnownFileType = ${file.type}; path = ${file.name}; sourceTree = "<group>"; };`);
}
for (const file of testFiles) {
  w(`\t\t${file.ref} /* ${file.name} */ = {isa = PBXFileReference; lastKnownFileType = ${file.type}; path = ${file.name}; sourceTree = "<group>"; };`);
}
for (const file of [...dataFiles, ...fontFiles]) {
  w(`\t\t${file.ref} /* ${file.name} */ = {isa = PBXFileReference; lastKnownFileType = ${file.type}; path = ${file.name}; sourceTree = "<group>"; };`);
}
w("/* End PBXFileReference section */");
w("");
w("/* Begin PBXFrameworksBuildPhase section */");
w(`\t\t${appFrameworksPhase} /* Frameworks */ = {`);
w("\t\t\tisa = PBXFrameworksBuildPhase;");
w("\t\t\tbuildActionMask = 2147483647;");
w("\t\t\tfiles = (");
w("\t\t\t);");
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;");
w("\t\t};");
w(`\t\t${testFrameworksPhase} /* Frameworks */ = {`);
w("\t\t\tisa = PBXFrameworksBuildPhase;");
w("\t\t\tbuildActionMask = 2147483647;");
w("\t\t\tfiles = (");
w("\t\t\t);");
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;");
w("\t\t};");
w("/* End PBXFrameworksBuildPhase section */");
w("");
w("/* Begin PBXGroup section */");
w(`\t\t${mainGroup} = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
w(`\t\t\t\t${dishaGroup} /* Disha */,`);
w(`\t\t\t\t${id("file:storekit")} /* Disha.storekit */,`);
w(`\t\t\t\t${testsGroup} /* DishaTests */,`);
w(`\t\t\t\t${productsGroup} /* Products */,`);
w("\t\t\t);");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${dishaGroup} /* Disha */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
w(`\t\t\t\t${sourcesGroup} /* Sources */,`);
w(`\t\t\t\t${resourcesGroup} /* Resources */,`);
w(`\t\t\t\t${assets} /* Assets.xcassets */,`);
w(`\t\t\t\t${plist} /* Info.plist */,`);
w(`\t\t\t\t${privacy} /* PrivacyInfo.xcprivacy */,`);
w(`\t\t\t\t${variant} /* InfoPlist.strings */,`);
w("\t\t\t);");
w("\t\t\tpath = Disha;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${sourcesGroup} /* Sources */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
for (const file of swiftFiles) w(`\t\t\t\t${file.ref} /* ${file.name} */,`);
w("\t\t\t);");
w("\t\t\tpath = Sources;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${resourcesGroup} /* Resources */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
w(`\t\t\t\t${fontsGroup} /* Fonts */,`);
for (const file of dataFiles) w(`\t\t\t\t${file.ref} /* ${file.name} */,`);
w("\t\t\t);");
w("\t\t\tpath = Resources;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${fontsGroup} /* Fonts */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
for (const file of fontFiles) w(`\t\t\t\t${file.ref} /* ${file.name} */,`);
w("\t\t\t);");
w("\t\t\tpath = Fonts;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${testsGroup} /* DishaTests */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
for (const file of testFiles) w(`\t\t\t\t${file.ref} /* ${file.name} */,`);
w("\t\t\t);");
w("\t\t\tpath = DishaTests;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w(`\t\t${productsGroup} /* Products */ = {`);
w("\t\t\tisa = PBXGroup;");
w("\t\t\tchildren = (");
w(`\t\t\t\t${appProduct} /* Disha.app */,`);
w(`\t\t\t\t${testProduct} /* DishaTests.xctest */,`);
w("\t\t\t);");
w("\t\t\tname = Products;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w("/* End PBXGroup section */");
w("");
w("/* Begin PBXNativeTarget section */");
w(`\t\t${app} /* Disha */ = {`);
w("\t\t\tisa = PBXNativeTarget;");
w(`\t\t\tbuildConfigurationList = ${appList} /* Build configuration list for PBXNativeTarget "Disha" */;`);
w("\t\t\tbuildPhases = (");
w(`\t\t\t\t${appSourcesPhase} /* Sources */,`);
w(`\t\t\t\t${appFrameworksPhase} /* Frameworks */,`);
w(`\t\t\t\t${appResourcesPhase} /* Resources */,`);
w("\t\t\t);");
w("\t\t\tbuildRules = (");
w("\t\t\t);");
w("\t\t\tdependencies = (");
w("\t\t\t);");
w("\t\t\tname = Disha;");
w("\t\t\tproductName = Disha;");
w(`\t\t\tproductReference = ${appProduct} /* Disha.app */;`);
w("\t\t\tproductType = \"com.apple.product-type.application\";");
w("\t\t};");
w(`\t\t${test} /* DishaTests */ = {`);
w("\t\t\tisa = PBXNativeTarget;");
w(`\t\t\tbuildConfigurationList = ${testList} /* Build configuration list for PBXNativeTarget "DishaTests" */;`);
w("\t\t\tbuildPhases = (");
w(`\t\t\t\t${testSourcesPhase} /* Sources */,`);
w(`\t\t\t\t${testFrameworksPhase} /* Frameworks */,`);
w("\t\t\t);");
w("\t\t\tbuildRules = (");
w("\t\t\t);");
w("\t\t\tdependencies = (");
w(`\t\t\t\t${dependency} /* PBXTargetDependency */,`);
w("\t\t\t);");
w("\t\t\tname = DishaTests;");
w("\t\t\tproductName = DishaTests;");
w(`\t\t\tproductReference = ${testProduct} /* DishaTests.xctest */;`);
w("\t\t\tproductType = \"com.apple.product-type.bundle.unit-test\";");
w("\t\t};");
w("/* End PBXNativeTarget section */");
w("");
w("/* Begin PBXProject section */");
w(`\t\t${project} /* Project object */ = {`);
w("\t\t\tisa = PBXProject;");
w("\t\t\tattributes = {");
w("\t\t\t\tBuildIndependentTargetsInParallel = 1;");
w("\t\t\t\tLastSwiftUpdateCheck = 1600;");
w("\t\t\t\tLastUpgradeCheck = 1600;");
w("\t\t\t\tTargetAttributes = {");
w(`\t\t\t\t\t${test} = {`);
w("\t\t\t\t\t\tTestTargetID = " + app + ";");
w("\t\t\t\t\t};");
w("\t\t\t\t};");
w("\t\t\t};");
w(`\t\t\tbuildConfigurationList = ${projectList} /* Build configuration list for PBXProject "Disha" */;`);
w("\t\t\tcompatibilityVersion = \"Xcode 14.0\";");
w("\t\t\tdevelopmentRegion = en;");
w("\t\t\thasScannedForEncodings = 0;");
w("\t\t\tknownRegions = (");
w("\t\t\t\ten,");
w("\t\t\t\thi,");
w("\t\t\t\tBase,");
w("\t\t\t);");
w(`\t\t\tmainGroup = ${mainGroup};`);
w(`\t\t\tproductRefGroup = ${productsGroup} /* Products */;`);
w("\t\t\tprojectDirPath = \"\";");
w("\t\t\tprojectRoot = \"\";");
w("\t\t\ttargets = (");
w(`\t\t\t\t${app} /* Disha */,`);
w(`\t\t\t\t${test} /* DishaTests */,`);
w("\t\t\t);");
w("\t\t};");
w("/* End PBXProject section */");
w("");
w("/* Begin PBXResourcesBuildPhase section */");
w(`\t\t${appResourcesPhase} /* Resources */ = {`);
w("\t\t\tisa = PBXResourcesBuildPhase;");
w("\t\t\tbuildActionMask = 2147483647;");
w("\t\t\tfiles = (");
w(`\t\t\t\t${id("build:assets")} /* Assets.xcassets in Resources */,`);
w(`\t\t\t\t${id("build:privacy")} /* PrivacyInfo.xcprivacy in Resources */,`);
w(`\t\t\t\t${id("build:strings")} /* InfoPlist.strings in Resources */,`);
for (const file of [...dataFiles, ...fontFiles]) {
  w(`\t\t\t\t${file.build} /* ${file.name} in Resources */,`);
}
w("\t\t\t);");
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;");
w("\t\t};");
w("/* End PBXResourcesBuildPhase section */");
w("");
w("/* Begin PBXSourcesBuildPhase section */");
w(`\t\t${appSourcesPhase} /* Sources */ = {`);
w("\t\t\tisa = PBXSourcesBuildPhase;");
w("\t\t\tbuildActionMask = 2147483647;");
w("\t\t\tfiles = (");
for (const file of swiftFiles) w(`\t\t\t\t${file.build} /* ${file.name} in Sources */,`);
w("\t\t\t);");
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;");
w("\t\t};");
w(`\t\t${testSourcesPhase} /* Sources */ = {`);
w("\t\t\tisa = PBXSourcesBuildPhase;");
w("\t\t\tbuildActionMask = 2147483647;");
w("\t\t\tfiles = (");
for (const file of testFiles) w(`\t\t\t\t${file.build} /* ${file.name} in Sources */,`);
w("\t\t\t);");
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;");
w("\t\t};");
w("/* End PBXSourcesBuildPhase section */");
w("");
w("/* Begin PBXTargetDependency section */");
w(`\t\t${dependency} /* PBXTargetDependency */ = {`);
w("\t\t\tisa = PBXTargetDependency;");
w(`\t\t\ttarget = ${app} /* Disha */;`);
w(`\t\t\ttargetProxy = ${proxy} /* PBXContainerItemProxy */;`);
w("\t\t};");
w("/* End PBXTargetDependency section */");
w("");
w("/* Begin PBXVariantGroup section */");
w(`\t\t${variant} /* InfoPlist.strings */ = {`);
w("\t\t\tisa = PBXVariantGroup;");
w("\t\t\tchildren = (");
w(`\t\t\t\t${enStrings} /* en */,`);
w(`\t\t\t\t${hiStrings} /* hi */,`);
w("\t\t\t);");
w("\t\t\tname = InfoPlist.strings;");
w("\t\t\tsourceTree = \"<group>\";");
w("\t\t};");
w("/* End PBXVariantGroup section */");
w("");

const shared = `
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_VERSION = 5.0;
`.trimEnd();

function xcconfig(cid, name, extra) {
  w(`\t\t${cid} /* ${name} */ = {`);
  w("\t\t\tisa = XCBuildConfiguration;");
  w("\t\t\tbuildSettings = {");
  w(extra);
  w("\t\t\t};");
  w(`\t\t\tname = ${name};`);
  w("\t\t};");
}

w("/* Begin XCBuildConfiguration section */");
xcconfig(configs.projectDebug, "Debug", `${shared}
\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;
\t\t\t\tENABLE_TESTABILITY = YES;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;
\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
\t\t\t\tONLY_ACTIVE_ARCH = YES;
\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";`);
xcconfig(configs.projectRelease, "Release", `${shared}
\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;
\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;
\t\t\t\tVALIDATE_PRODUCT = YES;`);

const appSettings = `
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tENABLE_PREVIEWS = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = Disha/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.ikshanasolutions.disha;
\t\t\t\tPRODUCT_NAME = Disha;
\t\t\t\tSUPPORTED_PLATFORMS = "iphoneos iphonesimulator";
\t\t\t\tSUPPORTS_MACCATALYST = NO;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
`.trimEnd();
xcconfig(configs.appDebug, "Debug", appSettings);
xcconfig(configs.appRelease, "Release", appSettings);

const testSettings = `
\t\t\t\tBUNDLE_LOADER = "$(TEST_HOST)";
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@loader_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.ikshanasolutions.disha.tests;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = NO;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t\tTEST_HOST = "$(BUILT_PRODUCTS_DIR)/Disha.app/Disha";
`.trimEnd();
xcconfig(configs.testDebug, "Debug", testSettings);
xcconfig(configs.testRelease, "Release", testSettings);
w("/* End XCBuildConfiguration section */");
w("");

function list(cid, comment, debug, release) {
  w(`\t\t${cid} /* ${comment} */ = {`);
  w("\t\t\tisa = XCConfigurationList;");
  w("\t\t\tbuildConfigurations = (");
  w(`\t\t\t\t${debug} /* Debug */,`);
  w(`\t\t\t\t${release} /* Release */,`);
  w("\t\t\t);");
  w("\t\t\tdefaultConfigurationIsVisible = 0;");
  w("\t\t\tdefaultConfigurationName = Release;");
  w("\t\t};");
}
w("/* Begin XCConfigurationList section */");
list(projectList, 'Build configuration list for PBXProject "Disha"', configs.projectDebug, configs.projectRelease);
list(appList, 'Build configuration list for PBXNativeTarget "Disha"', configs.appDebug, configs.appRelease);
list(testList, 'Build configuration list for PBXNativeTarget "DishaTests"', configs.testDebug, configs.testRelease);
w("/* End XCConfigurationList section */");
w("\t};");
w(`\trootObject = ${project} /* Project object */;`);
w("}");
w("");

const projDir = resolve(ios, "Disha.xcodeproj");
mkdirSync(projDir, { recursive: true });
writeFileSync(resolve(projDir, "project.pbxproj"), lines.join("\n"));

const schemeDir = resolve(projDir, "xcshareddata/xcschemes");
mkdirSync(schemeDir, { recursive: true });
const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${app}"
               BuildableName = "Disha.app"
               BlueprintName = "Disha"
               ReferencedContainer = "container:Disha.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${test}"
               BuildableName = "DishaTests.xctest"
               BlueprintName = "DishaTests"
               ReferencedContainer = "container:Disha.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${app}"
            BuildableName = "Disha.app"
            BlueprintName = "Disha"
            ReferencedContainer = "container:Disha.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
      <StoreKitConfigurationFileReference
         identifier = "../../../Disha.storekit">
      </StoreKitConfigurationFileReference>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${app}"
            BuildableName = "Disha.app"
            BlueprintName = "Disha"
            ReferencedContainer = "container:Disha.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;
writeFileSync(resolve(schemeDir, "Disha.xcscheme"), scheme);
console.log(`Wrote Disha.xcodeproj with ${sources.length} sources and ${tests.length} test files`);
