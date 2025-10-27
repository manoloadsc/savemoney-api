import crypto from "crypto"

export function generateRandomPassowrd(length = 10)  { 
    return crypto.randomBytes(length).toString("base64").slice(0, length)
} 

export function generateCode(length : number = 9) { 
    const digits = '0123456789'
    let code = ''
    for(let i = 0; i < length; i++) { 
        code += digits[Math.floor(Math.random() * digits.length)]
    }
    return code
}