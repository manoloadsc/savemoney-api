import { Prisma } from "lib/prisma.js";

export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj; // If it's not an object, return as is (base case)
    }

    if (obj instanceof Prisma.Decimal) {
        // If it's a Prisma.Decimal, create a new instance to avoid referencing the same object
        return new Prisma.Decimal(obj.toString()) as T;
    }

    if (Array.isArray(obj)) {
        // Handle arrays
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }

    const result: Record<string, any> = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = deepClone(obj[key]);
        }
    }

    return result as T;
}