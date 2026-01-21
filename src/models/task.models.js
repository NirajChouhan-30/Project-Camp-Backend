import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        assignee: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        status: {
            type: String,
            enum: ['todo', 'in_progress', 'done'],
            default: 'todo'
        },
        attachments: [
            {
                url: {
                    type: String
                },
                localPath: {
                    type: String
                },
                mimetype: {
                    type: String
                },
                size: {
                    type: Number
                }
            }
        ],
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const Task = mongoose.model("Task", taskSchema);
