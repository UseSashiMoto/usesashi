import {QueryClient, QueryClientProvider} from "@tanstack/react-query"
import {useEffect, useState} from "react"
import {createBrowserRouter, RouterProvider} from "react-router-dom"
import type {UserPreferences} from "./components/ThemeSwitcher"
import {HomePage} from "./pages/HomePage"

type QueueDashPagesProps = {
    // URL to the API
    apiUrl: string
    // Base path for the app
    basename: string
}
export const App = ({apiUrl, basename}: QueueDashPagesProps) => {
    const [ready, setReady] = useState(false)
    const [queryClient] = useState(() => new QueryClient())

    useEffect(() => {
        const userPreferences: UserPreferences | null = JSON.parse(
            localStorage.getItem("user-preferences") || "null"
        )

        if (userPreferences) {
            if (
                userPreferences.theme === "dark" ||
                (userPreferences.theme === "system" &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches)
            ) {
                document.documentElement.classList.add("dark")
            } else {
                document.documentElement.classList.remove("dark")
            }
        } else {
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                document.documentElement.classList.add("dark")
            } else {
                document.documentElement.classList.remove("dark")
            }
        }

        setReady(true)
    }, [])

    if (!ready) {
        return null
    }

    const router = createBrowserRouter(
        [
            {
                path: "/",
                element: <HomePage apiUrl={apiUrl} />
            }
        ],
        {
            basename
        }
    )

    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}
