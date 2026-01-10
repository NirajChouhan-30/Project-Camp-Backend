import Mailgen from "mailgen";

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
    forgotPasswordMailgenContent 
};