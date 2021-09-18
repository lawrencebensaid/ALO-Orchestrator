import fetchCourseFiles from "../fetchCourseFiles";
import { MongoClient } from "mongodb";
import WindesheimAzure, { fetchCookie, getCookie } from "../foundation/WindesheimAzure";
import Cache from "../foundation/Cache";
import ELO from "../foundation/ELO";
import fs from "fs";
import Course from "../models/Course";
import Task from "../foundation/Task";
import Job from "../foundation/Job";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class CourseController {

  /**
   * 
   */
  constructor() {
    // Notify Orchestrator.
    const task = new Task({
      key: `course.all`,
      message: `Running course update (all)`,
      timeout: 1000 * 60 * 60 // Terminate Task after 60 minutes.
    }, async ({ update, succeed, fail }) => {

      try {
        const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
        const dbo = db.db(environment.dbmsName);
        const cookie = await getCookie();

        if (!cookie) {
          throw new Error("No cookie available at this time")
        }
        const courses = await dbo.collection("courses").find().toArray();
        const courseIDs = [];
        for (const course of courses) {
          if (course.course_code) courseIDs.push(course.course_code);
        }
        const startTime = new Date().valueOf() / 1000;
        var coursesDone = 0;

        if (!Array.isArray(courses)) {
          fail("Invalid format");
          return;
        }
        for (const courseId of courseIDs) {
          var course = await new WindesheimAzure(cookie).fetchCourses(courseId);

          // Format
          if (!course) {
            console.log(`SKIPPING '${courseId}' DUE TO INVALID RESPONSE`);
            coursesDone += 1;
            continue;
          }
          
          course = {
            course_code: course.abbr,
            course_name: course.name,
            course_points: course.ects,
            course_description: course.description
          };

          await dbo.collection("courses").updateOne({ course_code: course.course_code }, { $set: course }, { upsert: true });
          coursesDone += 1;
          const percentage = coursesDone / courseIDs.length;
          const elapsed = new Date().valueOf() / 1000 - startTime;
          const estimation = elapsed / percentage;
          console.log(`Updated course '${courseId}'. [ total: ${coursesDone}; progress: ${(percentage * 100).toFixed(2)}% (${coursesDone}/${courseIDs.length}); estimation: ${(elapsed / 60).toFixed()}/${(estimation / 60).toFixed()} minutes ]`);
          update(percentage);
          await new Promise((resolve, reject) => { setTimeout(resolve, 250) });
        }
        db.close();
        succeed();
      } catch (error) {
        fail(error);
      }

    });

    const job = new Job({ task, key: `course.all`, interval: 1000 * 60 * 24 * 7 }); // Interval of 1 week.
    orchestrator.setJob(job, () => {

      const existingTask = orchestrator.getTask(`course.all`);
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
   * @description Course index
   */
  async myIndex({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);

      const user = await dbo.collection("users").findOne({ user_code: username.split("@")[0] });
      const courses = [];
      for (const id of user.courses || []) {
        try {
          const course = await dbo.collection("courses").findOne({ course_code: id });
          courses.push({
            code: course.course_code,
            name: course.course_name,
            points: course.course_points,
            description: course.course_description,
            canUpdate: !!course.course_eloid,
            thumbnail: `/course/${course.course_code}/thumbnail`,
            filemap: course.course_filemap
          });
        } catch (error) { }
      }

      resolve(courses);

      try {
        const metadata = await new ELO(username, password).fetchCourseMetadata();
        for (const data of metadata) {
          await dbo.collection("courses").updateOne({ course_code: data.code }, {
            $set: { course_eloid: data.id, course_thumbnail: data.data }
          }, { upsert: true });
        }
      } catch (error) {
        console.log(error);
      }

    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Courses" });
    }
  }


  /**
   * @description Specific course
   */
  async myShow({ session, params }, resolve, reject) {
    try {
      const { username, password } = session;
      const id = params.id;
      if (!id) {
        reject({ message: "Invalid 'id'" });
        return;
      }
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const user = await dbo.collection("users").findOne({ user_code: username.split("@")[0] });
      if (!user.courses) {
        reject({ message: `Course '${id}' has not been cached yet.` });
        return;
      }
      if (user.courses.includes(id) != true) {
        reject({ message: `You don't have access to Course '${id}'.` });
        return;
      }
      const course = await dbo.collection("courses").findOne({ course_code: id });
      if (!course) {
        reject({ message: `Course '${id}' not found at this time.` });
      }

      resolve({
        code: course.course_code,
        name: course.course_name,
        points: course.course_points,
        description: course.course_description,
        thumbnail: `/course/${course.course_code}/thumbnail`,
        filemap: course.course_filemap
      });

      try {
        if (course.course_eloid) {
          console.log("Fetching for:", course.course_eloid);
          const filemap = (await fetchCourseFiles(username, password, course.course_eloid)).filemap;
          if (Array.isArray(filemap)) {
            await dbo.collection("courses").updateOne({ course_code: id }, { $set: { course_filemap: filemap } }, { upsert: true });
          }
        } else {
          console.log("Course has no ELO id available")
        }
      } catch (error) {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch course" });
    }
  }


  /**
   * @description 
   */
  async index({ }, resolve, reject) {
    try {
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const courses = await dbo.collection("courses").find().toArray();
      db.close();

      // Format
      courses.forEach((row, i, array) => {
        array[i] = {
          code: row.course_code,
          name: row.course_name,
          points: row.course_points,
          description: row.course_description,
          thumbnail: `/course/${row.course_code}/thumbnail`
        }
      });

      resolve(courses);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Courses" });
    }
  }


  /**
   * @description 
   */
  async show({ session, params }, resolve, reject) {
    try {
      const { username, password } = session;
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {
        try {
          const cookie = await fetchCookie(username, password);
          const course = await new WindesheimAzure(cookie).fetchCourses(id);
          await dbo.collection("courses").updateOne({ course_code: course.abbr }, {
            $set: {
              course_code: course.abbr,
              course_name: course.name,
              course_points: course.ects,
              course_description: course.description
            }
          }, { upsert: true });
        } catch (error) {
          console.log(error);
        }
      }
      const course = await dbo.collection("courses").findOne({ course_code: id });
      db.close();

      if (!course) {
        reject({ message: `Course '${id}' does not exist` });
        return;
      }

      resolve({
        code: course.course_code,
        name: course.course_name,
        points: course.course_points,
        description: course.course_description,
        thumbnail: `/course/${course.course_code}/thumbnail`
      });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Courses" });
    }
  }


  /**
   * @description Responds with a image file.
   */
  async thumbnail({ response, params }, resolve, reject) {
    const { id } = params;

    // Mongo
    const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
    const dbo = db.db(environment.dbmsName);
    const course = await dbo.collection("courses").findOne({ course_code: id });
    
    db.close();

    Cache.validate();
    const filename = `${course._id}`;
    const download = `${Cache.cacheURI()}/${course._id}.jpg`;
    if (course.course_thumbnail) {
      fs.writeFileSync(download, course.course_thumbnail, "base64");
      resolve({ filename, download });
    } else {
      response.status(404);
      reject({ message: "Course has no thumbnail" });
    }
  }

}


export default CourseController;