import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import {emailVerificationMailgenContent, sendEmail} from "../utils/mail.js";
import SendmailTransport from "nodemailer/lib/sendmail-transport/index.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessTokens();
        const refreshToken = user.generateRefreshTokens();
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return { accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access token!");
    }
}

const registerUser = asyncHandler(async (requestAnimationFrame, res) => {
    const { email, username, password, role } = req.body;

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with the given email or username already exists", []);
    }

    const user = await User.create({
        email,
        password,
        username,
        usEmailVerified: false
    })

    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryTokens();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpirt = tokenExpiry;

    await user.save({validateBeforeSave: false});

    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your Email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
            ),

        });

        const createdUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationExpiry");

        if(!createdUser){
            throw new ApiError(500, "Something went erong while registering a user!");
        }

        return res
        .status(201)
        .json(
            new ApiResponse(
                200,
                {
                    user: createdUser,   
                },
                "User registered successfully and verification mail has been sent on your email address"
        ));
})

export {
    registerUser
};