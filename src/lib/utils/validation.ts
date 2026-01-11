/**
 * Input Validation Utilities
 */

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

/**
 * Validate required fields
 */
export function validateRequired(
    data: Record<string, any>,
    requiredFields: string[]
): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const field of requiredFields) {
        const value = data[field];
        if (value === undefined || value === null || value === '') {
            missing.push(field);
        }
    }

    return { valid: missing.length === 0, missing };
}

/**
 * Validate numeric value
 */
export function validateNumber(
    value: any,
    min?: number,
    max?: number
): boolean {
    const num = Number(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
    value: any,
    allowedValues: T[]
): value is T {
    return allowedValues.includes(value);
}
