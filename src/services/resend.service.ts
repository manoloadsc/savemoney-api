import path from "path";
import { Resend } from "resend";
import ejs from "ejs";
import fs from "fs";
import juice from "juice";
import { Users } from "lib/prisma.js";
import { dirname } from "lib/paths.js";

class ResendService {
  resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_KEY);
  }

  async sendEmail(to: string, message: string, html: string) {
    const { data, error } = await this.resend.emails.send({
      from: "EconomizeAI <noreply@economize-ai.com>",
      to: [to],
      subject: message,
      html,
    });

    if (error) console.log(error);

    return data;
  }

  async defaultUserCreated(to: string, password: string) {
    try {
      const imagePath = path.join(dirname, "public", "images", "logo-azul.png");
      const imageBase64 = fs.readFileSync(imagePath).toString("base64");
      const imageMimeType = "image/png";

      const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

      const data = {
        title: "Conta criada com sucesso!",
        siteName: "Economize AI",
        username: to,
        email: to,
        password: password,
        loginUrl: process.env.PUBLIC_URL
          ? `${process.env.PUBLIC_URL}/auth/login`
          : "https://economize-ai.com/auth/login",
        logoUrl: logoDataUrl,
        supportEmail: "suporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };

      // Renderiza o template com CSS inline
      const html = await this.renderEmailTemplate("user-created", data);

      // Envia o email
      const email = await this.sendEmail(
        to,
        "Sua conta no Economize AI foi criada",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log("Erro ao enviar email.... ", error.message);
    }
  }

  private async renderEmailTemplate(templateName: string, data: any) {
    const templatePath = path.join(dirname, "views", `${templateName}.ejs`);
    const cssPath = path.join(dirname, "public", "styles", "email.css");

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    const css = fs.readFileSync(cssPath, "utf-8");

    const htmlWithStyleTag = await ejs.render(htmlTemplate, data, {
      async: true,
    });

    // Insere o CSS dentro de <style> antes do </head>
    const htmlWithCss = htmlWithStyleTag.replace(
      "</head>",
      `<style>${css}</style></head>`
    );

    const finalHtml = juice(htmlWithCss);

    return finalHtml;
  }

  async welcomeEmail(username: string, useremail: string) {
    const imagePath = path.join(dirname, "public", "images", "logo-azul.png");
    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    const imageMimeType = "image/png";

    const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;
    try {
      const data = {
        title: "Bem-vindo(a) à plataforma!",
        siteName: "Economize AI",
        username: username,
        loginUrl: process.env.PUBLIC_URL
          ? `${process.env.PUBLIC_URL}/auth/login`
          : "https://economize-ai.com/auth/login",
        logoUrl: logoDataUrl,
        supportEmail: "suporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };
      const html = await this.renderEmailTemplate("welcome", data);
      let email = await this.sendEmail(
        useremail,
        "Bem vindo ao Economize AI",
        html
      );
      return email?.id;
    } catch (error: any) {
      console.log("Erro ao enviar email....  ", error.message);
    }
  }

  async recoverEmail(
    username: string,
    useremail: string,
    resetToken: string,
    expiresInMinutes: number = 60
  ) {
    const imagePath = path.join(dirname, "public", "images", "logo-azul.png");
    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    const imageMimeType = "image/png";
    const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    try {
      // Monte a URL de redefinição (ajuste o path conforme seu front)
      const baseUrl = process.env.PUBLIC_URL || "https://economize-ai.com";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(
        resetToken
      )}`;

      const data = {
        title: "Redefinição de Senha",
        siteName: "Economize AI",
        username,
        resetUrl,
        logoUrl: logoDataUrl,
        supportEmail: "suporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
        expiresInMinutes, // caso seu template exiba a validade do link
      };

      // Template EJS chamado "recover.ejs" (mesma estrutura do welcome)
      const html = await this.renderEmailTemplate("recover", data);

      const email = await this.sendEmail(
        useremail,
        "Redefinição de senha - Economize AI",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log("Erro ao enviar email.... ", error.message);
    }
  }

  async passwordResetSuccessEmail(username: string, useremail: string) {
    const imagePath = path.join(dirname, "public", "images", "logo-azul.png");
    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    const imageMimeType = "image/png";
    const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    try {
      const data = {
        title: "Senha redefinida com sucesso",
        siteName: "Economize AI",
        username,
        logoUrl: logoDataUrl,
        supportEmail: "suporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };

      const html = await this.renderEmailTemplate(
        "password-reset-success",
        data
      );

      const email = await this.sendEmail(
        useremail,
        "Sua senha foi redefinida - Economize AI",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log("Erro ao enviar email.... ", error.message);
    }
  }
}

export default new ResendService();
