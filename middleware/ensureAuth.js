function ensureAuthenticated(req, res, next) {
    if (!req.user) return res.render('client/login',{
      message: "You need to login first"
    });
    next();
  }

module.exports = ensureAuthenticated ;