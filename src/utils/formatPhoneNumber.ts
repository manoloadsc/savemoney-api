import { parsePhoneNumberFromString } from "libphonenumber-js"

export function formatPhoneNumber(from: string): string {
  // Remove o código do país (55) se vier com ele
  if (from.startsWith("55") && from.length === 12) {
    // Ex: 557488595408 → DDD: 74, Número: 88595408
    const ddd = from.slice(2, 4);
    const num = from.slice(4);
    
    // Se tiver 8 dígitos → adiciona 9
    if (num.length === 8) {
      return `55${ddd}9${num}`;
    }
  }

  // Já está com 9 dígitos ou outro formato
  return from;
}

export function getCountryFromPhone(phone: string): string | null {
  const phoneNumber = parsePhoneNumberFromString(phone)
  
  if (!phoneNumber || !phoneNumber.isValid()) {
    return null
  }

  return phoneNumber.country! // Retorna o código do país, como 'BR', 'US', 'IN', etc.
}