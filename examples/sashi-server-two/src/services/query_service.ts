import { AIFunction, registerFunctionIntoAI } from "@sashimo/lib";

// Mock database for testing
const mockDatabase = {
    users: [
        { id: 1, name: "John Doe", email: "john@example.com", role: "admin", isActive: true, createdAt: "2024-01-15" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", role: "user", isActive: true, createdAt: "2024-02-20" },
        { id: 3, name: "Bob Wilson", email: "bob@example.com", role: "user", isActive: false, createdAt: "2024-03-10" },
        { id: 4, name: "Alice Brown", email: "alice@example.com", role: "moderator", isActive: true, createdAt: "2024-04-05" }
    ],
    files: [
        { id: 1, name: "document.pdf", userId: 1, mimeType: "application/pdf", size: 1024000 },
        { id: 2, name: "image.png", userId: 2, mimeType: "image/png", size: 512000 },
        { id: 3, name: "spreadsheet.xlsx", userId: 1, mimeType: "application/vnd.ms-excel", size: 2048000 }
    ]
};

// Simple execute_query function for testing _generate
const ExecuteQueryFunction = new AIFunction(
    "execute_query",
    "Execute a raw SQL-like query. For testing, this simulates SQL execution against a mock database. Supports basic SELECT queries."
)
    .args({
        name: "sql",
        type: "string",
        description: "The SQL query to execute",
        required: true
    })
    .implement(async (sql: string) => {
        console.log('[ExecuteQuery] Executing SQL:', sql);

        // Simple mock: analyze the SQL to determine what to return
        const sqlLower = sql.toLowerCase();

        if (sqlLower.includes('select') && sqlLower.includes('user')) {
            // Filter based on conditions in the query
            let users = mockDatabase.users;

            if (sqlLower.includes("isactive = true") || sqlLower.includes('isactive=true')) {
                users = users.filter(u => u.isActive);
            }

            if (sqlLower.includes("role = 'admin'") || sqlLower.includes('role="admin"')) {
                users = users.filter(u => u.role === 'admin');
            }

            return users;
        }

        if (sqlLower.includes('select') && sqlLower.includes('file')) {
            return mockDatabase.files;
        }

        // Default: return all users
        if (sqlLower.includes('select')) {
            return mockDatabase.users;
        }

        throw new Error('Only SELECT queries are supported in this mock implementation');
    });

// Function that returns data suitable for transformation
const GetAnalyticsDataFunction = new AIFunction(
    "get_analytics_data",
    "Get analytics data that can be transformed into various formats. Returns structured data about users and system usage."
)
    .implement(async () => {
        return {
            totalUsers: 150,
            activeUsers: 89,
            inactiveUsers: 61,
            newUsersThisMonth: 23,
            usersByRole: {
                admin: 5,
                user: 120,
                moderator: 25
            },
            topFeatures: [
                { name: "Dashboard", usage: 450, percentage: 45 },
                { name: "Reports", usage: 320, percentage: 32 },
                { name: "Settings", usage: 180, percentage: 18 },
                { name: "Profile", usage: 50, percentage: 5 }
            ],
            recentActivity: {
                last24Hours: 1250,
                last7Days: 8750,
                last30Days: 35000
            }
        };
    });

// Function that returns stringified JSON (like the user's query_data function)
const QueryDataFunction = new AIFunction(
    "query_data_mock",
    "Mock function that returns stringified JSON, similar to the user's production query_data function. Use _transform to extract the data array."
)
    .args({
        name: "query",
        type: "string",
        description: "Natural language query",
        required: true
    })
    .implement(async (query: string) => {
        console.log('[QueryDataMock] Processing query:', query);

        // Simulate the stringified JSON response format from the user's function
        const response = {
            success: true,
            interpretation: `Mock query: ${query}`,
            count: mockDatabase.users.length,
            limit: 10,
            sql: `SELECT * FROM "User" LIMIT 10`,
            data: mockDatabase.users,
            query: query
        };

        // Return as stringified JSON (simulating the user's actual function)
        return JSON.stringify(response);
    });

registerFunctionIntoAI("execute_query", ExecuteQueryFunction);
registerFunctionIntoAI("get_analytics_data", GetAnalyticsDataFunction);
registerFunctionIntoAI("query_data_mock", QueryDataFunction);

console.log('✅ Query service functions registered (execute_query, get_analytics_data, query_data_mock)');

