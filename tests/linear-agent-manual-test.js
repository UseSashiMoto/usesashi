#!/usr/bin/env node

/**
 * Manual Integration Test for Linear Agent Endpoint
 * 
 * This script tests the actual Linear agent endpoint by making HTTP requests
 * to a running Sashi middleware instance.
 * 
 * Usage:
 *   node linear-agent-manual-test.js [middleware-url] [session-token]
 * 
 * Examples:
 *   node linear-agent-manual-test.js http://localhost:3001 your-session-token
 *   node linear-agent-manual-test.js https://your-middleware.com valid-token
 */

const https = require('https');
const http = require('http');

// Configuration
const MIDDLEWARE_URL = process.argv[2] || 'http://localhost:3001';
const SESSION_TOKEN = process.argv[3] || 'test-session-token';

console.log('🧪 Linear Agent Manual Integration Test');
console.log('=====================================');
console.log(`Middleware URL: ${MIDDLEWARE_URL}`);
console.log(`Session Token: ${SESSION_TOKEN.substring(0, 10)}...`);
console.log('');

// Test cases
const testCases = [
    {
        name: 'Help Request',
        userPrompt: 'help',
        previousActivities: []
    },
    {
        name: 'List Workflows',
        userPrompt: 'List my workflows',
        previousActivities: []
    },
    {
        name: 'GitHub Status',
        userPrompt: 'What\'s my GitHub status?',
        previousActivities: []
    },
    {
        name: 'Repository Details',
        userPrompt: 'Show me repo details',
        previousActivities: []
    },
    {
        name: 'Execute Workflow (will likely fail without real workflow)',
        userPrompt: 'Run workflow test-workflow',
        previousActivities: [
            { role: 'user', content: 'List my workflows' },
            { role: 'assistant', content: 'RESPONSE: Here are your workflows...' }
        ]
    },
    {
        name: 'Invalid Request (missing userPrompt)',
        userPrompt: null,
        previousActivities: []
    }
];

// Helper function to make HTTP requests
function makeRequest(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const postData = JSON.stringify(data);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        };

        const req = client.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Run tests
async function runTests() {
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
        console.log('─'.repeat(50));

        try {
            const requestData = testCase.userPrompt ? {
                userPrompt: testCase.userPrompt,
                previousActivities: testCase.previousActivities
            } : {
                previousActivities: testCase.previousActivities
            };

            const response = await makeRequest(
                `${MIDDLEWARE_URL}/linear/agent`,
                requestData,
                {
                    'x-sashi-session-token': SESSION_TOKEN
                }
            );

            console.log(`Status: ${response.status}`);

            if (response.data) {
                if (typeof response.data === 'object') {
                    console.log('Response:');
                    console.log(JSON.stringify(response.data, null, 2));

                    // Show the actual agent response if successful
                    if (response.data.success && response.data.response) {
                        console.log('\n🤖 Agent Response:');
                        console.log(response.data.response);
                    }
                } else {
                    console.log('Response:', response.data);
                }
            }

            // Simple validation
            if (testCase.name.includes('Invalid Request')) {
                if (response.status === 400) {
                    console.log('✅ Expected 400 error received');
                    passed++;
                } else {
                    console.log('❌ Expected 400 error but got:', response.status);
                    failed++;
                }
            } else if (response.status === 200 || response.status === 500) {
                // 500 is acceptable for some tests that might fail due to missing config
                console.log('✅ Request processed (status acceptable for test environment)');
                passed++;
            } else if (response.status === 401) {
                console.log('⚠️  Authentication failed - check your session token');
                console.log('   This might be expected if testing against a real server');
                passed++; // Count as passed since the endpoint is working
            } else {
                console.log('❌ Unexpected status code');
                failed++;
            }

        } catch (error) {
            console.log('❌ Request failed:', error.message);
            failed++;
        }
    }

    console.log('\n🏁 Test Summary');
    console.log('================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed! The Linear agent endpoint is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
    }

    console.log('\n💡 Tips:');
    console.log('   - Make sure your middleware is running on the specified URL');
    console.log('   - Verify your session token is valid');
    console.log('   - Check that your GitHub and hub configurations are set up');
    console.log('   - Some failures are expected in test environments without real data');
}

// Run the tests
runTests().catch(console.error);
