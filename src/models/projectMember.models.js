import mongoose, { Schema } from "mongoose";

const projectMemberSchema = new Schema(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'project_admin', 'member'],
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true,
        optimisticConcurrency: true // Enable optimistic locking with version key
    }
);

// Compound index for uniqueness - one user can only have one membership per project
projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });

// Index for efficient project member lookups
projectMemberSchema.index({ project: 1 });

// Index for efficient user project lookups
projectMemberSchema.index({ user: 1 });

export const ProjectMember = mongoose.model("ProjectMember", projectMemberSchema);
