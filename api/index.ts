import { VercelRequest, VercelResponse } from "@vercel/node";
import { getHello, userController, directoryController, authController } from "../controllers";
import cors from "cors";

import { allowCors, checkAuthExist, jsonParser } from "../middlewares";

const app = require("express")();

app.use(cors());
app.use(allowCors);

app.get("/api", checkAuthExist, getHello);

// AUTH CONTROLLER
app.post("/api/auth", authController.checkAuth);

// USER CONTROLLER
app.post("/api/user/check", jsonParser, userController.usernameCheck);
app.post("/api/user/register", jsonParser, userController.register);
app.post("/api/user/login", jsonParser, userController.login);

// DIRECTORY CONTROLLER
// TODO: need authentication middleware
app.post("/api/directory/link", jsonParser, directoryController.createLink);
app.post("/api/directory/folder", jsonParser, directoryController.createFolder);

app.get("/api/directory/:username/*", directoryController.readLinkOrFolder);

app.patch("/api/directory/folder", jsonParser, directoryController.updateFolder);
app.patch("/api/directory/link", jsonParser, directoryController.updateLink);

app.delete("/api/directory/:username/*", jsonParser, directoryController.deleteLinkOrFolder);

// CATCH ALL
app.all("*", (req: VercelRequest, res: VercelResponse) => {
  res.status(404).json({ success: false, message: "Endpoint not found." });
});

module.exports = app;
