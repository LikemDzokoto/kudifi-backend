// imports
import { withAccelerate } from "@prisma/extension-accelerate";

// generated
import { PrismaClient } from "@/generated/prisma";

export const prisma = new PrismaClient().$extends(withAccelerate());
