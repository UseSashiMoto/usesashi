import request from 'supertest';
import { callFunctionFromRegistry } from './ai-function-loader';
import { WorkflowResponse } from './models/models';
import { createTestApp } from './tests/utils.test';

// Mock the function registry
jest.mock('./ai-function-loader', () => ({
    ...jest.requireActual('./ai-function-loader'),
    callFunctionFromRegistry: jest.fn(),
}));

const callFunctionSpy = callFunctionFromRegistry as jest.MockedFunction<typeof callFunctionFromRegistry>;

describe('CSV Email Verification Workflow Integration Test', () => {
    let app: any;

    beforeAll(async () => {
        app = await createTestApp();
    });

    beforeEach(() => {
        callFunctionSpy.mockClear();
    });

    describe('Workflow Definition', () => {
        test('should define a complete CSV email verification workflow', () => {
            // This is the complete workflow that processes CSV data and sends verification emails
            const csvEmailWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'validate_csv_users',
                        tool: 'ValidateUserFunction',
                        description: 'Validate each user from CSV data',
                        map: true, // Process each CSV row individually
                        parameters: {
                            userData: [] // Will be populated with CSV data
                        },
                        parameterMetadata: {
                            userData: {
                                type: 'csv',
                                description: 'CSV data containing user information (name, email, phone)',
                                required: true,
                                expectedColumns: ['name', 'email', 'phone']
                            }
                        }
                    },
                    {
                        id: 'encode_phone_numbers',
                        tool: 'EncodePhoneForURLFunction',
                        description: 'Encode phone numbers for URL parameters',
                        map: true,
                        parameters: {
                            userValidationResult: 'validate_csv_users' // Reference previous step
                        }
                    },
                    {
                        id: 'generate_verification_urls',
                        tool: 'GenerateVerificationURLFunction',
                        description: 'Generate unique verification URLs for each user',
                        map: true,
                        parameters: {
                            encodedUserData: 'encode_phone_numbers'
                        }
                    },
                    {
                        id: 'send_verification_emails',
                        tool: 'SendVerificationEmailFunction',
                        description: 'Send verification emails with URLs to users',
                        map: true,
                        parameters: {
                            userWithURL: 'generate_verification_urls'
                        }
                    },
                    {
                        id: 'aggregate_results',
                        tool: 'AggregateEmailResultsFunction',
                        description: 'Aggregate all email sending results into a summary',
                        parameters: {
                            emailResults: 'send_verification_emails' // Collect all results
                        }
                    }
                ]
            };

            // Validate workflow structure
            expect(csvEmailWorkflow.type).toBe('workflow');
            expect(csvEmailWorkflow.actions).toHaveLength(5);

            // Validate CSV input configuration
            const csvAction = csvEmailWorkflow.actions[0];
            expect(csvAction.parameterMetadata?.userData.type).toBe('csv');
            expect(csvAction.parameterMetadata?.userData.expectedColumns).toEqual(['name', 'email', 'phone']);
            expect(csvAction.map).toBe(true);

            // Validate workflow chaining
            expect(csvEmailWorkflow.actions[1].parameters.userValidationResult).toBe('validate_csv_users');
            expect(csvEmailWorkflow.actions[2].parameters.encodedUserData).toBe('encode_phone_numbers');
            expect(csvEmailWorkflow.actions[3].parameters.userWithURL).toBe('generate_verification_urls');
            expect(csvEmailWorkflow.actions[4].parameters.emailResults).toBe('send_verification_emails');

            console.log('✅ Workflow Definition:');
            console.log(JSON.stringify(csvEmailWorkflow, null, 2));
        });
    });

    describe('Workflow Execution via /workflow/execute', () => {
        test('should execute the complete CSV email verification workflow', async () => {
            // Mock the function implementations to simulate the workflow
            const mockValidationResults = [
                { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1111111111', isValid: true, status: 'valid' },
                { name: 'Bob Wilson', email: 'bob@example.com', phone: '+2222222222', isValid: true, status: 'valid' },
                { name: 'Carol Davis', email: 'carol@invalid', phone: '+3333333333', isValid: false, status: 'invalid', errors: ['Invalid email format'] }
            ];

            const mockEncodedResults = [
                { ...mockValidationResults[0], encodedPhone: 'KzExMTExMTExMTE%3D', userId: 'user_alice123' },
                { ...mockValidationResults[1], encodedPhone: 'KzIyMjIyMjIyMjI%3D', userId: 'user_bob456' },
                { ...mockValidationResults[2], encodedPhone: 'KzMzMzMzMzMzMzM%3D', userId: 'user_carol789' }
            ];

            const mockURLResults = [
                { ...mockEncodedResults[0], verificationUrl: 'https://app.example.com/verify?user=user_alice123&phone=KzExMTExMTExMTE%3D&t=1234567890' },
                { ...mockEncodedResults[1], verificationUrl: 'https://app.example.com/verify?user=user_bob456&phone=KzIyMjIyMjIyMjI%3D&t=1234567891' },
                { ...mockEncodedResults[2], verificationUrl: 'https://app.example.com/verify?user=user_carol789&phone=KzMzMzMzMzMzMzM%3D&t=1234567892' }
            ];

            const mockEmailResults = [
                { ...mockURLResults[0], emailSent: true, messageId: 'msg_alice_001', sentAt: '2024-01-01T10:00:00Z' },
                { ...mockURLResults[1], emailSent: true, messageId: 'msg_bob_002', sentAt: '2024-01-01T10:00:01Z' },
                { ...mockURLResults[2], emailSent: false, error: 'Invalid email address', sentAt: null }
            ];

            const mockAggregateResult = {
                totalProcessed: 3,
                successfulValidations: 2,
                failedValidations: 1,
                successfulEmails: 2,
                failedEmails: 1,
                validationErrors: ['Invalid email format'],
                emailErrors: ['Invalid email address'],
                processingTime: '2.5s',
                summary: 'Processed 3 users: 2 valid emails sent, 1 failed validation'
            };

            // Setup function mocks in the expected order
            callFunctionSpy
                .mockResolvedValueOnce(mockValidationResults[0])  // Alice validation
                .mockResolvedValueOnce(mockValidationResults[1])  // Bob validation  
                .mockResolvedValueOnce(mockValidationResults[2])  // Carol validation
                .mockResolvedValueOnce(mockEncodedResults[0])     // Alice encoding
                .mockResolvedValueOnce(mockEncodedResults[1])     // Bob encoding
                .mockResolvedValueOnce(mockEncodedResults[2])     // Carol encoding
                .mockResolvedValueOnce(mockURLResults[0])         // Alice URL generation
                .mockResolvedValueOnce(mockURLResults[1])         // Bob URL generation
                .mockResolvedValueOnce(mockURLResults[2])         // Carol URL generation
                .mockResolvedValueOnce(mockEmailResults[0])       // Alice email sending
                .mockResolvedValueOnce(mockEmailResults[1])       // Bob email sending
                .mockResolvedValueOnce(mockEmailResults[2])       // Carol email sending
                .mockResolvedValueOnce(mockAggregateResult);      // Final aggregation

            // Define the workflow with actual CSV data
            const workflowWithData: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'validate_csv_users',
                        tool: 'ValidateUserFunction',
                        description: 'Validate each user from CSV data',
                        map: true,
                        parameters: {
                            userData: [
                                { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1111111111' },
                                { name: 'Bob Wilson', email: 'bob@example.com', phone: '+2222222222' },
                                { name: 'Carol Davis', email: 'carol@invalid', phone: '+3333333333' }
                            ]
                        }
                    },
                    {
                        id: 'encode_phone_numbers',
                        tool: 'EncodePhoneForURLFunction',
                        description: 'Encode phone numbers for URL parameters',
                        map: true,
                        parameters: {
                            userValidationResult: 'validate_csv_users'
                        }
                    },
                    {
                        id: 'generate_verification_urls',
                        tool: 'GenerateVerificationURLFunction',
                        description: 'Generate unique verification URLs for each user',
                        map: true,
                        parameters: {
                            encodedUserData: 'encode_phone_numbers'
                        }
                    },
                    {
                        id: 'send_verification_emails',
                        tool: 'SendVerificationEmailFunction',
                        description: 'Send verification emails with URLs to users',
                        map: true,
                        parameters: {
                            userWithURL: 'generate_verification_urls'
                        }
                    },
                    {
                        id: 'aggregate_results',
                        tool: 'AggregateEmailResultsFunction',
                        description: 'Aggregate all email sending results into a summary',
                        parameters: {
                            emailResults: 'send_verification_emails'
                        }
                    }
                ]
            };

            // Execute the workflow via the API endpoint
            const response = await request(app)
                .post('/workflow/execute')
                .set('x-sashi-session-token', 'test-session-token')
                .send({
                    workflow: workflowWithData,
                    debug: true // Enable debug mode for detailed logs
                });

            // Verify the response structure
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('results');
            expect(response.body.results).toHaveLength(5); // One result per action

            // Verify each step's results
            const results = response.body.results;

            // Step 1: CSV Validation (should have 3 mapped results)
            expect(results[0].actionId).toBe('validate_csv_users');
            expect(results[0].result).toEqual([
                mockValidationResults[0],
                mockValidationResults[1],
                mockValidationResults[2]
            ]);

            // Step 2: Phone Encoding (should have 3 mapped results)
            expect(results[1].actionId).toBe('encode_phone_numbers');
            expect(results[1].result).toEqual([
                mockEncodedResults[0],
                mockEncodedResults[1],
                mockEncodedResults[2]
            ]);

            // Step 3: URL Generation (should have 3 mapped results)
            expect(results[2].actionId).toBe('generate_verification_urls');
            expect(results[2].result).toEqual([
                mockURLResults[0],
                mockURLResults[1],
                mockURLResults[2]
            ]);

            // Step 4: Email Sending (should have 3 mapped results)
            expect(results[3].actionId).toBe('send_verification_emails');
            expect(results[3].result).toEqual([
                mockEmailResults[0],
                mockEmailResults[1],
                mockEmailResults[2]
            ]);

            // Step 5: Results Aggregation (single result)
            expect(results[4].actionId).toBe('aggregate_results');
            expect(results[4].result).toEqual(mockAggregateResult);

            // Verify function calls were made correctly
            expect(callFunctionSpy).toHaveBeenCalledTimes(13); // 3+3+3+3+1 calls

            // Verify the call sequence and parameters
            // Validation calls
            expect(callFunctionSpy).toHaveBeenNthCalledWith(1, 'ValidateUserFunction', { userData: { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1111111111' } });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(2, 'ValidateUserFunction', { userData: { name: 'Bob Wilson', email: 'bob@example.com', phone: '+2222222222' } });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(3, 'ValidateUserFunction', { userData: { name: 'Carol Davis', email: 'carol@invalid', phone: '+3333333333' } });

            // Encoding calls  
            expect(callFunctionSpy).toHaveBeenNthCalledWith(4, 'EncodePhoneForURLFunction', { userValidationResult: mockValidationResults[0] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(5, 'EncodePhoneForURLFunction', { userValidationResult: mockValidationResults[1] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(6, 'EncodePhoneForURLFunction', { userValidationResult: mockValidationResults[2] });

            // URL generation calls
            expect(callFunctionSpy).toHaveBeenNthCalledWith(7, 'GenerateVerificationURLFunction', { encodedUserData: mockEncodedResults[0] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(8, 'GenerateVerificationURLFunction', { encodedUserData: mockEncodedResults[1] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(9, 'GenerateVerificationURLFunction', { encodedUserData: mockEncodedResults[2] });

            // Email sending calls
            expect(callFunctionSpy).toHaveBeenNthCalledWith(10, 'SendVerificationEmailFunction', { userWithURL: mockURLResults[0] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(11, 'SendVerificationEmailFunction', { userWithURL: mockURLResults[1] });
            expect(callFunctionSpy).toHaveBeenNthCalledWith(12, 'SendVerificationEmailFunction', { userWithURL: mockURLResults[2] });

            // Aggregation call (with all email results)
            expect(callFunctionSpy).toHaveBeenNthCalledWith(13, 'AggregateEmailResultsFunction', {
                emailResults: [mockEmailResults[0], mockEmailResults[1], mockEmailResults[2]]
            });

            console.log('✅ Workflow Execution Results:');
            console.log(JSON.stringify(response.body, null, 2));
        });

        test('should handle workflow execution errors gracefully', async () => {
            // Mock a failure in the validation step
            callFunctionSpy.mockRejectedValueOnce(new Error('CSV validation failed: Invalid data format'));

            const workflowWithBadData: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'validate_csv_users',
                        tool: 'ValidateUserFunction',
                        description: 'Validate each user from CSV data',
                        map: true,
                        parameters: {
                            userData: [
                                { name: '', email: 'invalid-email', phone: 'not-a-phone' } // Invalid data
                            ]
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/workflow/execute')
                .set('x-sashi-session-token', 'test-session-token')
                .send({
                    workflow: workflowWithBadData,
                    debug: true
                });

            // Should return error status
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('CSV validation failed');

            console.log('✅ Error Handling:');
            console.log(JSON.stringify(response.body, null, 2));
        });

        test('should support debug mode with detailed execution info', async () => {
            // Simple single-step workflow for debug testing
            callFunctionSpy.mockResolvedValueOnce({
                name: 'Test User',
                email: 'test@example.com',
                phone: '+1234567890',
                isValid: true,
                status: 'valid',
                debugInfo: {
                    executionTime: '45ms',
                    validationSteps: ['email_format', 'phone_format', 'name_length']
                }
            });

            const debugWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'debug_validation',
                        tool: 'ValidateUserFunction',
                        description: 'Validate user data with debug info',
                        parameters: {
                            userData: { name: 'Test User', email: 'test@example.com', phone: '+1234567890' }
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/workflow/execute')
                .set('x-sashi-session-token', 'test-session-token')
                .send({
                    workflow: debugWorkflow,
                    debug: true
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.results[0].result.debugInfo).toBeDefined();

            console.log('✅ Debug Mode Results:');
            console.log(JSON.stringify(response.body, null, 2));
        });
    });

    describe('CSV Workflow UI Integration', () => {
        test('should generate proper form metadata for CSV workflows', () => {
            const csvWorkflowDefinition: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'process_csv',
                        tool: 'ProcessCSVFunction',
                        description: 'Process user data from CSV',
                        parameters: {
                            csvData: [] // Empty placeholder for form input
                        },
                        parameterMetadata: {
                            csvData: {
                                type: 'csv',
                                description: 'Upload or paste CSV data with user information',
                                required: true,
                                expectedColumns: ['name', 'email', 'phone', 'company']
                            }
                        }
                    }
                ]
            };

            // Verify the CSV metadata is properly structured for UI generation
            const csvField = csvWorkflowDefinition.actions[0].parameterMetadata?.csvData;
            expect(csvField?.type).toBe('csv');
            expect(csvField?.required).toBe(true);
            expect(csvField?.expectedColumns).toEqual(['name', 'email', 'phone', 'company']);
            expect(csvField?.description).toContain('CSV data');

            console.log('✅ CSV Form Metadata:');
            console.log(JSON.stringify(csvField, null, 2));
        });
    });
}); 