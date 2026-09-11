const { canAccessAiSelectionAgent } = require('../config/ai-selection-access');
const db = require('../db');

function rejectSession(req,res) {
  if (!req.session?.user) {
    if (req.session && req.method === 'GET') req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  return req.session.destroy(()=>{res.clearCookie('sid');res.redirect('/auth/login');});
}
async function requireAuth(req, res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser?.id || !sessionUser.breeder_id) return rejectSession(req,res);
  res.set('Cache-Control','no-store');
  try {
    if (!req.authVerified) {
      const result = await db.query(`SELECT u.id,u.breeder_id,u.email,u.full_name,u.role,u.session_version,u.is_active,
        b.status AS billing_status,b.beta_access,b.current_period_end
        FROM users u LEFT JOIN billing_accounts b ON b.breeder_id=u.breeder_id
        WHERE u.id=$1 AND u.breeder_id=$2`,[sessionUser.id,sessionUser.breeder_id]);
      const current = result.rows[0];
      if (!current || current.is_active === false || current.session_version !== (sessionUser.session_version || 0)) return rejectSession(req,res);
      req.session.user = {id:current.id,breeder_id:current.breeder_id,email:current.email,full_name:current.full_name,role:current.role,session_version:current.session_version};
      req.accountAccess = current.beta_access === true || (['active','trialing'].includes(current.billing_status) && new Date(current.current_period_end).getTime() > Date.now());
      req.authVerified = true;
    }
    const write = !['GET','HEAD','OPTIONS'].includes(req.method);
    if (write && ['reader','readonly'].includes(req.session.user.role) && !req.originalUrl.startsWith('/auth/')) return res.status(403).send('Votre accès est en lecture seule.');
    if (write && !req.accountAccess && !/^\/(billing|auth|account)(\/|$)/.test(req.originalUrl)) return res.status(402).send('Un abonnement actif est nécessaire pour enregistrer des modifications. Vos données restent consultables.');
    res.locals.user = req.session.user;
    res.locals.accountAccess = req.accountAccess;
    return next();
  } catch (error) { return next(error); }
}
function requireOwner(req,res,next) {
  return ['owner','admin'].includes(req.session?.user?.role) ? next() : res.status(403).send('Cette action est réservée au responsable de l’élevage.');
}
function requireAiSelectionOwner(req,res,next) {
  if (canAccessAiSelectionAgent(req.session?.user)) return next();
  return res.status(404).render('errors/404',{title:res.__('errors.notFound'),user:req.session?.user||null});
}
function requireGuest(req,res,next) { return req.session?.user ? res.redirect('/dashboard') : next(); }
module.exports={requireAuth,requireOwner,requireAiSelectionOwner,requireGuest};
