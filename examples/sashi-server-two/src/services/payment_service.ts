import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// Payment-related interfaces
interface PaymentMethod {
    id: string
    type: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer'
    last4?: string
    brand?: string
    expiryMonth?: number
    expiryYear?: number
    isDefault: boolean
    userId: string
    createdAt: string
}

interface Transaction {
    id: string
    amount: number
    currency: string
    status: 'pending' | 'completed' | 'failed' | 'refunded'
    type: 'payment' | 'refund' | 'subscription'
    userId: string
    paymentMethodId: string
    description: string
    createdAt: string
    processedAt?: string
    metadata: Record<string, any>
}

interface Subscription {
    id: string
    userId: string
    planId: string
    status: 'active' | 'canceled' | 'past_due' | 'paused'
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    amount: number
    currency: string
    interval: 'month' | 'year'
    createdAt: string
}

// Mock data
const paymentMethods: PaymentMethod[] = [
    {
        id: 'pm_001',
        type: 'credit_card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
        userId: 'user_123',
        createdAt: '2024-01-15T10:00:00Z'
    },
    {
        id: 'pm_002',
        type: 'paypal',
        isDefault: false,
        userId: 'user_456',
        createdAt: '2024-02-20T14:30:00Z'
    }
]

const transactions: Transaction[] = [
    {
        id: 'txn_001',
        amount: 2999,
        currency: 'USD',
        status: 'completed',
        type: 'payment',
        userId: 'user_123',
        paymentMethodId: 'pm_001',
        description: 'Pro Plan Subscription',
        createdAt: '2024-08-01T10:00:00Z',
        processedAt: '2024-08-01T10:00:05Z',
        metadata: { planId: 'pro_monthly' }
    },
    {
        id: 'txn_002',
        amount: 999,
        currency: 'USD',
        status: 'completed',
        type: 'payment',
        userId: 'user_456',
        paymentMethodId: 'pm_002',
        description: 'Basic Plan Subscription',
        createdAt: '2024-08-05T15:30:00Z',
        processedAt: '2024-08-05T15:30:03Z',
        metadata: { planId: 'basic_monthly' }
    }
]

const subscriptions: Subscription[] = [
    {
        id: 'sub_001',
        userId: 'user_123',
        planId: 'pro_monthly',
        status: 'active',
        currentPeriodStart: '2024-08-01T00:00:00Z',
        currentPeriodEnd: '2024-09-01T00:00:00Z',
        cancelAtPeriodEnd: false,
        amount: 2999,
        currency: 'USD',
        interval: 'month',
        createdAt: '2024-08-01T10:00:00Z'
    }
]

// Helper functions
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const formatAmount = (amountInCents: number, currency: string): string => {
    const amount = amountInCents / 100
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount)
}

// AI Object definitions
const PaymentMethodObject = new AIObject("PaymentMethod", "payment method information", true)
    .field({
        name: "id",
        description: "unique payment method identifier",
        type: "string",
        required: true
    })
    .field({
        name: "type",
        description: "type of payment method",
        type: "string",
        required: true
    })
    .field({
        name: "last4",
        description: "last 4 digits of card (for card types)",
        type: "string",
        required: false
    })
    .field({
        name: "brand",
        description: "card brand (visa, mastercard, etc.)",
        type: "string",
        required: false
    })
    .field({
        name: "expiryMonth",
        description: "card expiry month",
        type: "number",
        required: false
    })
    .field({
        name: "expiryYear",
        description: "card expiry year",
        type: "number",
        required: false
    })
    .field({
        name: "isDefault",
        description: "whether this is the default payment method",
        type: "boolean",
        required: true
    })
    .field({
        name: "userId",
        description: "user who owns this payment method",
        type: "string",
        required: true
    })
    .field({
        name: "createdAt",
        description: "when the payment method was added",
        type: "string",
        required: true
    })

const TransactionObject = new AIObject("Transaction", "payment transaction record", true)
    .field({
        name: "id",
        description: "unique transaction identifier",
        type: "string",
        required: true
    })
    .field({
        name: "amount",
        description: "transaction amount in cents",
        type: "number",
        required: true
    })
    .field({
        name: "currency",
        description: "currency code (USD, EUR, etc.)",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "transaction status",
        type: "string",
        required: true
    })
    .field({
        name: "type",
        description: "transaction type (payment, refund, subscription)",
        type: "string",
        required: true
    })
    .field({
        name: "userId",
        description: "user who made the transaction",
        type: "string",
        required: true
    })
    .field({
        name: "paymentMethodId",
        description: "payment method used",
        type: "string",
        required: true
    })
    .field({
        name: "description",
        description: "transaction description",
        type: "string",
        required: true
    })
    .field({
        name: "createdAt",
        description: "when the transaction was created",
        type: "string",
        required: true
    })
    .field({
        name: "processedAt",
        description: "when the transaction was processed",
        type: "string",
        required: false
    })
    .field({
        name: "metadata",
        description: "additional transaction metadata",
        type: "object",
        required: false
    })

const SubscriptionObject = new AIObject("Subscription", "subscription information", true)
    .field({
        name: "id",
        description: "unique subscription identifier",
        type: "string",
        required: true
    })
    .field({
        name: "userId",
        description: "user who owns the subscription",
        type: "string",
        required: true
    })
    .field({
        name: "planId",
        description: "subscription plan identifier",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "subscription status",
        type: "string",
        required: true
    })
    .field({
        name: "currentPeriodStart",
        description: "current billing period start date",
        type: "string",
        required: true
    })
    .field({
        name: "currentPeriodEnd",
        description: "current billing period end date",
        type: "string",
        required: true
    })
    .field({
        name: "cancelAtPeriodEnd",
        description: "whether subscription will cancel at period end",
        type: "boolean",
        required: true
    })
    .field({
        name: "amount",
        description: "subscription amount in cents",
        type: "number",
        required: true
    })
    .field({
        name: "currency",
        description: "currency code",
        type: "string",
        required: true
    })
    .field({
        name: "interval",
        description: "billing interval (month, year)",
        type: "string",
        required: true
    })
    .field({
        name: "createdAt",
        description: "when the subscription was created",
        type: "string",
        required: true
    })

// Register all payment functions using the new format
registerFunctionIntoAI({
    name: "process_payment",
    description: "process a one-time payment",
    parameters: {
        userId: {
            type: "string",
            description: "user making the payment",
            required: true
        },
        amount: {
            type: "number",
            description: "payment amount in cents",
            required: true
        },
        currency: {
            type: "string",
            description: "currency code (default: USD)",
            required: false
        },
        paymentMethodId: {
            type: "string",
            description: "payment method to use",
            required: true
        },
        description: {
            type: "string",
            description: "payment description",
            required: true
        }
    },
    handler: async ({ userId, amount, currency = 'USD', paymentMethodId, description }) => {
        const transactionId = generateId('txn')
        const timestamp = new Date().toISOString()

        // Validate inputs
        if (amount <= 0) {
            throw new Error("Payment amount must be greater than 0")
        }

        if (amount > 100000000) { // $1M limit
            throw new Error("Payment amount exceeds maximum limit")
        }

        // Check if payment method exists
        const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId && pm.userId === userId)
        if (!paymentMethod) {
            throw new Error("Payment method not found or doesn't belong to user")
        }

        // Simulate payment processing (90% success rate)
        const isSuccess = Math.random() > 0.1

        const transaction: Transaction = {
            id: transactionId,
            amount,
            currency: currency.toUpperCase(),
            status: isSuccess ? 'completed' : 'failed',
            type: 'payment',
            userId,
            paymentMethodId,
            description,
            createdAt: timestamp,
            processedAt: isSuccess ? timestamp : undefined,
            metadata: {}
        }

        transactions.push(transaction)

        console.log('💳 [Payment Service] Payment processed:', {
            id: transactionId,
            amount: formatAmount(amount, currency),
            status: transaction.status,
            userId,
            description
        })

        return transaction
    }
})

registerFunctionIntoAI({
    name: "get_user_transactions",
    description: "retrieve transactions for a user",
    parameters: {
        userId: {
            type: "string",
            description: "user ID to get transactions for",
            required: true
        },
        limit: {
            type: "number",
            description: "maximum number of transactions to return",
            required: false
        },
        status: {
            type: "string",
            description: "filter by transaction status",
            required: false
        }
    },
    handler: async ({ userId, limit = 50, status }) => {
        let userTransactions = transactions.filter(txn => txn.userId === userId)

        if (status) {
            userTransactions = userTransactions.filter(txn => txn.status === status)
        }

        return userTransactions
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit)
    }
})

registerFunctionIntoAI({
    name: "add_payment_method",
    description: "add a new payment method for a user",
    parameters: {
        userId: {
            type: "string",
            description: "user to add payment method for",
            required: true
        },
        type: {
            type: "string",
            description: "payment method type (credit_card, debit_card, paypal, bank_transfer)",
            required: true
        },
        last4: {
            type: "string",
            description: "last 4 digits of card (for card types)",
            required: false
        },
        brand: {
            type: "string",
            description: "card brand (for card types)",
            required: false
        },
        expiryMonth: {
            type: "number",
            description: "card expiry month (for card types)",
            required: false
        },
        expiryYear: {
            type: "number",
            description: "card expiry year (for card types)",
            required: false
        },
        setAsDefault: {
            type: "boolean",
            description: "whether to set as default payment method",
            required: false
        }
    },
    handler: async ({ userId, type, last4, brand, expiryMonth, expiryYear, setAsDefault = false }) => {
        const paymentMethodId = generateId('pm')
        const timestamp = new Date().toISOString()

        // Validate card details if it's a card type
        if ((type === 'credit_card' || type === 'debit_card')) {
            if (!last4 || !brand || !expiryMonth || !expiryYear) {
                throw new Error("Card details (last4, brand, expiryMonth, expiryYear) required for card types")
            }

            if (expiryMonth < 1 || expiryMonth > 12) {
                throw new Error("Invalid expiry month")
            }

            const currentYear = new Date().getFullYear()
            if (expiryYear < currentYear || expiryYear > currentYear + 20) {
                throw new Error("Invalid expiry year")
            }
        }

        // If setting as default, update existing payment methods
        if (setAsDefault) {
            paymentMethods.forEach(pm => {
                if (pm.userId === userId) {
                    pm.isDefault = false
                }
            })
        }

        const paymentMethod: PaymentMethod = {
            id: paymentMethodId,
            type: type as any,
            last4,
            brand,
            expiryMonth,
            expiryYear,
            isDefault: setAsDefault,
            userId,
            createdAt: timestamp
        }

        paymentMethods.push(paymentMethod)

        console.log('💳 [Payment Service] Payment method added:', {
            id: paymentMethodId,
            type,
            userId,
            isDefault: setAsDefault
        })

        return paymentMethod
    }
})

registerFunctionIntoAI({
    name: "get_user_payment_methods",
    description: "retrieve payment methods for a user",
    parameters: {
        userId: {
            type: "string",
            description: "user ID to get payment methods for",
            required: true
        }
    },
    handler: async ({ userId }) => {
        return paymentMethods.filter(pm => pm.userId === userId)
    }
})

registerFunctionIntoAI({
    name: "create_subscription",
    description: "create a new subscription for a user",
    parameters: {
        userId: {
            type: "string",
            description: "user to create subscription for",
            required: true
        },
        planId: {
            type: "string",
            description: "subscription plan identifier",
            required: true
        },
        amount: {
            type: "number",
            description: "subscription amount in cents",
            required: true
        },
        interval: {
            type: "string",
            description: "billing interval (month or year)",
            required: true
        },
        currency: {
            type: "string",
            description: "currency code (default: USD)",
            required: false
        }
    },
    handler: async ({ userId, planId, amount, interval, currency = 'USD' }) => {
        const subscriptionId = generateId('sub')
        const timestamp = new Date().toISOString()

        // Validate inputs
        if (amount <= 0) {
            throw new Error("Subscription amount must be greater than 0")
        }

        if (!['month', 'year'].includes(interval)) {
            throw new Error("Interval must be 'month' or 'year'")
        }

        // Check if user already has an active subscription
        const existingSubscription = subscriptions.find(
            sub => sub.userId === userId && sub.status === 'active'
        )

        if (existingSubscription) {
            throw new Error("User already has an active subscription")
        }

        // Calculate period end
        const periodStart = new Date(timestamp)
        const periodEnd = new Date(periodStart)
        if (interval === 'month') {
            periodEnd.setMonth(periodEnd.getMonth() + 1)
        } else {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        }

        const subscription: Subscription = {
            id: subscriptionId,
            userId,
            planId,
            status: 'active',
            currentPeriodStart: periodStart.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
            cancelAtPeriodEnd: false,
            amount,
            currency: currency.toUpperCase(),
            interval: interval as any,
            createdAt: timestamp
        }

        subscriptions.push(subscription)

        console.log('📅 [Payment Service] Subscription created:', {
            id: subscriptionId,
            userId,
            planId,
            amount: formatAmount(amount, currency),
            interval
        })

        return subscription
    }
})

registerFunctionIntoAI({
    name: "get_user_subscriptions",
    description: "retrieve subscriptions for a user",
    parameters: {
        userId: {
            type: "string",
            description: "user ID to get subscriptions for",
            required: true
        }
    },
    handler: async ({ userId }) => {
        return subscriptions.filter(sub => sub.userId === userId)
    }
})

registerFunctionIntoAI({
    name: "refund_transaction",
    description: "process a refund for a transaction",
    parameters: {
        transactionId: {
            type: "string",
            description: "transaction ID to refund",
            required: true
        },
        amount: {
            type: "number",
            description: "refund amount in cents (leave empty for full refund)",
            required: false
        },
        reason: {
            type: "string",
            description: "reason for the refund",
            required: false
        }
    },
    handler: async ({ transactionId, amount, reason }) => {
        const originalTransaction = transactions.find(txn => txn.id === transactionId)

        if (!originalTransaction) {
            throw new Error("Transaction not found")
        }

        if (originalTransaction.status !== 'completed') {
            throw new Error("Can only refund completed transactions")
        }

        const refundAmount = amount || originalTransaction.amount

        if (refundAmount > originalTransaction.amount) {
            throw new Error("Refund amount cannot exceed original transaction amount")
        }

        const refundId = generateId('txn')
        const timestamp = new Date().toISOString()

        const refundTransaction: Transaction = {
            id: refundId,
            amount: -refundAmount, // Negative amount for refund
            currency: originalTransaction.currency,
            status: 'completed',
            type: 'refund',
            userId: originalTransaction.userId,
            paymentMethodId: originalTransaction.paymentMethodId,
            description: `Refund for ${originalTransaction.description}${reason ? ` - ${reason}` : ''}`,
            createdAt: timestamp,
            processedAt: timestamp,
            metadata: {
                originalTransactionId: transactionId,
                reason: reason || 'Refund requested'
            }
        }

        transactions.push(refundTransaction)

        // Update original transaction status if fully refunded
        if (refundAmount === originalTransaction.amount) {
            originalTransaction.status = 'refunded'
        }

        console.log('↩️ [Payment Service] Refund processed:', {
            id: refundId,
            originalId: transactionId,
            amount: formatAmount(refundAmount, originalTransaction.currency),
            reason
        })

        return refundTransaction
    }
})