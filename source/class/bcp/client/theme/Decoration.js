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

qx.Theme.define("bcp.client.theme.Decoration",
{
  extend : qx.theme.indigo.Decoration,

  decorations :
  {
    "message-item" :
    {
      style :
      {
        widthBottom: 1,
        colorBottom : "gray",
        style : "dotted"
      }
    }
  }
});
