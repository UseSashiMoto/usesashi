import {SashiApp} from "@sashimo/ui"
import {StrictMode} from "react"
import {createRoot} from "react-dom/client"

interface CustomWindow extends Window {
    __INITIAL_STATE__: {
        apiUrl: string
        basename: string
    }
}

declare let window: CustomWindow

console.log("Root element:", document.getElementById("root"))
console.log("Initial state:", window.__INITIAL_STATE__)

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <div>React App Loaded</div>

        <SashiApp
            apiUrl={window.__INITIAL_STATE__.apiUrl}
            basename={window.__INITIAL_STATE__.basename}
        />
    </StrictMode>
)
