
/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Event {

  /**
   * @param {String} id
   * @param {String} name
   * @param {String} comments
   * @param {String} type
   * @param {Bool} isOnline
   * @param {Bool} isFreetime
   * @param {String} courseName
   * @param {String} courseCode
   * @param {Number} start
   * @param {Number} end
   * @param {Number} date
   * @param {[String]} rooms
   * @param {[String]} groups
   * @param {[String]} teachers
   * 
   */
  constructor(id, name, comments, type, isOnline, isFreetime, courseName, courseCode, start, end, date, rooms, groups, teachers) {
    this.id = id;
    this.name = name || null;
    this.comments = comments || null;
    this.type = type || null;
    this.isOnline = isOnline == true;
    this.isFreetime = isFreetime == true;
    this.courseName = courseName || null;
    this.courseCode = courseCode || null;
    this.start = start >= 0 ? start : null;
    this.end = end >= 0 ? end : null;
    this.date = date >= 0 ? date : null;
    this.rooms = Array.isArray(rooms) && rooms[0] ? rooms : [];
    this.groups = Array.isArray(groups) ? groups : [];
    this.teachers = Array.isArray(teachers) ? teachers : [];
  }


  /**
   * @return {Object} Structure used inside MongoDB.
   */
  getDocument() {
    return {
      event_id: this.id,
      event_name: this.name,
      event_comments: this.comments,
      event_type: this.type,
      event_online: this.isOnline,
      event_freetime: this.isFreetime,
      event_course_name: this.courseName,
      event_course_code: this.courseCode,
      event_start: this.start,
      event_end: this.end,
      event_date: this.date,
      event_rooms: this.rooms,
      event_groups: this.groups,
      event_teachers: this.teachers
    };
  }


  /**
   * @return {Object} Structure & format.
   */
  get() {
    return {
      id: this.id,
      name: this.name,
      comments: this.comments,
      type: this.type,
      isOnline: this.isOnline,
      isFreetime: this.isFreetime,
      courseName: this.courseName,
      courseCode: this.courseCode,
      start: this.start,
      end: this.end,
      date: this.date,
      rooms: this.rooms,
      groups: this.groups,
      teachers: this.teachers
    };
  }


  /**
   * @description Saves the object to the database.
   */
  save() {
    
  }

}

export default Event;