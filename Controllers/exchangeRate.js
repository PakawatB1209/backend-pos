const User = require("../models/User");
const Company = require("../models/Company");
const axios = require("axios");
const ExchangeRate = require("../models/ExchangeRate");
require("dotenv").config();
const getDateString = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};
// const getCurrentRate = async (targetCurrency, specificDate = null) => {
//   if (!targetCurrency || targetCurrency === "THB") {
//     return 1;
//   }

//   const targetDateStr = specificDate
//     ? specificDate.split("T")[0]
//     : getDateString(0);

//   let rateRecord = await ExchangeRate.findOne({
//     date: targetDateStr,
//     currency: targetCurrency,
//   });
//   if (rateRecord) return rateRecord.rate;

//   for (let i = 0; i < 7; i++) {
//     const checkDate = getDateString(i);
//     try {
//       const response = await axios.get(
//         "https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/",
//         {
//           params: {
//             start_period: checkDate,
//             end_period: checkDate,
//             currency: targetCurrency,
//           },
//           headers: {
//             Authorization: process.env.BOT_API_KEY || "",
//             accept: "application/json",
//           },
//         },
//       );

//       const dataDetail = response.data?.result?.data?.data_detail;
//       if (dataDetail && dataDetail.length > 0 && dataDetail[0].mid_rate) {
//         const rate = parseFloat(dataDetail[0].mid_rate);
//         await ExchangeRate.findOneAndUpdate(
//           {
//             date: todayStr,
//             currency: targetCurrency,
//           },
//           {
//             rate: rate,
//             source:
//               checkDate === todayStr ? "BOT" : `BOT_Fallback_${checkDate}`,
//           },
//           {
//             upsert: true,
//             new: true,
//             setDefaultsOnInsert: true,
//           },
//         );

//         console.log(
//           `✅ Saved rate ${rate} (from ${checkDate}) as Today's Rate`,
//         );

//         return rate;
//       }
//     } catch (e) {
//       console.error(
//         `Error fetching ${checkDate}:`,
//         e.response?.data || e.message,
//       );

//       if (!process.env.BOT_API_KEY) {
//         console.error("WARNING: API KEY IS MISSING OR UNDEFINED!");
//       }
//     }
//   }

//   const last = await ExchangeRate.findOne({ currency: targetCurrency }).sort({
//     date: -1,
//   });
//   return last ? last.rate : 1;
// };

const getCurrentRate = async (targetCurrency, specificDate = null) => {
  if (!targetCurrency || targetCurrency === "THB") {
    return 1;
  }

  // ✅ 1. ประกาศตัวแปรนี้ไว้แล้ว
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
            Authorization: process.env.BOT_API_KEY, // หรือลองตัวนี้
            accept: "application/json",
          },
        },
      );

      const dataDetail = response.data?.result?.data?.data_detail;
      if (dataDetail && dataDetail.length > 0 && dataDetail[0].mid_rate) {
        const rate = Number.parseFloat(dataDetail[0].mid_rate);

        // ✅ 2. แก้ตรงนี้: เปลี่ยน todayStr -> targetDateStr
        await ExchangeRate.findOneAndUpdate(
          {
            date: targetDateStr, // บันทึกว่าเป็นเรทของ "วันที่เราต้องการ"
            currency: targetCurrency,
          },
          {
            rate: rate,
            // ✅ 3. แก้ตรงนี้ด้วย: เปลี่ยน todayStr -> targetDateStr
            source:
              checkDate === targetDateStr ? "BOT" : `BOT_Fallback_${checkDate}`,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        console.log(
          `✅ Saved rate ${rate} (from ${checkDate}) as Rate for ${targetDateStr}`,
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
    const { currency, date } = req.query; // currency คือค่าที่พนักงานเลือกจาก Dropdown

    // 1. ดึงสกุลเงินหลักของบริษัทออกมาก่อน (เหมือนตอนทำ Create Purchase)
    const user = await User.findById(req.user.id).select("comp_id").lean();
    const company = await Company.findById(user.comp_id)
      .select("main_currency")
      .lean();
    const mainCurrency = company?.main_currency || "THB";

    let finalRate = 1; // ค่าเริ่มต้น (ถ้าสกุลเงินชนกัน จะได้เรท 1)

    // 2. ตรวจสอบว่าสกุลเงินที่เลือก ตรงกับสกุลเงินบริษัทไหม
    if (currency && currency !== mainCurrency) {
      // ถ้าไม่ตรง ค่อยไปคำนวณ Cross Rate จากแบงก์ชาติ
      const ratePurchaseToTHB = await getCurrentRate(currency, date);
      const rateBaseToTHB = await getCurrentRate(mainCurrency, date);

      finalRate = ratePurchaseToTHB / rateBaseToTHB;
    }

    const fallbackDate = getDateString(0);

    res.json({
      success: true,
      currency: currency,
      base_currency: mainCurrency, // ส่งไปบอกหน้าบ้านด้วยว่าบริษัทใช้เงินอะไรเป็นหลัก
      date: date || fallbackDate,
      rate: finalRate, // 🟢 ส่งเรทที่คำนวณแล้ว (ถ้า USD เจอ USD จะส่ง 1 กลับไป)
    });
  } catch (error) {
    console.error("Get Rate Error:", error);
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
