import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function getHello(req: VercelRequest, res: VercelResponse) {
  const { name = "World" } = req.query;
  console.log(req.headers.username);
  res.send(`Hello ${name}! running in node env:${process.env.NODE_ENV}, VERCEL_ENV:${process.env.VERCEL_ENV}`);
}
