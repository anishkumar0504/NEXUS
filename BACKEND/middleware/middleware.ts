import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/client.js";
import { prisma } from "../lib/prisma.js";

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
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

    // Unique placeholder so users without an email never collide on ""
    const email = supabaseUser.email || `${supabaseUser.id}@no-email.local`;

    // 1) match by Supabase id, 2) fall back to an existing row with the same email
    let dbUser =
      (await prisma.user.findUnique({ where: { id: supabaseUser.id } })) ??
      (await prisma.user.findUnique({ where: { email } }));

    if (!dbUser) {
      const provider =
        supabaseUser.app_metadata?.provider === "github" ? "GitHub" : "Google";

      const name =
        supabaseUser.user_metadata?.full_name ||
        supabaseUser.user_metadata?.name ||
        supabaseUser.email?.split("@")[0] ||
        "Unknown";

      try {
        dbUser = await prisma.user.create({
          data: {
            id: supabaseUser.id, // use Supabase UUID directly
            name,
            email,
            provider,
          },
        });
      } catch (e: any) {
        // P2002 = unique constraint. Happens when parallel first-login requests
        // all try to create the same user; the loser just reads the winner's row.
        if (e?.code !== "P2002") throw e;
        dbUser = await prisma.user.findFirst({
          where: { OR: [{ id: supabaseUser.id }, { email }] },
        });
        if (!dbUser) throw e;
      }
    }

    // Use the DB row's id (may differ from the Supabase id for older rows)
    req.userId = dbUser.id;
    next();
  } catch (err) {
    console.error("[auth middleware]", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
}