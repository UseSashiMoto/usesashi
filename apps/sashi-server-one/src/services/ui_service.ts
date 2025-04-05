import {
    AIArray,
    AIObject,
    VisualizationFunction,
    registerFunctionIntoAI
} from "@sashimo/lib"

const tableFunction = new VisualizationFunction(
    "tableVisualization",
    "Displays data as a table",
    "table"
)
    .args(
        new AIArray(
            "data",
            "The data to render in a table",
            new AIObject("row", "Row data", true)
        )
    )
    .returns(new AIObject("renderedTable", "HTML for a rendered table", true))
    .implement((data: any) => {
        // Format the data for the table
        return {
            type: "table",
            content: data // Assuming data is an array of objects representing rows
        }
    })

registerFunctionIntoAI("tableVisualization", tableFunction)

const dataCardFunction = new VisualizationFunction(
    "dataCardVisualization",
    "Displays single piece of data as a card to make it easier to read",
    "dataCard"
)
    .args(new AIObject("data", "The data to render in a data card", true))
    .returns(
        new AIObject("renderedDataCard", "HTML for a rendered data card", true)
    )
    .implement((data: any) => {
        // Format the data for the data card
        return {
            type: "dataCard",
            content: data // Assuming data is an object representing the data card
        }
    })

registerFunctionIntoAI("dataCardVisualization", dataCardFunction)
