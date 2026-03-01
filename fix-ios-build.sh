#!/bin/bash
set -e

echo "🧹 Cleaning up iOS build artifacts..."
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/*adwise*

echo "📦 Installing dependencies with pnpm..."
cd /Users/bunyasit/dev/adwise
pnpm install

echo "🔄 Installing iOS pods..."
cd ios
pod deintegrate 2>/dev/null || true
pod install

echo "✅ iOS build setup complete!"
echo ""
echo "You can now run:"
echo "  pnpm ios"
