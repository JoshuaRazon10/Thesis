const db = require('../src/data/db');

async function run() {
  try {
    const res = await db.query("UPDATE tbl_admins SET username = 'admin@chcc.edu.ph' WHERE username = 'admin'");
    console.log("Updated admin username successfully:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error updating admin username:", err);
    process.exit(1);
  }
}

run();
