function ensureAuthenticated(req, res, next) {
    if (!req.user) {
      req.flash('error',"You need to login first")
      return res.redirect('/login');
    }
    next();
  }

module.exports = ensureAuthenticated ;