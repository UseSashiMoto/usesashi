import {Bot, SettingsIcon, UserRound} from "lucide-react"
import React, {useEffect, useState} from "react"
import useAppStore from "src/store/chat-store"
import {Layout} from "../components/Layout"

function getUniqueId() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    )
}
export const HomePage = () => {
    const storedMessages = useAppStore(
        (state: {messages: any}) => state.messages
    )
    const storedMode = useAppStore((state: {mode: any}) => state.mode)
    const setMode = useAppStore((state: {setMode: any}) => state.setMode)
    const addMessage = useAppStore(
        (state: {addMessage: any}) => state.addMessage
    )
    const clearMessages = useAppStore(
        (state: {clearMessages: any}) => state.clearMessages
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

    const [isDialogShown, setDialogShown] = React.useState(false)
    const [selFuncType, setSelFuncType] = React.useState(0)
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isMounted) {
            setFuncType(storedMode)
            setMessageItems(storedMessages)
        }
    }, [isMounted])

    const deleteThread = async () => {
        try {
            setLoading(true)

            const response = await fetch("/assistant/thread", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({threadId: threadId})
            })

            if (!response.ok) {
                console.log("Oops, an error occurred", response.status)
            }

            const result = await response.json()

            console.log(result)
        } catch (error: any) {
            console.log(error.name, error.message)
        } finally {
            setLoading(false)
            setThreadId("")
        }
    }

    const sendMessage = async (payload: {
        tools?: any[]
        inquiry?: string
        previous: any
        type: string
    }) => {}

    const submitChatCompletion = async () => {
        console.log("submitChatCompletion")

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

        const newUserMessage = {
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
                const url: string =
                    result_tools.length > 0 ? "/chat/function" : "/chat/message"

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

                const result: any = await sendMessage(payload)

                console.log("admin-bot-response", result)

                if (result.output.content) {
                    console.log(result.output.content)

                    const newAssistantMessage = {
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
            console.log("admin bot error here", error.name, error.message)
        } finally {
            setLoading(false)

            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }

    const submitAssistant = async () => {
        console.log("submitAssistant")
        setLoading(true)

        const text = inputText

        setInputText("")
        inputRef.current?.blur()

        const message_id = getUniqueId()

        const newUserMessage = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: "user",
            content: text
        }
        setMessageItems((prev) => [...prev, ...[newUserMessage]])
        addMessage(newUserMessage)

        resetScroll()

        try {
            console.log("submit-assistant", threadId, text)

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

            console.log("assistant", result)

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
        console.log("handleSubmit", e)
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

    const handleClearMessages = async () => {
        if (funcType > 0 && threadId) {
            await deleteThread()
        }

        setMessageItems([])
        clearMessages()
    }

    const [input, setInput] = useState<string>("")

    console.log("messages", messageItems, input)

    return (
        <Layout>
            <div className="flex flex-row justify-center pb-20 h-dvh bg-white dark:bg-zinc-900">
                <div className="flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-3 h-full w-dvw items-center overflow-y-scroll">
                        {messageItems.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    padding: "1rem 1rem 0 1rem",
                                    display: "flex"
                                }}
                            >
                                {item.role === "assistant" && <Bot />}
                                {item.role === "function" && <SettingsIcon />}
                                <div
                                    style={
                                        item.role === "user"
                                            ? {
                                                  backgroundColor: "#ccf6ff",
                                                  borderRadius: "12px",
                                                  width: "100%",
                                                  padding: "1rem",
                                                  margin: 0
                                                  // whiteSpace: 'pre-wrap',
                                              }
                                            : {
                                                  backgroundColor: "#efefef"
                                              }
                                    }
                                >
                                    {item.content}
                                </div>
                                {item.role === "user" && <UserRound />}
                            </div>
                        ))}
                        <div />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px] mb-4"></div>

                    <form
                        className="flex flex-col gap-2 relative items-center"
                        onSubmit={async (event) => {
                            event.preventDefault()
                            handleSubmit(event)
                            /*setMessages((messages) => [
                                ...messages,
                                <Message
                                    key={messages.length}
                                    role="user"
                                    content={input}
                                />
                            ])*/
                            setInput("")

                            //const response: ReactNode = await sendMessage(input)
                            //setMessages((messages) => [...messages, response])
                        }}
                    >
                        <input
                            ref={inputRef}
                            className="bg-zinc-100 rounded-md px-2 py-1.5 w-full outline-none dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 md:max-w-[500px] max-w-[calc(100dvw-32px)]"
                            placeholder="Send a message..."
                            value={input}
                            onChange={(event) => {
                                console.log(
                                    "message on change",
                                    event.target.value
                                )
                                setInput(event.target.value)
                            }}
                        />
                    </form>
                </div>
            </div>
        </Layout>
    )
}
