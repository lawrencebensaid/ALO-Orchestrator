import httpRequest from "request-promise-native";
import puppeteer from "puppeteer";
import moment from "moment";
import { MongoClient } from "mongodb";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class WindesheimAzure {

  /**
   * @param {String} cookie 
   */
  constructor(cookie) {
    this.cookie = cookie;
  }


  /**
   * @description Fetches a specified Class or all Classes depending on the id.
   * 
   * @param {String?} id 
   */
  async fetchKlas(id = null) {
    const href = `https://windesheimapi.azurewebsites.net/api/v2/Klas${id ? `/${id}` : ""}`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches all Events of a specified Class.
   * 
   * @param {String} id 
   */
  async fetchKlasLes(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v2/Klas/${id}/Les`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches a Course of specified id.
   * 
   * @param {String} id course identifier
   */
  async fetchCourses(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Courses/${id}/?culture=NL`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {}});
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches information of a specified Person.
   * 
   * @param {String} id user code (For example: 's1141551')
   */
  async fetchPersons(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches Study information of a specified Person.
   * 
   * @param {String} id user code (For example: 's1141551')
   */
  async fetchPersonsStudy(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}/Study?onlydata=true`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches selected Klas Settings.
   * 
   * @param {String} id user code (For example: 's1141551')
   */
  async fetchPersonsSettingsKlas(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}/Settings?key=Setting_Activity_selected`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches selected Klas Settings.
   * 
   * @param {String} id user code (For example: 's1141551')
   * @param {Array<String>} classes Classes string array.
   */
  async updatePersonsSettingsKlas(id, classes) {
    const value = [];
    for (const _class of classes) {
      value.push({ id: _class, type: "Class" });
    }
    const valueString = JSON.stringify(value).split("\"").join("%22");
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}/PutSettings?key=Setting_Activity_selected&value=${valueString}`;
    try {
      return await httpRequest.put(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches NewsItems for a specified Person.
   * 
   * @param {String} id user code (For example: 's1141551')
   */
  async fetchPersonNewsitems(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}/NewsItems?onlydata=true`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches TestResults for a specified Person.
   * 
   * @param {String} id user code (For example: 's1141551')
   */
  async fetchPersonsStudyCourseTestResults(id) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Persons/${id}/Study/-1/Course/-1/TestResults?onlydata=true`;
    try {
      return await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
    } catch (error) {
      console.log(error);
      return [];
    }
  }


  /**
   * @description Fetches Study of a specified id or all the studies depending on the id.
   * 
   * @param {String?} id study code
   */
  async fetchOnderwijsproduct(id = null) {
    const href = `https://windesheimapi.azurewebsites.net/api/v1/Onderwijsproduct${id ? `/${id}` : ""}?onlydata=true`;
    try {
      const studies = await httpRequest(href, { headers: { "Cookie": this.cookie }, json: {} });
      return id ? studies[0] : studies;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

}


/**
 * @description Gets a valid WindesheimAzure cookie if one is available. If not it will return null.
 * 
 * @param {String} username Windesheim username
 * @returns {Promise<String?>} Cookie
 */
export async function getCookie(username) {
  const code = typeof username === "string" ? username.split("@")[0] : null;
  const now = Math.round(new Date().valueOf() / 1000);
  const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
  const dboc = db.db("windesheim-api").collection("users");
  const expired = await dboc.find({ "user_cookies.expiration": { $lt: now } }).toArray();
  for (const user of expired) {
    const validCookies = [];
    for (const index in user.user_cookies) {
      const cookie = user.user_cookies[index];
      if (cookie.expiration > now) {
        validCookies.push(user.user_cookies[index]);
      }
    }
    await dboc.updateOne({ _id: user._id }, { $set: { user_cookies: validCookies } });
  }
  if (code) {
    const user = await dboc.findOne({ user_code: code });
    db.close();
    if (user) {
      for (const cookie of user.user_cookies) {
        if (cookie.expiration > now) {
          console.log("Cached cookie found (personal)");
          return cookie.token;
        }
      }
    }
  } else {
    const users = await dboc.find().toArray();
    db.close();
    for (const user of users) {
      for (const cookie of user.user_cookies) {
        if (cookie.expiration > now) {
          console.log("Cached cookie found (random)");
          return cookie.token;
        }
      }
    }
  }
  return null;
}


/**
 * @description Fetches a non-personal cookie
 * 
 * @param {String} username 
 * @param {String} password 
 * 
 * @returns {Promise<String>}
 */
export async function fetchCookie(username, password) {
  return new Promise(async (resolve, reject) => {

    const cookieCache = await getCookie();
    if (cookieCache) {
      resolve(cookieCache);
      return;
    }

    return await fetchPersonalCookie(username, password);

  });
}


/**
 * @description Fetches a personal cookie
 * 
 * @param {String} username 
 * @param {String} password 
 * 
 * @returns {Promise<String>}
 */
export async function fetchPersonalCookie(username, password) {
  return new Promise(async (resolve, reject) => {

    const cookieCache = await getCookie(username);
    if (cookieCache) {
      resolve(cookieCache);
      return;
    }

    try { // Read klasses with Puppeteer
      console.log("Fetching cookie...");
      const browser = await puppeteer.launch({ headless: !environment.debug, defaultViewport: null, args: ["--no-sandbox"] });
      const page = await browser.newPage()
      await page.goto("https://wip.windesheim.nl");

      await page.waitForSelector("#i0116");
      await page.type("#i0116", `${username}@student.windesheim.nl`);
      await page.click(`#idSIButton9`);
      await page.waitForSelector("#userNameInput");
      const input = await page.$("#userNameInput");
      await input.click({ clickCount: 3 });
      await page.type("#userNameInput", `${username}@student.windesheim.nl`);
      await page.type("#passwordInput", password);
      await page.click("#submitButton");
      const expiration = Math.floor(moment().add(1, "hour").valueOf() / 1000);
      await page.waitForSelector("#idBtn_Back");
      await page.click("#idBtn_Back");
      await page.waitForNavigation()
      console.log("[WindesheimAzure] Auth success");
      await page.goto("https://windesheimapi.azurewebsites.net/api/v2");
      const cookies = await page.cookies();
      var token = "";
      for (const cookie of cookies) {
        if (cookie.name === ".AspNet.Cookies") {
          token = `${cookie.name}=${cookie.value}`;
        }
      }

      if (token.length <= 0) {
        reject();
        return;
      }

      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db("windesheim-api");
      await dbo.collection("users").updateOne({ user_code: username }, { $push: { user_cookies: { token, expiration } } });
      db.close();

      resolve(token)

      if (!environment.debug) {
        browser.close();
      }
    } catch (error) {
      console.log(error);
      reject(error);
    }

  });
}

WindesheimAzure.fetchCookie = fetchCookie;


export default WindesheimAzure;