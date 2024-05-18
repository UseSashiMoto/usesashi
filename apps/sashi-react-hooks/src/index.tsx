// src/useDynamicValue.tsx
import {useEffect, useState} from "react"
import axios from "axios"

const serverUrl = "https://your-server.com/api/values"

export function useDynamicValue(key: string, defaultValue: any) {
    const [value, setValue] = useState(defaultValue)

    // Fetch initial value from the server
    useEffect(() => {
        axios
            .get(`${serverUrl}?key=${key}`)
            .then((response) => {
                setValue(response.data.value || defaultValue)
            })
            .catch(() => setValue(defaultValue))
    }, [key, defaultValue])

    // Listen to messages from the Chrome extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== window || !event.data.type) return
            if (event.data.type === "UPDATE_VALUE" && event.data.key === key) {
                setValue(event.data.newValue)
                // Optionally update server with new value
                axios.post(`${serverUrl}`, {key, value: event.data.newValue})
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [key])

    return value
}
