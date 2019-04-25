const mongoose = require('mongoose')
const Series = mongoose.model('Series')
const SeriesPromoter = mongoose.model('SeriesPromoter')
const Promoter = mongoose.model('Promoter')
const asyncExpress = require('async-express')
const auth = require('../middleware/auth')

module.exports = (app) => {
  app.get('/series', getSeries)
  app.post('/series', auth, create)
  app.get('/series/authenticated', auth, getOwnSeries)
  app.post('/series/invite', auth, addPromoter)
  app.get('/series/promoters', getPromoters)
}

module.exports.isSeriesPromoter = isSeriesPromoter

async function isSeriesPromoter(seriesId, promoterId) {
  const model = await SeriesPromoter.findOne({
    promoterId: mongoose.Types.ObjectId(promoterId),
    seriesId: mongoose.Types.ObjectId(seriesId),
  })
  return !!model
}

const create = asyncExpress(async (req, res) => {
  const created = await Series.create(req.body)
  await SeriesPromoter.create({
    promoterId: mongoose.Types.ObjectId(req.promoter._id),
    seriesId: created._id,
    creator: true,
  })
  res.json(created)
})

const getSeries = asyncExpress(async (req, res) => {
  if (req.query._id) {
    const series = await Series.findOne({
      _id: mongoose.Types.ObjectId(req.query._id),
    })
      .populate('promoter')
      .lean()
      .exec()
    res.json(series)
    return
  }
  res.json(
    await Series.find({})
      .populate('promoter')
      .lean()
      .exec()
  )
})

const getOwnSeries = asyncExpress(async (req, res) => {
  const series = await SeriesPromoter.find({
    promoterId: mongoose.Types.ObjectId(req.promoter._id),
  })
    .populate('series')
    .lean()
    .exec()
  res.json(series.map((s) => s.series))
})

const getPromoters = asyncExpress(async (req, res) => {
  const promoters = await SeriesPromoter.find({
    seriesId: req.query.seriesId,
  })
    .populate('promoter')
    .lean()
    .exec()
  res.json(promoters.map((p) => p.promoter))
})

const addPromoter = asyncExpress(async (req, res) => {
  const promoter = await Promoter.findOne({
    email: req.body.email.toLowerCase(),
  })
    .lean()
    .exec()
  if (!promoter) {
    res.status(404).json({
      message: 'Could not find promoter to add',
    })
    return
  }
  if (!(await isSeriesPromoter(req.body.seriesId, req.promoter._id))) {
    res.status(401).json({
      message: 'You must be a series promoter to do this',
    })
    return
  }
  await SeriesPromoter.create({ promoterId: promoter._id, ...req.body })
  res.status(204).end()
})
