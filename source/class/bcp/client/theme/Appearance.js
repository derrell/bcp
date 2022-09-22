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
    },

    "tree-folder-sig":
    {
      style(states)
      {
        var backgroundColor;
        if (states.selected)
        {
          backgroundColor = "background-selected";
          if (states.disabled)
          {
            backgroundColor += "-disabled";
          }
        }
        return {
          padding: [2, 8, 2, 5],
          icon: states.opened
            ? "icon/16/places/folder-open.png"
            : "icon/16/places/folder.png",
          backgroundColor: backgroundColor,
          iconOpened: "icon/16/places/folder-open.png",
          opacity: states.drag ? 0.5 : undefined
        };
      }
    },

    "tree-folder-sig/open":
    {
      include: "image",
      style(states)
      {
        return {
          source: states.opened
            ? "bcp/client/decoration/icons8-minus-26.png"
            : "bcp/client/decoration/icons8-plus-26.png"
        };
      }
    },

    "tree-folder-sig/icon":
    {
      include: "image",
      style(states)
      {
        return {
          padding: [0, 4, 0, 0]
        };
      }
    },

    "tree-folder-sig/label":
    {
      style(states)
      {
        return {
          padding: [1, 2],
          textColor:
            states.selected && !states.disabled ? "text-selected" : undefined
        };
      }
    }
  }
});
