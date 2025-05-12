/**
 * Ensures a URL has either http:// or https:// protocol
 * @param url The URL to validate and potentially modify
 * @returns A URL with proper protocol
 */
export const ensureUrlProtocol = (url: string): string => {
    if (!url) return url;

    // If URL already has a protocol, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Default to https:// if no protocol is specified
    return `https://${url.replace(/^\/+/, '')}`;
}; 