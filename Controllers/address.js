const Address = require("../models/Address");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

const { USERNAME } = require("../Config/geonames");

const COUNTRY_ID_TH = 1605651;

const fetchChildren = async (geonameId) => {
  try {
    const response = await axios.get(`http://api.geonames.org/childrenJSON`, {
      params: {
        geonameId: geonameId,
        username: process.env.GEONAMES_USERNAME,
        lang: "th",
      },
    });
    if (!response.data.geonames) {
      console.log("❌ API Response Error:", response.data);
    } else {
      console.log(`✅ Found ${response.data.geonames.length} items`);
    }
    return response.data.geonames || [];
  } catch (error) {
    throw new Error(`Fetch Children Failed: ${error.message}`);
  }
};

const findGeonameIdByName = async (name, featureCode) => {
  try {
    const url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(
      name
    )}&country=TH&featureCode=${featureCode}&maxRows=1&username=${USERNAME}`;
    const response = await axios.get(url);
    if (response.data.geonames && response.data.geonames.length > 0) {
      return response.data.geonames[0].geonameId;
    }
    return null;
  } catch (error) {
    console.error(`Error finding ID for ${name}:`, error.message);
    return null;
  }
};

const fetchPostalData = async (districtName, provinceName) => {
  try {
    const response = await axios.get(
      `http://api.geonames.org/postalCodeSearchJSON`,
      {
        params: {
          placename: districtName,
          adminName1: provinceName,
          country: "TH",
          username: process.env.GEONAMES_USERNAME,
          maxRows: 500,
          lang: "th",
        },
      }
    );
    return response.data.postalCodes || [];
  } catch (error) {
    throw new Error(`Fetch Postal Failed: ${error.message}`);
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.getProvinces = async (req, res) => {
  try {
    let provinces = await Address.distinct("province");
    if (provinces.length > 0) {
      provinces.sort((a, b) => a.localeCompare(b, "th"));
      return res.json({ source: "database", data: provinces });
    }

    const apiData = await fetchChildren(COUNTRY_ID_TH);
    provinces = apiData.map((item) => item.name);
    res.json({ source: "api", data: provinces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDistricts = async (req, res) => {
  const { province } = req.query;
  if (!province) return res.status(400).json({ error: "Province is required" });

  try {
    let districts = await Address.distinct("district", { province });
    if (districts.length > 0) {
      districts.sort((a, b) => a.localeCompare(b, "th"));
      return res.json({ source: "database", data: districts });
    }

    const provinceId = await findGeonameIdByName(province, "ADM1");
    if (!provinceId)
      return res.status(404).json({ error: "Province not found in API" });

    const apiData = await fetchChildren(provinceId);
    districts = apiData.map((item) => item.name);
    res.json({ source: "api", data: districts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSubDistricts = async (req, res) => {
  const { province, district } = req.query;
  if (!province || !district)
    return res
      .status(400)
      .json({ error: "Province and District are required" });

  try {
    const dbData = await Address.find({ province, district }).select(
      "sub_district zipcode -_id"
    );
    if (dbData.length > 0) {
      return res.json({ source: "database", data: dbData });
    }

    const districtId = await findGeonameIdByName(district, "ADM2");

    if (!districtId) {
      const fallbackData = await fetchPostalData(district, province);
      if (fallbackData.length === 0)
        return res.json({ source: "api_empty", data: [] });

      const bulkOpsFallback = fallbackData.map((i) => ({
        updateOne: {
          filter: {
            province: province,
            district: district,
            sub_district: i.placeName,
          },
          update: {
            $setOnInsert: {
              country: "Thailand",
              province: province,
              district: district,
              sub_district: i.placeName,
              zipcode: i.postalCode,
            },
          },
          upsert: true,
        },
      }));
      await Address.bulkWrite(bulkOpsFallback);

      return res.json({
        source: "api_fallback",
        data: fallbackData.map((i) => ({
          sub_district: i.placeName,
          zipcode: i.postalCode,
        })),
      });
    }

    const allSubDistricts = await fetchChildren(districtId);
    const postalData = await fetchPostalData(district, province);
    const districtZipcode =
      postalData.length > 0 ? postalData[0].postalCode : "";

    const mergedData = allSubDistricts.map((item) => ({
      placeName: item.name,
      postalCode: districtZipcode,
      adminName1: province,
      adminName2: district,
    }));

    if (mergedData.length === 0)
      return res.json({ source: "api_empty", data: [] });

    const bulkOps = mergedData.map((item) => {
      return {
        updateOne: {
          filter: {
            province: item.adminName1,
            district: item.adminName2,
            sub_district: item.placeName,
          },
          update: {
            $setOnInsert: {
              country: "Thailand",
              province: item.adminName1,
              district: item.adminName2,
              sub_district: item.placeName,
              zipcode: item.postalCode,
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await Address.bulkWrite(bulkOps);
    }

    const resultData = mergedData.map((item) => ({
      sub_district: item.placeName,
      zipcode: item.postalCode,
    }));

    res.json({ source: "api_and_saved", data: resultData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.syncAllAuto = async (req, res) => {
  // 1. Set Timeout to 2 hours
  req.setTimeout(2 * 60 * 60 * 1000);

  // Helper: Retry Function
  const fetchWithRetry = async (fn, retries = 3, delayMs = 2000) => {
    try {
      return await fn();
    } catch (err) {
      if (retries > 0) {
        console.log(
          `      ⚠️ Connection hiccup (${err.message})... Retrying in ${
            delayMs / 1000
          }s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return fetchWithRetry(fn, retries - 1, delayMs * 2);
      }
      throw err;
    }
  };

  try {
    console.log("🚀 Start Auto Syncing (Force Thai Data + Smart Retry)...");

    // Fetch provinces (We get Thai names here because of our helper)
    const allProvinces = await fetchChildren(COUNTRY_ID_TH);
    const totalProvinces = allProvinces.length;

    // Batch size 5 to avoid Geonames limit
    const BATCH_SIZE = 5;

    let currentSkip = 0;
    let totalSaved = 0;
    let processedCount = 0;

    while (currentSkip < totalProvinces) {
      const targetProvinces = allProvinces.slice(
        currentSkip,
        currentSkip + BATCH_SIZE
      );
      console.log(
        `\n📦 Processing Batch: ${currentSkip + 1} to ${
          currentSkip + targetProvinces.length
        }`
      );

      for (const province of targetProvinces) {
        console.log(`   > [${province.name}] Processing...`);

        let districtList = [];
        try {
          // Fetch Districts
          districtList = await fetchWithRetry(() =>
            fetchChildren(province.geonameId)
          );
          // Rest 1s
          await delay(1000);
        } catch (e) {
          console.log(
            `      ❌ Skipping Province ${province.name} (Error Fetching Children)`
          );
          continue;
        }

        for (const district of districtList) {
          try {
            // Fetch Sub-districts/Postal Codes
            const subDistricts = await fetchWithRetry(() =>
              fetchPostalData(district.name, province.name)
            );

            if (subDistricts && subDistricts.length > 0) {
              const bulkOps = subDistricts.map((item) => {
                // 🔥 Logic: Force Thai Language from Parent Loop
                // We ignore item.adminName1 (which might be "Bangkok") and use province.name ("กรุงเทพ") instead
                const finalProvince = province.name;
                const finalDistrict = district.name;
                const finalSubDistrict = item.placeName;

                return {
                  updateOne: {
                    filter: {
                      province: finalProvince,
                      district: finalDistrict,
                      sub_district: finalSubDistrict,
                      zipcode: item.postalCode,
                    },
                    update: {
                      $set: {
                        country: "ไทย", // Keep data in Thai
                        province: finalProvince,
                        district: finalDistrict,
                        sub_district: finalSubDistrict,
                        zipcode: item.postalCode,
                      },
                    },
                    upsert: true,
                  },
                };
              });

              await Address.bulkWrite(bulkOps);
              totalSaved += subDistricts.length;
            }
          } catch (err) {
            console.log(
              `      ❌ Error District ${district.name}: ${err.message}`
            );
          }

          // Safe Mode Delay (2s)
          await delay(2000);
        }
        processedCount++;
      }

      console.log(`✅ Batch finished. Resting 5s...`);
      await delay(5000);
      currentSkip += BATCH_SIZE;
    }

    console.log("\n🎉 All Sync Complete! Data is saved in Thai.");
    res.json({
      success: true,
      message: "Sync Completed (Thai Data / English Logs)",
      stats: {
        total_provinces_processed: processedCount,
        total_records_saved: totalSaved,
      },
    });
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
};

exports.importStaticData = async (req, res) => {
  try {
    const provincesData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/provinces.json"), "utf-8")
    );
    const districtsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data/districts.json"), "utf-8")
    );
    const subDistrictsData = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../data/subdistricts.json"),
        "utf-8"
      )
    );

    const provinceMap = {};
    provincesData.forEach((p) => {
      provinceMap[String(p.PROV_KEY)] = p.PROV_NAME;
    });

    const districtMap = {};
    districtsData.forEach((d) => {
      districtMap[String(d.DSTRCT_KEY)] = {
        name_th: d.DSTRCT_NAME,
        province_id: String(d.DSTRCT_PROV),
      };
    });

    const bulkOps = [];

    subDistrictsData.forEach((sub) => {
      const distId = String(sub.SBDSTRIC_DSTRIC);
      const district = districtMap[distId];

      if (!district) return;

      const provinceName = provinceMap[district.province_id];
      const districtName = district.name_th;

      const subDistrictName = sub.SBDSTRIC_NAME;
      const zipCode = sub.SBDSTRIC_ZIPCODE ? String(sub.SBDSTRIC_ZIPCODE) : "";

      if (provinceName && districtName && subDistrictName && zipCode) {
        bulkOps.push({
          updateOne: {
            filter: {
              province: provinceName,
              district: districtName,
              sub_district: subDistrictName,
              zipcode: zipCode,
            },
            update: {
              $set: {
                country: "ไทย",
                province: provinceName,
                district: districtName,
                sub_district: subDistrictName,
                zipcode: zipCode,
              },
            },
            upsert: true,
          },
        });
      }
    });

    if (bulkOps.length > 0) {
      console.log(`Found ${bulkOps.length} records. Saving to Database...`);
      await Address.bulkWrite(bulkOps);
      console.log("Import Successful!");

      res.json({
        success: true,
        message: "Import Thai Data Successful",
        total_records: bulkOps.length,
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: "No matched data found." });
    }
  } catch (err) {
    console.error("Import Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Import failed", error: err.message });
  }
};
