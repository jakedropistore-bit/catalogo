import { sql, init } from "../lib/db.mjs";
export const config = { path: "/api/products" };
export default async () => {
  await init();
  const rows = await sql`select id, ref, name, price, image_url from products where active order by name`;
  return Response.json(rows, { headers: { "cache-control": "public, max-age=60" } });
};
