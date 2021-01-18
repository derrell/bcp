/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2021 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

qx.Class.define("bcp.server.Cron",
{
  type   : "singleton",
  extend : qx.core.Object,

  statics :
  {
    REMINDER_DAYS_BEFORE : 2,

    CRON_JOBS :
    {
    }
  },

  members :
  {
    _db : null,

    /**
     * Periodically scan for and email reminders of upcoming
     * appointments. Also send a confirmation when an appointment is
     * scheduled.
     *
     * @param app {Express}
     *   The Express app object
     */
    init(app, bIsHttps, server, db)
    {
      // Save the database handle
      this._db = db;

      setInterval(
        () =>
        {
        },
        60000);
    },

    _sendReminders()
    {
      let             data = {};

      return Promise.resolve()
        // Get the list of families to whom we should send email reminders
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT",
                "    f.family_name AS family_name,",
                "    dp.start_date AS start_date,",
                "    f.appt_day AS appt_day,",
                "    f.appt_time AS appt_time,",
                "    c.email AS email",
                "  FROM Fulfillment f",
                "  LEFT OUTER JOIN Reminder r",
                "    ON     r.distribution = f.distribution",
                "       AND r.family_name = f.family_name",
                "  LEFT OUTER JOIN Client c",
                "    ON     c.family_name = f.family_name",
                "  LEFT OUTER JOIN DistributionPeriod dp",
                "    ON     dp.start_date = f.distribution",
                "  WHERE NOT fulfilled",
                "   AND NOT COALESCE(reminder_sent, 0)",
                "   AND start_date >= $todayDate",
                "  ORDER BY start_date, appt_day, appt_time;"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            let             todayDate;
            let             now = new Date();

            todayDate =
              [
                now.getFullYear(),
                ("0" + (now.getMonth() + 1)).substr(-2),
                ("0" + now.getDate()).substr(-2)
              ].join("-");

            return stmt.all(
              {
                $todayDate : todayDate
              });
          })
        .then((result) => data.appointments = result)

        // Get the reminder email content
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT value",
                "  FROM KeyValueStore",
                "  WHERE key = 'appointment_reminder_text';"
              ].join(" "));
          })
        .then((stmt) => stmt.all({}))
        .then((result) => data.message = result[0].value)

        // Send email to each family
        .then(
          () =>
          {
            data.appointments.forEach(
              (appointment) =>
              {
                let             appointmentTime;
                let             now = new Date();

                // Get the appointment time as a date object
                appointmentTime = this._getAppointmentTime(appointment);

                // Figure out if it's time to issue a reminder yet
                if (now.getTime() <
                    appointmentTime.getTime() -
                    (1000 * 60 *  60 * 24 *
                     this.constructor.REMINDER_BEFORE_DAYS))
                {
                  // It's still too early.
                  return;
                }

                if (appointment.email)
                {
                  appointment.email = appointment.email.replace(/#.*/, "");
console.log(`Would be sending to ${appointment.email}`);
                  bcp.server.Email.getInstance().sendEmail(
                    "derrell.lipman@gmail.com",
                    "Upcoming appointment at Billerica Community Pantry",
                    this._editContent(data.message, appointment),
                    true,
                    (e) =>
                    {
                      if (! e)
                      {
                        Promise.resolve()
                          .then(
                            () =>
                            {
                              return this._db.prepare(
                                [
                                  "REPLACE INTO Reminder",
                                  "    (",
                                  "      distribution,",
                                  "      family_name,",
                                  "      reminder_sent",
                                  "    )",
                                  "  VALUES",
                                  "    (",
                                  "      $distribution,",
                                  "      $familyName,",
                                  "      1",
                                  "    );"
                                ].join(" "));
                            })
                          .then(
                            (stmt) =>
                            {
                              return stmt.all(
                                {
                                  $distribution : appointment.start_date,
                                  $familyName   : appointment.family_name
                                });
                            })
                          .catch(
                            (e) =>
                            {
                              console.warn("Error saving Reminder Sent", e);
                            });
                      }
                    });
                }
              });
          })
        .catch((e) =>
          {
            console.warn("Error retrieving reminder recipients", e);
          });
    },

    /**
     * Edit the content of an email message to be sent, by replacing marker
     * text with text pertaining to an appointment.
     *
     * Markers:
     * - %APPT%
     *   Replaced by the appointment time, pretty-printed
     *
     * @param inMessage {String}
     *   The message to be sent (including markers)
     *
     * @param appointment {Map}
     *   Map containing the following members:
     *   - family_name
     *   - start_date (e.g., "2021-01-18")
     *   - appt_day (1-relative)
     *   - appt_time (24-hour time in HH:MM format)
     *   - email
     *
     * @return {String}
     *   The input string with markers replaced with values formatted from the
     *   appointment map.
     */
    _editContent(inMessage, appointment)
    {
      let             date;
      let             outMessage;
      let             apptFormatted;
      const           day =
        [
          "Sunday", "Monday", "Tuesday", "Wednesday",
          "Thursday", "Friday", "Saturday"
        ];
      const           month =
        [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];

      // Get a formatted time of the appointment.
      date = this._getAppointmentTime(appointment);

      apptFormatted =
        [
          day[date.getDay()],
          ", ",
          month[date.getMonth()],
          " ",
          date.getDate(),
          ", ",
          date.getFullYear(),
          " at ",
          bcp.server.TimeConversion.formatTime12(date)
        ].join("");

      // Fill in the appointment time. Highlight it.
      outMessage = inMessage.replace(
        /%APPT%/g,
        "<span style='font-weight: bold;'>" + apptFormatted + "</span>");

      // We're using HTML, so replace newlines with paragraph markers
      outMessage = outMessage.replace(/\n/g, "<p>");

      // Give 'em what they came for!
      return outMessage.trim();
    },

    /**
     * Create a Date object that represents the appointment time
     *
     * @param appointment {Map}
     *   Map which includes start_date, appt_day, and appt_time fields
     *
     * @return {Date}
     *   The appointment time converted to a Date object
     */
    _getAppointmentTime(appointment)
    {
      let             date;
      let             timestamp;

      timestamp =
        [
          appointment.start_date, // date as YYYY-MM-DD
          "T",                    // date/time separator
          appointment.appt_time,  // time as HH:MM
          ":00"                   // seconds
        ].join("");
      date = new Date(timestamp);

      // Add to it the day offset. (Subtract one so day 1 is same as date)
      date =
        new Date(date.getTime() +
                 (appointment.appt_day - 1) * (1000 * 60 * 60 * 24));

      return date;
    }
  }
});
