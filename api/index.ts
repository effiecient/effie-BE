import { VercelRequest, VercelResponse } from "@vercel/node";
import bodyParser from "body-parser";
import { getHello, userController, directoryController } from "../controllers";
import cors from "cors";

const app = require("express")();

const allowCors = (fn: Function) => async (req: VercelRequest, res: VercelResponse) => {
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
  return await fn(req, res);
};

const jsonParser = bodyParser.json();

app.use(cors());
app.get("/api", allowCors(getHello));

// app.get("/api/username-check", allowCors(userController.checkUsername));
app.post("/api/user/register", jsonParser, allowCors(userController.createUsername));
// app.post("/api/user/login", jsonParser, allowCors(userController.loginUsername));

// don't expose it if we don't need it yet.
// app.get("/api/user/read", allowCors(userController.readUsername));
// app.get("/api/user/readall", allowCors(userController.readAllUsername));
// app.put("/api/user/update", jsonParser, allowCors(userController.updateUsername));
// app.delete("/api/user/delete", jsonParser, allowCors(userController.deleteUsername));

// directory controller. need authentication middleware
// create
// link
app.post("/api/directory/link", jsonParser, allowCors(directoryController.createLink));

// folder
// app.post("/api/directory/folder", jsonParser, allowCors(directoryController.createFolder));

// read (link and folder)
app.get("/api/directory/:username/*", allowCors(directoryController.readLinkOrFolder));
// delete
// update
// catch all
app.all("*", (req: VercelRequest, res: VercelResponse) => {
  res.status(404).json({ success: false, message: "Not Found." });
});
module.exports = app;
