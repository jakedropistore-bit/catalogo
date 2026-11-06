import { neon } from "@neondatabase/serverless";
export const sql = neon(process.env.DATABASE_URL);
let ready;
export const init = () => (ready ??= (async () => {
  await sql`create table if not exists products (id serial primary key, name text not null, name_key text not null unique, price integer not null, image_url text, active boolean not null default true, updated_at timestamptz not null default now())`;
  await sql`alter table products add column if not exists ref text`;
  await sql`update products set ref = 'R' || lpad(id::text, 3, '0') where ref is null`;
  await sql`create unique index if not exists products_ref_key on products (ref)`;
})());
export const keyOf = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
