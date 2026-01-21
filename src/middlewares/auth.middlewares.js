import { User } from "../models/user.models.js";
import { ProjectMember } from "../models/projectMember.models.js";
import { Project } from "../models/project.models.js";
import{ ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";

/**
 * Logs authorization failures for security auditing
 * @param {Object} req - Express request object
 * @param {String} errorMessage - Error message to log
 * @param {Number} statusCode - HTTP status code
 */
const logAuthorizationFailure = (req, errorMessage, statusCode) => {
    console.error(`Authorization failed: ${errorMessage}`, {
        userId: req.user?._id?.toString() || 'unauthenticated',
        endpoint: req.path,
        method: req.method,
        statusCode,
        timestamp: new Date().toISOString()
    });
};

export const verifyJWT = asyncHandler(async (req, res, next) =>{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if(!token){
        const errorMessage = "Unauthorized request";
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry");

        if(!user){
            const errorMessage = "Invalid access token";
            logAuthorizationFailure(req, errorMessage, 401);
            throw new ApiError(401, errorMessage);
        }

        req.user = user;
        next();

    } catch (error) {
        const errorMessage = "Invalid access token";
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

})

/**
 * Middleware factory that creates role verification middleware
 * @param {Array<String>} allowedRoles - Array of roles that can access the endpoint
 * @returns {Function} Express middleware function
 */
export const verifyRoles = (allowedRoles) => {
    return asyncHandler(async (req, res, next) => {
        // Ensure user exists (verifyJWT should have run first)
        if (!req.user) {
            const errorMessage = "Unauthorized request";
            logAuthorizationFailure(req, errorMessage, 401);
            throw new ApiError(401, errorMessage);
        }

        // Check if user has a role field
        if (!req.user.role) {
            const errorMessage = "User role not defined";
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Validate role against allowedRoles array
        if (!allowedRoles.includes(req.user.role)) {
            const errorMessage = `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`;
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // User has required role, proceed
        next();
    });
}

/**
 * Middleware that verifies user is a member of the specified project
 * Extracts projectId from req.params and validates membership
 */
export const verifyProjectMembership = asyncHandler(async (req, res, next) => {
    // Ensure user exists (verifyJWT should have run first)
    if (!req.user) {
        const errorMessage = "Unauthorized request";
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

    // Extract projectId from req.params
    const { projectId } = req.params;

    if (!projectId) {
        const errorMessage = "Project ID is required";
        logAuthorizationFailure(req, errorMessage, 400);
        throw new ApiError(400, errorMessage);
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    
    if (!project) {
        const errorMessage = "Project not found";
        logAuthorizationFailure(req, errorMessage, 404);
        throw new ApiError(404, errorMessage);
    }

    // Query ProjectMember collection for membership record
    const membership = await ProjectMember.findOne({
        project: projectId,
        user: req.user._id
    });

    // Throw 403 if user is not a member
    if (!membership) {
        const errorMessage = "Access denied. You are not a member of this project";
        logAuthorizationFailure(req, errorMessage, 403);
        throw new ApiError(403, errorMessage);
    }

    // Attach membership object to req.projectMembership including role
    req.projectMembership = membership;

    // Call next() when membership is valid
    next();
});

/**
 * Middleware factory that verifies user has specific role within a project
 * @param {Array<String>} allowedRoles - Array of project roles that can access
 * @returns {Function} Express middleware function
 */
export const verifyProjectRole = (allowedRoles) => {
    return asyncHandler(async (req, res, next) => {
        // Ensure verifyProjectMembership has already run
        if (!req.projectMembership) {
            const errorMessage = "Project membership validation required before role check";
            logAuthorizationFailure(req, errorMessage, 500);
            throw new ApiError(500, errorMessage);
        }

        // Check if membership has a role field
        if (!req.projectMembership.role) {
            const errorMessage = "Project role not defined";
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Validate project role against allowedRoles array
        if (!allowedRoles.includes(req.projectMembership.role)) {
            const errorMessage = `Insufficient permissions. Required project role: ${allowedRoles.join(' or ')}`;
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // User has required project role, proceed
        next();
    });
};