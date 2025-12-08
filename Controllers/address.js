const Address = require("../models/Address");
const axios = require("axios");

const { USERNAME } = require("../Config/geonames");

const COUNTRY_ID_TH = 1605651;

const fetchChildren = async (geonameId) => {
  try {
    const url = `http://api.geonames.org/childrenJSON?geonameId=${geonameId}&username=${USERNAME}`;
    const response = await axios.get(url);
    return response.data.geonames || [];
  } catch (error) {
    console.error("Error fetching children:", error.message);
    return [];
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
    const url = `http://api.geonames.org/postalCodeSearchJSON?placename=${encodeURIComponent(
      districtName
    )}&country=TH&username=${USERNAME}`;
    const response = await axios.get(url);
    const rawData = response.data.postalCodes || [];

    return rawData.filter((item) => item.adminName1 === provinceName);
  } catch (error) {
    console.error("Error fetching postal data:", error.message);
    return [];
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

exports.syncDataTest = async (req, res) => {
  req.setTimeout(300000);

  try {
    console.log(" Start Syncing (Smart Mode - Test 5 Provinces)...");

    const allProvinces = await fetchChildren(COUNTRY_ID_TH);
    const targetProvinces = allProvinces.slice(0, 5);

    console.log(
      `Will process: ${targetProvinces.map((p) => p.name).join(", ")}`
    );

    let totalSaved = 0;
    let totalSkipped = 0;

    for (const province of targetProvinces) {
      console.log(`\n Province: ${province.name}`);

      const districtList = await fetchChildren(province.geonameId);

      for (const district of districtList) {
        const exists = await Address.findOne({
          province: province.name,
          district: district.name,
        });

        if (exists) {
          console.log(`[SKIP] ${district.name} (Already exists)`);
          totalSkipped++;
          continue;
        }

        console.log(`[FETCH] Downloading data for ${district.name}...`);
        const subDistricts = await fetchPostalData(
          district.name,
          province.name
        );

        if (subDistricts.length > 0) {
          const bulkOps = subDistricts.map((item) => {
            const fixedDistrict = item.adminName2 || district.name;

            return {
              updateOne: {
                filter: {
                  province: item.adminName1,
                  district: fixedDistrict,
                  sub_district: item.placeName,
                  zipcode: item.postalCode,
                },
                update: {
                  $set: {
                    country: "Thailand",
                    province: item.adminName1,
                    district: fixedDistrict,
                    sub_district: item.placeName,
                    zipcode: item.postalCode,
                  },
                },
                upsert: true,
              },
            };
          });

          await Address.bulkWrite(bulkOps);
          totalSaved += subDistricts.length;

          await delay(200);
        }
      }
    }

    console.log("\n Sync Complete!");
    res.json({
      message: "Provinces Successfully",
      stats: {
        saved_records: totalSaved,
        skipped_districts: totalSkipped,
        provinces_synced: targetProvinces.map((p) => p.name),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
};
