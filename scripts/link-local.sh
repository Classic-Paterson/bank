#!/bin/bash

# Banking CLI Local Link Script
# This script builds the project and links it globally for local development

set -e  # Exit on any error

echo "🏗️  Building the banking CLI..."
npm run build

echo "🔗 Linking globally..."
npm link

echo "📋 Testing the installation..."
if command -v bank &> /dev/null; then
    echo "✅ Success! Banking CLI is now available globally."
    echo ""
    echo "🚀 You can now use:"
    echo "   bank --help"
    echo "   bank accounts"
    echo "   bank transactions"
    echo "   bank settings"
    echo ""
    echo "📍 CLI version:"
    bank --version
else
    echo "❌ Something went wrong. The 'bank' command is not available."
    echo "💡 Try running 'npm link' manually or check your PATH."
    exit 1
fi

echo ""
echo "🧹 To unlink later, run: npm unlink -g bank"
