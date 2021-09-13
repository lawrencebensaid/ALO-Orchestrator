import httpRequest from "request-promise-native";
import Cache from "./Cache";
import fs from "fs";
import { v4 as UUID } from "uuid";


class Util {

}


export default Util;


/**
 * @description Saves a document file to the cache.
 * 
 * @param {String} url Location
 * @param {String} cookie Token
 * 
 * @returns {String|Binary} Data
 */
export async function download(options) {
  var { filename, base64 } = options;
  const { url, cookie } = options;
  const headers = {};
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  const requestOptions = { headers };
  if (base64) {
    requestOptions.encoding = null;
  }
  const request = httpRequest(url, requestOptions);
  Cache.validate();
  return new Promise((resolve, reject) => {
    var fileStream;
    if (filename) {
      fileStream = fs.createWriteStream(`${Cache.cacheURI()}/${filename}`);
      request.pipe(fileStream);
    }
    const urlComponents = url.split("/");
    const docName = urlComponents[urlComponents.length - 1].split("%20").join(" ")
    request.on("complete", (response, data) => {
      let message = `Download complete: ${filename ? `${filename} ` : ""}(${docName})`;
      if (fileStream) {
        message += ` (${fileStream.bytesWritten})`;
      }
      console.log(message);
      resolve(base64 ? Buffer.from(data).toString("base64") : data);
    });
    request.on("error", (error) => {
      reject(error);
    });
  });
}


export function getFileExtension(string) {
  const components = string.split(".");
  return components[components.length - 1];
}


/**
 * @param {String} ua User agent
 * @returns {String|null} OS name
 */
export function getOSFromUserAgent(ua) {
  const oses = {
    "Mac OS X": "macOS",
    "iPhone OS": "iOS",
    "Windows NT": "Windows",
    "Android": "Android",
    "Linux": "Linux"
  };
  for (const os of Object.keys(oses)) {
    if (ua.includes(os)) {
      const name = oses[os];
      const version = ua.split(os)[1].split(";")[0].split(")")[0].trim().split("_").join(".");
      return {
        name, version
      }
    }
  }
  return { name: null, version: null };
}


/**
 * @param {String} ua User agent
 * @returns {String|null} Browser name
 */
export function getBrowserFromUserAgent(ua) {
  var tem, M = ua.match(/(postmanruntime|opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+(\.\d+)?(\.\d+)?)/i) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return {
      name: "IE",
      version: (tem[1] || null)
    };
  }
  if (M[1] === "Chrome") {
    tem = ua.match(/\bOPR|Edge\/(\d+)/)
    if (tem != null) {
      return {
        name: "Opera",
        version: tem[1]
      };
    }
  }
  M = M[2] ? [M[1], M[2]] : [null, null, "-?"];
  if (M[0] === "PostmanRuntime") {
    return {
      name: "Postman",
      version: M[1]
    };
  }
  if ((tem = ua.match(/version\/(.+?(?= ))/i)) != null) {
    M.splice(1, 1, tem[1]);
  }
  return {
    name: M[0],
    version: M[1]
  };
}