import { VercelRequest, VercelResponse } from "@vercel/node";
import bodyParser from "body-parser";
import { getHello } from "../controllers";
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

module.exports = app;
