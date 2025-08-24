import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// Analytics interfaces
interface AnalyticsEvent {
    id: string
    eventType: string
    userId?: string
    sessionId: string
    timestamp: string
    properties: Record<string, any>
    source: string
}

interface DashboardMetric {
    id: string
    name: string
    value: number
    previousValue: number
    change: number
    changeType: 'increase' | 'decrease' | 'no_change'
    unit: string
    category: string
}

interface UserEngagement {
    date: string
    activeUsers: number
    newUsers: number
    returningUsers: number
    sessionDuration: number
    pageViews: number
}

// Mock data
const analyticsEvents: AnalyticsEvent[] = [
    {
        id: 'evt_001',
        eventType: 'page_view',
        userId: 'user_123',
        sessionId: 'sess_abc',
        timestamp: '2024-08-16T10:00:00Z',
        properties: { page: '/dashboard', referrer: 'google.com' },
        source: 'web'
    },
    {
        id: 'evt_002',
        eventType: 'user_signup',
        userId: 'user_456',
        sessionId: 'sess_def',
        timestamp: '2024-08-16T10:15:00Z',
        properties: { plan: 'free', source: 'organic' },
        source: 'web'
    },
    {
        id: 'evt_003',
        eventType: 'feature_used',
        userId: 'user_123',
        sessionId: 'sess_abc',
        timestamp: '2024-08-16T10:30:00Z',
        properties: { feature: 'export_data', duration: 5000 },
        source: 'web'
    }
]

const dashboardMetrics: DashboardMetric[] = [
    {
        id: 'metric_001',
        name: 'Total Users',
        value: 1250,
        previousValue: 1180,
        change: 5.9,
        changeType: 'increase',
        unit: 'users',
        category: 'users'
    },
    {
        id: 'metric_002',
        name: 'Active Sessions',
        value: 89,
        previousValue: 95,
        change: -6.3,
        changeType: 'decrease',
        unit: 'sessions',
        category: 'engagement'
    },
    {
        id: 'metric_003',
        name: 'Revenue',
        value: 12500,
        previousValue: 11800,
        change: 5.9,
        changeType: 'increase',
        unit: 'USD',
        category: 'revenue'
    },
    {
        id: 'metric_004',
        name: 'Conversion Rate',
        value: 3.2,
        previousValue: 2.8,
        change: 14.3,
        changeType: 'increase',
        unit: '%',
        category: 'conversion'
    }
]

// Helper functions
const generateEventId = () => `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const getDateRange = (days: number): Date[] => {
    const dates: Date[] = []
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        dates.push(date)
    }
    return dates
}

const generateMockEngagementData = (days: number): UserEngagement[] => {
    return getDateRange(days).map(date => ({
        date: (date ? date?.toISOString()?.split('T')[0] : '') as string,
        activeUsers: Math.floor(Math.random() * 100) + 50,
        newUsers: Math.floor(Math.random() * 20) + 5,
        returningUsers: Math.floor(Math.random() * 80) + 40,
        sessionDuration: Math.floor(Math.random() * 300) + 120, // 2-7 minutes
        pageViews: Math.floor(Math.random() * 500) + 200
    }))
}

// AI Object definitions
const AnalyticsEventObject = new AIObject("AnalyticsEvent", "analytics event data", true)
    .field({
        name: "id",
        description: "unique event identifier",
        type: "string",
        required: true
    })
    .field({
        name: "eventType",
        description: "type of event (e.g., page_view, user_signup, feature_used)",
        type: "string",
        required: true
    })
    .field({
        name: "userId",
        description: "ID of the user who triggered the event",
        type: "string",
        required: false
    })
    .field({
        name: "sessionId",
        description: "session identifier",
        type: "string",
        required: true
    })
    .field({
        name: "timestamp",
        description: "when the event occurred",
        type: "string",
        required: true
    })
    .field({
        name: "properties",
        description: "event-specific properties and metadata",
        type: "object",
        required: false
    })
    .field({
        name: "source",
        description: "source of the event (web, mobile, api)",
        type: "string",
        required: true
    })

const DashboardMetricObject = new AIObject("DashboardMetric", "dashboard metric with trends", true)
    .field({
        name: "id",
        description: "unique metric identifier",
        type: "string",
        required: true
    })
    .field({
        name: "name",
        description: "display name of the metric",
        type: "string",
        required: true
    })
    .field({
        name: "value",
        description: "current value of the metric",
        type: "number",
        required: true
    })
    .field({
        name: "previousValue",
        description: "previous period value for comparison",
        type: "number",
        required: true
    })
    .field({
        name: "change",
        description: "percentage change from previous period",
        type: "number",
        required: true
    })
    .field({
        name: "changeType",
        description: "direction of change (increase, decrease, no_change)",
        type: "string",
        required: true
    })
    .field({
        name: "unit",
        description: "unit of measurement",
        type: "string",
        required: true
    })
    .field({
        name: "category",
        description: "metric category (users, engagement, revenue, etc.)",
        type: "string",
        required: true
    })

const UserEngagementObject = new AIObject("UserEngagement", "daily user engagement metrics", true)
    .field({
        name: "date",
        description: "date in YYYY-MM-DD format",
        type: "string",
        required: true
    })
    .field({
        name: "activeUsers",
        description: "number of active users on this date",
        type: "number",
        required: true
    })
    .field({
        name: "newUsers",
        description: "number of new users who signed up",
        type: "number",
        required: true
    })
    .field({
        name: "returningUsers",
        description: "number of returning users",
        type: "number",
        required: true
    })
    .field({
        name: "sessionDuration",
        description: "average session duration in seconds",
        type: "number",
        required: true
    })
    .field({
        name: "pageViews",
        description: "total page views for the date",
        type: "number",
        required: true
    })

const AnalyticsSummaryObject = new AIObject("AnalyticsSummary", "analytics summary and insights", true)
    .field({
        name: "totalEvents",
        description: "total number of events tracked",
        type: "number",
        required: true
    })
    .field({
        name: "uniqueUsers",
        description: "number of unique users",
        type: "number",
        required: true
    })
    .field({
        name: "uniqueSessions",
        description: "number of unique sessions",
        type: "number",
        required: true
    })
    .field({
        name: "topEvents",
        description: "most common event types",
        type: "array",
        required: true
    })
    .field({
        name: "averageSessionDuration",
        description: "average session duration in minutes",
        type: "number",
        required: true
    })
    .field({
        name: "timeRange",
        description: "time range of the data",
        type: "string",
        required: true
    })

// Register all analytics functions using the new format
registerFunctionIntoAI({
    name: "track_event",
    description: "record a new analytics event",
    parameters: {
        eventType: {
            type: "string",
            description: "type of event to track",
            required: true
        },
        userId: {
            type: "string",
            description: "ID of the user performing the action",
            required: false
        },
        sessionId: {
            type: "string",
            description: "current session identifier",
            required: false
        },
        properties: {
            type: "string",
            description: "event properties as JSON string",
            required: false
        },
        source: {
            type: "string",
            description: "source of the event (web, mobile, api)",
            required: false
        }
    },
    handler: async ({ eventType, userId, sessionId = `sess_${Date.now()}`, properties = '{}', source = 'web' }) => {
        const eventId = generateEventId()
        const timestamp = new Date().toISOString()

        // Parse properties
        let parsedProperties: Record<string, any> = {}
        try {
            parsedProperties = JSON.parse(properties)
        } catch (error) {
            parsedProperties = { raw: properties }
        }

        const event: AnalyticsEvent = {
            id: eventId,
            eventType,
            userId,
            sessionId,
            timestamp,
            properties: parsedProperties,
            source
        }

        analyticsEvents.push(event)

        console.log('📊 [Analytics] Event tracked:', {
            id: eventId,
            type: eventType,
            userId,
            sessionId,
            source
        })

        return event
    }
})

registerFunctionIntoAI({
    name: "get_dashboard_metrics",
    description: "retrieve key dashboard metrics",
    parameters: {
        category: {
            type: "string",
            description: "filter metrics by category (users, engagement, revenue, conversion)",
            required: false
        }
    },
    handler: async ({ category }) => {
        if (category) {
            return dashboardMetrics.filter(metric => metric.category === category)
        }
        return dashboardMetrics
    }
})

registerFunctionIntoAI({
    name: "get_dashboard_metrics_by_category",
    description: "retrieve dashboard metrics filtered by category",
    parameters: {
        category: {
            type: "string",
            description: "filter metrics by category (users, engagement, revenue, conversion)",
            required: true
        }
    },
    handler: async ({ category }) => {
        return dashboardMetrics.filter(metric => metric.category === category)
    }
})

registerFunctionIntoAI({
    name: "get_user_engagement",
    description: "retrieve user engagement data for the last 30 days",
    parameters: {},
    handler: async () => {
        return generateMockEngagementData(30)
    }
})

registerFunctionIntoAI({
    name: "get_user_engagement_custom",
    description: "retrieve user engagement data for a custom number of days",
    parameters: {
        days: {
            type: "number",
            description: "number of days to retrieve data for (1-365)",
            required: true
        }
    },
    handler: async ({ days }) => {
        if (days < 1 || days > 365) {
            throw new Error("Days must be between 1 and 365")
        }
        return generateMockEngagementData(days)
    }
})

registerFunctionIntoAI({
    name: "get_recent_events",
    description: "retrieve the 50 most recent analytics events",
    parameters: {},
    handler: async () => {
        return analyticsEvents
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50)
    }
})

registerFunctionIntoAI({
    name: "get_recent_events_custom",
    description: "retrieve recent analytics events with custom limit",
    parameters: {
        limit: {
            type: "number",
            description: "maximum number of events to return",
            required: true
        }
    },
    handler: async ({ limit }) => {
        return analyticsEvents
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, Math.max(1, Math.min(limit, 1000))) // Limit between 1-1000
    }
})

registerFunctionIntoAI({
    name: "get_events_by_type",
    description: "retrieve analytics events filtered by event type",
    parameters: {
        eventType: {
            type: "string",
            description: "event type to filter by",
            required: true
        }
    },
    handler: async ({ eventType }) => {
        return analyticsEvents
            .filter(event => event.eventType === eventType)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 100) // Reasonable default limit
    }
})

registerFunctionIntoAI({
    name: "get_events_by_user",
    description: "retrieve analytics events for a specific user",
    parameters: {
        userId: {
            type: "string",
            description: "user ID to filter events by",
            required: true
        }
    },
    handler: async ({ userId }) => {
        return analyticsEvents
            .filter(event => event.userId === userId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 100) // Reasonable default limit
    }
})

registerFunctionIntoAI({
    name: "get_analytics_summary",
    description: "get comprehensive analytics summary",
    parameters: {
        hours: {
            type: "number",
            description: "number of hours to analyze (default: 24)",
            required: false
        }
    },
    handler: async ({ hours = 24 }) => {
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
        const recentEvents = analyticsEvents.filter(
            event => new Date(event.timestamp) > cutoffTime
        )

        const uniqueUsers = new Set(recentEvents.filter(e => e.userId).map(e => e.userId)).size
        const uniqueSessions = new Set(recentEvents.map(e => e.sessionId)).size

        // Count event types
        const eventCounts: Record<string, number> = {}
        recentEvents.forEach(event => {
            eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1
        })

        const topEvents = Object.entries(eventCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([eventType, count]) => ({ eventType, count }))

        // Calculate average session duration (mock calculation)
        const averageSessionDuration = Math.floor(Math.random() * 10) + 5 // 5-15 minutes

        return {
            totalEvents: recentEvents.length,
            uniqueUsers,
            uniqueSessions,
            topEvents,
            averageSessionDuration,
            timeRange: `Last ${hours} hours`
        }
    }
})

registerFunctionIntoAI({
    name: "get_conversion_funnel",
    description: "analyze conversion funnel metrics",
    parameters: {
        funnelSteps: {
            type: "string",
            description: "comma-separated list of funnel steps to analyze",
            required: false
        }
    },
    handler: async ({ funnelSteps = "page_view,user_signup,feature_used" }) => {
        const steps = funnelSteps.split(',').map(s => s.trim())

        // Mock funnel data generation
        let currentUsers = 1000
        const stepData = steps.map((step, index) => {
            const dropoffRate = 0.2 + (index * 0.1) // Increasing dropoff at each step
            const users = Math.floor(currentUsers * (1 - dropoffRate))
            const conversionRate = index === 0 ? 100 : (users / 1000) * 100

            const result = {
                step,
                users: index === 0 ? currentUsers : users,
                conversionRate: Math.round(conversionRate * 100) / 100,
                dropoffRate: index === 0 ? 0 : Math.round(dropoffRate * 100 * 100) / 100
            }

            currentUsers = users
            return result
        })

        const completedUsers = currentUsers
        const overallConversionRate = Math.round((completedUsers / 1000) * 100 * 100) / 100

        return {
            steps: stepData,
            overallConversionRate,
            totalUsers: 1000,
            completedUsers
        }
    }
})