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

qx.Class.define("bcp.server.TimeConversion",
{
  type : "static",

  statics :
  {
    /**
     * Provide a consistently formatted 24-hour time
     *
     * @param timestamp {Date}
     *  The timestamp to be formatted
     *
     * @return {String}
     *  The time, formatted as HH:MM
     */
    formatTime24(timestamp)
    {
      return (
        ("0" + timestamp.getHours()).substr(-2) +
          ":" +
          ("0" + timestamp.getMinutes()).substr(-2));
    },

    /**
     * Provide a consistently formatted 12-hour time
     *
     * @param timestamp {Date}
     *  The timestamp to be formatted
     *
     * @return {String}
     *  The time, formatted as H:MM ap
     */
    formatTime12(timestamp)
    {
      let             suffix;
      let             hours = timestamp.getHours();

      if (hours < 12)
      {
        suffix = " am";
      }
      else if (hours == 12)
      {
        suffix = " pm";
      }
      else
      {
        hours -= 12;
        suffix = " pm";
      }

      return (
        hours + ":" + ("0" + timestamp.getMinutes()).substr(-2) + suffix);
    }
  }
});
