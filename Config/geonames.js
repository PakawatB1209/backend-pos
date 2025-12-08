require("dotenv").config();

const BASE_URL = "http://api.geonames.org";
module.exports = {
  USERNAME: process.env.GEONAMES_USERNAME || "demo",

  API: {
    POSTAL: `${BASE_URL}/postalCodeSearchJSON`,
    COUNTRY: `${BASE_URL}/countryInfoJSON`,
    SEARCH: `${BASE_URL}/searchJSON`,
    CHILDREN: `${BASE_URL}/childrenJSON`,
    HIERARCHY: `${BASE_URL}/hierarchyJSON`,
  },
};
