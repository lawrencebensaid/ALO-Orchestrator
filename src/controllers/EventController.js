import ical from "ical-generator";
import { MongoClient } from "mongodb";
import WindesheimAzure, { fetchCookie, getCookie } from "../foundation/WindesheimAzure";
import Task from "../foundation/Task";
import Job from "../foundation/Job";
import Event from "../models/Event";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class EventController {

  /**
   * 
   */
  constructor() {
    // Notify Orchestrator.
    const task = new Task({
      key: `event.all`,
      message: `Running event update (all)`,
      timeout: 1000 * 60 * 60 // Terminate Task after 60 minutes.
    }, async ({ update, succeed, fail }) => {

      try {
        const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
        const dbo = db.db(environment.dbmsName);
        const cookie = await getCookie();

        if (!cookie) {
          throw new Error("No cookie available at this time")
        }
        const groups = await new WindesheimAzure(cookie).fetchKlas();
        const startTime = new Date().valueOf() / 1000;
        var eventsDone = 0;
        var groupsDone = 0;

        if (!Array.isArray(groups)) {
          fail("Invalid format");
          return;
        }
        for (const group of groups) {
          const events = await new WindesheimAzure(cookie).fetchKlasLes(group.id);

          // Format
          if (!Array.isArray(events)) {
            console.log(`SKIPPING '${group.id}' DUE TO INVALID RESPONSE`);
            groupsDone += 1;
            continue;
          }
          events.forEach((row, i, array) => {
            array[i] = evaluateEvent(row).getDocument();
          });

          for (const event of events) {
            await dbo.collection("events").updateOne({ event_id: event.event_id }, { $set: event }, { upsert: true });
          }
          eventsDone += events.length;
          groupsDone += 1;
          const percentage = groupsDone / groups.length;
          const elapsed = new Date().valueOf() / 1000 - startTime;
          const estimation = elapsed / percentage;
          console.log(`Updated ${events.length} events. [ total: ${eventsDone}; progress: ${(percentage * 100).toFixed(2)}% (${groupsDone}/${groups.length}); estimation: ${(elapsed / 60).toFixed()}/${(estimation / 60).toFixed()} minutes ]`);
          update(percentage);
          await new Promise((resolve, reject) => { setTimeout(resolve, 250) });
        }
        db.close();
        succeed();
      } catch (error) {
        fail(error);
      }

    });

    const job = new Job({ task, key: `event.all`, interval: 1000 * 60 * 24 * 7 }); // Interval of 1 week.
    orchestrator.setJob(job, () => {

      const existingTask = orchestrator.getTask(`event.all`);
      const isUpdating = existingTask ? existingTask.isRunning() : false;

      if (isUpdating) {
        console.log(`An update is already in progress.`);
        return false;
      }

      return true;
    });

    job.trigger();
  }


  /**
   * @description 
   */
  async index({ }, resolve, reject) {
    try {
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);

      const events = await dbo.collection("events").find().toArray();
      db.close();

      // Format
      events.forEach((row, i, array) => {
        array[i] = {
          name: row.event_name,
          comments: row.event_comments,
          type: row.event_type,
          isOnline: row.event_online,
          isFreetime: row.event_freetime,
          courseName: row.event_course_name,
          courseCode: row.event_course_code,
          start: row.event_start,
          end: row.event_end,
          date: row.event_date,
          rooms: row.event_rooms,
          groups: row.event_groups,
          teachers: row.event_teachers
        }
      });

      resolve(events);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch events" });
    }
  }


  /**
   * @description 
   */
  async search({ params }, resolve, reject) {
    try {
      const { query } = params;
      const search = new RegExp(query, "i");
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);

      const events = await dbo.collection("events").find({ $or: [{ event_name: { $regex: search } }, { event_comments: { $regex: search } }] }).toArray();
      db.close();

      // Format
      events.forEach((row, i, array) => {
        array[i] = {
          name: row.event_name,
          comments: row.event_comments,
          type: row.event_type,
          isOnline: row.event_online,
          isFreetime: row.event_freetime,
          courseName: row.event_course_name,
          courseCode: row.event_course_code,
          start: row.event_start,
          end: row.event_end,
          date: row.event_date,
          rooms: row.event_rooms,
          groups: row.event_groups,
          teachers: row.event_teachers
        }
      });

      resolve(events);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch event" });
    }
  }


  /**
   * @description 
   */
  async byClass({ session, params }, resolve, reject) {
    try {
      const { username, password } = session;
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {

        // Fetch
        const cookie = await fetchCookie(username, password);
        const events = await new WindesheimAzure(cookie).fetchKlasLes(id);

        const ids = [];
        for (const event of events) {
          ids.push(event.id);
        }

        // Format
        events.forEach((row, i, array) => {
          array[i] = evaluateEvent(row).getDocument();
        });

        // Mongo
        for (const id of ids) {
          await dbo.collection("events").deleteOne({ event_id: id });
        }
        await dbo.collection("events").insertMany(events);
      }

      const events = await dbo.collection("events").find({ event_groups: id }).toArray();
      db.close();

      // Format
      events.forEach((row, i, array) => {
        array[i] = {
          name: row.event_name,
          comments: row.event_comments,
          type: row.event_type,
          isOnline: row.event_online,
          isFreetime: row.event_freetime,
          courseName: row.event_course_name,
          courseCode: row.event_course_code,
          start: row.event_start,
          end: row.event_end,
          date: row.event_date,
          rooms: row.event_rooms,
          groups: row.event_groups,
          teachers: row.event_teachers
        }
      });

      resolve(events);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch events" });
    }
  }


  /**
   * @description 
   */
  async ical({ params }, resolve, reject) {
    try {
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);

      // Mongo
      const events = await dbo.collection("events").find({ event_groups: id }).toArray();
      db.close();

      const calendar = ical({ domain: "windesheim.dev", name: id });

      // Format
      for (const event of events) {
        const teachers = Array.isArray(event.event_teachers) ? event.event_teachers : [];
        const htmlTeachers = [];
        for (const teacher of teachers) {
          htmlTeachers.push(`<i>${teacher}</i>`);
        }
        const roomsString = event.event_rooms.join(", ");
        const classesString = event.event_groups.join(", ");
        const teachersString = teachers.join(", ");
        const htmlTeachersString = htmlTeachers.join(", ");
        const eventData = {
          start: new Date(event.event_start * 1000),
          end: new Date(event.event_end * 1000),
          summary: event.event_course_name || event.event_description || "",
          description: `${event.event_comments}${event.event_course_code ? `\n\nCourse: ${event.event_course_code}` : ""}\n\nTeachers: ${teachersString || "-"}\n\nClasses: ${classesString || "-"}\n\nComments: ${event.event_comments || "-"}`,
          htmlDescription: `<html><body>${event.event_comments}${event.event_course_code ? `\n\n<b>Course:</b> ${event.event_course_code}` : ""}\n\n<b>Teachers:</b> ${htmlTeachersString || "-"}\n\n<b>Classes:</b> ${classesString || "-"}\n\n<b>Comments:</b> ${event.event_comments || "-"}</body></html>`
        };
        if (roomsString) {
          eventData.location = roomsString
        }
        calendar.createEvent(eventData);
      }

      resolve({ calendar });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch events" });
    }
  }

}


export default EventController;


const ignores = ["-"];

const types = {
  "assessment": "assessment",
  "beoordeling": "assessment",
  "coaching": "coaching",
  "coaching/begeleiding": "coaching",
  "college": "lecture",
  "extern": "external",
  "excursie": "excursion",
  "evenement/excursie": "excursion",
  "feedback/terugkoppeling": "feedback",
  "gastcollege": "guestLecture",
  "hoorcollege": "lecture",
  "instructie": "instruction",
  "introductie": "introduction",
  "introductiecollege": "lecture",
  "intervisie": "intervision",
  "kick off": "kickoff",
  "leerplein": "leerplein",
  "masterclass": "masterclass",
  "onbegeleid werken": "workUnaccompanied",
  "opstart/kick-off": "kickoff",
  "overig": "other",
  "project": "project",
  "projectondersteuning": "project",
  "practicum": "practical",
  "presentaties": "presentations",
  "presentatie": "presentations",
  "responsiecollege": "responseLecture",
  "spreekuur": "consultation",
  "tentamen": "exam",
  "vaardighedentraining": "skillsTraining",
  "voorlichting": "counselling",
  "werkcollege": "seminar",
  "workshop": "workshop"
};

const affixes = ["ter", "van der", "van", "de"];

/**
 * @description Factory for the Event model.
 * 
 * @param {Object} event Unstructured event data.
 * 
 * @return {Event}
 */
function evaluateEvent(event) {
  const rooms = event.lokaal.split(";").filter((item) => { return !!item });
  const activity = event.leeractiviteit.toLowerCase();
  const isFreetime = activity.includes("collegeluw") || activity.includes("kerstvakantie");
  const isOnline = (event.lokaal || "").toLowerCase().includes("online") || (rooms.length <= 0 && activity.includes("online"));
  const descriptionComponents = event.leeractiviteit.split(" ,");
  const commentsComponents = event.commentaar.split(" ,");
  for (const index in descriptionComponents) {
    descriptionComponents[index] = descriptionComponents[index].trim();
    if (!descriptionComponents[index]) descriptionComponents.splice(index, 1);
  }
  for (const index in commentsComponents) {
    commentsComponents[index] = commentsComponents[index].trim();
    if (!commentsComponents[index]) commentsComponents.splice(index, 1);
  }
  const typeNote = descriptionComponents.length > 1 ? descriptionComponents.pop().toLowerCase() : "overig";
  const type = typeNote.includes("tentamen ") ? types["tentamen"] : types.hasOwnProperty(typeNote) ? types[typeNote] : null;
  const start = Math.round((event.starttijd) / 1000) - 7200;
  const end = Math.round((event.eindtijd) / 1000) - 7200;
  const date = Math.round(new Date(event.roosterdatum).valueOf() / 1000); // We already have the 'start' and 'end' datetime. Do we really need the 'date' too???
  if (!types.hasOwnProperty(typeNote) && !ignores.includes(typeNote)) { // Warning in case we missed a type.
    console.log(`UNDEFINED EVENT TYPE: '${typeNote}'`);
    descriptionComponents.push(typeNote);
  }
  const teachers = Array.isArray(event.docentnamen) ? event.docentnamen : [];
  for (const index in teachers) {
    const raw = teachers[index];
    const components = raw.split(", ");
    const affix = components[components.length - 1];
    const nameComponents = components[0].split(" ");
    if (affixes.includes(affix)) {
      nameComponents.splice(1, 0, affix);
    }
    var characters = "";
    for (const character of nameComponents[0]) {
      if (character === ".") continue;
      characters += `${character}.`;
    }
    nameComponents[0] = characters;
    teachers[index] = nameComponents.join(" ");
  }

  return new Event(event.id, descriptionComponents.join(", "), commentsComponents.join(", "), type, isOnline, isFreetime, event.vaknaam, event.vakcode, start, end, date, rooms, event.groepcode.split(", "), teachers);
}