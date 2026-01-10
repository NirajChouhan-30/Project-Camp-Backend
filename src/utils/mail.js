import Mailgen from "mailgen";
import nodemailer from "nodemailer";


const sendEmail = async(opyions) => {
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Task Manager",
            link: "https://taskmanagerlink.com"
        }
    })

    const emailTextual = mailGenerator.generatePlainText(options.mailgenContent);
    const emailHtml = mailGenerator.generate(options.mailgenContent);

    const transportor = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: process.env.MAILTRAP_SMPT_PORT,
        auth: {
            user: process.env.MAILTRAP_SMTP_USER,
            pass: process.env.MAILTRAP_SMPT_PASSWORD
        }
    })


    const mail = {
        from: "mail.taskmanager@example.com",
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml
    }

    try {
        await transportor.sendMail(mail);
    } catch (error) {
        console.error("Email service failed");
        console.error("Error",error);
    }

}

const emailVerificationMailgenContent = (username, verificationUrl) => {
    return{
        body: {
            name: username,
            intro: "Welcome to our Project Management System! We're excited to have you on board.",
            action: {
                instructions: "To get started, please verify your email address by clicking the button below:",
                button: {
                    text: "To verify your email please click on the following button",
                    button: {
                        color: "#22BC66",
                        text: "Verify your email",
                        link: verificationUrl
                    },
                },
            },
            outro: "Need hellp, or have question? Just reply to this email, we'd love to help." 
        },
    };
};

const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
    return{
        body: {
            name: username,
            intro: "We got a request to reset the password of your account.",
            action: {
                instructions: "TO reset your password click on the following button or link",
                button: {
                    color: "#22BC66",
                    text: "Reset Password",
                    link: passwordResetUrl
                },
            },
            outro: "Need hellp, or have question? Just reply to this email, we'd love to help." 
        },
    };
};

export { 
    emailVerificationMailgenContent, 
    forgotPasswordMailgenContent,
    sendEmail 
};