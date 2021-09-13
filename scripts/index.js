const httpRequest = require("request-promise-native");
const puppeteer = require("puppeteer");
const moment = require("moment");


const { WAPI_USERNAME: username, WAPI_PASSWORD: password } = process.env;

(async () => {

  const cookie = await fetchCookie(username, password);
  const start = moment(new Date());
  console.log(`\nStart at ${start}`);
  const timer = setInterval(async () => {
    const href = "https://windesheimapi.azurewebsites.net/api/v2/Klas";
    try {
      const response = await httpRequest(href, { headers: { "Cookie": cookie } });
      console.log("Started", start.fromNow(), (JSON.parse(response) || []).length);
    } catch (error) {
      console.log("\nERROR", error);
      console.log(`\nNo longer valid: ${start.fromNow()}`);
      console.log(`End at ${moment(new Date())}\n`);
      clearInterval(timer);
    }
  }, 60000);

})();


async function fetchCookie(username, password) {
  return new Promise(async (resolve, reject) => {

    try { // Read klasses with Puppeteer
      console.log("Fetching cookie...");
      const browser = await puppeteer.launch({ defaultViewport: null, args: ["--no-sandbox"] });
      const page = await browser.newPage()
      await page.goto("https://wip.windesheim.nl");

      await page.waitForSelector("#i0116");
      await page.type("#i0116", username);
      await page.click(`#idSIButton9`);
      await page.waitForSelector("#userNameInput");
      const input = await page.$("#userNameInput");
      await input.click({ clickCount: 3 });
      await page.type("#userNameInput", username);
      await page.type("#passwordInput", password);
      await page.click("#submitButton");
      await page.waitForSelector("#idBtn_Back");
      await page.click("#idBtn_Back");
      await page.waitForNavigation()
      console.log("[???] Auth success");
      await page.goto("https://windesheimapi.azurewebsites.net/api/v2");
      const cookies = await page.cookies();
      var header = "";
      for (const cookie of cookies) {
        if (cookie.name === ".AspNet.Cookies") {
          header = `${cookie.name}=${cookie.value}`;
        }
      }

      if (header.length <= 0) {
        reject();
        return;
      }

      resolve(header)

      browser.close();
    } catch (error) {
      console.log(error);
      reject(error);
    }

  });
}