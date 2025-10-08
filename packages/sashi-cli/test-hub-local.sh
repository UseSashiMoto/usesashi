#!/bin/bash

# Test script for hub registration with local development server
# Usage: ./test-hub-local.sh [hub-url]

HUB_URL=${1:-"http://localhost:3004"}

echo "🧪 Testing Sashi CLI Hub Registration"
echo "Hub URL: $HUB_URL"
echo "========================================"

# Ensure CLI is built
if [ ! -f "dist-simple/simple-index.js" ]; then
    echo "📦 Building CLI..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please fix build errors first."
        exit 1
    fi
fi

# Test 1: Setup command with hub registration
echo ""
echo "🔧 Test 1: Setup command with hub registration"
echo "Creating test directory..."
mkdir -p test-setup-hub
cd test-setup-hub

# Create a basic package.json
cat > package.json << EOF
{
  "name": "test-setup-hub",
  "version": "1.0.0",
  "description": "Test project for hub registration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
EOF

echo "Running setup with hub registration..."
echo "(This will prompt for hub registration if no API key is provided)"
../dist-simple/simple-index.js setup --hub-url "$HUB_URL" --framework nodejs

# Check if files were created
if [ -f ".env.local" ]; then
    echo "✅ .env.local created"
    echo "Contents:"
    cat .env.local
else
    echo "❌ .env.local not created"
fi

if [ -f "sashi.config.js" ]; then
    echo "✅ sashi.config.js created"
else
    echo "❌ sashi.config.js not created"
fi

cd ..

# Test 2: Init command with hub registration
echo ""
echo "🚀 Test 2: Init command with hub registration"
echo "Cleaning up previous test project..."
rm -rf test-project-hub

echo "Creating new project with hub registration..."
./dist-simple/simple-index.js init test-project-hub --hub-url "$HUB_URL" --framework nodejs

# Check if project was created
if [ -d "test-project-hub" ]; then
    echo "✅ Project directory created"
    cd test-project-hub
    
    if [ -f ".env.local" ]; then
        echo "✅ .env.local created in project"
        echo "Contents:"
        cat .env.local
    else
        echo "❌ .env.local not created in project"
    fi
    
    if [ -f "sashi.config.js" ]; then
        echo "✅ sashi.config.js created in project"
    else
        echo "❌ sashi.config.js not created in project"
    fi
    
    cd ..
else
    echo "❌ Project directory not created"
fi

# Test 3: Test with existing API key (should skip hub registration)
echo ""
echo "🔑 Test 3: Setup with existing API key (should skip hub registration)"
mkdir -p test-with-key
cd test-with-key

cat > package.json << EOF
{
  "name": "test-with-key",
  "version": "1.0.0"
}
EOF

echo "Running setup with existing API key..."
../dist-simple/simple-index.js setup --api-key "test-openai-key" --hub-url "$HUB_URL" --framework nodejs

if [ -f ".env.local" ]; then
    echo "✅ .env.local created with provided API key"
    if grep -q "test-openai-key" .env.local; then
        echo "✅ API key correctly set in .env.local"
    else
        echo "❌ API key not found in .env.local"
    fi
else
    echo "❌ .env.local not created"
fi

cd ..

echo ""
echo "🧹 Cleaning up test directories..."
rm -rf test-setup-hub test-project-hub test-with-key

echo ""
echo "✅ Hub registration tests completed!"
echo ""
echo "📋 Summary:"
echo "- Test 1: Setup command with hub registration"
echo "- Test 2: Init command with hub registration" 
echo "- Test 3: Setup with existing API key"
echo ""
echo "💡 Tips:"
echo "- Check your local hub logs to see registration requests"
echo "- Verify API keys are valid in your hub's database"
echo "- Test with different email addresses for multiple runs"
