const { makeMemModel } = require("./_mem");
const Admin = makeMemModel([
  // seed opcional:
  // { _id: "seed_admin", email: "admin@admin.com", password: "$2b$..." }
]);
module.exports = Admin;
