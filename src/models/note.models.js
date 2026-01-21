import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema(
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
        content: {
            type: String,
            trim: true
        },
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

export const Note = mongoose.model("Note", noteSchema);
