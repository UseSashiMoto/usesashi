import {PaperPlaneIcon} from "@radix-ui/react-icons"
import axios from "axios"
import {motion} from "framer-motion"
import {X} from "lucide-react"
import React, {useEffect} from "react"
import {MasonryIcon, VercelIcon} from "src/components/message-icons"
import {Message} from "src/components/MessageComponent"
import {useScrollToBottom} from "src/components/use-scroll-to-bottom"
import useAppStore from "src/store/chat-store"
import {MessageItem} from "src/store/models"
import {Layout} from "../components/Layout"

function getUniqueId() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    )
}
export const HomePage = ({apiUrl}: {apiUrl: string}) => {
    const storedMessages = useAppStore(
        (state: {messages: any}) => state.messages
    )

    const clearMessages = useAppStore((state) => state.clearMessages)

    const storedMode = useAppStore((state: {mode: any}) => state.mode)
    const addMessage = useAppStore(
        (state: {addMessage: any}) => state.addMessage
    )

    const threadId = useAppStore((state: {threadId: any}) => state.threadId)
    const setThreadId = useAppStore(
        (state: {setThreadId: any}) => state.setThreadId
    )

    const messageRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const [isMounted, setMounted] = React.useState(false)

    const [loading, setLoading] = React.useState(false)
    const [inputText, setInputText] = React.useState("")
    const [messageItems, setMessageItems] = React.useState<MessageItem[]>([])

    const [funcType, setFuncType] = React.useState(0)

    const [messagesContainerRef, messagesEndRef] =
        useScrollToBottom<HTMLDivElement>()

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isMounted) {
            setFuncType(storedMode)
            setMessageItems(storedMessages)
        }
    }, [isMounted])

    const sendMessage = async ({
        payload
    }: {
        payload: {
            tools?: any[]
            inquiry?: string
            previous: any
            type: string
        }
    }) => {
        const response = await axios.post(`${apiUrl}/chat`, payload)

        return response.data
    }

    const handleClearMessages = async () => {
        setMessageItems([])
        clearMessages()
    }

    const submitChatCompletion = async () => {
        if (inputText.length === 0) {
            return
        }

        setLoading(true)

        const text = inputText

        setInputText("")
        inputRef.current?.blur()

        let previous = messageItems.map((item) => {
            return {
                role: item.role,
                content: item.content
            }
        })

        const newUserMessage: MessageItem = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: "user",
            content: text
        }
        setMessageItems((prev) => [...prev, ...[newUserMessage]])
        addMessage(newUserMessage)

        resetScroll()

        let result_tools = []
        let isCompleted = false
        let MAX_LOOP_COUNT = 10 // Don't want to let it run loose
        let loopCount = 0

        try {
            do {
                const payload: {
                    tools?: any[]
                    inquiry?: string
                    previous: any
                    type: string
                } =
                    result_tools.length > 0
                        ? {
                              tools: result_tools,
                              previous,
                              type: "/chat/function"
                          }
                        : {inquiry: text, previous, type: "/chat/message"}

                const result = await sendMessage({payload})

                if (result.output.content) {
                    const newAssistantMessage: MessageItem = {
                        id: getUniqueId(),
                        created_at: new Date().toISOString(),
                        role: "assistant",
                        content: result.output.content
                    }
                    setMessageItems((prev) => [
                        ...prev,
                        ...[newAssistantMessage]
                    ])
                    addMessage(newAssistantMessage)

                    previous.push({
                        role: "assistant",
                        content: result.output.content
                    })

                    resetScroll()
                }

                if (result.output.tool_calls) {
                    loopCount++

                    if (loopCount >= MAX_LOOP_COUNT) {
                        isCompleted = true
                    } else {
                        result_tools = result.output.tool_calls
                    }
                } else {
                    isCompleted = true
                }
            } while (!isCompleted)
        } catch (error: any) {
            const payload: {
                tools?: any[]
                inquiry?: string
                previous: any
                type: string
            } =
                result_tools.length > 0
                    ? {
                          tools: result_tools,
                          previous,
                          type: "/chat/function"
                      }
                    : {inquiry: text, previous, type: "/chat/message"}
        } finally {
            setLoading(false)

            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }

    const submitAssistant = async () => {
        setLoading(true)

        const text = inputText

        setInputText("")
        inputRef.current?.blur()

        const message_id = getUniqueId()

        const newUserMessage: MessageItem = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: "user",
            content: text
        }
        setMessageItems((prev) => [...prev, ...[newUserMessage]])
        addMessage(newUserMessage)

        resetScroll()

        try {
            const thread_id = threadId ? threadId : ""

            const response = await fetch("/assistant/message", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inquiry: text,
                    threadId: thread_id,
                    messageId: message_id
                })
            })

            if (!response.ok) {
                console.log("Oops, an error occurred", response.status)
            }

            const result = await response.json()

            setThreadId(result.threadId)

            if (result.messages.length > 0) {
                let new_messages = []

                for (let i = 0; i < result.messages.length; i++) {
                    const msg = result.messages[i]

                    if (
                        Object.prototype.hasOwnProperty.call(msg.metadata, "id")
                    ) {
                        if (msg.metadata.id === message_id) {
                            break // last message
                        }
                    } else {
                        new_messages.push({
                            id: msg.id,
                            created_at: msg.created_at,
                            role: msg.role,
                            content: msg.content[0].text.value
                        })
                    }
                }

                if (new_messages.length > 0) {
                    setMessageItems((prev) => [...prev, ...new_messages])

                    for (let newmsg of new_messages) {
                        addMessage(newmsg)
                    }

                    resetScroll()
                }
            }
        } catch (error: any) {
            console.log(error.name, error.message)
        } finally {
            setLoading(false)

            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }

    const handleSubmit = async (e: {preventDefault: () => void}) => {
        e.preventDefault()
        if (funcType > 0) {
            submitAssistant()
        } else {
            submitChatCompletion()
        }
    }

    const resetScroll = () => {
        setTimeout(() => {
            if (!messageRef.current) return
            messageRef.current.scrollTop =
                (messageRef.current?.scrollHeight ?? 0) + 24
        }, 100)
    }

    return (
        <Layout>
            <div className="flex flex-row justify-center pb-20 h-dvh bg-white dark:bg-zinc-900">
                <div className="flex flex-col items-center justify-between gap-4">
                    <div
                        ref={messagesContainerRef}
                        className="flex flex-col gap-3 h-full w-dvw items-center overflow-y-scroll"
                    >
                        {messageItems.length === 0 && (
                            <motion.div className="h-[350px] px-4 w-full md:w-[500px] md:px-0 pt-20">
                                <div className="border rounded-lg p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
                                    <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
                                        <VercelIcon size={16} />
                                        <span>+</span>
                                        <MasonryIcon />
                                    </p>
                                    <p>
                                        Sashi Bot is a chatbot that can be used
                                        to do administrative tasks on your
                                        application. It can be integrated with
                                        your application using the Sashi SDK.
                                    </p>
                                    <p>
                                        {" "}
                                        Learn more about the{" "}
                                        <a
                                            className="text-blue-500 dark:text-blue-400"
                                            href="https://sdk.vercel.ai/docs/ai-sdk-rsc/streaming-react-components"
                                            target="_blank"
                                        >
                                            Sashi SDK
                                        </a>
                                        from our website.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        {messageItems.map((item) => (
                            <Message role={item.role} content={item.content} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px] mb-4"></div>

                    <form
                        className="flex w-full flex-row gap-2 relative justify-center items-center"
                        onSubmit={async (event) => {
                            event.preventDefault()
                            handleSubmit(event)
                            setInputText("")
                        }}
                    >
                        <input
                            ref={inputRef}
                            className="bg-zinc-100 rounded-md px-2 py-1.5 w-full outline-none dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 md:max-w-[500px] max-w-[calc(100dvw-32px)]"
                            placeholder="Send a message..."
                            value={inputText}
                            onChange={(event) => {
                                setInputText(event.target.value)
                            }}
                        />

                        <button tabIndex={-1} className="">
                            <PaperPlaneIcon
                                color="white"
                                width={20}
                                height={20}
                            />
                        </button>
                        <button
                            onClick={handleClearMessages}
                            tabIndex={-1}
                            className=""
                        >
                            <X color="white" width={20} height={20} />
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    )
}
