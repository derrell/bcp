/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2022 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
qx.Class.define("bcp.client.CenterCellRenderer",
{
  extend : qx.ui.table.cellrenderer.Abstract,

  members :
  {
    // overridden
    _getCellStyle : function(cellInfo)
    {
      return "text-align: center;";
    }
  }
});
