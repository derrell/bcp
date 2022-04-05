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
qx.Theme.define("bcp.client.theme.Appearance",
{
  extend : qx.theme.indigo.Appearance, // indigo.Appearance extends Simple's

  appearances :
  {
    "treevirtual-folder" :
    {
      style : function(states)
      {
        return {
          icon : (states.opened ? "static/blank.gif" : "static/blank.gif"),
          opacity : states.drag ? 0.5 : undefined
        };
      }
    },

    "treevirtual-file" :
    {
      include : "treevirtual-folder",
      alias : "treevirtual-folder",

      style : function(states)
      {
        return {
          icon : "static/blank.gif",
          opacity : states.drag ? 0.5 : undefined
        };
      }
    }
  }
});
