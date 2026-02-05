const mongoose = require("mongoose");

const ExchangeRateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    currency: { type: String, required: true },
    rate: { type: Number, required: true },
    source: { type: String, default: "BOT" },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: "30d",
    },
  },
  { timestamps: true },
);

ExchangeRateSchema.index({ date: 1, currency: 1 }, { unique: true });

module.exports = mongoose.model("ExchangeRate", ExchangeRateSchema);
