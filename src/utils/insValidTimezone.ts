export function validateTimezone(timezone: string): boolean {
    try {
        // Tenta criar uma data para o timezone passado, se não for possível, lança erro
        const date = new Date();
        const formattedDate = date.toLocaleString("en-US", { timeZone: timezone });
        return formattedDate !== "Invalid Date"; // Se o fuso horário for inválido, retorna falso
    } catch (error) {
        return false;
    }
}