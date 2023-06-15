const log = new (require('../logs/Logger'))({});
const axios = require('axios');
const States = require('../../routes/api/states');
const StatesDB = require('../../models/States');
const WebsitesNew = require('../../models/WebsitesNew');
const envVars = require('../../envVars/index');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const langdetect = require('langdetect');
const pa11y = require('pa11y');
const natural = require('natural');
const request = require('request');






class Conductor {
  constructor() { }

  /**
Asynchronously gets website data for the specified website using axios.
* @param {string} website - The URL of the website to get data for.
* @returns {Promise} A promise that resolves to the website data if successful, or null if not.
The GetWebsiteData function is an asynchronous method that uses axios to fetch website data for a given website URL. It takes in a single parameter website, which is the URL of the website to get data for.
This function is useful for retrieving website data in a Node.js application, and can be used in conjunction with other functions to build a comprehensive website analysis tool.
*/
  async GetWebsiteData(website) {
    log.info(`Getting website data for ${website}`);
    const response = await axios
      .get(website, { timeout: 5000 })
      .catch((err) => {
        return null;
      });

    if (response?.data) {
      log.success(`End getting website data for ${website}`, 'cyan');
      return response.data;
    } else {
      return null;
    }
  }

  

  /**
Asynchronously retrieves all cities within a given distance of a reference city.
* @param {Object} options - An object containing options for the function.
* @param {number} options.distanceInMiles - The maximum distance (in miles) from the reference city.
* @param {Object} options.thisCity - The reference city object containing latitude and longitude properties.
* @returns {Promise} A promise that resolves to an array of cities that fall within the specified distance from the reference city.

The function calculates the distance between the reference city and each city in the allCities array using the CalculateDistance function. It then filters the allCities array to only include cities that are within the specified distance from the reference city.
This function is useful for finding all cities within a given distance of a reference city in a Node.js application, and can be used in conjunction with other functions to build location-based services.
*/
  async GetAllCitiesWithinDistance({ distanceInMiles, thisCity }) {
    try {
      const referenceCity = {
        lat: parseFloat(thisCity.latitude),
        lng: parseFloat(thisCity.longitude),
      };
      const maxDistance = distanceInMiles;

      const dbQuery = {
        'cities': {
          $elemMatch: {
            'longitudeNum': {
              $gte: referenceCity.lng - maxDistance / (111.32 * Math.cos(referenceCity.lat * (Math.PI / 180))),
              $lte: referenceCity.lng + maxDistance / (111.32 * Math.cos(referenceCity.lat * (Math.PI / 180)))
            },
            'latitudeNum': {
              $gte: referenceCity.lat - (maxDistance / 111.32),
              $lte: referenceCity.lat + (maxDistance / 111.32)
            }
          }
        }
      };

      let allStates = await StatesDB.find(dbQuery);
      let allCities = allStates.reduce(
        (acc, state) => [...acc, ...state.cities.map((city) => city)],
        []
      );

      const filteredCities = allCities.filter(
        (city) =>
          this.CalculateDistance(
            referenceCity.lat,
            referenceCity.lng,
            parseFloat(city.latitude),
            parseFloat(city.longitude)
          ) <= maxDistance
      );
      return filteredCities;

    } catch (err) {
      console.log(err);
    }
  }

  /**
Calculates the distance between two sets of latitude and longitude coordinates using the haversine formula.
* @param {number} lat1 - The latitude of the first coordinate.
* @param {number} lon1 - The longitude of the first coordinate.
* @param {number} lat2 - The latitude of the second coordinate.
* @param {number} lon2 - The longitude of the second coordinate.

The function calculates the distance between two points on a sphere (the Earth) using the haversine formula, which takes into account the curvature of the Earth's surface. It uses the radius of the Earth in miles and the coordinates of the two points to calculate the distance between them.
*/
  CalculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // radius of Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }

  /**
Asynchronously retrieves information for a US state by name from a database.
* @param {Object} options - An object containing options for the function.
* @param {string} options.stateName - The name of the US state to retrieve information for.
* @returns {Promise} A promise that resolves to an object containing information for the specified state.
The GetStateInfo function is an asynchronous method that retrieves information for a US state by name from a database. It takes in a single object parameter options, which contains one property: stateName (the name of the US state to retrieve information for).
*/
  async GetStateInfo({ stateName }) {
    const [state] = States.filter(
      ({ name }) => name.toLowerCase() === stateName.toLowerCase()
    );
    const stateCode = state.state_code;
    const stateInfo = await StatesDB.find({ name: stateCode });
    return stateInfo[0];
  }

  /**
Asynchronously retrieves information for a city in a US state from a database.
* @param {Object} options - An object containing options for the function.
* @param {string} options.stateName - The name of the US state the city is in.
* @param {string} options.cityName - The name of the city to retrieve information for.
* @returns {Promise} A promise that resolves to an object containing information for the specified city.

The GetCityInfo function is an asynchronous method that retrieves information for a city in a US state from a database. It takes in an object parameter options, which contains two properties: stateName (the name of the US state the city is in) and cityName (the name of the city to retrieve information for).

The function returns a promise that resolves to an object containing information for the specified city.
*/
  async GetCityInfo({ stateName, cityName }) {
    const stateInfo = await this.GetStateInfo({ stateName });
    const city =
      stateInfo.cities.filter(
        (city) => city.name.toLowerCase() === cityName.toLowerCase()
      )[0] || null;
    return city;
  }

  /**
   * Trims a URL down to its root domain by removing any trailing strings past the domain name, such as the top-level domain (e.g., .com, .net, etc.) and any subdomains.
   *
   * This function takes a single string parameter `url` representing the URL to be trimmed. It uses regular expressions to test for the presence of common top-level domains in the input URL, and returns a new string that represents the root domain.
   *
   * If the input URL does not contain a recognized top-level domain, this function returns `null`.
   *
   * @param {string} url - The URL to be trimmed.
   * @returns {string|null} The trimmed URL or null if the input URL cannot be trimmed.
   */
  TrimUrl({ url }) {
    if (new RegExp('.com').test(url)) {
      let breakdown = url.split('.com');
      return `${breakdown[0]}.com`;
    } else if (new RegExp('.net').test(url)) {
      let breakdown = url.split('.net');
      return `${breakdown[0]}.net`;
    } else if (new RegExp('.org').test(url)) {
      let breakdown = url.split('.org');
      return `${breakdown[0]}.org`;
    } else if (new RegExp('.edu').test(url)) {
      let breakdown = url.split('.edu');
      return `${breakdown[0]}.edu`;
    } else {
      return null;
    }
  }

  /**
   * Checks if a given website is associated with a specific city ID.
   *
   * This function takes two parameters: `cityID`, which is the ID of the city to search, and `url`, which is the URL to be checked. It queries the `WebsitesNew` collection in the database to find any records that match the input URL, and then filters these records by comparing the `siteName` property (the trimmed URL) and the `city_id` property to the input parameters. If any matches are found, this function returns `true`. Otherwise, it returns `false`.
   *
   * @param {string} cityID - The ID of the city to search.
   * @param {string} url - The URL to be checked.
   * @returns {boolean} `true` if the website is associated with the given city ID, `false` otherwise.
   */
  async CheckIfWebsiteInCity({ cityID, url }) {
    const results = await WebsitesNew.find({ siteName: url });
    const thisWebsite = results.filter(
      (r) =>
        r.siteName.toLowerCase() === url.toLowerCase() && r.city_id === cityID
    );
    return thisWebsite.length > 0;
  }

  /**
   * Checks if the content of a given website is in English.
   *
   * This function takes two parameters: `data` and `url`. If `data` is provided, it uses the langdetect package to detect the language of the input text and returns `true` if the detected language is English, and `false` otherwise. If `data` is not provided, it calls the `GetWebsiteData` method with the input URL to retrieve the website content, then uses langdetect to check the language as before. If the input parameters are not valid, an error is thrown.
   *
   * @param {string} data - The text content to be checked. Optional if `url` is provided.
   * @param {string} url - The URL to retrieve the content for. Optional if `data` is provided.
   * @returns {boolean} `true` if the content is in English, `false` otherwise.
   * @throws {Error} If neither `data` nor `url` is provided.
   */
  async CheckLanguageIsEnglish({ data, url }) {
    if (!data && !url) {
      throw new Error('CheckLanguageIsEnglish: data or url is required');
    }
    if (!data) {
      data = await this.GetWebsiteData(url);
    }
    const language = langdetect.detect(data);
    if (language === 'en') {
      log.info('The content on the website is in English.');
      return true;
    } else {
      log.info(`The content on the website is in ${language}.`);
      return false;
    }
  }

  /**
   * Checks if a given website should be blacklisted based on a list of words stored in `envVars.sitesToFilter`.
   *
   * This function takes two parameters: `url`, which is the URL to be checked, and `siteName`, which is the site name to be checked. It uses the `sitesToFilter` environment variable, which contains an array of words that are used to filter out blacklisted websites. If `url` or `siteName` contain any of the words in this array (case-insensitive), this function returns `true`, indicating that the website should be blacklisted. Otherwise, it returns `false`.
   *
   * @param {string} url - The URL to be checked.
   * @param {string} siteName - The site name to be checked.
   * @returns {boolean} `true` if the website should be blacklisted, `false` otherwise.
   */
  CheckIfSiteBlacklisted({ url, siteName }) {

    if (
      envVars.sitesToFilter.some(
        (word) =>
          new RegExp(word, 'i').test(url) ||
          new RegExp(word, 'i').test(siteName)
      )
    ) {
      log.info(`filtered out from envVars sitesToFilter: ${url || siteName}`);
      return true;
    }
    return false;
  }

  /**
   * Extracts the domain from a given URL.
   *
   * This function takes one parameter: `url`, which is the URL to extract the domain from. It first checks if the URL includes `www.` and, if it does, it returns the substring of the URL that follows it. Otherwise, it splits the URL using `//` as a delimiter and returns the second element of the resulting array. In either case, the returned value is the domain of the input URL.
   *
   * @param {string} url - The URL to extract the domain from.
   * @returns {string} The domain of the input URL.
   */
  GetDomainFromUrl({ url }) {
    if (!url) {
      return
    }
    try {
      if (url.includes('www.')) {
        return url.split('www.')[1];
      } else {
        return url.split('//')[1];
      }
    } catch (err) {
      console.log(err)
    }
  }

  /**
   * Retrieves a list of websites from Google using the SerpApi service.
   *
   * This function takes one parameter: `query`, which is the search query to be used when requesting websites from Google. It sends a request to the SerpApi service to search Google for websites related to the input query. If the request is successful, the function returns a list of websites. If the request fails, an error is logged and `null` is returned.
   *
   * @param {string} query - The search query to use when requesting websites from Google.
   * @returns {Array} An array of websites, or `null` if the request fails.
   */
  async GetWebsitesFromGoogle({ query }) {
    try {
      var options = {
        method: 'GET',
        url: envVars.api.baseUrl,
        params: { query, limit: '1000', related_keywords: 'true' },
        headers: {
          'X-RapidAPI-Key': envVars.api.codes.apiVersion2Code1,
          'X-RapidAPI-Host': envVars.api.hostUrl,
        },
      };
      let websites = await axios.request(options).then(function (response) {
        return response.data;
      });
      return websites;
    } catch (err) {
      log.warn('err in GetWebsitesFromGoogle');
      console.log(err);
    }
  }


  /**
   * Checks if a given website should be considered unwanted based on a list of blacklisted sites stored in `blackListedDB` and a list of words stored in `envVars.sitesToFilter`.
   *
   * This function takes two parameters: `siteName`, which is the name of the site to be checked, and `blackListedDB`, which is an array of objects representing blacklisted sites. It iterates over each object in `blackListedDB` and checks if `siteName` matches the `name` property of that object (case-sensitive). If it does, this function returns `true`, indicating that the site should be considered unwanted. If no matches are found in `blackListedDB`, the function checks if `siteName` contains any of the words in `sitesToFilter` (case-insensitive), which are used to filter out unwanted sites. If any matches are found, the function returns `true`. Otherwise, it returns `false`.
   *
   * @param {string} siteName - The name of the site to be checked.
   * @param {Array} blackListedDB - An array of objects representing blacklisted sites.
   * @returns {boolean} `true` if the site should be considered unwanted, `false` otherwise.
   */
  CheckUnwantedSite({ siteName, blackListedDB }) {
    for (let site of blackListedDB) {
      if (new RegExp(site.name).test(siteName)) {
        return true;
      } else if (
        envVars.sitesToFilter.some((word) =>
          new RegExp(word.toLowerCase(), 'i').test(siteName)
        )
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * This method performs a comprehensive research on a given website using the HTML data provided, and updates the corresponding WebsiteObject with the results. It takes an options object with the following properties:
   *
   * @param {Object} options - The options object.
   * @param {String} options.data - The HTML data of the website.
   * @param {WebsiteObject} options.websiteObject - The WebsiteObject instance corresponding to the website to research.
   * @param {Boolean} [options.save=true] - Whether to save the website object to the database.
   * @param {Boolean} [options.quickUpdate=false] - Whether to perform a quick update (without running some of the checks that take longer).
   *
   * @returns {Promise<void>} - A Promise that resolves when the website object is updated (and saved to the database, if `save` is `true`).
   *
   * The method then performs a number of checks on the website, including checking for various analytics tools and content management systems, auditing the website's SEO, accessibility, and contact information, and checking for mobile friendliness and responsiveness. The results of these checks are then stored in the WebsiteObject instance, and the instance is saved to the database (if save is true).
   */
  async research({ data, websiteObject, save = true, quickUpdate = false, checkRelevance = true, justRelevanceCheck = false }) {
    // removed from sample
  }


  /**
   * Determines if a website is relevant to a given keyword.
   * @param {string} keyword - The keyword to check relevance for.
   * @param {string} data - The HTML content of the website.
   * @returns {boolean} - Indicates whether the website is relevant to the keyword.
   */
  IsSiteRelevantToKeyword({ keyword, data }) {
    try {
      // Load HTML content into Cheerio for parsing
      const $ = cheerio.load(data);

      // Get the website's title and meta description
      const title = $('title').text().toLowerCase();
      // Get all text content from the site
      const siteContent = $('body, script, img').map((i, element) => {
        if ($(element).is('img')) {
          // Include the alt attribute of img tags in the site content
          return $(element).attr('alt') || '';
        } else if ($(element).is('script')) {
          // Include the text content of script tags in the site content
          return $(element).text() || '';
        } else {
          // Include all other text content in the site content
          return $(element).text() || '';
        }
      }).get().join(' ').toLowerCase();

     
      // Check if the keyword appears in the site content, title, or meta description
      let isRelevant = siteContent.includes(keyword.toLowerCase()) ||
        title.includes(keyword.toLowerCase());
      // Check all metadata fields for the keyword
      $('meta').each((i, element) => {
        const content = $(element).attr('content');

     
        if (content && content.toLowerCase().includes(keyword.toLowerCase())) {
          isRelevant = true;
        }
      });
      return isRelevant;
    } catch (error) {
      console.error(error);
      return false;
    }
  }



 // rewrite this better

/**
 * Checks for the presence of analytic tools in a website.
 * @param {string} url - The URL of the website.
 * @param {object} soup - The parsed HTML content of the website.
 * @returns {Array} - An array of names of the detected analytic tools.
 */
  async CheckForAnalyticTools(url, soup) {
    const scripts = soup.findAll('script');
    const results = [];

    try {
      envVars.analyticsTools.forEach((tool) => {
        scripts.forEach((script) => {
          if (script.attrs.src && script.attrs.src.includes(tool.pattern)) {
            results.push(tool.name);
          }
          if (script.text && script.text.includes(tool.pattern)) {
            results.push(tool.name);
          }
        });
      });
      return Array.from(new Set(results));
    } catch (err) {
      console.warn('err in CheckForAnalyticTools')
      return '';
    }
  }


  /**
   * Determine the content management system (CMS) used by a website by searching for specific signatures in its HTML data.
   *
   * @param {Object} options - The options object.
   * @param {String[]} [options.cmsSignatures=envVars.cmsSignatures] - The array of CMS signatures to search for.
   * @param {String} options.data - The HTML data of the website to search for CMS signatures.
   *
   * @returns {String} - The name of the CMS used by the website (if found), or an empty string if no matching CMS signature is found.
   */
  DetermineCMS({ cmsSignatures = envVars.cmsSignatures, data }) {
    let thisCMS = '';
    if (!data || !typeof data === 'string') {
      return thisCMS;
    }
    for (let cms in cmsSignatures) {
      try {
        if (
          data.includes(cmsSignatures[cms][0]) ||
          data.includes(cmsSignatures[cms][1])
        ) {
          thisCMS = cms;
          log.info(`${thisCMS} is used on this website`);
          return thisCMS;
        }
      } catch (err) {
        console.log('err in DetermineCMS')
      }
    }
    return thisCMS;
  }

  /**
   * Determines the front-end framework used to build the website by searching for specific signatures in the HTML data.
   *
   * @param {String} data - The HTML data of the website.
   *
   * @returns {String} - The name of the framework used, or an empty string if the framework could not be determined.
   */
  DetermineFramework({ data }) {
    let thisFramework = '';
    if (!data) {
      return thisFramework;
    }
    try {
      for (const framework of envVars.frameworkSignatures) {
        for (const signature of framework.signatures) {
          if (data.includes(signature)) {
            thisFramework = framework.name;
            log.info(`${thisFramework} is used`);
            return thisFramework;
          }
        }
      }
    } catch (err) {
      log.error(`Error in DetermineFramework`);
      console.error(err);
      return thisFramework;
    }
  }

  /**
   * Given a parsed HTML soup, returns the total number of pages as per the count of all links in the soup that
   * correspond to a page link, like pagination links or load-more links.
   *
   * @param {Object} options - The options object.
   * @param {Object} options.soup - The parsed HTML data object.
   *
   * @returns {Promise<number>} - A Promise that resolves with the total number of pages on the website, based on the links found in the soup.
   */
  async GetPageCount({ soup }) {
    try {
      const allLinks = [
        ...soup.findAll('a'),
        ...soup.findAll('a', { text: /next/i }),
        ...soup.findAll('a', { text: /prev/i }),
        ...soup.findAll('a', { href: /page\d+/ }),
        ...soup.findAll('a', { text: /load more/i }),
        ...soup.findAll('div', { class: 'infinite-scroll' }),
        ...soup.findAll('div', { class: 'search-results' }),
        ...soup.findAll('ul', { class: 'sitemap' }),
      ];
      log.info(`Page count is ${allLinks.length}`);
      return allLinks.length;
    } catch (error) {
      console.warn('err in GetPageCount')
      log.error(error);
      return null;
    }
  }




  // rewrite this better

/**
 * Checks the mobile friendliness of a website.
 * @param {string} url - The URL of the website.
 * @returns {boolean} - Indicates whether the website is mobile-friendly.
 */
  async CheckMobileFriendlinessOnly(url) {
    let browser;
    try {
      if (envVars.build === 'DEV') {
        browser = await puppeteer.launch({ args: [`--user-data-dir=${process.env.TMPDIR}`], });

      } else {
        browser = await puppeteer.launch({ args: ['--no-sandbox'] });

      }

      const page = await browser.newPage();
      await page.setViewport({ width: 375, height: 667, isMobile: true });
      await page.goto(url, { waitUntil: 'networkidle2' });

      const { hasViewportMeta, isResponsive, usesMediaQueries, isLegible, isProperlySized, isUnzoomed } = await page.evaluate(() => {
        const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');

        const viewportWidth = window.innerWidth;
        const documentWidth = document.documentElement.getBoundingClientRect().width;
        const isResponsive = Math.abs(viewportWidth - documentWidth) <= 20;

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(style => style.innerHTML);
        const usesMediaQueries = styles.some(style => style.includes('@media'));

        const isLegible = [...document.querySelectorAll('body *')].every(el => {
          const style = getComputedStyle(el);
          return parseInt(style.fontSize, 10) >= 12;
        });

        const tapTargetSize = [...document.querySelectorAll('a, button, input, select, textarea')].every(el => {
          const { width, height } = el.getBoundingClientRect();
          return width >= 40 && height >= 40;
        });

        const contentZoom = document.documentElement.style.zoom === '';

        return { hasViewportMeta, isResponsive, usesMediaQueries, isLegible, isProperlySized: tapTargetSize, isUnzoomed: contentZoom };
      });

      await browser.close();

      const isMobileFriendly = isResponsive || usesMediaQueries;
      return isMobileFriendly;
    } catch (error) {
      console.error(`Error checking Mobile Friendliness for ${url}: ${error.message}`);

      if (browser) {
        console.warn('Closing puppeteer browser');
        try {
          await browser.close();
        } catch (err) {
          console.warn('Error in closing puppeteer browser in CheckMobileFriendliness');
        }
      }
      return false;
    }
  }



  /**
   * Check for contact information on a website and update the corresponding WebsiteObject with the results.
   *
   * @param {Object} options - The options object.
   * @param {String} options.data - The HTML data of the website.
   * @param {WebsiteObject} options.websiteObject - The WebsiteObject instance corresponding to the website to check.
   *
   * @returns {Object} - An object containing the phone number, domain email address, and physical address (if available) for the website.
   */
  async CheckContactInfo({ data, websiteObject }) {

    if (!data || !websiteObject.domain) {
      return { domainEmailAddress, phoneNumber, address };
    }
    try {

      let domainEmailAddress, phoneNumber, address;
      const $ = cheerio.load(data);
      if (!$) {
        return { domainEmailAddress, phoneNumber, address };
      }

      const contactInfoRegex =
        /(\b[A-Za-z0-9._%+-]+@(?!.*\.\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b)|(\b(?:(?:\+\d{1,2}\s)?(?:\d{3}|\(\d{3}\))[-.\s]?)?\d{3}[-.\s]?\d{4}\b)|(\b\d{1,5}\s+[A-Za-z0-9'#.,]+\s+(?:(?:Ave|St|Rd|Blvd|Dr)\b|[A-Za-z]+\s*,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?)\b)/g;

      const endpoints = [
        '/contact',
        '/about',
        '/about-us',
        '/aboutus',
        '/contact-us',
        '/contactus',
      ];

      const promises = endpoints.map((endpoint) =>
        this.GetWebsiteData(`${websiteObject.siteName}${endpoint}`)
      );

      const pagesData = await Promise.allSettled(promises).then((results) =>
        results
          .filter((result) => result.status === 'fulfilled' && result.value)
          .map((result) => cheerio.load(result.value))
      );

      pagesData.push($);

      pagesData.forEach(($) => {
        const match = $('body').text().match(contactInfoRegex);
        if (match) {
          match.forEach((m) => {
            if (m.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/)) {
              const domain = m.split('@')[1].toLowerCase();
              if (domain === websiteObject.domain.toLowerCase()) {
                domainEmailAddress = m;
              }
            } else if (
              m.match(
                /\b(?:(?:\+\d{1,2}\s)?(?:\d{3}|\(\d{3}\))[-.\s]?)?\d{3}[-.\s]?\d{4}\b/
              )
            ) {
              if (m.length >= 10) {
                phoneNumber = m;
              }
            } else {
              address = m.replace(/[\n\r]/g, ' ').replace(/\s{2,}/g, ' ');
            }
          });
        }
      });
      const results = {
        domainEmailAddress: domainEmailAddress || null,
        phoneNumber: phoneNumber || null,
        address: address || null,
      };
      return results;
    } catch (err) {
      console.warn('err in CheckContactInfo')
      console.log(err);
    }
  }


  /**
   * Check if a website is insecure (i.e., if it does not support HTTPS).
   *
   * @param {WebsiteObject} websiteObject - The WebsiteObject instance corresponding to the website to check.
   *
   * @returns {Boolean} - Whether the website is insecure.
   */
  async checkInsecure(websiteObject) {
  
    const websiteDomain = websiteObject.domain;
    let secureSite = null;

    try {
      const httpsResponse = await axios.get(`https://${websiteDomain}`, { timeout: 5000 });
      if (httpsResponse.status >= 200 && httpsResponse.status < 300) {
        secureSite = true;
      }
    } catch (err) {
    }
    try {
      const httpsResponse = await axios.get(`https://www.${websiteDomain}`, { timeout: 5000 });
      if (httpsResponse.status >= 200 && httpsResponse.status < 300) {
        secureSite = true;
      }
    } catch (err) {
      log.error(`Error getting data for ${websiteDomain} in checkInsecure (HTTPS):`, err);

    }

    if (secureSite) {
      this.ScoreHandler(0, websiteObject);
      return false;
    } else {
      this.ScoreHandler(10, websiteObject);
      return true;
    }
  }


/**
 * Checks if the given data contains the Facebook pixel.
 * Updates the websiteObject with the corresponding information.
 * @param {string} data - The data to be checked.
 * @param {object} websiteObject - The object representing the website.
 * @returns {boolean} - Indicates whether the data contains the Facebook pixel.
 */
  checkFacebookPixel(data, websiteObject) {
    if (new RegExp('connect.facebook.net').test(data)) {
      websiteObject.facebookPixel = 'Has facebook pixel';
      return true;
    } else {
      websiteObject.facebookPixel = 'Does not have facebook pixel';
      this.ScoreHandler(0, websiteObject);
      return false;
    }
  }


/**
 * Checks if the provided data contains a title element.
 * Updates the websiteObject with the corresponding title information.
 *
 * @param {string} data - The data to be checked.
 * @param {object} websiteObject - The object representing the website.
 * @param {object} soup - The parsed HTML content.
 * @returns {boolean} A boolean indicating whether the data contains a title element.
 */
  checkTitle(data, websiteObject, soup) {
    if (soup.find('title')) {
      try {
        if (soup.find('title').text.length > 0) {
          websiteObject.title = `${soup.find('title').text}`;
          this.ScoreHandler(0, websiteObject);
          return true;
        } else {
          websiteObject.title = `Has title but appears empty, it is: ${soup.find('title').text
            }`;
          this.ScoreHandler(1, websiteObject);
          return false;
        }
      } catch (err) {
        log.error('error in checkTitle');
        log.error(err);
      }
    } else {
      this.ScoreHandler(5, websiteObject);
      return false;
    }
  }


  /**
 * Checks if the provided data contains alt tags for images.
 * Updates the websiteObject with the corresponding image alt information.
 *
 * @param {string} data - The data to be checked.
 * @param {object} websiteObject - The object representing the website.
 * @param {object} soup - The parsed HTML content.
 * @returns {boolean} A boolean indicating whether the data contains alt tags for images.
 */
  checkImgAlt(data, websiteObject, soup) {
    let imgs = soup.findAll('img');
    if (!imgs.length) return;

    let hasAlt = imgs.some((img) => img.attrs.alt && img.attrs.alt.length > 0);
    let hasNoAlt = imgs.some(
      (img) => !img.attrs.alt || img.attrs.alt.length < 1
    );

    if (hasNoAlt && hasAlt) {
      websiteObject.imgAlt = 'Some of the images do not have alt tags.';
      this.ScoreHandler(3, websiteObject);
      return false;
    } else if (!hasAlt) {
      websiteObject.imgAlt = 'No images have any alt tags attributed to them.';
      this.ScoreHandler(5, websiteObject);
      return false;
    } else if (hasAlt && !hasNoAlt) {
      websiteObject.imgAlt = 'All imgs have alt tags attributed to them.';
      this.ScoreHandler(-3, websiteObject);
      return true;
    }
  }


  /**
 * Checks if the provided data contains meta tags for description and keywords.
 * Updates the websiteObject with the corresponding meta information.
 *
 * @param {string} data - The data to be checked.
 * @param {object} websiteObject - The object representing the website.
 * @param {object} soup - The parsed HTML content.
 * @returns {void}
 */
  checkMeta(data, websiteObject, soup) {
    let metas = soup.findAll('meta');
    if (!metas.length) return;

    let hasDescription = false;
    let hasKeywords = false;

    metas.forEach((meta) => {
      if (meta.attrs.name === 'description') {
        websiteObject.metaDescriptionCheck = !!meta.attrs.content;
        hasDescription = true;
        if (meta.attrs.content) {
          websiteObject.metaDescription = meta.attrs.content;

        } else {
          websiteObject.metaDescription = 'Does not have meta description';
        }
      } else if (meta.attrs.name === 'keywords') {
        websiteObject.metaKeywordsCheck = !!meta.attrs.content;
        hasKeywords = true;
        if (meta.attrs.content) {
          websiteObject.metaKeywords = meta.attrs.content;
        } else {
          websiteObject.metaKeywords = 'Does not have meta keywords';
        }
      }
    });

    if (!hasDescription) {
      websiteObject.metaDescription = 'Does not have meta description';
      websiteObject.metaDescriptionCheck = false;
      this.ScoreHandler(5, websiteObject);
    } else {
    }
    if (!hasKeywords) {
      websiteObject.metaKeywords = 'Does not have meta keywords';
      websiteObject.metaKeywordsCheck = false;
      this.ScoreHandler(5, websiteObject);
    } else {
    }
  }


/**
 * Checks if the provided data contains a footer element.
 * Updates the websiteObject with the corresponding footer information.
 *
 * @param {string} data - The data to be checked.
 * @param {object} websiteObject - The object representing the website.
 * @param {object} soup - The parsed HTML content.
 * @returns {boolean} A boolean indicating whether the data contains a footer element.
 */
  checkFooter(data, websiteObject, soup) {
    const currentYear = new Date().getFullYear();
    const pastFiveYears = Array.from({ length: 5 }, (_, i) =>
      (currentYear - i).toString()
    );

    if (!soup.find('footer')) {
      websiteObject.hasFooter = 'Does not have a footer.';
      this.ScoreHandler(5, websiteObject);
      return false;
    }

    try {
      websiteObject.hasFooter = 'Has a footer.';
      let tag = soup.find('footer').prettify();

      if (pastFiveYears.some((d) => tag.includes(d))) {
        websiteObject.hasFooter = `Has a footer with a date in the past five years.`;
      }

      if (tag.includes(currentYear.toString())) {
        websiteObject.hasFooter = 'Has a footer with the current year.';
      }

      return true;
    } catch (err) {
      log.error('error in metacheck');
      log.error(err);
    }
  }


  // refactor this - break-out into multiple single purpose methods

/**
 * Performs an SEO audit on the provided URL data.
 * Calculates a score based on various SEO factors.
 *
 * @param {string} url - The URL of the website to be audited.
 * @param {string} data - The data to be audited.
 * @param {boolean} simplyScore - Flag indicating whether to return only the score.
 * @param {string} domain - The domain of the website.
 * @returns {number|object} The audit score or the detailed audit results.
 */
  async AuditSEO({ url, data, simplyScore = false, domain }) {
    if (!data) {
      return;
    }
    try {
      const $ = cheerio.load(data);
      if (!$) {
        return;
      }
      let keywords = $('meta[name="keywords"]').attr('content');
      let description = $('meta[name="description"]').attr('content');
      let title = $('title').text();
      let h1 = $('h1:first').text();
      let canonical = $('link[rel="canonical"]').attr('href');
      let images = $('img');
      let internalLinks = $('a[href^="/"], a[href^="http://' + domain + '"], a[href^="https://' + domain + '"], a[href^="http://www.' + domain + '"], a[href^="https://www.' + domain + '"]');
      let externalLinks = $('a[href^="http://"], a[href^="https://"]').not('[href*="' + domain + '"]');


      let score = 100;

      // Check the presence of the title, description, and keywords
      if (!title) {
        score -= 20;
      }
      if (!description) {
        score -= 20;
      }
      if (!keywords) {
        score -= 20;
      }
      let titleLengthOver60;
      let descriptionLengthOver155;
      let keywordsLengthOver255;
      // Check the length of the title, description, and keywords
      if (title) {
        if (title.length > 70) {
          score -= 10;
          titleLengthOver60 = true;
        } else {
          titleLengthOver60 = false;
        }
      }
      if (description) {
        if (description.length > 155) {
          score -= 10;
          descriptionLengthOver155 = true;
        } else {
          descriptionLengthOver155 = false;
        }
      }
      if (keywords) {
        if (keywords.length > 255) {
          score -= 10;
          keywordsLengthOver255 = true;
        } else {
          keywordsLengthOver255 = false;
        }
      }
      let h1TagContent;
      let h1TagTotalAmount;
      let h1FirstTagLength;
      // Check the presence of the H1 tag
      if (!h1) {
        score -= 10;
      } else if (h1.length > 60) {
        score -= 5;
      }
      if (h1) {
        h1TagTotalAmount = $('h1').length;
        h1TagContent = $('h1:first').text();
        h1FirstTagLength = $('h1:first').text().length;
      }
      // Check for broken links
      let brokenLinks = 0;
      const promises = [];
      const statusCodesToIgnore = [429, 999, 403, 401];
      const brokenLinksContainer = [];

      // just checking internal links
      let interLinkHref = [];
      internalLinks.each((index, link) => {
        let href = $(link).attr('href');
        let protocol = new URL(url).protocol
        if (
          href &&
          typeof href === 'string' &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:')
        ) {
          if (!/^(https?:)?\/\//i.test(href)) {
            if (!href.startsWith('/') && !href.startsWith('www.') && !href.startsWith('//')) {
              href = '/' + href;
            } else if (href.startsWith('www.')) {
              href = protocol + '//' + href;
            }
            else {
              href = url + href;
            }

          } else if (href.startsWith('//')) {
            href = href.split('//')[1];
            if (!href.startsWith(protocol)) {
              href = protocol + '//' + href;
            }
          }
          interLinkHref.push(href);
          const options = {
            url: href,
            timeout: 5000, // timeout in milliseconds (5 seconds)
          };
          promises.push(
            new Promise((resolve, reject) => {
              request(options, (error, response) => {

                if (
                  (error && error?.code !== 'ESOCKETTIMEDOUT') &&
                  (response &&
                    response?.statusCode !== 200 &&
                    /^[45]/.test(response.statusCode.toString()) &&
                    !statusCodesToIgnore.includes(response.statusCode) && response.statusCode >= 500)
                ) {
                  brokenLinks++;
                  brokenLinksContainer.push(href);
                }
                resolve();
              });
            })
          );
        }
      });


      await Promise.allSettled(promises);

      if (brokenLinks) {
        score -= 5;
      }

      // Check the presence of the canonical tag
      if (!canonical) {
        score -= 10;
      }

      // Check for the presence of alternative text for images
      let missingImgAlt = false;
      let numberOfImages = 0;
      let numberOfImagesMissingAlt = 0;

      images.each(function () {
        numberOfImages += 1;
        if (!$(this).attr('alt')) {
          // score -= 5;
          missingImgAlt = true;
          numberOfImagesMissingAlt += 1;
        }
      });

      const missingAltPenalty =
        (numberOfImagesMissingAlt / numberOfImages) * 15;

      score -= Math.ceil(missingAltPenalty);

      // Check the ratio of internal to external links
      if (
        internalLinks &&
        externalLinks &&
        internalLinks.length / externalLinks.length < 0.5
      ) {
        score -= 10;
      }


      const results = {
        score,
        title,
        titleLength: title?.length || 0,
        description,
        descriptionLength: description?.length || 0,
        keywords,
        keywordsLength: keywords?.length || 0,
        h1,
        canonical,
        images: images?.length,
        internalLinks: internalLinks?.length,
        externalLinks: externalLinks?.length,
        interLinkHref: interLinkHref,
        missingImgAlt: missingImgAlt,
        titleLengthOver60,
        descriptionLengthOver155,
        keywordsLengthOver255,
        numberOfImages,
        numberOfImagesMissingAlt,
        brokenLinks: brokenLinksContainer.length < 20 ? brokenLinks : null,
        // structuredDataReport,
        h1TagTotalAmount,
        h1TagContent,
        h1FirstTagLength,
        allBrokenLinks:
          brokenLinksContainer.length < 20
            ? brokenLinksContainer.join(',')
            : null,
      };
      if (simplyScore) {
        return results.score;
      } else {
        return results;
      }
    } catch (err) {
      console.log(`error in seo score for ${url}`)
      console.log(err);
    }
  }

  /**
   * Check website accessibility using Pa11y and return an object with the results.
   *
   * @param {Object} options - The options object.
   * @param {String} options.url - The URL to check accessibility for.
   *
   * @returns {Promise<Object>} - A Promise that resolves to an object with the accessibility results.
   */
  async CheckAccessibility({ url }) {
    let completedResults;
    if (!url) {
      return;
    }
    const customConfig = {
      includeNotices: false,
      includeWarnings: true,
      includeErrors: true,
      level: 'WCAG2AA',
      standard: 'WCAG2AA',
      timeout: 10000,
      chromeLaunchConfig: {
        args: [
          '--disable-extensions',
          // '--no-sandbox',
          '--disable-setuid-sandbox',
          '--kill-on-fail',
        ],
      },
      launchOptions: {
        userDataDir: process.env.TMPDIR
      }
    };
    let results;
    try {
      results = await pa11y(url, customConfig);
      if (!results) {
        return { score: null, issues: null, goodFeatures: null }
      }
      const issues = results.issues.map((issue) => {
        const tester = issue.code
          .replace(/\./g, ' ')
          .replace(/_/g, '.')
          .replace(/Guideline/g, 'Guideline ');
        const guidelineName = tester;

        return {
          code: issue.code,
          context: issue.context,
          message: issue.message,
          selector: issue.selector,
          type: issue.type,
          guidelineName,
        };
      });


      const goodFeatures = results.passes
        ? results.passes.map((pass) => {
          return {
            code: pass.code,
            context: pass.context,
            message: pass.message,
            selector: pass.selector,
            type: 'pass',
          };
        })
        : [];

      const maxScore = 100;
      const issuesCount = issues.length;
      const issuesErrorCount = issues.filter(issue => issue.type === 'error').length;
      const issuesWarningCount = issuesCount - issuesErrorCount;
      const maxIssuesWeight = Math.max(1, issuesCount / 10);
      const issuesWeight = {
        error: Math.min(maxIssuesWeight, issuesCount > 0 ? Math.ceil(issuesCount / (2 * issuesErrorCount)) : maxIssuesWeight),
        warning: Math.min(maxIssuesWeight, issuesCount > 0 ? Math.ceil(issuesCount / (2 * issuesWarningCount)) : maxIssuesWeight),
      };
      const weightedIssuesCount = issuesWeight.error * issuesErrorCount + issuesWeight.warning * issuesWarningCount;
      const accessibilityScore = Math.max(0, Math.floor((maxScore * (1 - weightedIssuesCount / (issuesCount + 1)))));

      completedResults = {
        accessibilityScore,
        issuesNumber: issues?.length || null,
        issuesWarningAmount:
          issues?.filter((issue) => issue.type === 'warning').length || null,
        issuesErrorAmount:
          issues?.filter((issue) => issue.type === 'error').length || null,
        issues: JSON.stringify(issues),
        goodFeatures: JSON.stringify(goodFeatures),
        goodFeaturesNumber: goodFeatures?.length || null,
      };
      return completedResults;
    } catch (error) {
      console.error('error in checkAccessibility');
      console.error(error);
      // if (browser) {
      //   await browser.close();
      // }
      return { score: null, issues: null, goodFeatures: null };
    }
  }


  /**
 * Parses an issue object and extracts relevant information.
 *
 * @param {object} issue - The issue object to be parsed.
 * @returns {object} The parsed issue containing code, context, message, selector, type, and guidelineName.
 */
  ParseIssue(issue) {
    const codeParts = issue.code.split('.');
    const guidelineName = `Guideline ${codeParts[2].replace('_', '.')} (${codeParts[1]
      })`;
    const results = {
      code: issue.code,
      context: issue.context,
      message: issue.message,
      selector: issue.selector,
      type: issue.type,
      guidelineName,
    };
    return results;
  }


  /**
 * Analyzes the content of a website or provided data for relevance to a keyword.
 *
 * @param {string} data - The website data to be analyzed.
 * @param {string} url - The URL of the website.
 * @param {string} keyword - The keyword to analyze relevance for.
 * @returns {void}
 */
  async ContentAnalyzer({ data, url, keyword }) {
    try {
      let websiteData = data || (await this.GetWebsiteData(url));

      if (!keyword && !websiteData) {
        return;
      }
      if (websiteData !== 'string') {
        websiteData = websiteData.data;
      }
      const $ = cheerio.load(websiteData);
      // extract the text content from the website
      const text = $('body').text();

      // extract the primary and secondary keywords from the input keyword phrase
      const tokenizer = new natural.WordTokenizer();
      const keywords = tokenizer.tokenize(keyword);

      // calculate the relevance score using Naive Bayes
      const classifier = new natural.BayesClassifier();
      classifier.addDocument(text, 'irrelevant');
      keywords.forEach((k) => classifier.addDocument(k, 'relevant'));
      classifier.train();

      const relevanceScore = classifier
        .getClassifications(text)
        .find((c) => c.label === 'relevant').value;

    } catch (err) {
      console.log(err);
    }
  }

  GenerateWebsiteSummary(data) {
    try {
      let summary = "";

      // Check probability score and add a note if high
      if (data.score > 20) {
        const highScoreNotes = [
          `The probability score is (${data.score}), indicating that the site has a higher probability of having issues that may require attention.\n`,
          `The site's probability score (${data.score}), which could suggest potential problems that need to be addressed.\n`,
          `The site has a probability score of (${data.score}), indicating that there may be issues that need to be investigated.\n`
        ];
        summary += highScoreNotes[Math.floor(Math.random() * highScoreNotes.length)];
      } else {
        const lowScoreNotes = [
          `The probability score for the site is ${data.score}, indicating that it could be in relatively good condition.\n`,
          `The site's probability score is ${data.score}, which is a reasonable score that suggests the site is functioning properly.\n`
        ];

        summary += lowScoreNotes[Math.floor(Math.random() * lowScoreNotes.length)];
      }

      // Check if the site is mobile-friendly
      if (!data.isMobileFriendly) {
        const mobileFriendlyNotes = [
          "The site is not mobile-friendly, which can negatively impact user experience and search engine ranking. Optimizing the site for mobile devices is an important part of website design.\n",
          "The site is not optimized for mobile devices, which could make it harder for users to access and engage with the content. Improving mobile accessibility is an important aspect of website management.\n",
          "The site is not mobile-friendly, which could make it harder for users to navigate and engage with the content. Optimizing the site for mobile devices is an important part of online inclusivity and user experience.\n",
          "The site is not mobile-friendly. This can result in a suboptimal user experience, leading to lower engagement, conversions, and revenue. Research has shown that users are more likely to leave a site that is not optimized for mobile devices, making it essential to optimize the site for mobile devices.\n",
          "The site is not optimized for mobile devices, which can lead to slower loading times, distorted images, and other issues that can negatively impact user experience. Studies have shown that users have high expectations for mobile-friendly websites, making it crucial to optimize the site for mobile devices.\n",
          "Our data has shown that the site is not mobile-friendly, which can lead to a higher bounce rate and a lower time spent on site, as users may find it difficult to navigate or access the content. In fact, research has shown that 57% of users will not recommend a business with a poorly designed mobile site. Therefore, optimizing the site for mobile devices is crucial for increasing user engagement and satisfaction.\n",
          "This site is not mobile-friendly, this can negatively impact search engine rankings and reduce organic traffic. Google and other search engines prioritize mobile-friendly sites in their search results, making it essential to optimize the site for mobile devices. In fact, studies have shown that mobile-friendliness is one of the most important factors in search engine rankings.\n",
          "Our analysis has shown that the site is not optimized for mobile devices, which can lead to a poor user experience and reduced conversions. Data has shown that 52% of users are less likely to engage with a company if their mobile site is poor. Therefore, optimizing the site for mobile devices is essential for increasing user engagement and driving revenue.\n"

        ];
        summary += mobileFriendlyNotes[Math.floor(Math.random() * mobileFriendlyNotes.length)];
      }

      // Check for missing meta keywords
      const metaKeywordsNotes = [
        "The site is missing meta keywords. Meta keywords are used to provide additional context to search engines and can improve search engine ranking.\n",
        "The site does not have meta keywords, which could negatively impact its search engine ranking.\n",
        "The site is missing meta keywords, which could make it harder for search engines to understand its content.\n"
      ];
      if (data.keywordsLength > 0) {
        const metaKeywordsFoundNotes = [
          "The site has meta keywords, which can provide additional context to search engines and improve search engine ranking.\n",
          "Meta keywords were found on the site, which could positively impact its search engine ranking.\n",
          "The site has meta keywords, which could make it easier for search engines to understand its content.\n"
        ];
        summary += metaKeywordsFoundNotes[Math.floor(Math.random() * metaKeywordsFoundNotes.length)];
      } else {
        summary += metaKeywordsNotes[Math.floor(Math.random() * metaKeywordsNotes.length)];
      }


      // Check for security issues
      const securityNotes = [
        "The site is insecure, which could make it vulnerable to attacks and negatively impact user trust and website performance.\n",
        "The site is not secure, which could raise concerns for users and negatively impact website performance and search engine ranking.\n",
        "The site is lacking proper security measures, which could leave it vulnerable to attacks and negatively impact user trust, website performance, and search engine ranking.\n",
        "The site does not have proper security protocols in place, which could expose user data to potential security breaches and negatively impact website performance and search engine ranking.\n",
        "The site is not using HTTPS, which could raise concerns for users and negatively impact website performance and search engine ranking.\n",
        "The site's security measures are insufficient, which could leave it vulnerable to attacks and negatively impact user trust, website performance, and search engine ranking.\n"
      ];
      if (data.insecureSite) {
        summary += securityNotes[Math.floor(Math.random() * securityNotes.length)];
      }

      // Check for accessibility issues
      const accessibilityErrors = data.accessibilityAll.length > 0 && data.accessibilityAll.reduce((acc, obj) => {
        return acc += obj.accessibilityErrorsAmount
      }, 0) + data.accessibilityErrorsAmount || data.accessibilityErrorsAmount;

      const accessibilityIssues = data.accessibilityAll.length > 0 && data.accessibilityAll.reduce((acc, obj) => {
        return acc += obj.accessibilityTotalIssuesAmount
      }, 0) + data.accessibilityTotalIssuesAmount || data.accessibilityTotalIssuesAmount;

      const accessibilityWarnings = data.accessibilityAll.length > 0 && data.accessibilityAll.reduce((acc, obj) => {
        return acc += obj.accessibilityWarningsAmount
      }, 0) + data.accessibilityWarningsAmount || data.accessibilityWarningsAmount;


      if (accessibilityErrors > 0) {
        const accessibilityNotes = [
          `The site has ${accessibilityErrors} accessibility issues, out of a total of ${accessibilityIssues} issues, with ${accessibilityWarnings} warnings. Addressing accessibility issues is important for ensuring that all users, including those with disabilities, can access and use the site.\n`,
          `There are ${accessibilityErrors} accessibility issues on the site that need to be resolved, out of a total of ${accessibilityIssues} issues. Addressing these issues is important for ensuring that all users, including those with disabilities, can access and use the site.\n`,
          `The site has ${accessibilityErrors} accessibility issues that need to be addressed, with ${accessibilityWarnings} warnings also present. Ensuring accessibility for all users is an important aspect of website design.\n`,
          `Out of a total of ${accessibilityIssues} issues, the site has ${accessibilityErrors} accessibility issues that need to be resolved. Addressing these issues is important for ensuring that all users, including those with disabilities, can access and use the site.\n`,
          `The site has ${accessibilityErrors} accessibility issues that need to be addressed in order to ensure that all users, including those with disabilities, can access and use the site effectively. A website that is accessible to all is an important part of online inclusivity.\n`
        ];
        summary += accessibilityNotes[Math.floor(Math.random() * accessibilityNotes.length)];
      }


      let imgsMissingAlt;
      if (imgsMissingAlt > 0) {
        // Check for missing alt tags
        imgsMissingAlt = data.seoData.length > 0 && data.seoData.reduce((acc, obj) => {
          return acc += obj.numberOfImagesMissingAlt;
        }, 0) + data.numberOfImagesMissingAlt || data.numberOfImagesMissingAlt;

        const numImages = data.seoData.length > 0 && data.seoData.reduce((acc, obj) => {
          return acc += obj.numberOfImages;
        }, 0) + data.numberOfImages || data.numberOfImages;
        const altTagNotes = [
          `The site has ${imgsMissingAlt} image${imgsMissingAlt === 1 ? "" : "s"} without alt tags, out of a total of ${numImages} image${numImages === 1 ? "" : "s"}. Alt tags are an important accessibility feature that provide text descriptions for visually impaired users and can also improve search engine ranking.\n`,
          `There are ${imgsMissingAlt} image${imgsMissingAlt === 1 ? "" : "s"} on the site without alt tags, which could make it difficult for visually impaired users to understand the content. Providing alt tags is an important part of making websites accessible to all users.\n`,
          `Out of a total of ${numImages} image${numImages === 1 ? "" : "s"}, the site has ${imgsMissingAlt} image${imgsMissingAlt === 1 ? "" : "s"} without alt tags, which could negatively impact its search engine ranking and user experience. Providing alt tags for all images is an important part of website design.\n`,
          `The site has ${imgsMissingAlt} image${imgsMissingAlt === 1 ? "" : "s"} without alt tags, which could make it harder for users to understand the content and negatively impact website performance and search engine ranking.\n`,
          `There are ${imgsMissingAlt} image${imgsMissingAlt === 1 ? "" : "s"} on the site without alt tags, which could make it difficult for users to access and understand the content. Providing alt tags is an important part of website design and online inclusivity.\n`
        ];
        summary += altTagNotes[Math.floor(Math.random() * altTagNotes.length)];
      }


      // Check for issues with the CMS
      const cmsNotes = [
        `The site is using ${data.cms}, which may have limitations. Choosing the right CMS is important for website functionality and management.\n`,
        `The site's CMS is ${data.cms}, which could affect its performance and functionality.\n`,
        `The site is built on ${data.cms}, which has its pros and cons for website management and optimization.\n`
      ];
      // summary += (data.cms === "wordpress" || data.cms === "drupal" ? "" : cmsNotes[Math.floor(Math.random() * cmsNotes.length)]);

      // Check for broken links
      const brokenLinksTotal = data?.seoData?.length > 0 && data.seoData.reduce((acc, obj) => {
        return acc += obj.brokenLinks;
      }, 0) + data.brokenLinks || data.brokenLinks;

      if (data.brokenLinks > 0) {
        const brokenLinksNotes = [
          `The site has ${brokenLinksTotal} broken link${brokenLinksTotal === 1 ? "" : "s"} that could negatively impact user experience and search engine ranking. Fixing broken links is an important part of website maintenance.\n`,
          `There are ${brokenLinksTotal} broken link${brokenLinksTotal === 1 ? "" : "s"} on the site that need to be addressed. Broken links can hurt search engine ranking and user experience, so it's important to fix them as soon as possible.\n`,
          `The site has ${brokenLinksTotal} broken link${brokenLinksTotal === 1 ? "" : "s"} that could be hurting its search engine ranking and user experience. Addressing broken links is an important part of website optimization.\n`,
          `Having ${brokenLinksTotal} broken link${brokenLinksTotal === 1 ? "" : "s"} on the site can negatively impact user experience and search engine ranking. It's important to regularly check for broken links and fix them promptly.\n`,
          `The site has ${brokenLinksTotal} broken link${brokenLinksTotal === 1 ? "" : "s"} that could be causing problems for users and search engines. Fixing broken links is an important part of website management and optimization.\n`
        ];
        summary += brokenLinksNotes[Math.floor(Math.random() * brokenLinksNotes.length)];
      }

      // Check for missing footer
      const missingFooterNotes = [
        "The site is missing a footer, which can make it difficult for users to find important information or navigate the site.\n",
        "The site does not have a footer, which could make it harder for users to find relevant content.\n",
        "The site is lacking a footer, which could negatively impact user experience and engagement.\n"
      ];
      summary += (data.hasFooterCheck && data.hasFooter === "Does not have a footer." ? missingFooterNotes[Math.floor(Math.random() * missingFooterNotes.length)] : "");

      // Check for outdated footer
      const outdatedFooterNotes = [
        "The site has an outdated footer. An outdated footer can negatively impact user trust and website performance.\n",
        "The site's footer is outdated, which could make it harder for users to trust the site or find relevant information.\n",
        "The site's footer is not up-to-date, which could negatively impact its overall performance and user experience.\n"
      ];
      summary += (data.footerOutDatedCheck && data.footerOutDated ? outdatedFooterNotes[Math.floor(Math.random() * outdatedFooterNotes.length)] : "");

      // Check for HTML in slug
      const htmlInSlugNotes = [
        "The site has HTML in the URL slug. URLs should be easy to read and understand for both users and search engines.\n",
        "The site's URL slug has HTML in it, which could make it harder for search engines to crawl and understand the content.\n",
        "Having HTML in the URL slug could negatively impact the site's search engine ranking and user experience.\n"
      ];
      summary += (data.htmlInSlugCheck && data.htmlInSlug ? htmlInSlugNotes[Math.floor(Math.random() * htmlInSlugNotes.length)] : "");

      // Check for outdated title length
      if (data.titleLengthOver60) {
        const titleLengthNotes = [
          `The site's title is longer than the recommended length of 50-70 characters, which can negatively impact search engine ranking and user experience. Shortening the title can help improve the site's visibility and readability.\n`,
          `The site's title is too long, which could make it harder for users to understand and remember. A shorter, more concise title can improve user experience and search engine ranking.\n`,
          `With a title that exceeds the recommended length, the site may be hurting its search engine ranking and user experience. Shortening the title is an important part of website optimization.\n`,
          `The site's title is too long, which could make it harder for search engines to understand the site's content. Shortening the title can help improve the site's visibility and ranking.\n`,
          `Having a title that is too long can negatively impact the site's search engine ranking and user experience. Shortening the title is an important part of website management and optimization.\n`
        ];
        summary += titleLengthNotes[Math.floor(Math.random() * titleLengthNotes.length)];
      }

      // Check for outdated description length
      if (data.descriptionLengthOver155) {
        const descriptionLengthNotes = [
          `The site's meta description is longer than the recommended length of 120-155 characters, which can negatively impact search engine ranking and user experience. Shortening the description can help improve the site's visibility and readability.\n`,
          `The site's meta description is too long, which could make it harder for users to understand and engage with the content. Shortening the description can improve user experience and search engine ranking.\n`,
          `With a meta description that exceeds the recommended length, the site may be hurting its search engine ranking and user experience. Shortening the description is an important part of website optimization.\n`,
          `The site's meta description is too long, which could make it harder for search engines to understand the site's content. Shortening the description can help improve the site's visibility and ranking.\n`,
          `Having a meta description that is too long can negatively impact the site's search engine ranking and user experience. Shortening the description is an important part of website management and optimization.\n`
        ];
        summary += descriptionLengthNotes[Math.floor(Math.random() * descriptionLengthNotes.length)];
      }

      // Return the summary
      return summary;
    } catch (err) {
      console.error('error in GenerateWebsiteSummary');
      console.log(err)
      return ''
    }
  }


  /**
 * Performs SEO analysis on internal links within a website.
 *
 * @param {object} websiteObject - The object representing the website.
 * @returns {object} An object containing SEO data and accessibility data.
 */
  async SeoInternalLinks({ websiteObject }) {
    let seoData = [];
    let accessibilityData = [];

    if (websiteObject.internalLinksRaw.length < envVars.seoInternalLinksLimit) {
      try {
        const promises = websiteObject.internalLinksRaw.map(async (link) => {
          envVars.mediaFileExtensions.some(ext => link.includes(ext))
          if (envVars.mediaFileExtensions.some(ext => link.includes(ext))) {
            return
          }
          const data = await this.GetWebsiteData(link);
          if (data) {
            try {
              const {
                missingImgAlt,
                titleLengthOver60,
                titleLength,
                descriptionLengthOver155,
                descriptionLength,
                keywordsLengthOver255,
                keywordsLength,
                score,
                numberOfImages,
                numberOfImagesMissingAlt,
                keywords,
                internalLinks,
                externalLinks,
                brokenLinks,
                allBrokenLinks,
                h1TagTotalAmount,
                h1TagContent,
                h1FirstTagLength,
                interLinkHref,
              } = await this.AuditSEO({
                url: link,
                data,
                simplyScore: false,
              });

            
              seoData.push({
                href: link,
                missingImgAlt,
                titleLengthOver60,
                titleLength,
                descriptionLengthOver155,
                descriptionLength,
                keywordsLengthOver255,
                keywordsLength,
                seoScore: score,
                numberOfImages,
                numberOfImagesMissingAlt,
                keywords,
                internalLinks,
                externalLinks,
                brokenLinks,
                allBrokenLinks,
                h1TagTotalAmount,
                h1TagContent,
                h1FirstTagLength,
              })
            } catch (err) {
              console.log(err);
            }
          }
        });
        // Wait for all promises to resolve
        for (const promise of promises) {
          await promise;
        }
      } catch (err) {
        console.log(err)
      }
    }

    else {
    }

    return { seoData, accessibilityData };

  }

}

module.exports = Conductor;
