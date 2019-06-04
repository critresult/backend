const mongoose = require('mongoose')
const Passing = mongoose.model('Passing')
const Rider = mongoose.model('Rider')
const Race = mongoose.model('Race')
const Entry = mongoose.model('Entry')
const asyncExpress = require('async-express')
const moment = require('moment')
const _ = require('lodash')

module.exports = (app) => {
  app.get('/races/leaderboard', leaderboard)
}

async function transpondersByRaceId(_id) {
  return Entry.find({
    raceId: mongoose.Types.ObjectId(_id),
  })
    .exec()
    .then((entries) => {
      if (!entries.length) return []
      return Rider.find({
        $or: _.map(entries, (entry) => ({ _id: entry.riderId })),
      })
    })
    .then((riders) => _.map(riders, 'transponder'))
    .then((transponders) => _.compact(transponders))
}

/**
 * Calculate the latest results for a given race
 **/
const leaderboard = asyncExpress(async (req, res) => {
  res.json(await leaderboardByRaceId(req.query.raceId))
})

/**
 * Return format
 * {
 *   passings: Passing[],
 *   isFinished: boolean,
 *   leaderFinishTime: ISODate,
 *  }
 **/
const leaderboardByRaceId = async (raceId) => {
  const [race, enteredTransponders] = await Promise.all([
    Race.findOne({
      _id: mongoose.Types.ObjectId(raceId),
    }).exec(),
    transpondersByRaceId(raceId),
  ])
  const passings = await Passing.find({
    eventId: race.eventId,
    date: {
      $gte: race.actualStart || new Date(0),
    },
    $or: _.map(enteredTransponders, (transponder) => ({ transponder })),
  })
    .lean()
    .exec()
  const passingsByTransponder = _.chain(passings)
    .sortBy('date')
    .groupBy('transponder')
    .value()

  // Calculate the leaderboard for a given lap number
  const resultsForLap = (lapNumber) =>
    _.chain(passingsByTransponder)
      .map((passes) => {
        const passCount = passes.length
        // The latest pass we should evaluate for the race
        const passIndex = Math.min(passCount - 1, lapNumber - 1)
        return {
          ...passes[passIndex],
          lapCount: Math.min(passCount, lapNumber),
        }
      })
      .sortBy('date')
      .reverse()
      .sortBy('lapCount')
      .reverse()
      .value()

  const results = resultsForLap(race.lapCount || Number.MAX_VALUE)
  // Retroactively load associated transponders if not mapped to riderId
  const resultPasses = await Promise.all(
    results.map((pass) => {
      if (pass.riderId) return Promise.resolve(pass)
      return Rider.findOne({
        transponder: pass.transponder,
      })
        .lean()
        .exec()
        .then((rider = {}) => ({ ...pass, riderId: rider._id }))
    })
  )
  const finalResults = _.map(resultPasses, (pass) => {
    if (pass.lapCount <= 1) return pass
    const lapLeaderboard = resultsForLap(pass.lapCount)
    const leaderTransponder = _.first(lapLeaderboard).transponder
    const leaderPass =
      passingsByTransponder[leaderTransponder][pass.lapCount - 1]
    const secondsDiff =
      moment(pass.date).unix() - moment(leaderPass.date).unix()
    return {
      ...pass,
      secondsDiff,
    }
  })
  const [leaderPass] = finalResults
  return {
    isFinished:
      race.lapCount && leaderPass && race.lapCount <= leaderPass.lapCount,
    leaderFinishTime: (leaderPass && leaderPass.date) || undefined,
    passings: finalResults.map((passing) => ({
      raceId,
      ...passing,
    })),
  }
}

module.exports.leaderboardByRaceId = leaderboardByRaceId
