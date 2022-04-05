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

/**
 * @asset(qx/decoration/Indigo/font/JosefinSlab-SemiBold.woff)
 * @asset(qx/decoration/Indigo/font/JosefinSlab-SemiBold.ttf)
 */
qx.Theme.define("bcp.client.theme.Font",
{
  fonts :
  {
    "default" :
    {
      size : 12,
      family : [ "Trebuchet MS", "Verdana", "Arial" ],
      color: "font",
      lineHeight: 1.8
    },

    "bold" :
    {
      size : 12,
      family : [ "Trebuchet MS", "Verdana", "Arial" ],
      bold : true,
      color: "font",
      lineHeight: 1.8
    },

    "header" :
    {
      size : 28,
      bold : true,
      family : ["sans-serif"],
      sources:
      [
        {
          family : "JosefinSlab",
          source: [
            "qx/decoration/Indigo/font/JosefinSlab-SemiBold.woff",
            "qx/decoration/Indigo/font/JosefinSlab-SemiBold.ttf"
          ]
        }
      ]
    },

    "small" :
    {
      size : 11,
      family : ["Lucida Grande", "DejaVu Sans", "Verdana", "sans-serif"],
      color: "font",
      lineHeight: 1.8
    },

    "monospace" :
    {
      size : 11,
      family : [ "DejaVu Sans Mono", "Courier New", "monospace" ],
      color: "font",
      lineHeight: 1.8
    }    
  }
});
