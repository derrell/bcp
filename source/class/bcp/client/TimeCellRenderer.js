/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

qx.Class.define("bcp.client.TimeCellRenderer",
{
  extend : qx.ui.table.cellrenderer.Abstract,

  members :
  {
    // overridden
    _getContentHtml : function(cellInfo)
    {
      let             time = (cellInfo.value || "").split(":");

      // If no time, just leave blank
      if (cellInfo.value === null ||
          cellInfo.value === "" ||
          time.length === 0)
      {
        return "";
      }

      // Times before noon remain as is, with an "am" suffix
      if (time[0] <= 12)
      {
        return cellInfo.value + " am";
      }

      // Times after noon are converted to 12-hour format and get "pm" suffix
      time[0] -= 12;
      return time.join(":") + " pm";
    },


/*
    // overridden
    _getCellStyle : function(cellInfo)
    {
      return "text-align: center;";
    }
*/
  }
});
