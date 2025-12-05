import { WhopServerSdk } from "@whop/api";

/**
 * Inicialização do SDK Whop
 * Este SDK será usado para verificar acessos e gerenciar usuários
 */
export const whopSdk = WhopServerSdk({
  appId: process.env.WHOP_APP_ID!,
  appApiKey: process.env.WHOP_API_KEY!,
  companyId: process.env.WHOP_COMPANY_ID,
});

/**
 * Helper para verificar token de usuário vindo do header
 * Útil para rotas de API que recebem requisições do iframe Whop
 */
export async function verifyWhopUserToken(headers: any) {
  try {
    const { userId } = await whopSdk.verifyUserToken(headers);
    return userId;
  } catch (error) {
    throw new Error("Invalid Whop token");
  }
}

/**
 * Helper para verificar se usuário tem acesso a um recurso da Company
 */
export async function checkWhopAccess(whopUserId: string, companyId: string) {
  try {
    const result = await whopSdk.access.checkIfUserHasAccessToCompany({
      userId: whopUserId,
      companyId: companyId,
    });
    
    return {
      hasAccess: result.hasAccess || false,
      accessLevel: result.accessLevel || "no_access",
    };
  } catch (error) {
    console.error("Erro ao verificar acesso Whop:", error);
    return { hasAccess: false, accessLevel: "no_access" };
  }
}
