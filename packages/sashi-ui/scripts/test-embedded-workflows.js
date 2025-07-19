#!/usr/bin/env node

/**
 * Test runner for Embedded Workflow functionality
 * 
 * This script runs comprehensive tests for the embedded workflow system including:
 * - Workflow parsing from markdown blocks
 * - Message component rendering
 * - Integration with the chat system
 * - Performance and optimization tests
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Embedded Workflow Tests\n');

const testSuites = [
    {
        name: 'Workflow Classification & Parsing',
        pattern: 'workflowClassification.test.ts',
        description: 'Tests for parseEmbeddedWorkflows, removeWorkflowBlocks, and hasEmbeddedWorkflows functions'
    },
    {
        name: 'Message Component Rendering',
        pattern: 'MessageComponent.test.tsx',
        description: 'Tests for inline workflow rendering and collapse/expand behavior'
    },
    {
        name: 'Integration Tests',
        pattern: 'EmbeddedWorkflowIntegration.test.tsx',
        description: 'End-to-end tests for the complete embedded workflow flow'
    }
];

function runTestSuite(suite) {
    console.log(`\n📋 ${suite.name}`);
    console.log(`   ${suite.description}\n`);

    try {
        const result = execSync(`npm test -- --testPathPattern=${suite.pattern} --verbose`, {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: 'pipe'
        });

        console.log('✅ PASSED\n');
        if (process.env.VERBOSE) {
            console.log(result);
        }
        return true;
    } catch (error) {
        console.log('❌ FAILED\n');
        console.error(error.stdout || error.message);
        return false;
    }
}

function runAllTests() {
    console.log('🚀 Running all embedded workflow tests...\n');

    let passedCount = 0;
    const totalCount = testSuites.length;

    for (const suite of testSuites) {
        if (runTestSuite(suite)) {
            passedCount++;
        }
    }

    console.log('\n📊 Test Summary:');
    console.log(`   Passed: ${passedCount}/${totalCount}`);
    console.log(`   Failed: ${totalCount - passedCount}/${totalCount}`);

    if (passedCount === totalCount) {
        console.log('\n🎉 All embedded workflow tests passed!');
        process.exit(0);
    } else {
        console.log('\n💥 Some tests failed. Please check the output above.');
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'parsing':
        runTestSuite(testSuites[0]);
        break;
    case 'component':
        runTestSuite(testSuites[1]);
        break;
    case 'integration':
        runTestSuite(testSuites[2]);
        break;
    case 'all':
    default:
        runAllTests();
        break;
}

console.log('\n💡 Usage:');
console.log('   node scripts/test-embedded-workflows.js [parsing|component|integration|all]');
console.log('   VERBOSE=1 node scripts/test-embedded-workflows.js  # Show detailed output'); 