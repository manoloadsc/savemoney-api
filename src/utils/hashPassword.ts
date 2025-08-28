import bcrypt from "bcrypt";

const SALT_ROUNDS = 4;

export async function hashParssword(password: string) {
    const hash = await bcrypt.hash(password, 10);
    return hash;
}

export async function comparePassword(password: string, hash: string) {
    const result = await bcrypt.compare(password, hash);
    return result;
}