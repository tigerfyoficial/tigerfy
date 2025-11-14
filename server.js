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
app.set("trust proxy", 1); // garante secure cookies atrás de proxy

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

/* -------- Sessão (req.session.userId) -------- */
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

/* -------- Locais globais para as views -------- */
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

/* -------- Arquivos estáticos -------- */
app.use(express.static(path.join(__dirname, "public")));

/* -------- Rotas -------- */
app.get("/", (_req, res) => res.redirect("/login"));

app.get("/", (_req, res) => res.redirect("/dashboard")); // opcional; se prefere /login, mantenha

app.use("/", require("./routes/auth"));         // login/register/logout
app.use("/", require("./routes/dashboard"));    // /dashboard
app.use("/", require("./routes/offers"));       // /ofertas, /ofertas/criar, /ofertas/gerenciar
app.use("/", require("./routes/api_pix"));      // /adquirentes
app.use("/", require("./routes/perfil"));       // /perfil   (aquele que já criamos)
app.use("/", require("./routes/conquistas"));   // /conquistas (aquele que já criamos)
app.use("/", require("./routes/aliases"));      // redirecionamentos antigos

/* -------- Favicon (evita 404 nos logs) -------- */
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
