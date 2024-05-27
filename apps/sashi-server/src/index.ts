import express from "express"
import sashiMiddleware from "sashi-middleware" // Adjust import based on actual export

const app = express()
const port = 3000

// Optional: Use JSON middleware if your middleware or routes need it
app.use(express.json())

// Use sashi-middleware
app.use("/api", sashiMiddleware({
    databaseUrl: "",
    redisUrl: "",
    accountIdHeader: ""
}))

// Simple route to check server is running
app.get("/", (req, res) => {
    res.send("Hello from Sashi Express TypeScript Server!")
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
})
