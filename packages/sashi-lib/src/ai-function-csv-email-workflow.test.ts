import { AIFunction } from './ai-function-loader';

// Mock SendGrid module
const mockSendGridSend = jest.fn();
const mockSendGrid = {
    setApiKey: jest.fn(),
    send: mockSendGridSend
};

describe('CSV Email Workflow with SendGrid Integration', () => {
    beforeEach(() => {
        // Reset mocks before each test
        mockSendGridSend.mockReset();
        mockSendGrid.setApiKey.mockReset();
    });

    describe('Phone Number URL Encoding', () => {
        test('should encode phone number for URL query parameter', () => {
            const phoneNumber = '+1234567890';

            // Simple encoding algorithm (base64)
            const encodedPhone = Buffer.from(phoneNumber).toString('base64');

            // Test the encoding works and is URL safe
            expect(encodedPhone).toBeDefined();
            expect(encodedPhone).toBe('KzEyMzQ1Njc4OTA='); // base64 of '+1234567890'

            // Test URL encoding for safety
            const urlSafeEncoded = encodeURIComponent(encodedPhone);
            expect(urlSafeEncoded).toBe('KzEyMzQ1Njc4OTA%3D'); // base64 with URL-encoded '=' character
        });

        test('should create verification URL with encoded phone', () => {
            const phoneNumber = '+1234567890';
            const userId = 'user123';
            const baseUrl = 'https://app.example.com/verify';

            // Encode phone for URL safety
            const encodedPhone = encodeURIComponent(Buffer.from(phoneNumber).toString('base64'));
            const url = `${baseUrl}?user=${userId}&phone=${encodedPhone}&t=${Date.now()}`;

            expect(url).toContain(baseUrl);
            expect(url).toContain(`user=${userId}`);
            expect(url).toContain('phone=');
            expect(url).toContain('t=');
        });
    });

    describe('SendGrid Email Function', () => {
        test('should create function that sends email with verification URL', async () => {
            const sendVerificationEmailFunction = new AIFunction(
                "SendVerificationEmail",
                "Sends verification email with encoded phone URL to user"
            )
                .args({
                    name: "userData",
                    description: "User data from CSV including name, email, and phone",
                    type: "object",
                    required: true
                })
                .implement((userData: any) => {
                    // Extract user data
                    const { name, email, phone, userId } = userData;

                    // Encode phone number for URL
                    const encodedPhone = encodeURIComponent(
                        Buffer.from(phone).toString('base64')
                    );

                    // Create verification URL
                    const verificationUrl = `https://app.example.com/verify?user=${userId}&phone=${encodedPhone}&t=${Date.now()}`;

                    // Prepare email data
                    const emailData = {
                        to: email,
                        from: 'noreply@example.com',
                        subject: `Hi ${name}, please verify your phone number`,
                        html: `
                            <h2>Phone Verification Required</h2>
                            <p>Hi ${name},</p>
                            <p>Please click the link below to verify your phone number (${phone}):</p>
                            <a href="${verificationUrl}">Verify Phone Number</a>
                            <p>This link is valid for 24 hours.</p>
                        `
                    };

                    // Mock SendGrid send
                    mockSendGrid.setApiKey('test-api-key');
                    mockSendGrid.send(emailData);

                    return {
                        success: true,
                        email: email,
                        phone: phone,
                        verificationUrl: verificationUrl,
                        emailSent: true,
                        timestamp: new Date().toISOString()
                    };
                });

            // Test data matching CSV structure
            const testUserData = {
                name: 'John Smith',
                email: 'john.smith@example.com',
                phone: '+1234567890',
                userId: 'user_12345'
            };

            // Execute the function
            const result = await sendVerificationEmailFunction.execute(testUserData);

            // Verify the result
            expect(result.success).toBe(true);
            expect(result.email).toBe('john.smith@example.com');
            expect(result.phone).toBe('+1234567890');
            expect(result.verificationUrl).toContain('https://app.example.com/verify');
            expect(result.verificationUrl).toContain('user=user_12345');
            expect(result.verificationUrl).toContain('phone=');
            expect(result.emailSent).toBe(true);

            // Verify SendGrid was called correctly
            expect(mockSendGrid.setApiKey).toHaveBeenCalledWith('test-api-key');
            expect(mockSendGrid.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'john.smith@example.com',
                    from: 'noreply@example.com',
                    subject: 'Hi John Smith, please verify your phone number',
                    html: expect.stringContaining('Hi John Smith')
                })
            );
        });
    });

    describe('CSV Bulk Email Processing', () => {
        test('should process multiple users from CSV and send verification emails', async () => {
            const bulkEmailFunction = new AIFunction(
                "BulkSendVerificationEmails",
                "Processes CSV data and sends verification emails to all users"
            )
                .args({
                    name: "csvData",
                    description: "Array of user data from CSV",
                    type: "object",
                    required: true
                })
                .implement((csvData: any) => {
                    // Handle both single object and array (for testing flexibility)
                    const users = Array.isArray(csvData) ? csvData : [csvData];
                    const results = [];

                    for (const user of users) {
                        const { name, email, phone } = user;
                        const userId = `user_${Math.random().toString(36).substr(2, 9)}`;

                        // Encode phone number
                        const encodedPhone = encodeURIComponent(
                            Buffer.from(phone).toString('base64')
                        );

                        // Create verification URL
                        const verificationUrl = `https://app.example.com/verify?user=${userId}&phone=${encodedPhone}&t=${Date.now()}`;

                        // Simulate email sending
                        const emailData = {
                            to: email,
                            from: 'noreply@example.com',
                            subject: `Hi ${name}, verify your phone ${phone}`,
                            html: `<a href="${verificationUrl}">Verify ${phone}</a>`
                        };

                        mockSendGrid.send(emailData);

                        results.push({
                            name,
                            email,
                            phone,
                            userId,
                            verificationUrl,
                            status: 'sent',
                            sentAt: new Date().toISOString()
                        });
                    }

                    return {
                        totalProcessed: results.length,
                        successfulSends: results.length,
                        results: results
                    };
                });

            // Test data simulating CSV rows
            const csvTestData = [
                { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1111111111' },
                { name: 'Bob Wilson', email: 'bob@example.com', phone: '+2222222222' },
                { name: 'Carol Davis', email: 'carol@example.com', phone: '+3333333333' }
            ];

            // Execute bulk function
            const result = await bulkEmailFunction.execute(csvTestData);

            // Verify bulk processing results
            expect(result.totalProcessed).toBe(3);
            expect(result.successfulSends).toBe(3);
            expect(result.results).toHaveLength(3);

            // Verify each user was processed correctly
            result.results.forEach((userResult: any, index: number) => {
                const originalUser = csvTestData[index];
                if (originalUser) {
                    expect(userResult.name).toBe(originalUser.name);
                    expect(userResult.email).toBe(originalUser.email);
                    expect(userResult.phone).toBe(originalUser.phone);
                }
                expect(userResult.verificationUrl).toContain('https://app.example.com/verify');
                expect(userResult.status).toBe('sent');
                expect(userResult.userId).toMatch(/^user_/);
            });

            // Verify SendGrid was called for each user
            expect(mockSendGrid.send).toHaveBeenCalledTimes(3);

            // Check specific SendGrid calls
            const sendGridCalls = mockSendGrid.send.mock.calls;
            expect(sendGridCalls[0][0].to).toBe('alice@example.com');
            expect(sendGridCalls[1][0].to).toBe('bob@example.com');
            expect(sendGridCalls[2][0].to).toBe('carol@example.com');
        });
    });

    describe('URL Validation and Security', () => {
        test('should properly encode special characters in phone numbers', async () => {
            const testFunction = new AIFunction("TestPhoneEncoding", "Test phone encoding")
                .args({
                    name: "phone",
                    description: "Phone number to encode",
                    type: "object",
                    required: true
                })
                .implement((data: any) => {
                    const phone = data.phone;
                    const encoded = encodeURIComponent(Buffer.from(phone).toString('base64'));
                    return { original: phone, encoded };
                });

            // Test various phone number formats
            const testCases = [
                { phone: '+1 (555) 123-4567' },
                { phone: '+44 20 7946 0958' },
                { phone: '+81-3-1234-5678' },
                { phone: '555.123.4567' }
            ];

            for (const testCase of testCases) {
                const result = await testFunction.execute(testCase);

                expect(result.original).toBe(testCase.phone);
                expect(result.encoded).toBeDefined();
                expect(result.encoded).not.toContain('+');
                expect(result.encoded).not.toContain(' ');
                expect(result.encoded).not.toContain('(');
                expect(result.encoded).not.toContain(')');
            }
        });

        test('should generate unique URLs for same phone numbers', async () => {
            const urlGeneratorFunction = new AIFunction("GenerateUniqueURL", "Generate unique verification URLs")
                .args({
                    name: "userData",
                    description: "User data",
                    type: "object",
                    required: true
                })
                .implement((userData: any) => {
                    const { phone, userId } = userData;
                    const timestamp = Date.now();
                    const encodedPhone = encodeURIComponent(Buffer.from(phone).toString('base64'));

                    return {
                        url: `https://app.example.com/verify?user=${userId}&phone=${encodedPhone}&t=${timestamp}`,
                        timestamp
                    };
                });

            // Generate URLs for same phone but different users
            const user1Result = await urlGeneratorFunction.execute({
                phone: '+1234567890',
                userId: 'user1'
            });

            // Wait a millisecond to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 1));

            const user2Result = await urlGeneratorFunction.execute({
                phone: '+1234567890',
                userId: 'user2'
            });

            // URLs should be different due to different userIds and timestamps
            expect(user1Result.url).not.toBe(user2Result.url);
            expect(user1Result.url).toContain('user=user1');
            expect(user2Result.url).toContain('user=user2');
            expect(user1Result.timestamp).not.toBe(user2Result.timestamp);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing required fields gracefully', async () => {
            const robustEmailFunction = new AIFunction("RobustEmailSender", "Email sender with error handling")
                .args({
                    name: "userData",
                    description: "User data (may be incomplete)",
                    type: "object",
                    required: true
                })
                .implement((userData: any) => {
                    const { name, email, phone } = userData;

                    // Validate required fields
                    if (!email) {
                        return { success: false, error: 'Email is required' };
                    }
                    if (!phone) {
                        return { success: false, error: 'Phone number is required' };
                    }

                    // If validation passes, process normally
                    const encodedPhone = encodeURIComponent(Buffer.from(phone).toString('base64'));
                    const url = `https://app.example.com/verify?phone=${encodedPhone}`;

                    return {
                        success: true,
                        email,
                        phone,
                        verificationUrl: url
                    };
                });

            // Test with missing email
            const resultMissingEmail = await robustEmailFunction.execute({
                name: 'John Doe',
                phone: '+1234567890'
            });

            expect(resultMissingEmail.success).toBe(false);
            expect(resultMissingEmail.error).toBe('Email is required');

            // Test with missing phone
            const resultMissingPhone = await robustEmailFunction.execute({
                name: 'Jane Doe',
                email: 'jane@example.com'
            });

            expect(resultMissingPhone.success).toBe(false);
            expect(resultMissingPhone.error).toBe('Phone number is required');

            // Test with all required fields
            const resultComplete = await robustEmailFunction.execute({
                name: 'Complete User',
                email: 'complete@example.com',
                phone: '+1234567890'
            });

            expect(resultComplete.success).toBe(true);
            expect(resultComplete.verificationUrl).toContain('https://app.example.com/verify');
        });
    });
}); 