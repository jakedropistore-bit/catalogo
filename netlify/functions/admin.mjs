import { createHash, timingSafeEqual } from "node:crypto";
import { sql, init, keyOf } from "../lib/db.mjs";
export const config = { path: "/api/admin/*" };
let failsReady;
const initFails = () => (failsReady ??= sql`create table if not exists admin_fails (ip text primary key, n int not null default 0, first_at timestamptz not null default now())`);
const publicId = (u) => { const m = String(u || "").match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i); return m ? m[1] : null; };
const releaseImage = async (url) => {
  const id = publicId(url); if (!id) return null;
  const [still] = await sql`select 1 as x from products where image_url = ${url} limit 1`;
  if (still) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHash("sha1").update(`invalidate=true&public_id=${id}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
  const r = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: "POST", body: new URLSearchParams({ public_id: id, timestamp, invalidate: "true", api_key: process.env.CLOUDINARY_API_KEY, signature })
  });
  return (await r.json()).result === "ok";
};
const okPin = (pin) => {
  const a = Buffer.from(pin), b = Buffer.from(process.env.ADMIN_PIN || "");
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
};
export default async (req) => {
  await init(); await initFails();
  const ip = req.headers.get("x-nf-client-connection-ip") || "desconocida";
  const [fl] = await sql`select n, first_at from admin_fails where ip = ${ip}`;
  if (fl && fl.n >= 5 && Date.now() - new Date(fl.first_at).getTime() < 15 * 60 * 1000)
    return new Response("Demasiados intentos. Espera 15 minutos.", { status: 429 });
  if (!okPin(req.headers.get("x-admin-pin") || "")) {
    await sql`insert into admin_fails (ip, n, first_at) values (${ip}, 1, now())
      on conflict (ip) do update set
        n = case when now() - admin_fails.first_at > interval '15 minutes' then 1 else admin_fails.n + 1 end,
        first_at = case when now() - admin_fails.first_at > interval '15 minutes' then now() else admin_fails.first_at end`;
    return new Response("PIN incorrecto", { status: 401 });
  }
  if (fl) await sql`delete from admin_fails where ip = ${ip}`;
  const path = new URL(req.url).pathname.replace("/api/admin/", "");
  if (path === "list") return Response.json(await sql`select * from products order by active desc, name`);
  if (path === "sign") {
    const timestamp = Math.floor(Date.now() / 1000), folder = "catalogo";
    const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
    return Response.json({ cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature });
  }
  const b = await req.json().catch(() => ({}));
  if (path === "save") {
    const name = String(b.name || "").trim().slice(0, 120), price = Math.round(Number(b.price));
    if (!name || !(price > 0)) return new Response("Escribe un nombre y un precio válidos", { status: 400 });
    const id = Number(b.id) || null;
    try {
      if (id) {
        const [old] = await sql`select image_url from products where id = ${id}`;
        const [row] = await sql`update products set name = ${name}, name_key = ${keyOf(name)}, price = ${price},
          image_url = coalesce(${b.image_url || null}, image_url), active = true, updated_at = now()
          where id = ${id} returning *`;
        if (!row) return new Response("Ese producto ya no existe", { status: 404 });
        if (b.image_url && old?.image_url && old.image_url !== row.image_url) { try { await releaseImage(old.image_url); } catch {} }
        return Response.json(row);
      }
      const [row] = await sql`insert into products (name, name_key, price, image_url, active)
        values (${name}, ${keyOf(name)}, ${price}, ${b.image_url || null}, true)
        on conflict (name_key) do update set name = excluded.name, price = excluded.price,
          image_url = coalesce(excluded.image_url, products.image_url), active = true, updated_at = now()
        returning *`;
      if (!row.ref) { const [r2] = await sql`update products set ref = 'R' || lpad(id::text, 3, '0') where id = ${row.id} returning *`; return Response.json(r2); }
      return Response.json(row);
    } catch (e) {
      if (e.code === "23505" || /duplicate key/i.test(String(e.message))) return new Response("Ya existe otro producto con ese nombre", { status: 409 });
      throw e;
    }
  }
  if (path === "delete") {
    const [row] = await sql`delete from products where id = ${Number(b.id)} returning image_url`;
    let foto = null;
    if (row?.image_url) { try { foto = await releaseImage(row.image_url); } catch { foto = false; } }
    return Response.json({ ok: true, foto });
  }
  if (path === "toggle") {
    const [row] = await sql`update products set active = ${!!b.active}, updated_at = now() where id = ${Number(b.id)} returning *`;
    return Response.json(row || {});
  }
  return new Response("No existe", { status: 404 });
};
