module.exports = function (req, res, next) {
  const logged = !!(req.session && (req.session.user || req.session.userId));
  if (!logged) return res.redirect("/login");
  res.locals.user = req.session.user || { _id: req.session.userId };
  next();
};
