import { VercelRequest, VercelResponse } from "@vercel/node";
import bodyParser from "body-parser";
import { getHello, createUsername, readUsername, readAllUsername, updateUsername, deleteUsername } from "../controllers";
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

app.post("/api/user/create", jsonParser, allowCors(createUsername));
app.get("/api/user/read", allowCors(readUsername));
app.get("/api/user/readall", allowCors(readAllUsername));
app.put("/api/user/update", jsonParser, allowCors(updateUsername));
app.delete("/api/user/delete", jsonParser, allowCors(deleteUsername));

module.exports = app;
