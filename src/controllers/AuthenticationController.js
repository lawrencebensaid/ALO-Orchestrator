import fs from "fs";
import jwt from "jsonwebtoken";
import fetchInfo from "../fetchInfo";
import { MongoClient, ObjectId } from "mongodb";
import Cache from "../foundation/Cache";
import { getBrowserFromUserAgent, getOSFromUserAgent } from "../foundation/Util";
import WindesheimAzure, { fetchPersonalCookie } from "../foundation/WindesheimAzure";



const STUDY_TYPE = {
  "opleiding": "education",
  "cursus": "course"
}

const STUDY_FORM = {
  "voltijd": "fulltime",
  "deeltijd": "parttime",
  "duaal": "dual",
  "regulier": "regular"
}

const STUDY_STATUS = {
  "ingeschreven": "enrolled",
}

const ENTOLLMENT_STUDY_STATUS = {
  "studerend": "studying",
}

const STUDY_PHASE = {
  "propedeuse": "propaedeutic",
  "hoofdfase": "main"
}

const ENROLLMENT_STATUS = {
  "definitief": "definitive",
}

/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class AuthenticationController {

  /**
   * @description Responds with API infromation & status.
   */
  async status({ request, query }, resolve) {
    const info = JSON.parse(fs.readFileSync("package.json"));
    const routes = JSON.parse(fs.readFileSync("src/routing.json"));
    const paths = Object.keys(routes["endpoints"]);
    const humanReadable = !parseInt(query["dataOnly"]);
    const service = {};
    for (const sibling of environment.getSiblings()) {
      service[sibling.name] = `${request.protocol}://` + environment.getSibling(sibling.name).webDomain;
    }
    const response = {
      message: "The service is functioning normally",
      description: info.description,
      version: info.version,
      clients: {
        "AppStore (TestFlight)": "https://testflight.apple.com/join/2AV0dYfv"
      },
      service,
      endpoints: paths,
      orchestrator: orchestrator.description({ humanReadable })
    };
    resolve(response);
  }


  /**
   * @description 
   */
  async myProfile({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const cookie = await fetchPersonalCookie(username, password);

      const study = await new WindesheimAzure(cookie).fetchPersonsStudy(username);
      const info = await new WindesheimAzure(cookie).fetchPersons(username);

      const progress = study[0].WH_studyProgress;
      const progressStatus = STUDY_STATUS[progress.status.toLowerCase()] || progress.status;
      const profile = {
        id: progress.studentid,
        status: progressStatus,
        progress: {
          active: progress.active == true,
          pointsAchieved: {
            total: progress.ectsBehaald,
            propaedeutic: progress.ectsBehaaldPropedeuse,
            main: progress.ectsBehaaldHoofdfase
          },
          pointsTotal: {
            total: progress.ectsTeBehalen,
            propaedeutic: progress.ectsTeBehalenPropedeuse,
            main: progress.ectsTeBehalenHoofdfase,
            bsa: progress.ectsTeBehalenBSA,
          }
        },
        enrollments: info.WH_inschrijving
      };

      for (const index in profile.enrollments) {
        const enrollment = profile.enrollments[index];
        const study = enrollment.onderwijsproduct;
        const form = STUDY_FORM[study.crohovorm.toLowerCase()] || form;
        const type = STUDY_TYPE[study.onderwijsproducttype.toLowerCase()] || type;
        const studyStatus = ENTOLLMENT_STUDY_STATUS[enrollment.studiestatus.toLowerCase()] || enrollment.studiestatus;
        const studyPhase = STUDY_PHASE[enrollment.studiefase.toLowerCase()] || enrollment.studiefase;
        const enrollmentStatus = ENROLLMENT_STATUS[enrollment.statusaanmelding.toLowerCase()] || enrollment.statusaanmelding;
        profile.enrollments[index] = {
          id: enrollment.id,
          location: enrollment.lesplaats,
          category: enrollment.categorie,
          cohort: enrollment.curriculumcohort,
          startDate: Math.floor(new Date(enrollment.instroomdatum).valueOf() / 1000),
          enrollmentDate: Math.floor(new Date(enrollment.aanmelddatum).valueOf() / 1000),
          enrollmentSpecification: enrollment.inschrijfspecificatie,
          enrollmentStatus,
          studyStatus,
          studyPhase,
          study: {
            code: study.id,
            description: study.onderwijsproductnaam,
            type: type,
            form: form,
            isat: study.isatcode,
          }
        }
      }

      resolve(profile);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Profile" });
    }
  }


  /**
   * @description 
   */
  async myLogin({ session }, resolve, reject) {
    try {
      const { username } = session;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const logins = await dbo.collection("logins").find({ user_code: username, deleted_at: null }).toArray();
      db.close();

      // Format
      for (const index in logins) {
        const login = logins[index];
        const isCurrent = session.token === login.login_token;
        logins[index] = {
          id: login._id,
          device: login.login_device,
          deviceName: login.login_device_name,
          deviceVersion: login.login_device_version,
          client: login.login_client,
          clientVersion: login.login_client_version,
          os: login.login_os,
          osVersion: login.login_os_version,
          isCurrent,
          lastSignin: login.login_last_signin,
          lastSeen: login.login_last_seen,
          deletedAt: login.deleted_at || null,
          createdAt: login.created_at,
        }
      }

      resolve(logins);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Classes" });
    }
  }


  /**
   * @description 
   */
  async myLoginDelete({ session, params }, resolve, reject) {
    try {
      const { username } = session;
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      await dbo.collection("logins").updateOne({ _id: new ObjectId(id), user_code: username }, {
        $set: { deleted_at: (new Date().valueOf() / 1000).toFixed() }
      });
      db.close();

      resolve({ message: "Login invalidated" });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to invalidate Login" });
    }
  }


  /**
   * @description Responds with a file.
   */
  async resourceIndex({ response }, resolve, reject) {

    // Mongo
    const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
    const dbo = db.db(environment.dbmsName);
    const files = await dbo.collection("files").find().toArray();
    db.close();

    const resources = [];
    for (const file of files) {
      resources.push({
        id: file._id,
        name: file.file_name,
        directory: file.file_directory,
        extension: file.file_extension,
        size: file.file_size,
        course: {
          code: file.course_code
        }
      });
    }
    resolve(resources);
  }


  /**
   * @description Responds with a file.
   */
  async file({ params, response }, resolve, reject) {
    const { id } = params;

    // Mongo
    const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
    const dbo = db.db(environment.dbmsName);
    const file = await dbo.collection("files").findOne({ _id: new ObjectId(id) });
    db.close();

    if (!file) {
      reject({ message: `File '${id}' was not found.` });
      return;
    }

    // const data = file.file_data;
    const filename = file.file_name;
    Cache.validate();
    const download = `${Cache.cacheURI()}/${file._id}.${file.file_extension}`;
    response.set("Content-Type", `application/${file.file_extension}`);
    resolve({ filename, download });
  }


  /**
   * @description Authenticates with ELO.
   */
  async authenticate({
    response,
    request,
    body: {
      username,
      password,
      publicKey,
      device,
      deviceName,
      deviceVersion,
      client,
      clientAPN,
      clientVersion,
      os,
      osVersion,
      origin
    }
  }, resolve, reject) {

    if (!publicKey) {
      reject({ message: "'publicKey' missing" });
      return;
    }
    if (!username) {
      reject({ message: "'username' missing" });
      return;
    }
    if (!password) {
      reject({ message: "'password' missing" });
      return;
    }

    try {
      const code = username.split("@")[0].toLowerCase();
      await fetchInfo(code, password); // Authentication
      const token = jwt.sign({ data: { username, password } }, environment.secret);
      const now = Math.round(new Date().valueOf() / 1000);
      const agent = request.headers["user-agent"];
      const agentOS = getBrowserFromUserAgent(agent);
      const agentBrowser = getBrowserFromUserAgent(agent);

      // Mongo
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (!await dbo.collection("users").findOne({ user_code: code })) {
        await dbo.collection("users").insertOne({
          user_code: code,
          user_cookies: [],
          created_at: now
        });
      }

      const login = {
        user_code: code,
        login_device: device,
        login_device_name: deviceName,
        login_device_version: deviceVersion,
        login_client: agentBrowser.name || client,
        login_client_version: agentBrowser.version || clientVersion,
        login_os: agentOS.name || os,
        login_os_version: agentOS.version || osVersion,
        login_origin: origin,
        login_agent: agent,
        login_token: token,
        login_rsa_key: publicKey,
        login_last_signin: now,
        login_last_seen: now,
        deleted_at: null,
        created_at: now
      };
      if (clientAPN) {
        login.login_client_apn = clientAPN;
      }

      // Please take another look at this. What happens if someone finds out a user's publicKey and abuses it?
      await dbo.collection("logins").updateOne({ login_rsa_key: publicKey }, {
        $set: login
      }, { upsert: true });
      db.close();

      resolve({ token });
    } catch (error) {
      if (typeof error === "string") {
        response.status(403);
        reject({ message: error });
      } else {
        console.log(error);
        reject({ message: "Unable to authenticate at this time." });
      }
    }
  }

}


export default AuthenticationController;