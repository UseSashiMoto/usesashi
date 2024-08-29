import {SashiApp} from "@sashi/ui"

function getBaseUrl() {
    if (process.env.API_URL) {
        return `https://${process.env.API_URL}/sashi/api`
    }

    return `http://localhost:${process.env.PORT ?? 3000}/control-panel`
}

const Pages = () => {
    return (
        <div>
            <SashiApp apiUrl={getBaseUrl()} basename="/sashi" />
        </div>
    )
}

export default Pages
