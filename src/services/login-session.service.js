function localReturnPath(value) {
  return typeof value === 'string' && /^\/(?![\/\\])/.test(value) && !/[\\\r\n]/.test(value)
    ? value : '/dashboard';
}

async function establishSession(req, user) {
  const returnTo = localReturnPath(req.session.returnTo);
  const preferences = req.session.preferences;
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.user = user;
  req.session.preferences = preferences;
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  return returnTo;
}

module.exports = { establishSession, localReturnPath };
