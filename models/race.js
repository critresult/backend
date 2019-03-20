const mongoose = require('mongoose');

const RaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    scheduledStart: {
      type: Date,
      required: true,
    },
    actualStart: {
      type: Date,
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
  },
  {
    collection: 'races',
  }
);

mongoose.model('Race', RaceSchema);