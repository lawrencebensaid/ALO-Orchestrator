import puppeteer from "puppeteer";
import cheerio from "cheerio";
import Course from "../models/Course";
import { MongoClient } from "mongodb";
import Cache from "./Cache";
import fs from "fs";
import httpRequest from "request-promise-native";
import { download, getFileExtension } from "./Util";

var listeners = [];


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class ELO {

  /**
   * @description ELO represents an ELO user login.
   */
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }


  /**
   * @description Fetches the details and all resources of a course.
   * 
   * @returns {Promise<Course>}
   */
  async fetchCourseFiles(id, { onUpdate }) {
    const update = typeof onUpdate === "function" ? onUpdate : () => { };
    return new Promise(async (resolve, reject) => {
      try {
        Cache.setUpdating("courses");
        const browser = await puppeteer.launch({ headless: !environment.debug, defaultViewport: null, args: ["--no-sandbox"] });
        const page = await browser.newPage()
        await page._client.send("Page.setDownloadBehavior", { behavior: "deny", downloadPath: `${Cache.cacheURI()}/.temp` });
        await page.setRequestInterception(true);
        listeners = [];
        page.on("request", async interceptedRequest => {
          // interceptedRequest.headers
          for (const listener of listeners) {
            const execute = typeof listener === "function" ? listener : () => { };
            execute(interceptedRequest);
          }
          await interceptedRequest.continue();
        });

        await page.goto("https://elo.windesheim.nl");
        await page.waitForSelector("#userNameInput");
        await page.type("#userNameInput", `${this.username}@student.windesheim.nl`);
        await page.type("#passwordInput", this.password);
        await page.click("#submitButton");
        console.log("[ELO] Auth complete");

        // #tns
        var tns = await page.waitForSelector("#tns", { visible: true, timeout: 0 });
        tns = await tns.contentFrame();

        const cookies = await page.cookies();
        const cookie = `${cookies[0].name}=${cookies[0].value}`;

        // #_204 was renamed to #_207
        var _204 = await tns.waitForSelector("#_207", { visible: true, timeout: 0 });
        _204 = await _204.contentFrame();

        // Display all
        await _204.waitForSelector("#moreAll");
        await _204.click("#moreAll");
        await _204.waitForSelector("#loadMoreSR_All");
        await _204.click("#loadMoreSR_All");
        // await _204.waitForSelector(`ul.all-studyroutes > li[data-srid="${id}"]`);
        await _204.waitForSelector(`li[data-srid="${id}"]`);
        // await _204.click(`ul.all-studyroutes > li[data-srid="${id}"]`);
        await _204.click(`li[data-srid="${id}"]`);

        // #tns
        var tns2 = await page.waitForSelector("#tns", { visible: true, timeout: 0 });
        tns2 = await tns2.contentFrame();

        // #_206 was renamed to #_209
        var _206 = await tns2.waitForSelector("#_209", { visible: true, timeout: 0 });
        _206 = await _206.contentFrame();

        // Get title
        await _206.waitForSelector(".detailintro-content > p");
        const courseName = await _206.$eval(".detailintro-content > p", (element) => { return element.innerHTML; });
        var courseCode = null;

        // Get thumbnail
        await _206.waitForSelector(".detailintro");
        const courseDiv = await _206.$eval(".detailintro", (element) => { return element.outerHTML; });
        const $courseDiv = cheerio.load(courseDiv);
        const property = $courseDiv("div.detailintro[style]").css("background-image");
        const thumbnailURL = property.split("url('")[1].split("')")[0];
        await download({ cookie, url: thumbnailURL, destination: ".thumbnails", filename: `${courseName}.${getFileExtension(thumbnailURL)}` });
        const thumbnail = `/files/.thumbnails/${courseName}.${getFileExtension(thumbnailURL)}`;

        // #widgetsiframe
        var wif = await _206.waitForSelector("#widgetsiframe", { visible: true, timeout: 0 });
        wif = await wif.contentFrame();
        console.log("[ELO] Course loaded");

        // .widgetiframe News
        try {
          var wif_news = await wif.waitForSelector(`iframe[title="News"]`, { visible: true, timeout: 2500 });
          wif_news = await wif_news.contentFrame();

          // Get code
          await wif_news.waitForSelector(".line-title.mynewscategory");
          courseCode = await wif_news.$eval(".line-title.mynewscategory", (element) => { return element.innerHTML; });
        } catch (error) { }

        // .widgetiframe Contents
        var wif_contents = await wif.waitForSelector(`iframe[title="Contents"]`, { visible: true, timeout: 0 });
        wif_contents = await wif_contents.contentFrame();

        // Wait for table of content to load
        await wif_contents.waitForSelector(`div[name="Xplorer"] > ul.root > li`);
        console.log("[ELO] Content loaded");
        await wif_contents.click(`div[name="Xplorer"] > ul.root > li`);

        try {
          await wif_contents.waitForSelector(`div[name="Xplorer"] > ul.root > li > ul > li`, { timeout: 1000 });
          await wif_contents.click(`div[name="Xplorer"] > ul.root > li > ul > li`);
        } catch (error) { }

        // Wait for ELO modal to load
        await tns2.waitForSelector(`div.ExplorerTree > #uls > *`);
        console.log("[ELO] Files loaded");
        update(.25);
        // Map file structure
        const filemap = await ELO.scanFileStructure(tns2, cookie, `${courseName}`);
        // console.log(util.inspect(filemap, false, null, true));
        const course = new Course(id, courseCode, courseName, thumbnail, filemap);
        course.save();
        resolve(course);

        if (!environment.debug) {
          browser.close();
        }
      } catch (error) {
        console.log(error);
        reject("Task quit because the ELO was not responding");
      }
    });
  }


  /**
   * @description Fetches the details and all resources of a course.
   * 
   * @returns {Promise<[Object]>}
   */
  async fetchCourseMetadata() {
    return new Promise(async (resolve, reject) => {
      try {
        const browser = await puppeteer.launch({ headless: !environment.debug, defaultViewport: null, args: ["--no-sandbox"] });
        const page = await browser.newPage()
        await page.goto("https://elo.windesheim.nl");
        await page.waitForSelector("#userNameInput");
        await page.type("#userNameInput", `${this.username}@student.windesheim.nl`);
        await page.type("#passwordInput", this.password);
        await page.click("#submitButton");
        console.log("[ELO] Auth complete");

        // #tns
        var tns = await page.waitForSelector("#tns", { visible: true, timeout: 0 });
        tns = await tns.contentFrame();

        const cookies = await page.cookies();
        const cookie = `${cookies[0].name}=${cookies[0].value}`;

        // #_204 was renamed to #_207
        var _204 = await tns.waitForSelector("#_207", { visible: true, timeout: 0 });
        _204 = await _204.contentFrame();

        // Remove filters
        await _204.waitForSelector(".view-options a.dropdown-toggle");
        await _204.click(".view-options a.dropdown-toggle");

        await _204.waitForSelector(`.view-options .dropdown-menu li:first-child a[data-filteroption="1"]`);
        await _204.click(`.view-options .dropdown-menu li:first-child a[data-filteroption="1"]`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Display all
        await _204.waitForSelector("#moreAll");
        await _204.click("#moreAll");
        await _204.waitForSelector("#loadMoreSR_All");
        await _204.click("#loadMoreSR_All");
        await _204.waitForSelector("ul.all-studyroutes");
        console.log("[ELO] Courses loaded");

        // Structure and save
        const list = await _204.$$(".all-studyroutes > li");
        const thumbnailData = [];
        for (let i = 0; i < list.length; i++) {
          const element = list[i];
          const $ = cheerio.load(await (await element.getProperty("outerHTML")).jsonValue());
          const id = parseInt($("li").attr("data-srid"));
          const code = $("li .thumb-item-code").text();
          const property = $("li .thumb-item-img[style]").css("background-image");
          const thumbnailURL = "https://elo.windesheim.nl" + property.split("url('")[1].split("')")[0];
          const data = await download({ cookie, url: thumbnailURL, base64: true });
          thumbnailData.push({ id, code, data });
        }

        resolve(thumbnailData);
        if (!environment.debug) {
          browser.close();
        }
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

}


ELO.scanFileStructure = function (context, cookie, pwd) {
  const ulid = arguments[3] ? arguments[3].replace("LI", "UL") : null;
  return new Promise(async (resolve, reject) => {
    const structure = [];
    const selector = `div.ExplorerTree > #uls ${ulid ? `ul#${ulid} > li` : "li"}`;
    const list = await context.$$(selector);
    for (let i = 0; i < list.length; i++) {
      const element = list[i];
      const item = {};
      // Scrape
      var name = await (await element.getProperty("innerText")).jsonValue();
      name = name.split("&amp;").join("&");
      const $ = cheerio.load(await (await element.getProperty("outerHTML")).jsonValue());
      const eid = $("li").attr("id");
      const icon = $("li").attr("icon");
      const type = getType(icon.split("#")[1]);
      const rnr = parseInt(Math.random() * 10000);
      try {
        await element.click();
      } catch (error) { }
      item.name = typeof type.subtype === "string" ? name.endsWith(`.${type.subtype}`) ? name : `${name}.${type.subtype}` : name;
      item.type = type.name;
      item.subtype = type.subtype;

      // Mongo
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const file = { file_name: name, file_directory: pwd, file_extension: type.subtype };
      const existingFile = await dbo.collection("files").findOne({ file_name: name, file_directory: pwd, file_extension: type.subtype });
      if (existingFile) {
        file._id = existingFile._id;
      } else {
        try {
          await dbo.collection("files").insertOne(file);
        } catch (e) {
          console.log(e)
        }
      }
      db.close();

      if (type.name === "file") {
        listeners[rnr] = (async (intercept) => {
          const url = intercept.url();
          if (url.includes("/CMS/_STUDYROUTE_FOLDERS/")) {
            let bytes = -1;
            try {
              delete listeners[rnr];
              const data = await download({ url, cookie, filename: `${file._id}.${type.subtype}` });
              bytes = fs.statSync(`${Cache.cacheURI()}/${file._id}.${type.subtype}`).size;

              // Mongo 2
              const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
              const dbo = db.db(environment.dbmsName);
              await dbo.collection("files").updateOne({ _id: file._id }, { $set: { file_extension: type.subtype, file_size: bytes, file_data: data } });
              db.close();

              if (bytes) {
                item.size = bytes;
              }
              item.path = `/file/${file._id}`;
              item.id = file._id;
              structure.push(item);
            } catch (error) {
              console.log(error.code === "ERR_OUT_OF_RANGE" ? `File '${file._id}' is too big! (${bytes})` : `[ELO] DOWNLOAD NOTICE:\n${error}\n`);
            }
            return;
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else { // If content loading is needed
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Recurse
        var children = [];
        try {
          children = await ELO.scanFileStructure(context, cookie, `${pwd}/${name}`, eid);
        } catch (error) {
          console.log("[ELO] RECURSE NOTICE", error);
        }
        // Structure
        if (type.id === 103) item.children = children;
        if ([496].includes(type.id)) { // If link
          var detailFrame = await context.waitForSelector("iframe.ipadFastScroll", { visible: true, timeout: 0 });
          detailFrame = await detailFrame.contentFrame();
          const html = await detailFrame.$eval("html", (element) => { return element.outerHTML; });
          const $context = cheerio.load(html);
          const href = $context(".studyrouteitemDescription a").attr("href");
          const { request } = await httpRequest(href, { headers: { "Cookie": cookie }, resolveWithFullResponse: true });
          if (href) item.href = request.uri.href;
        }
        structure.push(item);
      }
    }
    resolve(structure);
  });
}


export default ELO;


function getType(id) {
  return TYPES.hasOwnProperty(`${id}`) ? TYPES[id] : TYPES["0"];
}


const TYPES = {
  "0": {
    id: 0,
    name: "unknown"
  },
  "103": {
    id: 103,
    name: "folder"
  },
  "142": {
    id: 142,
    name: "webpage"
  },
  "146": {
    id: 146,
    name: "file"
  },
  "246": {
    id: 246,
    name: "form"
  },
  "496": {
    id: 496,
    name: "resource"
  },
  "656": {
    id: 656,
    name: "file",
    subtype: "pdf"
  },
  "666": {
    id: 666,
    name: "file",
    subtype: "docx"
  },
  "667": {
    id: 667,
    name: "file",
    subtype: "xlsx"
  },
  "668": {
    id: 668,
    name: "file",
    subtype: "pptx"
  },
  "670": {
    id: 670,
    name: "file",
    subtype: "mp4"
  }
};