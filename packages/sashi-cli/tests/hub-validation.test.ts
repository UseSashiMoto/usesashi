import { validateHubUrl } from '../src/utils/hub';

describe('Hub URL Validation', () => {
    describe('validateHubUrl', () => {
        it('should validate valid HTTP URLs', () => {
            expect(validateHubUrl('http://localhost:3000')).toBe(true);
            expect(validateHubUrl('https://hub.usesashi.com')).toBe(true);
            expect(validateHubUrl('https://api.example.com:8080')).toBe(true);
            expect(validateHubUrl('http://127.0.0.1:3004')).toBe(true);
        });

        it('should reject invalid URLs', () => {
            expect(validateHubUrl('invalid-url')).toBe(false);
            expect(validateHubUrl('ftp://example.com')).toBe(false);
            expect(validateHubUrl('')).toBe(false);
            expect(validateHubUrl('not-a-url')).toBe(false);
            expect(validateHubUrl('javascript:alert(1)')).toBe(false);
        });

        it('should handle edge cases', () => {
            expect(validateHubUrl('https://')).toBe(false);
            expect(validateHubUrl('http://')).toBe(false);
            expect(validateHubUrl('https://example')).toBe(true); // Valid but unusual
        });
    });
});
