import { buildApp } from "./app.js";
import { env } from "./env.js";

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
