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
qx.Class.define("bcp.server.GetReport",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    _path : null,

    /**
     * Serve the GUI
     *
     * @param app {Express}
     *   The Express app object
     */
    init : function(app)
    {
      const           fs = require("fs");

      this.info("GetReport: starting");

      this._path =
        qx.core.Environment.select(
          "bcp.target",
          {
            "build"  : "reports",
            "source" : `${process.cwd()}/reports`
          });

      // Clean up any left-over reports in the download queue
      fs.readdir(
        this._path,
        {},
        (e, files) =>
        {
          files.forEach(
            (file) =>
            {
              this.__deleteFile(file);
            });
        });

      // Create routes
      [
        this.__routeGetReport
      ].forEach(
        (f) =>
        {
          f.call(this, app);
        });
    },

    /**
     * Provide the interface for retrieving reports.
     * This is for CSV reports at the time of writing.
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeGetReport : function(app)
    {
      app.get(
        "/getReport/:fileId",
        (req, res) =>
        {
          console.log("getReport: ", req.params);
          res.download(
            this._path + "/" + req.params.fileId,
            req.params.fileId,
            (e) =>
            {
              // Delete the file now that it's downloaded (or the download failed)
              this.__deleteFile(req.params.fileId);

              if (e)
              {
                console.warn(`Could not provide download for ${req.params.fileId}: `, e);
                return;
              }

              console.log(`File ${req.params.fileId} was downloaded`);
            });
        });
    },

    __deleteFile : function(name)
    {
        const           fs = require("fs");

        // Delete the file from the reports directory
        fs.unlink(
          this._path + "/" + name,
          (e) =>
          {
            if (e)
            {
              console.warn(
                `Could not delete report ${name}: `, e);
              return;
            }

            console.log(`Deleted report ${name}`);
          });      
    }
  }
});
