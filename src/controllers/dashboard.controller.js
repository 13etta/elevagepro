const dashboardService = require('../services/dashboard.service');

async function showDashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboardData(req.session.user.breeder_id);
    return res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      ...data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showDashboard,
};
