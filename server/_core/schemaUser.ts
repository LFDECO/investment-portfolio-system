import mysql from "mysql2/promise";
import { ENV } from "./env";

let pool: mysql.Pool | null = null;

function getPool() {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is required for strict user provisioning");
  }

  if (!pool) {
    pool = mysql.createPool({
      uri: ENV.databaseUrl,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  return pool;
}

export async function ensureSchemaUserByEmail(payload: {
  email: string;
  name: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedName = payload.name.trim() || normalizedEmail;

  const conn = await getPool().getConnection();
  try {
    await conn.execute(
      `
        INSERT INTO \`user\` (\`name\`, \`email\`, \`phone\`, \`created_at\`)
        VALUES (?, ?, NULL, NOW())
        ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)
      `,
      [normalizedName, normalizedEmail]
    );

    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT \`user_id\`, \`name\`, \`email\` FROM \`user\` WHERE \`email\` = ? LIMIT 1`,
      [normalizedEmail]
    );

    const row = rows?.[0];
    const userId = Number(row?.user_id ?? 0);
    if (!userId) {
      throw new Error("Unable to resolve strict schema user_id after OAuth sign-in");
    }

    return {
      user_id: userId,
      name: String(row?.name ?? normalizedName),
      email: String(row?.email ?? normalizedEmail),
    };
  } finally {
    conn.release();
  }
}
