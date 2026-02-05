const axios = require("axios");
const ExchangeRate = require("../models/ExchangeRate");
require("dotenv").config();
const getDateString = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};
const getCurrentRate = async (targetCurrency, specificDate = null) => {
  console.log("🔑 Using API Key:", process.env.BOT_API_KEY); // 👈
  if (!targetCurrency || targetCurrency === "THB") {
    return 1;
  }

  const targetDateStr = specificDate
    ? specificDate.split("T")[0]
    : getDateString(0);

  let rateRecord = await ExchangeRate.findOne({
    date: targetDateStr,
    currency: targetCurrency,
  });
  if (rateRecord) return rateRecord.rate;

  for (let i = 0; i < 7; i++) {
    const checkDate = getDateString(i);
    try {
      const response = await axios.get(
        "https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/",
        {
          params: {
            start_period: checkDate,
            end_period: checkDate,
            currency: targetCurrency,
          },
          headers: {
            Authorization: process.env.BOT_API_KEY || "",
            accept: "application/json",
          },
        },
      );

      const dataDetail = response.data?.result?.data?.data_detail;
      if (dataDetail && dataDetail.length > 0 && dataDetail[0].mid_rate) {
        const rate = parseFloat(dataDetail[0].mid_rate);
        await ExchangeRate.findOneAndUpdate(
          {
            date: todayStr,
            currency: targetCurrency,
          },
          {
            rate: rate,
            source:
              checkDate === todayStr ? "BOT" : `BOT_Fallback_${checkDate}`,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        console.log(
          `✅ Saved rate ${rate} (from ${checkDate}) as Today's Rate`,
        );

        return rate;
      }
    } catch (e) {
      console.error(
        `Error fetching ${checkDate}:`,
        e.response?.data || e.message,
      );

      if (!process.env.BOT_API_KEY) {
        console.error("WARNING: API KEY IS MISSING OR UNDEFINED!");
      }
    }
  }

  const last = await ExchangeRate.findOne({ currency: targetCurrency }).sort({
    date: -1,
  });
  return last ? last.rate : 1;
};
exports.getCurrentRate = getCurrentRate;

// show front
exports.getRate = async (req, res) => {
  try {
    const { currency, date } = req.query;
    const rate = await getCurrentRate(currency, date);

    res.json({
      success: true,
      currency: currency,
      date: date,
      rate: rate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listExchangeRates = async (req, res) => {
  try {
    const rates = await ExchangeRate.find({}).sort({ date: -1 }).limit(30);

    res.json({
      success: true,
      count: rates.length,
      data: rates,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
