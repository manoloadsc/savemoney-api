import createError from "@fastify/error";


const ERRORS = { 
    "BAD_REQUEST" : 400,
    "NOT_FOUND" : 404,
    "INTERNAL_SERVER_ERROR" : 500,
    "UNAUTHORIZED" : 401,
    "FORBIDDEN" : 403,  
    "CONFLICT" : 409,
    "TOO_MANY_REQUESTS" : 429,
    "SERVICE_UNAVAILABLE" : 503
}


export const fastifyError = (error : keyof typeof ERRORS, message : string) => {
    const generatedError = createError(
    error,
    message,
    ERRORS[error]
    );

    console.log(`Erro gerado: ${error}, Status: ${ERRORS[error]}, Mensagem: ${message}`);
    return new generatedError();
}

export const badRequestError = (message : string) => fastifyError("BAD_REQUEST", message);
export const notFoundError = (message : string) => fastifyError("NOT_FOUND", message);
export const internalServerError = (message : string) => fastifyError("INTERNAL_SERVER_ERROR", message);
export const unauthorizedError = (message : string) => fastifyError("UNAUTHORIZED", message);
export const forbiddenError = (message : string) => fastifyError("FORBIDDEN", message);
export const conflictError = (message : string) => fastifyError("CONFLICT", message);
export const tooManyRequestsError = (message : string) => fastifyError("TOO_MANY_REQUESTS", message);
export const serviceUnavailableError = (message : string) => fastifyError("SERVICE_UNAVAILABLE", message);