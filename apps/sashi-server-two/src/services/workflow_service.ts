import { AIFunction, registerFunctionIntoAI } from "@sashimo/lib"
import { registerGenericWorkflowFunctions } from "@sashimo/lib/src/generic-workflow-functions"

// Register the generic workflow functions so they're available to the AI
registerGenericWorkflowFunctions()




// Function to create a simple report
const CreateReportFunction = new AIFunction(
    "createReport",
    "Create a formatted report from processed data"
)
    .args({
        name: "data",
        description: "Data to include in report",
        type: "object",
        required: true
    })
    .args({
        name: "title",
        description: "Report title",
        type: "string",
        required: false
    })
    .implement(async (data: any, title: string = "Data Report") => {
        const reportData = Array.isArray(data) ? data : [data]

        return {
            title,
            generatedAt: new Date().toISOString(),
            summary: {
                totalRecords: reportData.length,
                dataTypes: [...new Set(reportData.map(item => typeof item))],
                hasErrors: reportData.some(item => item.errors || item.error)
            },
            data: reportData,
            reportFormat: "JSON",
            status: "completed"
        }
    })



// Register the workflow functions
registerFunctionIntoAI("createReport", CreateReportFunction)



