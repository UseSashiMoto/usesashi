import {ChakraProvider, extendBaseTheme} from "@chakra-ui/react"
import React from "react"
import AIBotComponent from "./AIBotComponent"

const AIBotPage = () => {
    console.log("AIBotPage component is rendering")

    const theme = extendBaseTheme({
        components: {}
    })
    return (
        <ChakraProvider theme={theme}>
            <AIBotComponent />
        </ChakraProvider>
    )
}

export default AIBotPage
