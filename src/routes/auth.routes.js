import { Router } from "express";
import { registerUser } from "../controllers/auth.cotrollers.js";

const router = Router();

router.route("/register").post(registerUser);

export default router;