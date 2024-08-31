import {SashiApp} from "@sashi/ui"

function getBaseUrl() {
    if (process.env.API_URL) {
        return `https://${process.env.API_URL}`
    }

    return `http://localhost:${process.env.API_PORT ?? 3002}/sashi`
}

const Pages = () => {
    return (
        <div>
            <SashiApp apiUrl={getBaseUrl()} basename="/sashi" />
        </div>
    )
}

export default Pages
