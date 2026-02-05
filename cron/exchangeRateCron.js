const cron = require("node-cron");
const { getCurrentRate } = require("../Controllers/exchangeRate");

const targetCurrencies = ["USD"];

const startExchangeRateJob = () => {
  cron.schedule(
    "0 20 * * *",
    async () => {
      console.log("[Cron Job] Starting daily exchange rate update...");

      for (const currency of targetCurrencies) {
        try {
          const rate = await getCurrentRate(currency);
          console.log(`[Cron Job] Updated ${currency}: ${rate}`);
        } catch (error) {
          console.error(
            `[Cron Job] Failed to update ${currency}:`,
            error.message,
          );
        }
      }

      console.log("[Cron Job] Finished.");
    },
    {
      timezone: "Asia/Bangkok",
    },
  );
};

module.exports = startExchangeRateJob;
