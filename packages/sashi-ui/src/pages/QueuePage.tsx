import {Layout} from "../components/Layout"

export const {format: numberFormat} = new Intl.NumberFormat("en-US")

export const QueuePage = () => {
    console.log("QueuePage component is rendering")
    return <Layout>hello world</Layout>
}
