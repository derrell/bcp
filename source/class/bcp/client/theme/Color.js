/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2021 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

/**
 * @asset(qx/decoration/Indigo/font/JosefinSlab-SemiBold.woff)
 * @asset(qx/decoration/Indigo/font/JosefinSlab-SemiBold.ttf)
 */
qx.Theme.define("bcp.client.theme.Color",
{
  extend : qx.theme.indigo.Color,
  
  colors :
  {
    "table-row-background-even" : "white",
    "table-row-background-odd" : [ 245, 245, 245 ],

    "search-failure" : [ 255, 175, 175 ]
  }
});
