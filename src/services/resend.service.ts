import path from "path";
import { Resend } from "resend";
import ejs from "ejs";
import fs from "fs";
import juice from "juice";
import { dirname } from "lib/paths.js";

class ResendService {
  resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_KEY);
  }

  async sendEmail(to: string, message: string, html: string) {
    const { data, error } = await this.resend.emails.send({
      from: "SaveMoney <no-reply@savemoneyy.com>",
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
        title: "¡Cuenta creada con éxito!",
        siteName: "SaveMoney",
        username: to,
        email: to,
        password: password,
        loginUrl: process.env.PUBLIC_URL
          ? `${process.env.PUBLIC_URL}/auth/login`
          : "https://savemoneyy.com/auth/login",
        logoUrl: logoDataUrl,
        supportEmail: "soporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };

      // Renderiza la plantilla con CSS inline
      const html = await this.renderEmailTemplate("user-created", data);

      // Envía el correo
      const email = await this.sendEmail(
        to,
        "Tu cuenta en SaveMoney ha sido creada",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log(error)
      console.log("Error al enviar el correo... ", error.message);
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

    // Inserta el CSS dentro de <style> antes de </head>
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

    console.log("aaaaaaaaa")

    const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;
    try {
      const data = {
        title: "¡Bienvenido(a) a la plataforma!",
        siteName: "SaveMoney",
        username: username,
        loginUrl: process.env.PUBLIC_URL
          ? `${process.env.PUBLIC_URL}/auth/login`
          : "https://savemoneyy.com/auth/login",
        logoUrl: logoDataUrl,
        supportEmail: "savemoneyy.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };
      const html = await this.renderEmailTemplate("welcome", data);
      let email = await this.sendEmail(
        useremail,
        "Bienvenido a SaveMoney",
        html
      );
      return email?.id;
    } catch (error: any) {
      console.log("Error al enviar el correo...  ", error.message);
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
      // Monta la URL de restablecimiento (ajusta el path según tu front)
      const baseUrl = process.env.PUBLIC_URL || "https://savemoneyy.com";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(
        resetToken
      )}`;

      const data = {
        title: "Restablecimiento de Contraseña",
        siteName: "SaveMoney",
        username,
        resetUrl,
        logoUrl: logoDataUrl,
        supportEmail: "soporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
        expiresInMinutes, // por si tu plantilla muestra la validez del enlace
      };

      // Plantilla EJS llamada "recover.ejs" (misma estructura que welcome)
      const html = await this.renderEmailTemplate("recover", data);

      const email = await this.sendEmail(
        useremail,
        "Restablecimiento de contraseña - SaveMoney",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log("Error al enviar el correo... ", error.message);
    }
  }

  async passwordResetSuccessEmail(username: string, useremail: string) {
    const imagePath = path.join(dirname, "public", "images", "logo-azul.png");
    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    const imageMimeType = "image/png";
    const logoDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    try {
      const data = {
        title: "Contraseña restablecida con éxito",
        siteName: "SaveMoney",
        username,
        logoUrl: logoDataUrl,
        supportEmail: "soporte@economizeai.com",
        whatsappNumber: "5511963018864",
        year: new Date().getFullYear(),
      };

      const html = await this.renderEmailTemplate(
        "password-reset-success",
        data
      );

      const email = await this.sendEmail(
        useremail,
        "Tu contraseña ha sido restablecida - SaveMoney",
        html
      );

      return email?.id;
    } catch (error: any) {
      console.log("Error al enviar el correo... ", error.message);
    }
  }
}

export default new ResendService();
