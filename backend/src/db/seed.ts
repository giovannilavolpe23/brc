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
  { legacyId: "gio", displayName: "Gio", roleKey: "admin", passwordHash: "$2a$12$ErRI6zdXcekHh1vGuYPmmu5Uf/S4iqp6MPg17/OHAUdCOxk1M/RVi" },
  { legacyId: "marto", displayName: "Marto", roleKey: "user", passwordHash: "$2a$12$T2k8XT/xfE9/ko9iaTMpS.Rg9AmLNcnrwK4rdcbkVtVNYJQl1HL0a" },
  { legacyId: "sebas", displayName: "Sebas", roleKey: "user", passwordHash: "$2a$12$R/xS2HY8AR1HabaAmDXiGe6ve57YnUtSKq2dUjf0srHuTOvxWtfOa" },
  { legacyId: "ger", displayName: "Ger", roleKey: "user", passwordHash: "$2a$12$gz6g.Nc38PtxBsooMZSY/ed6zy8uNShT.mKF8cXoIVNCz0aqCt1ES" },
  { legacyId: "nerea", displayName: "Nerea", roleKey: "user", passwordHash: "$2a$12$hdar2smfyCiDtnQeyz.8GekkiNy.HOl.J05pdVEwdK15YTRIB8hAW" },
  { legacyId: "simon", displayName: "Simon", roleKey: "user", passwordHash: "$2a$12$tc1dlDxBSfNBklHgg07Ax.qsJbBByp7RIxoWTsNY9EGMR90dr8O0u" },
  { legacyId: "agus", displayName: "Agus", roleKey: "user", passwordHash: "$2a$12$WffH.e9cMCXhpZJ9FtG3bem8CYPvoBG.ov9obyW/tnwserORf8uBC" },
  { legacyId: "nata", displayName: "Nata", roleKey: "user", passwordHash: "$2a$12$GuIwHylzMEHQ6oicpIXIEeS24pDCznSqRQyn.ctXkpQkl0ydYZ9Mu" },
  { legacyId: "barua", displayName: "Barua", roleKey: "user", passwordHash: "$2a$12$MIJ5YkF.STnudHrqC1gIjuYelE4XNzwIVSRgAwFsOsrrhvcSUomim" },
  { legacyId: "jere", displayName: "Jere", roleKey: "user", passwordHash: "$2a$12$iDCdKUke6L6zCIFTbFxe5uVSIthut8cerw8cntKmrV/s9ID0PiWfO", permissions: ["create_previa"] },
  { legacyId: "tobi", displayName: "Tobi", roleKey: "user", passwordHash: "$2a$12$eMH7Z.fsFxHVGXsseZkXnengUbk0BLao9zFOkmvrVRkKnaVv.wxQ." },
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
