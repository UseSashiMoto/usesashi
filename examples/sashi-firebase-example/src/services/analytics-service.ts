import { registerFunctionIntoAI } from "@sashimo/lib"

// Firebase Analytics-style data
const events = [
  { id: "evt_1", type: "page_view", userId: "user_1", timestamp: "2024-01-20T10:00:00Z", data: { page: "/dashboard" } },
  { id: "evt_2", type: "button_click", userId: "user_2", timestamp: "2024-01-20T10:15:00Z", data: { button: "download" } },
  { id: "evt_3", type: "form_submit", userId: "user_1", timestamp: "2024-01-20T10:30:00Z", data: { form: "contact" } },
  { id: "evt_4", type: "page_view", userId: "user_3", timestamp: "2024-01-20T11:00:00Z", data: { page: "/pricing" } },
  { id: "evt_5", type: "conversion", userId: "user_2", timestamp: "2024-01-20T11:15:00Z", data: { value: 99.99 } },
]

const metrics = {
  totalUsers: 1250,
  activeUsers: 890,
  conversions: 45,
  revenue: 4499.55,
  bounceRate: 0.32,
  avgSessionDuration: 420 // seconds
}

registerFunctionIntoAI({
  name: "track_firebase_event",
  description: "Track an analytics event in Firebase",
  parameters: {
    type: "object",
    properties: {
      eventType: {
        type: "string",
        description: "Type of event to track",
        enum: ["page_view", "button_click", "form_submit", "conversion", "error"]
      },
      userId: {
        type: "string",
        description: "ID of the user performing the action"
      },
      data: {
        type: "object",
        description: "Additional event data",
        properties: {}
      }
    },
    required: ["eventType", "userId"]
  },
  handler: async ({ eventType, userId, data = {} }: {
    eventType: string,
    userId: string,
    data?: Record<string, any>
  }) => {
    const newEvent = {
      id: `evt_${Date.now()}`,
      type: eventType,
      userId,
      timestamp: new Date().toISOString(),
      data
    }
    events.push(newEvent)

    return {
      message: "Event tracked successfully in Firebase Analytics",
      event: newEvent,
      source: "Firebase Functions"
    }
  }
})

registerFunctionIntoAI({
  name: "get_firebase_analytics_dashboard",
  description: "Get Firebase Analytics dashboard metrics",
  parameters: {},
  handler: async () => {
    return {
      metrics: {
        ...metrics,
        lastUpdated: new Date().toISOString()
      },
      recentEvents: events.slice(-5),
      source: "Firebase Functions"
    }
  }
})

registerFunctionIntoAI({
  name: "get_firebase_events_by_type",
  description: "Get Firebase Analytics events filtered by type",
  parameters: {
    type: "object",
    properties: {
      eventType: {
        type: "string",
        description: "Type of events to retrieve"
      },
      limit: {
        type: "number",
        description: "Maximum number of events to return",
        default: 10
      }
    },
    required: ["eventType"]
  },
  handler: async ({ eventType, limit = 10 }: { eventType: string, limit?: number }) => {
    const filteredEvents = events
      .filter(e => e.type === eventType)
      .slice(-limit)
      .reverse()

    return {
      events: filteredEvents,
      count: filteredEvents.length,
      eventType,
      source: "Firebase Functions"
    }
  }
})

registerFunctionIntoAI({
  name: "get_firebase_user_events",
  description: "Get all events for a specific user from Firebase Analytics",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user"
      },
      limit: {
        type: "number",
        description: "Maximum number of events to return",
        default: 20
      }
    },
    required: ["userId"]
  },
  handler: async ({ userId, limit = 20 }: { userId: string, limit?: number }) => {
    const userEvents = events
      .filter(e => e.userId === userId)
      .slice(-limit)
      .reverse()

    return {
      events: userEvents,
      count: userEvents.length,
      userId,
      source: "Firebase Functions"
    }
  }
})

registerFunctionIntoAI({
  name: "get_firebase_conversion_funnel",
  description: "Get conversion funnel data from Firebase Analytics",
  parameters: {},
  handler: async () => {
    const funnelSteps = [
      { step: "page_view", count: events.filter(e => e.type === "page_view").length },
      { step: "button_click", count: events.filter(e => e.type === "button_click").length },
      { step: "form_submit", count: events.filter(e => e.type === "form_submit").length },
      { step: "conversion", count: events.filter(e => e.type === "conversion").length }
    ]

    // Calculate conversion rates
    const funnelWithRates = funnelSteps.map((step, index) => {
      const conversionRate = index === 0 ? 100 : (step.count / funnelSteps[0].count) * 100
      return {
        ...step,
        conversionRate: Math.round(conversionRate * 100) / 100
      }
    })

    return {
      funnel: funnelWithRates,
      totalConversions: funnelSteps[funnelSteps.length - 1].count,
      source: "Firebase Functions"
    }
  }
})