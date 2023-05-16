import { VercelRequest, VercelResponse } from "@vercel/node";
import { getHello, userController, directoryController, authController } from "../controllers";
import cors from "cors";

import { allowCors, addAuthUsernameToHeader, jsonParser } from "../middlewares";
import { STATUS_ERROR } from "../config";

const cookiesParser = require("cookie-parser");

const app = require("express")();

app.use(cookiesParser());
app.use(
  cors({
    credentials: true,
  })
);
app.use(allowCors);
app.use(addAuthUsernameToHeader);

app.get("/api", getHello);

// AUTH CONTROLLER
app.post("/api/auth", authController.checkAuth);

// USER CONTROLLER
app.post("/api/user/check-google", jsonParser, userController.checkGoogleAccountIsRegistered);

app.post("/api/user/register-google", jsonParser, userController.registerGoogle);
app.post("/api/user/login-google", jsonParser, userController.loginGoogle);

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
  res.status(404).json({ status: STATUS_ERROR, message: "Endpoint not found" });
});

module.exports = app;
