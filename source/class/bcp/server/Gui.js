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
qx.Class.define("bcp.server.Gui",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    /**
     * Serve the GUI
     *
     * @param app {Express}
     *   The Express app object
     */
    init : function(app)
    {
      this.info("Gui: starting");

      // Create routes
      [
        this.__routeGui
      ].forEach(
        (f) =>
        {
          f.call(this, app);
        });
    },

    /**
     * Provide the GUI
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeGui : function(app)
    {
      let             express = require("express");
      const           path =
        qx.core.Environment.select(
          "bcp.target",
          {
            "build"  : "",
            "source" : `${process.cwd()}/output/source-browser/`
          });

      this.debug(`Got request for GUI; using path ${path}`);

      [
        { route : "index.html",  path : `${path}index.html` },
        { route : "bcp.client/index.js([\$]*)",
          path  : `${path}bcp.client/index.js` },
        { route : "bcp.client",  path : `${path}bcp.client` },
        { route : "resource",    path : `${path}resource` },
        { route : "help",        path : `${path}help` },
        { route : "transpiled",  path : `${path}transpiled` },
        { route : "favicon.ico", path : `${path}resource/bcp/client/favicon.ico` }
      ].forEach(
        (item) =>
        {
          this.debug(
            `Gui: create route for ${item.route} to ${item.path}`);
          app.use("/" + item.route, express.static(item.path));
        });

      app.get(
        "/",
        (req, res) =>
        {
          res.redirect("/index.html");
        });
    }
  }
});
