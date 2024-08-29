import React from "react"
import {createRoot} from "react-dom/client"
import AIBotPage from "./page/AIBotPage"

const container = document.getElementById("root")
if (container) {
    createRoot(container).render(<AIBotPage />)
}
