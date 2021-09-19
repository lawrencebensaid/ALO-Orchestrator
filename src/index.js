import fs from "fs"
import express from "express"
import session from "express-session"
import bodyParser from "body-parser"
import Cache from "./foundation/Cache"
import Environment from "./foundation/Environment"
import Orchestrator from "./foundation/Orchestrator"
import WebSocket from "ws"
import { MongoClient } from "mongodb"
import { config } from "dotenv"
config();

const { env } = process;
const DB_NAME = env.DB_NAME;
global.environment = new Environment({
  secret: env.SECRET,
  debug: (env.DEBUG || "").toLowerCase() === "true",
  webDomain: env.WEB_DOMAIN,
  webHost: env.WEB_HOST,
  webPort: env.WEB_PORT,
  prodWebDomain: env.PROD_WEB_DOMAIN,
  devWebDomain: env.DEV_WEB_DOMAIN,
  dbmsName: env.DB_NAME,
  dbmsHost: env.DB_HOST,
  dbmsPort: env.DB_PORT,
  dbmsUser: env.DB_USER,
  dbmsPassword: env.DB_PASSWORD,
  dbmsRealm: env.DB_REALM || "mongodb"
});
global.orchestrator = new Orchestrator();

(async () => {
  console.log(`Connecting to MongoDB... (${environment.getDatabaseURI()})`);
  try {
    const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`MongoDB connection successful`);

    // Initialize database
    const dbo = db.db(DB_NAME);
    const collections = [];
    for (const collection of await dbo.listCollections().toArray()) {
      collections.push(collection.name);
    }

    if (!collections.includes("files")) {
      await dbo.createCollection("files");
    }
    await dbo.collection("files").dropIndexes();
    await dbo.collection("files").createIndex({ file_name: 1, file_directory: 1 }, { unique: true });


    if (!collections.includes("groups")) {
      await dbo.createCollection("groups");
    }
    await dbo.collection("groups").dropIndexes();
    await dbo.collection("groups").createIndex({ group_code: "text", group_name: "text" });
    await dbo.collection("groups").createIndex({ group_code: 1 }, { unique: true });


    if (!collections.includes("users")) {
      await dbo.createCollection("users");
    }
    await dbo.collection("users").dropIndexes();
    await dbo.collection("users").createIndex({ user_code: 1 }, { unique: true });


    if (!collections.includes("logins")) {
      await dbo.createCollection("logins");
    }
    await dbo.collection("logins").dropIndexes();
    await dbo.collection("logins").createIndex({ login_client_apn: 1 }, { unique: true, sparse: true });
    await dbo.collection("logins").createIndex({ login_rsa_key: 1 }, { unique: true });
    await dbo.collection("logins").createIndex({ login_token: 1 }, { unique: true });


    if (!collections.includes("courses")) {
      await dbo.createCollection("courses");
    }
    await dbo.collection("courses").dropIndexes();
    await dbo.collection("courses").createIndex({ course_code: 1 }, { unique: true });


    if (!collections.includes("grades")) {
      await dbo.createCollection("grades");
    }
    await dbo.collection("grades").dropIndexes();


    if (!collections.includes("events")) {
      await dbo.createCollection("events");
    }
    await dbo.collection("events").dropIndexes();
    await dbo.collection("events").createIndex({ event_id: 1 }, { unique: true });
    await dbo.collection("events").createIndex({ event_name: "text", event_comments: "text" });


    if (!collections.includes("rooms")) {
      await dbo.createCollection("rooms");
    }
    await dbo.collection("rooms").dropIndexes();
    await dbo.collection("rooms").createIndex({ room_code: 1 }, { unique: true });


    if (!collections.includes("studies")) {
      await dbo.createCollection("studies");
    }
    await dbo.collection("studies").dropIndexes();
    await dbo.collection("studies").createIndex({ study_code: 1 }, { unique: true });

    db.close();
    console.log(`Database structure validated`);
  } catch (error) {
    console.log("ERROR: MongoDB connection failed:", error);
  }
})();

const app = express();

app.use(bodyParser.json())

app.use(session({
  secret: environment.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

const directory = Cache.cacheURI();
if (!fs.existsSync(directory)) fs.mkdirSync(directory);
app.use("/files", express.static(directory));


// Router
const routing = JSON.parse(fs.readFileSync("src/routing.json"));
const endpoints = Object.keys(routing["endpoints"]);

for (const endpoint of endpoints) {
  const middleware = [];
  const route = {
    method: "GET",
    path: null,
    controller: null,
    middleware: [],
    handler: null
  }
  const request = endpoint.split(" ");
  const flow = routing.endpoints[endpoint];
  route.method = request[0].toUpperCase();
  route.path = request[1];
  if (typeof flow === "object") {
    const destination = Object.keys(flow)[0];
    const components = destination.split(".");
    route.controller = components[0];
    route.handler = components[1];
    const middleware = flow[destination];
    for (const ware of middleware) {
      route.middleware.push(ware);
    }
  } else if (typeof flow === "string") {
    const components = flow.split(".");
    route.controller = components[0];
    route.handler = components[1];
  }

  // Collect middleware
  for (const ware of route.middleware) {
    const execution = require(`./middleware/${ware}.js`).default;
    middleware.push(new execution().middleware);
  }

  app[route.method.toLowerCase()](route.path, middleware, async (request, response) => {
    try {
      const file = `${__dirname}/controllers/${route.controller}.js`;
      if (!fs.existsSync(file)) {
        console.log(`Missing controller: "${file}"`);
        throw { status: 500, message: "Endpoint handler missing" };
      }
      const controller = require(file).default;
      const instance = new controller();
      const result = await new Promise(async (resolve, reject) => {
        const context = { request, response, session: request.session, params: request.params, query: request.query, body: request.body };
        instance[route.handler](context, resolve, reject);
      });

      if (result.calendar) {
        result.calendar.serve(response);
      } else if (result.download) {
        const urlComponents = result.download.split("/");
        const filename = result.filename || urlComponents[urlComponents.length - 1]
        response.download(result.download, filename);
      } else {
        response.json(result);
      }
    } catch (error) {
      const { status, message } = error;
      if (error instanceof Error) {
        console.log(error);
      }
      response.status(status || 400);
      response.json({ message });
    }
  });
}

const { webHost: host, webPort: port } = environment;
const server = app.listen(port, host, () => {
  console.log(`Webserver running on ${host}:${port}`);
});


const wsServer = new WebSocket.Server({ noServer: true });

let sockets = [];
wsServer.on("connection", (socket) => {
  sockets.push(socket);
  console.log("connection");

  socket.on("close", () => {
    console.log("close");
    sockets = sockets.filter(s => s !== socket);
  });
});

orchestrator.on("update", (data) => {
  console.log("update", data);
  sockets.forEach(s => s.send(Buffer.from(JSON.stringify(data))));
});

server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, socket => {
    wsServer.emit("connection", socket, request);
  });
});