import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/client.js";
import { prisma } from "../lib/prisma.js";

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  // Verify token with Supabase
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUser = data.user;

  // Try to find the user in our DB
  let dbUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
  });

  // If user doesn't exist in our DB yet, create them
  // Supabase stores provider info in app_metadata
  if (!dbUser) {
    const provider = supabaseUser.app_metadata?.provider === "github"
      ? "GitHub"
      : "Google";

    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      supabaseUser.email?.split("@")[0] ||
      "Unknown";

    const email = supabaseUser.email || "";

    dbUser = await prisma.user.create({
      data: {
        id: supabaseUser.id,  // use Supabase UUID directly
        name,
        email,
        provider,
      },
    });
  }

  // Attach userId to request so routes can use it
  req.userId = supabaseUser.id;
  next();
}