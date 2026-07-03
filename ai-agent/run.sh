#!/bin/bash

cd /Users/mattgor/Documents/Daily/ai-pm-radar

echo "🚀 AI Agent Runner (Level 2)"
echo "==========================="

# 1. Show queue state
echo "📋 Reading queue..."
cat ai-agent/QUEUE.md

# 2. Run executor (dry run)
echo "\n🤖 Executing queue (dry-run)..."
node ai-agent/executor.mjs

# 3. Run safety validation gate
echo "\n🧪 Running validation gate..."
npm run validate:data
npm run validate:daily
npm run build

echo "\n📦 Final git status"
git status -sb

echo "\n✅ Done (Level 2 safety mode)"
