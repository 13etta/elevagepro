const service = require('../services/training.service');
const db = require('../db');
const documents = require('../services/training-document.service');
const wrap = work => async (req,res,next) => { try { return await work(req,res); } catch(error) { if(error.status) return res.status(error.status).send(error.message); return next(error); } };
const breederId = req => req.session.user.breeder_id;
exports.list = wrap(async (req,res) => {
  const jobs = (await db.query(`SELECT j.*,COALESCE(p.received,0)::int AS received FROM training_jobs j
    LEFT JOIN LATERAL (SELECT SUM(CASE WHEN kind='refund' THEN -amount_cents ELSE amount_cents END) AS received
      FROM training_payments WHERE breeder_id=j.breeder_id AND job_id=j.id) p ON true
    WHERE j.breeder_id=$1 ORDER BY j.start_date DESC,j.created_at DESC`,[breederId(req)])).rows;
  return res.render('training/index',{title:'Dressage',jobs});
});
exports.form = wrap(async(req,res) => {
  const job = req.params.id ? (await service.detail(breederId(req),req.params.id)).job : {};
  return res.render('training/new',{title:job.id?'Modifier le devis':'Nouveau devis de dressage',job});
});
exports.update = wrap(async(req,res) => { await service.update(breederId(req),req.params.id,req.body); return res.redirect('/training/'+req.params.id); });
exports.create = wrap(async(req,res) => { const job = await service.create(breederId(req),req.body); return res.redirect('/training/'+job.id); });
exports.show = wrap(async(req,res) => res.render('training/show',{title:'Dossier dressage',...await service.detail(breederId(req),req.params.id)}));
exports.accept = wrap(async(req,res) => { await service.accept(breederId(req),req.params.id,req.body.acceptance_reference); return res.redirect('/training/'+req.params.id); });
exports.pay = wrap(async(req,res) => { await service.payment(breederId(req),req.params.id,req.body); return res.redirect('/training/'+req.params.id); });
exports.close = wrap(async(req,res) => { await service.close(breederId(req),req.params.id,req.body.action); return res.redirect('/training/'+req.params.id); });
exports.document = wrap(async(req,res) => {
  const data = await service.documentData(breederId(req),req.params.id,req.params.kind,req.body.payment_id);
  const pdf = await documents.generate(data);
  res.type('application/pdf'); res.set('Content-Disposition',`attachment; filename="${data.number}-${req.params.kind}.pdf"`);
  return res.send(pdf);
});
