const mongoose = require('mongoose')
const Rider = mongoose.model('Rider')
const _async = require('async-express')
const auth = require('../middleware/auth')

module.exports = (app) => {
  app.get('/riders', getRiders)
  app.post('/riders', auth, create)
  app.get('/riders/search', search)
  app.put('/riders', auth, update)
  app.post('/riders/byId', auth, byId)
}

const byId = _async(async (req, res) => {
  const riders = await Rider.find({
    $or: req.body._ids.map((_id) => ({
      _id,
    })),
  })
  res.json(riders)
})

const create = _async(async (req, res) => {
  if (req.body.models) {
    const created = await Rider.create(req.body.models)
    res.json(created)
    return
  }
  if (!req.body.license && !req.body.licenseExpirationDate) {
    // It's a one day, set the license expiration 1 day forward
    const licenseExpirationDate = new Date()
    licenseExpirationDate.setDate(licenseExpirationDate.getDate() + 1)
    req.body.licenseExpirationDate = licenseExpirationDate
  }
  const created = await Rider.create(req.body)
  res.json(created)
})

const getRiders = _async(async (req, res) => {
  const query = {}
  if (req.query.license) {
    query.license = req.query.license
  } else if (req.query._id) {
    query._id = mongoose.Types.ObjectId(req.query._id)
  }
  if (Object.keys(query).length === 0) {
    // Mass find
    const models = await Rider.find(query)
    res.json(models)
    return
  }
  const model = await Rider.findOne(query)
    .lean()
    .exec()
  if (!model) {
    res.status(404).json({
      message: 'No model found',
    })
    return
  }
  res.json(model)
})

const search = _async(async (req, res) => {
  const searchString = req.query.search || ''
  // Limit to 3 search terms
  const strings = searchString.split(' ').slice(0, 3)
  const searchRegexes = strings.map((s) => new RegExp(`^${s}`, 'i'))
  // And each of these or clauses
  const orClauses = searchRegexes.map((regex) => ({
    $or: [
      {
        license: {
          $regex: regex,
        },
      },
      {
        firstname: {
          $regex: regex,
        },
      },
      {
        lastname: {
          $regex: regex,
        },
      },
    ],
  }))
  const riders = await Rider.find({
    $or: [
      {
        licenseExpirationDate: {
          $gte: new Date(),
        },
      },
      {
        license: {
          $exists: false,
        },
      },
    ],
  })
    .and(orClauses)
    .populate('bibs')
    .limit(20)
    .lean()
    .exec()
  res.json(riders)
})

const update = _async(async (req, res) => {
  await Rider.updateOne(req.body.where, req.body.changes).exec()
  res.status(204).end()
})
