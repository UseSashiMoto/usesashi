import { SashiApp } from "@sashimo/ui"

function getBaseUrl() {
    if (process.env.API_URL) {
        return `https://${process.env.API_URL}`
    }

    return `http://localhost:${process.env.API_PORT ?? 3003}/sashi`
}

const Pages = () => {
    console.log("connecting to api at", getBaseUrl())
    return (
        <div>
            <SashiApp
                sessionToken="userone-session-token"
                apiUrl={getBaseUrl()}
            />
        </div>
    )
}

export default Pages
