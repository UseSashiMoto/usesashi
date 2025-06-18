import { RefObject, useEffect, useRef, useState } from "react"

export function useScrollToBottom<T extends HTMLElement>(): [
    RefObject<T>,
    RefObject<T>,
    boolean,
    () => void
] {
    const containerRef = useRef<T>(null)
    const endRef = useRef<T>(null)
    const [showScrollButton, setShowScrollButton] = useState(false)

    useEffect(() => {
        const container = containerRef.current
        const end = endRef.current

        if (container && end) {
            const observer = new MutationObserver(() => {
                // Check if we're not already at the bottom
                const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
                setShowScrollButton(!isAtBottom)
            })

            observer.observe(container, {
                childList: true,
                subtree: true
            })

            // Also check on scroll
            const handleScroll = () => {
                const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
                setShowScrollButton(!isAtBottom)
            }

            container.addEventListener('scroll', handleScroll)

            return () => {
                observer.disconnect()
                container.removeEventListener('scroll', handleScroll)
            }
        }
    }, [])

    const scrollToBottom = () => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }

    return [containerRef, endRef, showScrollButton, scrollToBottom]
}
