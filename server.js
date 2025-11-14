const express = require("express");
const session = require("express-session");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

const app = express();

/* -------- Vercel/Proxy -------- */
app.set("trust proxy", 1);

/* -------- Middlewares básicos -------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(morgan("tiny"));

/* -------- Sessão -------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tigerfy_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

/* -------- Locais globais -------- */
app.use((req, res, next) => {
  res.locals.active = "";
  res.locals.userEmail = req.session?.userEmail || null;
  next();
});

/* -------- EJS + Layouts -------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

/* -------- Estáticos -------- */
app.use(express.static(path.join(__dirname, "public")));

/* -------- Raiz (escolhe login ou dashboard) -------- */
app.get("/", (req, res) => {
  if (req.session?.userId) return res.redirect("/dashboard");
  return res.redirect("/login");
});

/* -------- Rotas -------- */
app.use("/", require("./routes/auth"));         // /login, /register, /logout
app.use("/", require("./routes/dashboard"));    // /dashboard
app.use("/", require("./routes/offers"));       // /ofertas, /ofertas/criar, /ofertas/painel/:id
app.use("/", require("./routes/api_pix"));      // /adquirentes
app.use("/", require("./routes/perfil"));       // /perfil
app.use("/", require("./routes/conquistas"));   // /conquistas
app.use("/", require("./routes/aliases"));      // compat de URLs antigas

/* -------- Favicon (silencia 404) -------- */
app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.get("/favicon.png", (_req, res) => res.status(204).end());

/* -------- 404 -------- */
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - TigerFy" });
});

/* -------- Export / Start -------- */
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 TigerFy rodando na porta ${PORT}`));
}

module.exports = app;
