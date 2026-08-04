import "dotenv/config";
import mysql from "mysql2/promise";

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/set-admin.mjs <email>"); process.exit(1); }

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [res] = await connection.execute(
    "UPDATE users SET role = 'admin' WHERE email = ?", [email]
  );
  if (res.affectedRows === 0) { console.error(`Usuário não encontrado: ${email}`); process.exit(1); }
  console.log(`✓ ${email} agora é admin.`);
} finally {
  await connection.end();
}
