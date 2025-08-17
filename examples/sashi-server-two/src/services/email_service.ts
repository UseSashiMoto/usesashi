import {
    AIFunction,
    registerFunctionIntoAI
} from "@sashimo/lib";

// Mock email function for testing
const SendEmailFunction = new AIFunction(
    'send_email',
    'Send an email to a specific email address'
)
    .args(
        {
            name: 'email',
            description: 'The email address to send the mock email to',
            type: 'string',
            required: true,
        },
        {
            name: 'subject',
            description: 'The subject line of the email',
            type: 'string',
            required: false,
        },
        {
            name: 'message',
            description: 'The body content of the email',
            type: 'string',
            required: false,
        }
    )
    .returns({
        name: 'result',
        description: 'The result of the mock email sending operation',
        type: 'object',
    })
    .implement(async (email: string, subject?: string, message?: string) => {
        // Mock email sending logic
        console.log('📧 [Mock Email] Sending email:', {
            to: email,
            subject: subject || 'Test Email',
            message: message || 'This is a test email from the Sashi system.',
            timestamp: new Date().toISOString()
        });

        // Simulate email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                success: false,
                error: 'Invalid email address format',
                to: email,
                subject: subject || 'Test Email',
                attemptedAt: new Date().toISOString(),
                provider: 'MockEmailProvider',
                status: 'validation_failed'
            };
        }

        // Simulate random success/failure for testing (90% success rate)
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
            return {
                success: true,
                messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                to: email,
                subject: subject || 'Test Email',
                message: message || 'This is a test email from the Sashi system.',
                sentAt: new Date().toISOString(),
                provider: 'MockEmailProvider',
                status: 'sent'
            };
        } else {
            // Simulate occasional failures
            return {
                success: false,
                error: 'Mock email delivery failed - simulated network error',
                to: email,
                subject: subject || 'Test Email',
                attemptedAt: new Date().toISOString(),
                provider: 'MockEmailProvider',
                status: 'failed'
            };
        }
    });


// Register the functions
registerFunctionIntoAI("send_mock_email", SendEmailFunction);
