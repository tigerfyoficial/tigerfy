// controllers/authController.js
const Admin = require("../models/Admin");

module.exports = {
  getLogin(req, res) {
    res.render("login", { message: "" });
  },

  async postLogin(req, res) {
    const { user, pass } = req.body;

    const admin = await Admin.findOne({ username: user });
    if (!admin) {
      return res.render("login", { message: "Usuário/senha incorretos." });
    }

    const ok = await admin.comparePassword(pass);
    if (!ok) {
      return res.render("login", { message: "Usuário/senha incorretos." });
    }

    req.session.user = {
      id: admin._id,
      username: admin.username,
    };

    return res.redirect("/deck");
  },

  async getRegister(req, res) {
    res.render("register", { message: "" });
  },

  async postRegister(req, res) {
    const { username, email, password } = req.body;

    try {
      await Admin.create({ username, email, password });
      return res.redirect("/login");
    } catch (e) {
      console.log("Erro register:", e);
      return res.render("register", { message: "Erro ao registrar." });
    }
  },

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  },
};
