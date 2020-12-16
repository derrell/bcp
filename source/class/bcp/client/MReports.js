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
qx.Mixin.define("bcp.client.MReports",
{
  members :
  {
    _win                  : null,
    _reports              : null,
    _reportForm           : null,
    _reportLabelToListMap : null,

    /**
     * Create the report page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createReportsTab(tabView)
    {
      let             page;
      let             vBox;
      let             formData;
      const           _this = this;

      page = new qx.ui.tabview.Page("Reports");
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      // Initialize the label to list map
      this._reportLabelToListMap = {};

      // Create a vbox for the report list and New Report button
      vBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      page.add(vBox);

      // Add the list of reports
      this._reports = new qx.ui.form.List();
      this._reports.set(
        {
          width : 240
        });
      vBox.add(this._reports, { flex : 1 });

      this._reports.addListener(
        "appear", this._onReportListAppear, this);
      this._reports.addListener(
        "changeSelection", this._onReportChangeSelection, this);

      // Create the form for adding/editing a report record
      this._reportForm = new qxl.dialog.FormEmbed(
        {
          callback         : function(result)
          {
            console.log("result=", result);
          }
        });

      // Initially hide form so the top (before-form) buttons get hidden
      this._reportForm.hide();

      // When the form is OK'ed or Canceled, remove list-box selection
      this._reportForm.addListener(
        "ok", this._onReportOkOrCancel, this);
      this._reportForm.addListener(
        "cancel", this._onReportOkOrCancel, this);

      page.add(this._reportForm);
      page.add(new qx.ui.core.Spacer(), { flex : 1 });
    },

    /**
     * Disallow changing list selection, adding a new report, or
     * switching tabs, while form is present. User must press Save or
     * Cancel to continue.
     *
     * @param bDisable {Boolean}
     *   true to disable them (called when form is shwon)
     *   false to re-enable all of the buttons (called by Ok/Cancel handlers);
     */
    _disableAllForReport : function(bDisable)
    {
      // Disable/Enable all tabs other than "Report"
      this._tabView.getChildren().forEach(
        (child) =>
        {
          if (child.getLabel() != "Reports")
          {
            child.getChildControl("button").setEnabled(! bDisable);
          }
        });
    },

    /*
     * Remove the selection in the report list when Ok or Cancel is
     * selected in the detail form.
     */
    _onReportOkOrCancel : function()
    {
      // Re-enable access to the rest of the gui
      this._disableAllForReport(false);
    },

    _onReportListAppear : function()
    {
      let             rpc;

      this._reports.removeAll();

      // Recreate the list of reports
      rpc = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      rpc.sendRequest("getReportList", [])
        .catch(
          (e) =>
          {
            console.error("getReportList:", e);
          })
        .then(
          (reports) =>
          {
console.log("getReportList reports=", reports);

            reports.forEach(
              (report) =>
              {
                let             listItem;

                listItem = new qx.ui.form.ListItem(report.name);
                this._reportLabelToListMap[report.name] = listItem;
                this._reports.add(listItem);

                // Save the remainder of the report info as
                // userdata of the list item
                listItem.setUserData("reportInfo", report);
              });
          });
    },

    _onReportChangeSelection : function(e)
    {
      let             i;
      let             rpc;
      let             formData;
      let             reports;
      let             reportInfo;
      let             eData = e.getData();

      // If the selection is being cleared, we have nothing to do.
      if (eData.length === 0)
      {
        return;
      }

      // Disable access to the rest of the gui while working
      // with the form
      this._disableAllForReport(true);

      // Retrieve the report selected in the reports list
      reportInfo = eData[0].getUserData("reportInfo");

      formData =
        {
          name :
          {
            type       : "TextField",
            label      : "Name",
            value      : reportInfo.name
          },

          description :
          {
            type       : "TextArea",
            label      : "Description",
            value      : reportInfo.description,
            lines      : 5
          }
        };

      this._reportForm.set(
        {
          width            : 800,
          message          : this.bold(reportInfo.name),
          labelColumnWidth : 150,
          formData         : formData
        });

      this._reportForm._okButton.setLabel("Generate Report");

      this._reportForm.promise()
        .then(
          (result) =>
          {
            let             rpc;

            // ... then just reset the selection, ...
            this._reports.resetSelection();

            // If the form was cancelled...
            if (! result)
            {
              // ... then just reset the selection, ...
              this._reports.resetSelection();

              // ... and get outta Dodge!
              return Promise.resolve();
            }

            rpc = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
            return rpc.sendRequest("generateReport", [ result.name ])
              .catch(
                (e) =>
                {
                  console.warn("Error generating report:", e);
                  qxl.dialog.Dialog.error(`Error generating report: ${e}`);
                })
              .then(
                (report) =>
                {
                  let             headings;
                  
                  console.log("Report data:", report);

                  if (report.length === 0)
                  {
                    // If there is no data, let 'em know
                    qxl.dialog.Dialog.alert("Nothing to report");
                    return;
                  }

                  // If there's a prior report window, close it
                  if (this._win)
                  {
                    this._win.close();
                  }

                  // Create a window in which to generate the report
                  this._win = window.open(
                    "",
                    "Report",
                    "resizable=yes,scrollbars=yes,width=1000,height=600");

                  // Insert the common prefix HTML code
                  this._insertPrefix(
                    this._win, result.name, reportInfo.landscape);

                  // Write the heading
                  this._win.document.write("<thead><tr>");
                  Object.keys(report[0]).forEach(
                    (heading) =>
                    {
                      this._win.document.write(`<th>${heading}</th>`);
                    });
                  this._win.document.write("</tr></thead>");

                  // Write the body
                  this._win.document.write("<tbody>");
                  report.forEach(
                    (row) =>
                    {
                      this._win.document.write("<tr>");
                      Object.keys(report[0]).forEach(
                        (heading) =>
                        {
                          this._win.document.write(`<td>${row[heading]}</td>`);
                        });
                      this._win.document.write("</tr>");
                    });
                  this._win.document.write("</tbody>");

                  // Insert the common suffix HTML code
                  this._insertSuffix(this._win);
                });
          });

      this._reportForm.show();
    },

    _insertPrefix(win, title, bLandscape)
    {
      let             media =
          bLandscape ? "@media print{@page {size: landscape}}" : "";

      // Write the boilerplate prefix stuff
      win.document.write(
        [
          "<html>",
          "  <head>",
          `    <title>${title}</title>`,
          "    <style>",
          `      ${media}`,
          "      table {",
          "        border-collapse: collapse;",
          "      }",
          "      td, th {",
          "        border: 1px solid #999;",
          "        padding: 0.5rem;",
          "        text-align: left;",
          "      }",
          "      tbody tr:nth-child(odd) {",
          "        background: #eee;",
          "      }",
          "    </style>",
          "  </head>",
          "  <body>",
          `    <h1>${title}</h1>`,
          "    <table>"
        ].join(""));
    },

    _insertSuffix(win)
    {
      win.document.write(
        [
          "    </table>",
          "  </body>",
          "</html>"
        ].join(""));
    }
  }
});
