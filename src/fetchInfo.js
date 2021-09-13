import puppeteer from "puppeteer";
import cheerio from "cheerio";

export default async function (username, password) {
  return new Promise(async (resolve, reject) => {

    // const info = {};
    var abort = false;

    try { // Read grades with Puppeteer

      const browser = await puppeteer.launch({ headless: !environment.debug, defaultViewport: null, args: ["--no-sandbox"] });
      const page = await browser.newPage()
      await page.goto("https://educator.windesheim.nl/studyprogress");
      await page.waitForSelector("#userNameInput");
      await page.type("#userNameInput", `${username}@student.windesheim.nl`);
      await page.type("#passwordInput", password);
      await page.click("#submitButton");
      setTimeout(() => {
        page.$eval("#errorText", (element) => { return element.innerHTML; }).then((message) => {
          message = message.trim();
          if (message) {
            abort = true;
            console.log(`Auth failed: "${message}"`);
            reject(message);
          }
        }).catch(() => { });
      }, 750);

      await page.waitForSelector(".menu--student-dashboard__list li:nth-child(2)");
      console.log("[Educator] Auth complete");
      // await page.click(".menu--student-dashboard__list li:nth-child(2)");
      // await page.waitForSelector(".su-personal-data-content");
      // console.log("Results loaded");

      // // Structure and respond
      // const $ = cheerio.load(await page.content());
      // var html = "";
      // $(".su-personal-data-content .panel.panel-default .dl-horizontal").each((i, element) => {
      //   html = html + $(element).html().split("\n").join("").split("\t").join("").trim();
      // });
      // html = html.substr(4, html.length - 9);
      // for (const property of html.split("</dd><dt>")) {
      //   const pair = property.split("</dt><dd>");
      //   if (pair[0].trim() === "" || pair[1].trim().split("&#xA0;").join("") === "") {
      //     continue;
      //   }
      //   info[pair[0]] = pair[1];
      // }
      // resolve(info);
      resolve();
      if (!environment.debug) {
        browser.close();
      }
    } catch (error) {
      if (abort) {
        return;
      }
      console.log(error);
      reject(error);
    }

  });
}
