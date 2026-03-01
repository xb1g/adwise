# iOS Build Fix Summary

## Issues Fixed

The iOS build was failing due to several compatibility issues with native modules:

1. **New Architecture (Fabric) Incompatibility** - Disabled in both `app.json` and `ios/Podfile.properties.json`
   - Error: Swift interface mismatches with `EXFileSystemInterface`
   - Solution: The new architecture is still experimental in Expo SDK 54; using the legacy architecture is more stable

2. **expo-file-system Version Incompatibility** - Downgraded from ^55.0.10 to ~15.0.1
   - Error: `value of type 'any EXFileSystemInterface' has no member 'getPathPermissions'`
   - The 55.x version is too new for Expo SDK 54 compatibility
   - Solution: Use a stable version compatible with your SDK

## Changes Made

### 1. `/Users/bunyasit/dev/adwise/app.json`
```json
- "newArchEnabled": true,
+ "newArchEnabled": false,
```

### 2. `/Users/bunyasit/dev/adwise/ios/Podfile.properties.json`
```json
- "newArchEnabled": "true"
+ "newArchEnabled": "false"
```

### 3. `/Users/bunyasit/dev/adwise/package.json`
```json
- "expo-file-system": "^55.0.10",
+ "expo-file-system": "~15.0.1",
```

## Next Steps

Run the clean rebuild script to update dependencies:

```bash
bash /Users/bunyasit/dev/adwise/clean-rebuild.sh
```

This will:
1. Remove old pods and build artifacts
2. Clear Xcode's derived data
3. Reinstall npm/pnpm dependencies
4. Reinstall iOS pods with the correct versions

Then rebuild:

```bash
cd /Users/bunyasit/dev/adwise
eas build --platform ios --profile development
```

Or for local testing:
```bash
pnpm ios
```
