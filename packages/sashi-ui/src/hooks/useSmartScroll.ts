import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Smart scroll hook that only auto-scrolls when user is at the bottom
 * Prevents annoying scroll interruptions when reading old messages
 */
export const useSmartScroll = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [hasNewMessages, setHasNewMessages] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const threshold = 100; // Consider "at bottom" if within 100px
            const atBottom = scrollHeight - scrollTop - clientHeight < threshold;

            setIsAtBottom(atBottom);
            setShouldAutoScroll(atBottom);

            // Clear new messages indicator when scrolling to bottom
            if (atBottom) {
                setHasNewMessages(false);
            }
        };

        // Use passive listener for better scroll performance
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToBottom = useCallback((options: { force?: boolean; smooth?: boolean } = {}) => {
        const { force = false, smooth = true } = options;

        if (force || shouldAutoScroll) {
            containerRef.current?.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto',
            });
            setHasNewMessages(false);
        } else {
            // If not auto-scrolling, indicate there are new messages
            setHasNewMessages(true);
        }
    }, [shouldAutoScroll]);

    // Auto-scroll on new content if at bottom
    useEffect(() => {
        if (shouldAutoScroll) {
            scrollToBottom({ smooth: true });
        } else {
            setHasNewMessages(true);
        }
    }, []); // Dependencies handled by scrollToBottom

    return {
        containerRef,
        isAtBottom,
        shouldAutoScroll,
        hasNewMessages,
        scrollToBottom,
    };
};

