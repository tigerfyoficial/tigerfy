// middleware/authGuard.js
module.exports = function authGuard(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect("/login");
};
