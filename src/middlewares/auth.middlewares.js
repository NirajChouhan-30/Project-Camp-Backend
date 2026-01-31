import mongoose from "mongoose";
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

/**
 * Middleware that verifies JWT token and attaches authenticated user to request
 * Handles token extraction from cookies or Authorization header
 * Provides detailed error messages for different failure scenarios
 */
export const verifyJWT = asyncHandler(async (req, res, next) =>{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if(!token){
        const errorMessage = "Access token is required. Please provide a valid token in cookies or Authorization header";
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

    try {
        // Verify token signature and expiration
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        // Validate decoded token has required fields
        if (!decodedToken?._id) {
            const errorMessage = "Invalid token structure. Token does not contain user identifier";
            logAuthorizationFailure(req, errorMessage, 401);
            throw new ApiError(401, errorMessage);
        }

        // Fetch user from database, excluding sensitive fields
        const user = await User.findById(decodedToken._id).select("-password -refreshTokens -forgotPasswordToken -forgotPasswordExpiry -emailVerificationToken -emailVerificationExpiry");

        if(!user){
            const errorMessage = "User associated with this token no longer exists. Please login again";
            logAuthorizationFailure(req, errorMessage, 401);
            throw new ApiError(401, errorMessage);
        }

        // Attach user object to request for downstream middleware/controllers
        req.user = user;
        next();

    } catch (error) {
        // Handle specific JWT errors with detailed messages
        let errorMessage = "Invalid access token";
        
        if (error.name === 'TokenExpiredError') {
            errorMessage = "Access token has expired. Please refresh your token or login again";
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = "Invalid access token. Token signature verification failed";
        } else if (error.name === 'NotBeforeError') {
            errorMessage = "Access token is not yet valid. Please check your system time";
        } else if (error instanceof ApiError) {
            // Re-throw ApiError instances (from validation checks above)
            throw error;
        }
        
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

})

/**
 * Middleware factory that creates role verification middleware
 * Validates user's system-level role against allowed roles
 * @param {Array<String>} allowedRoles - Array of roles that can access the endpoint
 * @returns {Function} Express middleware function
 */
export const verifyRoles = (allowedRoles) => {
    // Validate allowedRoles parameter
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        throw new Error("verifyRoles requires a non-empty array of allowed roles");
    }

    return asyncHandler(async (req, res, next) => {
        // Ensure user exists (verifyJWT should have run first)
        if (!req.user) {
            const errorMessage = "Authentication required. User not found in request";
            logAuthorizationFailure(req, errorMessage, 401);
            throw new ApiError(401, errorMessage);
        }

        // Check if user has a role field
        if (!req.user.role) {
            const errorMessage = "User role not defined. Please contact system administrator";
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Validate role against allowedRoles array
        if (!allowedRoles.includes(req.user.role)) {
            const errorMessage = `Insufficient permissions. Your role '${req.user.role}' does not have access. Required role: ${allowedRoles.join(' or ')}`;
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Log successful authorization for security auditing
        console.log(`Authorization successful: User ${req.user._id} with role '${req.user.role}' accessed ${req.method} ${req.path}`, {
            userId: req.user._id.toString(),
            userRole: req.user.role,
            endpoint: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });

        // User has required role, proceed
        next();
    });
}

/**
 * Middleware that verifies user is a member of the specified project
 * Extracts projectId from req.params and validates membership
 * Attaches membership object to req.projectMembership for downstream use
 */
export const verifyProjectMembership = asyncHandler(async (req, res, next) => {
    // Ensure user exists (verifyJWT should have run first)
    if (!req.user) {
        const errorMessage = "Authentication required. User not found in request";
        logAuthorizationFailure(req, errorMessage, 401);
        throw new ApiError(401, errorMessage);
    }

    // Extract projectId from req.params
    const { projectId } = req.params;

    if (!projectId) {
        const errorMessage = "Project ID is required in request parameters";
        logAuthorizationFailure(req, errorMessage, 400);
        throw new ApiError(400, errorMessage);
    }

    // Validate projectId format (MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        const errorMessage = `Invalid project ID format: ${projectId}`;
        logAuthorizationFailure(req, errorMessage, 400);
        throw new ApiError(400, errorMessage);
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    
    if (!project) {
        const errorMessage = `Project not found with ID: ${projectId}`;
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
        const errorMessage = `Access denied. User ${req.user._id} is not a member of project ${projectId}`;
        logAuthorizationFailure(req, errorMessage, 403);
        throw new ApiError(403, errorMessage);
    }

    // Log successful membership verification for security auditing
    console.log(`Project membership verified: User ${req.user._id} with role '${membership.role}' accessed project ${projectId}`, {
        userId: req.user._id.toString(),
        projectId: projectId,
        projectRole: membership.role,
        endpoint: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Attach membership object to req.projectMembership including role
    req.projectMembership = membership;

    // Call next() when membership is valid
    next();
});

/**
 * Middleware factory that verifies user has specific role within a project
 * Must be used after verifyProjectMembership middleware
 * @param {Array<String>} allowedRoles - Array of project roles that can access
 * @returns {Function} Express middleware function
 */
export const verifyProjectRole = (allowedRoles) => {
    // Validate allowedRoles parameter
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        throw new Error("verifyProjectRole requires a non-empty array of allowed roles");
    }

    return asyncHandler(async (req, res, next) => {
        // Ensure verifyProjectMembership has already run
        if (!req.projectMembership) {
            const errorMessage = "Project membership validation required before role check. Ensure verifyProjectMembership middleware runs first";
            logAuthorizationFailure(req, errorMessage, 500);
            throw new ApiError(500, errorMessage);
        }

        // Check if membership has a role field
        if (!req.projectMembership.role) {
            const errorMessage = "Project role not defined for this membership. Please contact system administrator";
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Validate project role against allowedRoles array
        if (!allowedRoles.includes(req.projectMembership.role)) {
            const errorMessage = `Insufficient project permissions. Your project role '${req.projectMembership.role}' does not have access. Required project role: ${allowedRoles.join(' or ')}`;
            logAuthorizationFailure(req, errorMessage, 403);
            throw new ApiError(403, errorMessage);
        }

        // Log successful project role authorization for security auditing
        console.log(`Project role authorization successful: User ${req.user._id} with project role '${req.projectMembership.role}' accessed ${req.method} ${req.path}`, {
            userId: req.user._id.toString(),
            projectId: req.projectMembership.project.toString(),
            projectRole: req.projectMembership.role,
            endpoint: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });

        // User has required project role, proceed
        next();
    });
};