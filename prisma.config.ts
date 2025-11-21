import "dotenv/config"; // load .env automatically
import { defineConfig } from "@prisma/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable");
}

export default defineConfig({
  engine: "classic", // required by Prisma 7
  datasource: {
    url: DATABASE_URL, // migration/runtime connection
  },
});
