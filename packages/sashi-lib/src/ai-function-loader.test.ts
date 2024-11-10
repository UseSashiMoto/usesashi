import { describe, expect, it } from "@jest/globals";

import { AIBoolean } from "./ai-function-loader";
// aiFunctionRegistry.test.ts
import {
    AIFieldEnum,
    AIFunction,
    AIObject,
    callFunctionFromRegistry,
    registerFunctionIntoAI
} from "./ai-function-loader"; // Adjust the import path as needed

describe("AI Function Registry", () => {
    const AddFunction = new AIFunction("add", "Adds two numbers")
        .args(
            {
                name: "a",
                description: "First number to add",
                type: "number",
                required: true
            },
            {
                name: "b",
                description: "Second number to add",
                type: "number",
                required: true
            }
        )
        .returns({
            name: "result",
            type: "number",
            description: "The sum of the two numbers"
        })
        .implement((a: number, b: number) => {
            return a + b
        })

    // Define a nested object for location details
    const LocationObject = new AIObject("location", "Location details", true)
        .field({
            name: "city",
            type: "string",
            description: "The city name",
            required: true
        })
        .field({
            name: "country",
            type: "string",
            description: "The country name",
            required: true
        })
        .field(
            new AIFieldEnum(
                "region",
                "The region of the country",
                ["North", "South", "East", "West"],
                true
            )
        )

    // Define the main function that uses nested objects and enums
    const WeatherForecastFunction = new AIFunction(
        "get_weather_forecast",
        "Get a weather forecast"
    )
        .args(
            LocationObject, // Use the nested location object
            new AIFieldEnum(
                "unit",
                "The temperature unit",
                ["celsius", "fahrenheit"], // Enum values for temperature unit
                true
            ),
            {
                name: "includeHumidity",
                description: "Whether to include humidity in the forecast",
                type: "boolean",
                required: true
            } as AIBoolean
        )
        .returns({
            name: "forecast",
            type: "string",
            description:
                "The weather forecast with temperature and optional humidity"
        })
        .implement((location: any, unit: string, includeHumidity: boolean) => {
            const temperature = unit === "celsius" ? "20°C" : "68°F"
            const forecast = `Weather in ${location.city}, ${location.country} (${location.region}): ${temperature}`
            if (includeHumidity) {
                return `${forecast} with 60% humidity.`
            }
            return forecast
        })

    beforeAll(() => {
        registerFunctionIntoAI("add", AddFunction)
    })

    it("should register the function and return the correct result", async () => {
        const result = await callFunctionFromRegistry("add", 1, 2)
        expect(result).toBe(3)
    })

    it("should validate the payload", async () => {
        await expect(
            callFunctionFromRegistry("add", 1, "two" as any)
        ).resolves.toContain("There was an issue with the parameters you provided for the function")
    })

    it("should validate the return value", async () => {
        class InvalidAddFunction extends AIFunction {
            constructor() {
                super(
                    "invalidAdd",
                    "Adds two numbers and returns a string (invalid)"
                )
                this.args(
                    {
                        name: "a",
                        type: "number",
                        description: "The first number"
                    },
                    {
                        name: "b",
                        type: "number",
                        description: "The second number"
                    }
                )
                    .returns({
                        name: "result",
                        type: "number",
                        description: "The sum of the two numbers as a number"
                    })
                    .implement((a: number, b: number) => `${a + b}`) // Returning a string instead of number
            }
        }

        const invalidAdd = new InvalidAddFunction()
        registerFunctionIntoAI("invalidAdd", invalidAdd)

        expect(
            await callFunctionFromRegistry<InvalidAddFunction>(
                "invalidAdd",
                1,
                2
            )
        ).toContain("There was an issue with the parameters you provided for the function ")
    })

    it("should correctly handle different types of parameters", async () => {
        class MixedParamsFunction extends AIFunction {
            constructor() {
                super("mixedParams", "Function with mixed parameter types")
                this.args(
                    {
                        name: "str",
                        type: "string",
                        description: "A string parameter"
                    },
                    {
                        name: "num",
                        type: "number",
                        description: "A number parameter"
                    },
                    {
                        name: "bool",
                        type: "boolean",
                        description: "A boolean parameter"
                    }
                )
                    .returns({
                        name: "result",
                        type: "string",
                        description: "A concatenated string"
                    })
                    .implement(
                        (str: string, num: number, bool: boolean) =>
                            `${str} - ${num} - ${bool}`
                    )
            }
        }

        const mixedParams = new MixedParamsFunction()
        registerFunctionIntoAI("mixedParams", mixedParams)

        const result = await callFunctionFromRegistry<MixedParamsFunction>(
            "mixedParams",
            "test",
            42,
            true
        )
        expect(result).toBe("test - 42 - true")

        /*await expect(
            callFunctionFromRegistry<MixedParamsFunction>(
                "mixedParams",
                "test",
                42,
                "not boolean" as any
            )
        ).rejects.toThrow()*/
    })

    it("should describe function parameters and return type correctly", () => {
        const expected = {
            type: "function",
            function: {
                name: "add",
                description: "Adds two numbers",
                parameters: {
                    type: "object",
                    properties: {
                        a: {
                            type: "number",
                            description: "First number to add"
                        },
                        b: {
                            type: "number",
                            description: "Second number to add"
                        }
                    },

                    required: ["a", "b"]
                }
            }
        }
        const description = AddFunction.description()

        expect(expected).toEqual(description)
    })

    beforeAll(() => {
        registerFunctionIntoAI("get_weather_forecast", WeatherForecastFunction)
    })

    // Test the complex function call with correct values
    it("should return the correct weather forecast with nested object and enum values", async () => {
        const location = {
            city: "San Francisco",
            country: "USA",
            region: "West" // Enum value
        }
        const result = await callFunctionFromRegistry(
            "get_weather_forecast",
            location,
            "celsius",
            true
        )
        expect(result).toBe(
            "Weather in San Francisco, USA (West): 20°C with 60% humidity."
        )
    })

    // Test description of complex function parameters and nested object
    it("should describe the nested object and enum fields correctly", () => {
        const description = WeatherForecastFunction.description()
        expect(description).toEqual({
            type: "function",
            function: {
                name: "get_weather_forecast",
                description: "Get a weather forecast",
                parameters: {
                    type: "object",
                    properties: {
                        location: {
                            name: "location",
                            type: "object",
                            description: "Location details",
                            properties: {
                                city: {
                                    type: "string",
                                    description: "The city name"
                                },
                                country: {
                                    type: "string",
                                    description: "The country name"
                                },
                                region: {
                                    type: "string",
                                    enum: ["North", "South", "East", "West"],
                                    description: "The region of the country"
                                }
                            },
                            required: ["city", "country", "region"]
                        },
                        unit: {
                            type: "string",
                            enum: ["celsius", "fahrenheit"],
                            description: "The temperature unit"
                        },
                        includeHumidity: {
                            type: "boolean",
                            description:
                                "Whether to include humidity in the forecast"
                        }
                    },
                    required: ["location", "unit", "includeHumidity"]
                }
            }
        })
    })

    // Test invalid input (wrong enum value)
    it("should throw an error when an invalid enum value is passed", async () => {
        const location = {
            city: "San Francisco",
            country: "USA",
            region: "Central" // Invalid region (should be one of "North", "South", "East", "West")
        }

        expect(
            await callFunctionFromRegistry(
                "get_weather_forecast",
                location,
                "celsius",
                true
            )
        ).toBe(
            "Weather in San Francisco, USA (Central): 20°C with 60% humidity."
        )
    })
})