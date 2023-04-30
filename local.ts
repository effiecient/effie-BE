import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

let app = require("./api");

const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
  res.send("Vercel + Express + TypeScript + Firebase Server");
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}. NODE_ENV: ${process.env.VERCEL_ENV}`);
});
