import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// Email-related interfaces
interface EmailTemplate {
    id: string
    name: string
    subject: string
    body: string
    variables: string[]
}

interface EmailLog {
    id: string
    to: string
    subject: string
    status: 'sent' | 'failed' | 'pending'
    timestamp: string
    provider: string
    messageId?: string
    error?: string
}

// Mock data
const emailTemplates: EmailTemplate[] = [
    {
        id: 'welcome',
        name: 'Welcome Email',
        subject: 'Welcome to {{appName}}!',
        body: 'Hello {{userName}}, welcome to our platform!',
        variables: ['appName', 'userName']
    },
    {
        id: 'reset_password',
        name: 'Password Reset',
        subject: 'Reset Your Password',
        body: 'Click here to reset your password: {{resetLink}}',
        variables: ['resetLink']
    },
    {
        id: 'notification',
        name: 'Notification',
        subject: 'New Notification',
        body: 'You have a new notification: {{message}}',
        variables: ['message']
    }
]

const emailLogs: EmailLog[] = []

// Helper functions
const generateEmailId = () => `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

const processTemplate = (template: EmailTemplate, variables: Record<string, string>) => {
    let processedSubject = template.subject
    let processedBody = template.body

    Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`
        processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value)
        processedBody = processedBody.replace(new RegExp(placeholder, 'g'), value)
    })

    return { subject: processedSubject, body: processedBody }
}

// AI Object definitions
const EmailTemplateObject = new AIObject("EmailTemplate", "email template configuration", true)
    .field({
        name: "id",
        description: "unique template identifier",
        type: "string",
        required: true
    })
    .field({
        name: "name",
        description: "human-readable template name",
        type: "string",
        required: true
    })
    .field({
        name: "subject",
        description: "email subject line with variable placeholders",
        type: "string",
        required: true
    })
    .field({
        name: "body",
        description: "email body content with variable placeholders",
        type: "string",
        required: true
    })
    .field({
        name: "variables",
        description: "list of available template variables",
        type: "array",
        required: true
    })

const EmailLogObject = new AIObject("EmailLog", "email sending log entry", true)
    .field({
        name: "id",
        description: "unique log entry identifier",
        type: "string",
        required: true
    })
    .field({
        name: "to",
        description: "recipient email address",
        type: "string",
        required: true
    })
    .field({
        name: "subject",
        description: "email subject line",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "email delivery status",
        type: "string",
        required: true
    })
    .field({
        name: "timestamp",
        description: "when the email was sent",
        type: "string",
        required: true
    })
    .field({
        name: "provider",
        description: "email service provider used",
        type: "string",
        required: true
    })
    .field({
        name: "messageId",
        description: "provider message identifier",
        type: "string",
        required: false
    })
    .field({
        name: "error",
        description: "error message if sending failed",
        type: "string",
        required: false
    })

const EmailResultObject = new AIObject("EmailResult", "result of email sending operation", true)
    .field({
        name: "success",
        description: "whether the email was sent successfully",
        type: "boolean",
        required: true
    })
    .field({
        name: "messageId",
        description: "unique message identifier",
        type: "string",
        required: false
    })
    .field({
        name: "to",
        description: "recipient email address",
        type: "string",
        required: true
    })
    .field({
        name: "subject",
        description: "email subject line",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "delivery status",
        type: "string",
        required: true
    })
    .field({
        name: "timestamp",
        description: "when the operation completed",
        type: "string",
        required: true
    })
    .field({
        name: "error",
        description: "error message if operation failed",
        type: "string",
        required: false
    })

// Register all email functions using the new format
registerFunctionIntoAI({
    name: "send_email",
    description: "send a custom email to a recipient",
    parameters: {
        to: {
            type: "string",
            description: "recipient email address",
            required: true
        },
        subject: {
            type: "string",
            description: "email subject line",
            required: true
        },
        body: {
            type: "string",
            description: "email body content",
            required: true
        },
        isHtml: {
            type: "boolean",
            description: "whether the body contains HTML content",
            required: false
        }
    },
    handler: async ({ to, subject, body, isHtml = false }) => {
        const timestamp = new Date().toISOString()
        const emailId = generateEmailId()

        console.log('📧 [Email Service] Sending email:', {
            id: emailId,
            to,
            subject,
            bodyLength: body.length,
            isHtml,
            timestamp
        })

        // Validate email
        if (!validateEmail(to)) {
            const error = 'Invalid email address format'
            const logEntry: EmailLog = {
                id: emailId,
                to,
                subject,
                status: 'failed',
                timestamp,
                provider: 'MockEmailProvider',
                error
            }
            emailLogs.push(logEntry)

            return {
                success: false,
                to,
                subject,
                status: 'validation_failed',
                timestamp,
                error
            }
        }

        // Simulate email sending (90% success rate)
        const isSuccess = Math.random() > 0.1

        if (isSuccess) {
            const messageId = `msg_${emailId}`
            const logEntry: EmailLog = {
                id: emailId,
                to,
                subject,
                status: 'sent',
                timestamp,
                provider: 'MockEmailProvider',
                messageId
            }
            emailLogs.push(logEntry)

            return {
                success: true,
                messageId,
                to,
                subject,
                status: 'sent',
                timestamp
            }
        } else {
            const error = 'Mock email delivery failed - simulated network error'
            const logEntry: EmailLog = {
                id: emailId,
                to,
                subject,
                status: 'failed',
                timestamp,
                provider: 'MockEmailProvider',
                error
            }
            emailLogs.push(logEntry)

            return {
                success: false,
                to,
                subject,
                status: 'failed',
                timestamp,
                error
            }
        }
    }
})

registerFunctionIntoAI({
    name: "send_template_email",
    description: "send an email using a predefined template",
    parameters: {
        templateId: {
            type: "string",
            description: "the ID of the email template to use",
            required: true
        },
        to: {
            type: "string",
            description: "recipient email address",
            required: true
        },
        variables: {
            type: "string",
            description: "template variables as JSON string (e.g., '{\"userName\":\"John\",\"appName\":\"MyApp\"}')",
            required: false
        }
    },
    handler: async ({ templateId, to, variables = '{}' }) => {
        const timestamp = new Date().toISOString()
        const emailId = generateEmailId()

        // Find template
        const template = emailTemplates.find(t => t.id === templateId)
        if (!template) {
            return {
                success: false,
                to,
                subject: 'Template Error',
                status: 'failed',
                timestamp,
                error: `Template with ID '${templateId}' not found`
            }
        }

        // Parse variables
        let parsedVariables: Record<string, string> = {}
        try {
            parsedVariables = JSON.parse(variables)
        } catch (error) {
            return {
                success: false,
                to,
                subject: template.subject,
                status: 'failed',
                timestamp,
                error: 'Invalid variables JSON format'
            }
        }

        // Process template
        const processed = processTemplate(template, parsedVariables)

        console.log('📧 [Template Email] Sending template email:', {
            id: emailId,
            templateId,
            to,
            variables: parsedVariables,
            timestamp
        })

        // Validate email
        if (!validateEmail(to)) {
            return {
                success: false,
                to,
                subject: processed.subject,
                status: 'validation_failed',
                timestamp,
                error: 'Invalid email address format'
            }
        }

        // Simulate sending
        const isSuccess = Math.random() > 0.1

        if (isSuccess) {
            const messageId = `msg_${emailId}`
            const logEntry: EmailLog = {
                id: emailId,
                to,
                subject: processed.subject,
                status: 'sent',
                timestamp,
                provider: 'MockEmailProvider',
                messageId
            }
            emailLogs.push(logEntry)

            return {
                success: true,
                messageId,
                to,
                subject: processed.subject,
                status: 'sent',
                timestamp
            }
        } else {
            const error = 'Template email delivery failed'
            const logEntry: EmailLog = {
                id: emailId,
                to,
                subject: processed.subject,
                status: 'failed',
                timestamp,
                provider: 'MockEmailProvider',
                error
            }
            emailLogs.push(logEntry)

            return {
                success: false,
                to,
                subject: processed.subject,
                status: 'failed',
                timestamp,
                error
            }
        }
    }
})

registerFunctionIntoAI({
    name: "get_email_templates",
    description: "retrieve all available email templates",
    parameters: {},
    handler: async () => {
        return emailTemplates
    }
})

registerFunctionIntoAI({
    name: "get_email_logs",
    description: "retrieve email sending logs",
    parameters: {
        limit: {
            type: "number",
            description: "maximum number of logs to return (default: 50)",
            required: false
        }
    },
    handler: async ({ limit = 50 }) => {
        return emailLogs
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit)
    }
})

registerFunctionIntoAI({
    name: "get_email_stats",
    description: "get email sending statistics",
    parameters: {},
    handler: async () => {
        const total = emailLogs.length
        const sent = emailLogs.filter(log => log.status === 'sent').length
        const failed = emailLogs.filter(log => log.status === 'failed').length
        const successRate = total > 0 ? Math.round((sent / total) * 100) : 0
        const lastActivity = emailLogs.length > 0
            ? emailLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp
            : undefined

        return {
            total,
            sent,
            failed,
            successRate,
            lastActivity
        }
    }
})