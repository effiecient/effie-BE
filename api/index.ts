import { VercelRequest, VercelResponse } from "@vercel/node";
import bodyParser from "body-parser";
import { getHello, userController, directoryController, authController } from "../controllers";
import cors from "cors";

const app = require("express")();

// middleware to allow cors with next function
function allowCors(req: VercelRequest, res: VercelResponse, next: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // another common pattern
  // res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return next(req, res);
}

const jsonParser = bodyParser.json();

app.use(cors());
app.get("/api", allowCors, getHello);

// AUTH CONTROLLER
app.post("/api/auth", allowCors, authController.checkAuth);

// USER CONTROLLER
app.post("/api/user/check", jsonParser, allowCors, userController.usernameCheck);
app.post("/api/user/register", jsonParser, allowCors, userController.register);
app.post("/api/user/login", jsonParser, allowCors, userController.login);

// DIRECTORY CONTROLLER
// TODO: need authentication middleware
app.post("/api/directory/link", jsonParser, allowCors, directoryController.createLink);
app.post("/api/directory/folder", jsonParser, allowCors, directoryController.createFolder);

app.get("/api/directory/:username/*", allowCors, directoryController.readLinkOrFolder);

app.patch("/api/directory/folder", jsonParser, allowCors, directoryController.updateFolder);
app.patch("/api/directory/link", jsonParser, allowCors, directoryController.updateLink);

app.delete("/api/directory/:username/*", jsonParser, allowCors, directoryController.deleteLinkOrFolder);

// CATCH ALL
app.all("*", (req: VercelRequest, res: VercelResponse) => {
  res.status(404).json({ success: false, message: "Endpoint not found." });
});

module.exports = app;
