const express = require('express');
const { createMiddleware, loadDefaultFunctionsOnDemand, registerFunctionIntoAI, AIFunction } = require('./dist/index.js');

const app = express();

// Load default functions (they will be hidden from UI)
loadDefaultFunctionsOnDemand(['math', 'text']);

// Create a visible wrapper function
const VisibleAddFunction = new AIFunction("add_numbers", "add two or more numbers together")
    .args({
        name: "numbers",
        description: "array of numbers to add together",
        type: "array",
        required: true
    })
    .returns({
        name: "result",
        description: "the sum of the numbers",
        type: "number"
    })
    .implement(async (numbers) => {
        // Call the hidden function
        const { callFunctionFromRegistry } = require('./dist/index.js');
        const result = await callFunctionFromRegistry("add", numbers);
        return result.result;
    });

registerFunctionIntoAI("add_numbers", VisibleAddFunction);

// Create middleware
const router = createMiddleware({
    openAIKey: process.env.OPENAI_API_KEY || "test-key",
    debug: true
});

app.use('/sashi', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Visit http://localhost:3000/sashi to see the UI');
    console.log('Hidden functions (add, subtract, etc.) will not appear in the dropdown');
    console.log('But visible functions (add_numbers) will appear');
}); 