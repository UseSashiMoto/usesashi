import { ensureUrlProtocol } from '../utils';

describe('ensureUrlProtocol', () => {
    describe('basic cases', () => {
        it('should add https:// to a URL without protocol', () => {
            expect(ensureUrlProtocol('example.com')).toBe('https://example.com');
        });

        it('should preserve existing https:// protocol', () => {
            expect(ensureUrlProtocol('https://example.com')).toBe('https://example.com');
        });

        it('should preserve existing http:// protocol', () => {
            expect(ensureUrlProtocol('http://example.com')).toBe('http://example.com');
        });

        it('should handle empty string', () => {
            expect(ensureUrlProtocol('')).toBe('');
        });
    });

    describe('double protocol cases', () => {
        it('should fix http://https:// combination', () => {
            expect(ensureUrlProtocol('http://https://example.com')).toBe('https://example.com');
        });

        it('should fix https://http:// combination', () => {
            expect(ensureUrlProtocol('https://http://example.com')).toBe('https://example.com');
        });

        it('should fix http://http:// combination', () => {
            expect(ensureUrlProtocol('http://http://example.com')).toBe('https://example.com');
        });

        it('should fix https://https:// combination', () => {
            expect(ensureUrlProtocol('https://https://example.com')).toBe('https://example.com');
        });
    });

    describe('edge cases', () => {
        it('should handle URLs with leading slashes', () => {
            expect(ensureUrlProtocol('//example.com')).toBe('https://example.com');
        });

        it('should handle URLs with multiple leading slashes', () => {
            expect(ensureUrlProtocol('///example.com')).toBe('https://example.com');
        });

        it('should trim whitespace', () => {
            expect(ensureUrlProtocol(' https://example.com ')).toBe('https://example.com');
        });

        it('should handle URLs with ports', () => {
            expect(ensureUrlProtocol('example.com:3000')).toBe('https://example.com:3000');
        });

        it('should handle complex URLs with paths', () => {
            expect(ensureUrlProtocol('example.com/path/to/resource')).toBe('https://example.com/path/to/resource');
        });
    });
}); 