import { pool } from "./pool";

type SeedUser = {
  legacyId: string;
  displayName: string;
  roleKey: "admin" | "user";
  passwordHash: string;
  permissions?: string[];
};

const roles = [
  { key: "admin", name: "Admin" },
  { key: "user", name: "User" },
];

const permissions = [
  { key: "create_previa", description: "Can create previas outside the admin panel." },
];

const users: SeedUser[] = [
  { legacyId: "gio", displayName: "Gio", roleKey: "admin", passwordHash: "$2a$12$o6JEOoqEAgjIF8jUH2Dru.wOsQ9eKoemF2RgNi6qwW.le0jVkw9Ny" },
  { legacyId: "marto", displayName: "Marto", roleKey: "user", passwordHash: "$2a$12$jyuRGHUliHb0GLJqlfUQW.JxVSyhpAhgDhLOar/wgCw5HRHBka.bi" },
  { legacyId: "sebas", displayName: "Sebas", roleKey: "user", passwordHash: "$2a$12$37FuJ.2jUSsOGYe.STW0x.qR/roAFOBcZQvH5zwG8BFvoAvDy5bf2" },
  { legacyId: "ger", displayName: "Ger", roleKey: "user", passwordHash: "$2a$12$RQ3c3RjM8E1SDoCg6o7ZkuLRZiibdpxQh79Mq.KkEaH0Hf1xP5cZO" },
  { legacyId: "nerea", displayName: "Nerea", roleKey: "user", passwordHash: "$2a$12$bzqJuRhWMhkJgiMMPtgI9.HrjEhdtLgyzIUKt.ZN4Qtn2oi4KPsBm" },
  { legacyId: "simon", displayName: "Simon", roleKey: "user", passwordHash: "$2a$12$ZbtfqRbUqiQUKeT8R8AjvOOuUXEMPUjvDHr22rMTidf8AMeMxhjna" },
  { legacyId: "agus", displayName: "Agus", roleKey: "user", passwordHash: "$2a$12$mx3XTWZc04mX/6GU5a/K7.JLXuNxtRe2JlTMbUS50hTk6ckl0TAk2" },
  { legacyId: "nata", displayName: "Nata", roleKey: "user", passwordHash: "$2a$12$7hpGm/48bOb.hAGyF/dzFuWAQ5v0Avo9ak4tqt8xuQiDLdNXsxnVq" },
  { legacyId: "barua", displayName: "Barua", roleKey: "user", passwordHash: "$2a$12$fzx6RawKYxU6hBkeMertIOt40ZKKzCgG/InIQnOYnTfdXpWZjZST." },
  { legacyId: "jere", displayName: "Jere", roleKey: "user", passwordHash: "$2a$12$JrYMoQjTUEExzmMQRzhVKeslu4BGiyG3N57oD3.8yNaMhEvrzeW6u", permissions: ["create_previa"] },
  { legacyId: "tobi", displayName: "Tobi", roleKey: "user", passwordHash: "$2a$12$0izgtGsnQff3nnGBhUFs7e3VWNh75Ha96f5nRrrz7UfAwgR81ZmWW" },
];

async function seedRoles(): Promise<void> {
  for (const role of roles) {
    await pool.query(
      `
        insert into roles (key, name)
        values ($1, $2)
        on conflict (key) do update
        set name = excluded.name, updated_at = now()
      `,
      [role.key, role.name]
    );
  }
}

async function seedPermissions(): Promise<void> {
  for (const permission of permissions) {
    await pool.query(
      `
        insert into permissions (key, description)
        values ($1, $2)
        on conflict (key) do update
        set description = excluded.description, updated_at = now()
      `,
      [permission.key, permission.description]
    );
  }
}

async function seedUsers(): Promise<void> {
  for (const user of users) {
    await pool.query(
      `
        insert into users (legacy_id, display_name, password_hash, role_id)
        select $1, $2, $3, roles.id
        from roles
        where roles.key = $4
        on conflict (legacy_id) do update
        set display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            role_id = excluded.role_id,
            updated_at = now()
      `,
      [user.legacyId, user.displayName, user.passwordHash, user.roleKey]
    );
  }
}

async function seedUserPermissions(): Promise<void> {
  for (const user of users) {
    for (const permissionKey of user.permissions || []) {
      await pool.query(
        `
          insert into user_permissions (user_id, permission_id)
          select users.id, permissions.id
          from users, permissions
          where users.legacy_id = $1 and permissions.key = $2
          on conflict do nothing
        `,
        [user.legacyId, permissionKey]
      );
    }
  }
}

async function main(): Promise<void> {
  await seedRoles();
  await seedPermissions();
  await seedUsers();
  await seedUserPermissions();
  console.log(`Seeded ${roles.length} roles, ${permissions.length} permissions, and ${users.length} users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
