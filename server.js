const express = require("express");
// trocado: usamos cookie-session em vez de express-session
const cookieSession = require("cookie-session");
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

/* -------- Sessão (stateless, compatível com serverless) -------- */
app.use(
  cookieSession({
    name: "tig.sid",
    keys: [
      process.env.SESSION_SECRET || "tigerfy_secret",
      process.env.SESSION_SECRET_FALLBACK || "tigerfy_fallback",
    ],
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // mantém o mesmo prazo de 8h do código anterior
    maxAge: 1000 * 60 * 60 * 8,
    // opcional: defina COOKIE_DOMAIN se precisar compartilhar entre subdomínios
    domain: process.env.COOKIE_DOMAIN || undefined,
  })
);

// renova o cookie a cada request (efeito "rolling")
app.use((req, _res, next) => {
  if (req.session) req.session._rt = Date.now();
  // polyfills para compat com possíveis usos de express-session nas rotas
  if (req.session && typeof req.session.destroy !== "function") {
    req.session.destroy = (cb) => {
      req.session = null;
      if (typeof cb === "function") cb();
    };
  }
  if (req.session && typeof req.session.regenerate !== "function") {
    req.session.regenerate = (cb) => {
      // cookie-session não tem id; só recriamos o objeto
      req.session = Object.assign({}, req.session);
      if (typeof cb === "function") cb();
    };
  }
  if (req.session && typeof req.session.save !== "function") {
    req.session.save = (cb) => (typeof cb === "function" ? cb() : undefined);
  }
  next();
});

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
