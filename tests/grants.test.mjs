// Privileges after supabase/migrations/0029 (the review before Supabase's 2026-10-30 change).
// Run with `npm test`. The real 0001 resale schema runs on PGlite with small auth/storage stand-ins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const sql = (file) => readFileSync(new URL(file, MIGRATIONS), "utf8");

const OWNER = "11111111-1111-1111-1111-111111111111";

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;`);
  // gen_random_uuid() is built in; PGlite has no pgcrypto package.
  await db.exec(sql("0001_init.sql").replace(/create extension if not exists "pgcrypto";/, ""));
  // What Supabase's default privileges gave these tables in production (review of 2026-10-20).
  await db.exec(`grant truncate, references, trigger on public.listings, public.listing_photos,
    public.listing_inquiries, public.profiles to anon, authenticated`);
  await db.exec(sql("0029_tighten_grants.sql"));
  await db.exec(sql("0029_tighten_grants.sql"));
  await db.query("insert into auth.users (id) values ($1)", [OWNER]);
  await db.exec(`insert into public.listings (id, owner_id, status, title, city, district, address_line, currency, title_deed_number, admin_notes)
    values ('22222222-2222-2222-2222-222222222222', '${OWNER}', 'approved', 'Flat', 'Istanbul', 'Sisli', 'Street 1', 'USD', 'TD-1', 'note'),
           ('33333333-3333-3333-3333-333333333333', '${OWNER}', 'draft', 'Draft', 'Istanbul', 'Sisli', 'Street 2', 'USD', null, null);
    insert into public.listing_photos (listing_id, storage_path, sort_order) values ('22222222-2222-2222-2222-222222222222', 'a/b.jpg', 0);`);
  return db;
}

async function as(db, role, uid, query, params) {
  await db.exec(`set test.uid = '${uid ?? ""}'; set role ${role};`);
  try {
    return await db.query(query, params);
  } finally {
    await db.exec("reset role");
  }
}

test("0029: no TRUNCATE, REFERENCES or TRIGGER for anon or authenticated", async () => {
  const db = await database();
  for (const role of ["anon", "authenticated"]) {
    for (const priv of ["truncate", "references", "trigger"]) {
      const r = await db.query(`select has_table_privilege($1, 'public.listings', $2) ok`, [role, priv]);
      assert.equal(r.rows[0].ok, false, `${role} ${priv}`);
    }
  }
  // And not for tables created later by postgres.
  await db.exec("create table public.later (id int)");
  const later = await db.query(`select has_table_privilege('anon', 'public.later', 'truncate') ok`);
  assert.equal(later.rows[0].ok, false);
});

test("0029: visitors see only the public columns of approved listings, and their photos", async () => {
  const db = await database();
  const rows = await as(db, "anon", null, "select id, title, city, owner_id from public.listings");
  assert.deepEqual(rows.rows.map((r) => r.title), ["Flat"]);
  for (const column of ["title_deed_number", "admin_notes", "address_line"]) {
    await assert.rejects(as(db, "anon", null, `select ${column} from public.listings`), /permission denied/);
  }
  const photos = await as(db, "anon", null, "select storage_path from public.listing_photos");
  assert.equal(photos.rows.length, 1);
  // A visitor can still send an inquiry about an approved listing, but never read any.
  await as(db, "anon", null, "insert into public.listing_inquiries (listing_id, name, email, phone, message) values ('22222222-2222-2222-2222-222222222222', 'A', 'a@b.c', '1', 'hi')");
  await assert.rejects(as(db, "anon", null, "select * from public.listing_inquiries"), /permission denied/);
});

test("0029: owners keep their account columns and can still edit; nobody reads the deed number", async () => {
  const db = await database();
  const own = await as(db, "authenticated", OWNER, "select id, address_line, rejection_reason from public.listings order by title");
  assert.equal(own.rows.length, 2);
  await as(db, "authenticated", OWNER, "update public.listings set title = 'Draft 2' where id = '33333333-3333-3333-3333-333333333333'");
  await assert.rejects(as(db, "authenticated", OWNER, "select title_deed_number from public.listings"), /permission denied/);
  await assert.rejects(as(db, "authenticated", OWNER, "select admin_notes from public.listings"), /permission denied/);
});

test("0029: trigger functions are not callable through the API but still fire", async () => {
  const db = await database();
  const r = await db.query(`select has_function_privilege('anon', 'public.handle_new_user()', 'execute') a,
    has_function_privilege('authenticated', 'public.enforce_listing_transition()', 'execute') b,
    has_function_privilege('anon', 'public.is_admin()', 'execute') admin`);
  assert.deepEqual(r.rows[0], { a: false, b: false, admin: true });
  // handle_new_user still runs on sign-up.
  const profile = await db.query("select count(*)::int n from public.profiles where id = $1", [OWNER]);
  assert.equal(profile.rows[0].n, 1);
});
