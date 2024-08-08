// aiFunctionRegistry.test.ts
import {
    AIFunction,
    callFunctionFromRegistry,
    registerFunctionIntoAI
} from "./ai-function-loader" // Adjust the import path as needed

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
        ).rejects.toThrow()
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

        await expect(
            callFunctionFromRegistry<InvalidAddFunction>("invalidAdd", 1, 2)
        ).rejects.toThrow()
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

        await expect(
            callFunctionFromRegistry<MixedParamsFunction>(
                "mixedParams",
                "test",
                42,
                "not boolean" as any
            )
        ).rejects.toThrow()
    })

    it("should describe function parameters and return type correctly", () => {
        const description = AddFunction.description()
        expect(description).toEqual({
            type: "function",
            function: {
                name: "add",
                description: "Adds two numbers",
                parameters: {
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
        })
    })
})
