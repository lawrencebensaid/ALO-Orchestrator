import puppeteer from "puppeteer";
import cheerio from "cheerio";


export default async function (username, password) {
  return new Promise(async (resolve, reject) => {

    const grades = [];

    try { // Read grades with Puppeteer

      const browser = await puppeteer.launch({ headless: !environment.debug, defaultViewport: null, args: ["--no-sandbox"] });
      const page = await browser.newPage()
      await page.goto("https://educator.windesheim.nl/studyprogress");
      await page.waitForSelector("#userNameInput");
      await page.type("#userNameInput", username);
      await page.type("#passwordInput", password);
      await page.click("#submitButton");
      console.log("[Educator] Auth complete");
      await page.waitForSelector(".menu--student-dashboard__list li:first-child");
      await page.click(".menu--student-dashboard__list li:first-child");
      await page.waitForSelector("div.list-group.list-group--grid.list-group--results");
      console.log("Results loaded");

      // Structure and respond
      const $ = cheerio.load(await page.content());
      $("div.list-group.list-group--grid.list-group--results").each((i, element) => {
        if (element.name == "div") {
          for (const child of element.children) {
            if (child.name == "div") {
              $(child).find(".grade i.fa").remove();
              $(child).find(".grade span.badge").remove();
  
              const name = $(child).find(".exam-unit__name > a").first().text().trim();
              const code = $(child).find(".exam-unit__name > small[class]").text().trim();
              // const attempts = parseInt($(child).find("span.badge-attempts").first().text().trim());
              const points = parseInt($(child).find(".exam-unit-workload dd").text());
              const date = parseDate($(child).find(".exam-unit.examination-date time").first().text());
              const grade = parseGrade($(child).find("dt[class] > span.grade").text().trim());
              const subgrades = [];
  
              $(child).find(".single-grade").each((i, element) => {
                const name = $(element).find("dd > a").text().trim();
                // const attempts = parseInt($(element).find(".badge-attempts").text().trim());
                const grade = parseGrade($(element).find("dt > span.grade").text().trim());
                const date = parseDate($(element).find(".exam-unit.examination-date time").text());
                subgrades.push({ name, grade, date });
              });
  
              grades.push({ name, code, grade, points, date, subgrades });
            }
          }
        }
      });
      resolve(grades);
      if (!environment.debug) {
        browser.close();
      }
    } catch (error) {
      console.log(error);
      reject(error);
    }
    
  });
}

function parseDate(string) {
  return  Math.floor(new Date(string.trim()) / 1000);
}


function parseGrade(string) {
  const grade = typeof string === "string" && (string.toLowerCase() === "voldaan" || string.toLowerCase() === "pass") ? "PASSED" : string
  return grade == "-" ? null : (parseFloat(grade.split(",").join(".")) || grade);
}