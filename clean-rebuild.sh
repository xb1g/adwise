#!/bin/bash
set -e

cd /Users/bunyasit/dev/adwise

echo "🧹 Deep cleaning build artifacts..."
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf node_modules
rm -rf pnpm-lock.yaml

echo "📦 Fresh install with pnpm..."
pnpm install

echo "🔄 Installing iOS pods..."
cd ios
pod install --repo-update

echo "✅ Complete! Ready to build."
echo ""
echo "Next, try:"
echo "  cd /Users/bunyasit/dev/adwise"
echo "  eas build --platform ios --profile development"
