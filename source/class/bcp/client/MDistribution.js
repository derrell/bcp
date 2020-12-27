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
qx.Mixin.define("bcp.client.MDistribution",
{
  members :
  {
    _distributions              : null,
    _distributionForm           : null,
    _distributionLabelToListMap : null,
    _butNewDistribution         : null,
    _tabLabelDistribution       : null,

    /**
     * Create the distribution page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createDistributionTab(tabView)
    {
      let             page;
      let             vBox;
      let             button;
      let             command;
      let             formData;
      const           _this = this;

      // Generate the label for this tab
      this._tabLabelDistribution = this.underlineChar("Distributions", 1);

      page = new qx.ui.tabview.Page(this._tabLabelDistribution);
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+I");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      // Initialize the label to list map
      this._distributionLabelToListMap = {};

      // Create a vbox for the distribution list and New Distribution button
      vBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      page.add(vBox);

      // Add the list of distributions
      this._distributions = new qx.ui.form.List();
      this._distributions.set(
        {
          width : 240
        });
      vBox.add(this._distributions, { flex : 1 });

      this._distributions.addListener(
        "appear", this._onDistributionListAppear, this);
      this._distributions.addListener(
        "changeSelection", this._onDistributionChangeSelection, this);

      // Allow creating a new distribution
      this._butNewDistribution = new qx.ui.form.Button("New Distribution");
      this._butNewDistribution.set(
        {
          maxWidth : 120
        });
      vBox.add(this._butNewDistribution);
      this._butNewDistribution.addListener(
        "execute",
        () =>
        {
          this._buildNewDistributionForm()
            .then(
              (result) =>
              {
                let             i;
                let             listItem;
                let             children;
                let             startDate;

                // Cancelled?
                if (! result)
                {
                  // Yup. See ya!
                  return;
                }

                startDate =
                  [
                    "" + result.start_date.getFullYear(),
                    ("0" + (result.start_date.getMonth() + 1)).substr(-2),
                    ("0" + result.start_date.getDate()).substr(-2)
                  ].join("-");

                // Make sure this supposedly new distribution doesn't exist
                children = this._distributions.getChildren();
                if (children.map(child => child.getLabel()).includes(startDate))
                {
                  qxl.dialog.Dialog.error(
                    `Distribution "${startDate}" already exists`);
                  return;
                }

                // Create a list item for this new distribution
                listItem = new qx.ui.form.ListItem(startDate);
                this._distributionLabelToListMap[startDate] = listItem;

                // Figure out where to add this distribution
                for (i = 0; i < children.length; i++)
                {
                  let             child = children[i];

                  // See if the one we're looking at precedes the one
                  // we want to add, and we want to keep them in
                  // descending order. If so, insert here.
                  if (child.getLabel() < startDate)
                  {
                    this._distributions.addAt(listItem, i);
                    break;
                  }
                }

                // Did we insert it?
                if (i == children.length)
                {
                  // Nope. Add it at the end.
                  this._distributions.add(listItem);
                }

                // Select this new item
                this._distributions.setSelection( [ listItem ] );
              });
        },
        this);

      // Create the form for adding/editing a distribution record
      this._distributionForm = new qxl.dialog.FormEmbed(
        {
          callback         : function(result)
          {
            console.log("result=", result);
          },
          setupFormRendererFunction : function(form)
          {
            var renderer = new qxl.dialog.MultiColumnFormRenderer(form);
            var layout = new qx.ui.layout.Grid();
            const col = renderer.column;

            layout.setSpacing(6);

            layout.setColumnMaxWidth(col(0), this.getLabelColumnWidth());
            layout.setColumnWidth(col(0), this.getLabelColumnWidth());
            layout.setColumnAlign(col(0), "right", "top");

            layout.setColumnMaxWidth(col(2), this.getLabelColumnWidth());
            layout.setColumnWidth(col(2), this.getLabelColumnWidth());
            layout.setColumnAlign(col(2), "right", "top");

            layout.setColumnMaxWidth(col(4), this.getLabelColumnWidth());
            layout.setColumnWidth(col(4), this.getLabelColumnWidth());
            layout.setColumnAlign(col(4), "right", "top");

            renderer._setLayout(layout);
            return renderer;
          }
        });

      // Initially hide form so the top (before-form) buttons get hidden
      this._distributionForm.hide();

      // When the form is OK'ed or Canceled, remove list-box selection
      this._distributionForm.addListener(
        "ok", this._onDistributionOk, this);
      this._distributionForm.addListener(
        "cancel", this._onDistributionCancel, this);

      page.add(this._distributionForm);
      page.add(new qx.ui.core.Spacer(), { flex : 1 });
    },

    _buildNewDistributionForm : function()
    {
      let             form;

      // Create a form for entry of a new distribution start date
      form = qxl.dialog.Dialog.form(
        "Add new distribution",
        {
          start_date:
            {
              type       : "DateField",
              label      : "Distribution start date",
              value      : new Date(),
              dateFormat : new qx.util.format.DateFormat("yyyy-MM-dd"),
              validation :
              {
                required   : true
              }
            }
        });
      form.set(
        {
          labelColumnWidth : 200
        });
      return form.promise();
    },

    /**
     * Disallow changing list selection, adding a new distribution, or
     * switching tabs, while form is present. User must press Save or
     * Cancel to continue.
     *
     * @param bDisable {Boolean}
     *   true to disable them (called when form is shwon)
     *   false to re-enable all of the buttons (called by Ok/Cancel handlers);
     */
    _disableAllForDistribution : function(bDisable)
    {
      this._distributions.setEnabled(! bDisable);
      this._butNewDistribution.setEnabled(! bDisable);

      // Disable/Enable all tabs other than "Distribution"
      this._tabView.getChildren().forEach(
        (child) =>
        {
          if (child.getLabel() != this._tabLabelDistribution)
          {
            child.getChildControl("button").setEnabled(! bDisable);
          }
        });
    },

    /*
     * Remove the selection in the distribution list when Ok is selected in
     * the detail form.
     */
    _onDistributionOk : function()
    {
      // Re-enable access to the rest of the gui
      this._disableAllForDistribution(false);
    },

    /*
     * Do everything that Ok handling does, plus re-generate the distribution
     * list.
     */
    _onDistributionCancel : function()
    {
      // Do common ok/cancel processing
      this._onDistributionOk();

      // Remove everything from the list and re-retrieve
      // it just as at startup. (Not necessary for Ok because it's done
      // after saving.)
      this._onDistributionListAppear();
    },

    _onDistributionListAppear : function()
    {
      this._distributions.removeAll();

      // Recreate the list of distributions
      this.rpc("getDistributionList", [])
        .catch(
          (e) =>
          {
            console.error("getDistributionListList:", e);
          })
        .then(
          (distributions) =>
          {
            distributions.forEach(
              (distribution) =>
              {
                let             listItem;

                listItem = new qx.ui.form.ListItem(distribution.start_date);
                this._distributionLabelToListMap[distribution.start_date] =
                  listItem;
                this._distributions.add(listItem);

                // Save the remainder of the distribution info as
                // userdata of the list item
                listItem.setUserData("distroInfo", distribution);
              });
          });
    },

    _onDistributionChangeSelection : function(e)
    {
      let             i;
      let             rpc;
      let             formData;
      let             dist;
      let             distributions;
      let             timestamp;
      let             periods;
      let             time12;
      let             time24;
      let             maxTime;
      let             startDate;
      let             eData = e.getData();
      let             first = [];
      let             last = [];
      let             times = [];
      const           form = this._distributionForm;
      const           fifteenMin = (1000 * 60 * 15);

      // If the selection is being cleared, we have nothing to do.
      if (eData.length === 0)
      {
        return;
      }

      // Add each possible time
      for (timestamp = new Date("2020-01-01T08:00"),
             periods = 0;
           periods <= 4 * 14; // 4x per hour, many hours
           timestamp = new Date(timestamp.getTime() + fifteenMin),
             periods++)
      {
        // Get the formatted time for this timestamp
        time12 = bcp.client.Appointment.formatTime12(timestamp);
        time24 = bcp.client.Appointment.formatTime24(timestamp);

        // Create an options entry for this time
        times.push( { label : time12, value : time24 } );

        // Save the maximum timestamp
        maxTime = time24;
      }

      // Disable access to the rest of the gui while working
      // with the form
      this._disableAllForDistribution(true);

      // Retrieve the distribution selected in the distributions list
      dist = eData[0].getUserData("distroInfo");

      if (! dist)
      {
        startDate = this._distributions.getSelection()[0].getValue();
        for (i = 1; i <= 7; i++)
        {
          first[i] = times[0].value;
          last[i] = times[times.length - 1].value;
        }
      }
      else
      {
        // We have the start date readily available
        startDate = dist.start_date;

        // Get the first/last times for each day
        first[1] = dist.day_1_first_appt;
        first[2] = dist.day_2_first_appt;
        first[3] = dist.day_3_first_appt;
        first[4] = dist.day_4_first_appt;
        first[5] = dist.day_5_first_appt;
        first[6] = dist.day_6_first_appt;
        first[7] = dist.day_7_first_appt;

        last[1] = dist.day_1_last_appt;
        last[2] = dist.day_2_last_appt;
        last[3] = dist.day_3_last_appt;
        last[4] = dist.day_4_last_appt;
        last[5] = dist.day_5_last_appt;
        last[6] = dist.day_6_last_appt;
        last[7] = dist.day_7_last_appt;
      }

      formData =
        {
          day_1_label :
          {
            type       : "Label",
            label      : this.bold("Day 1"),
            userdata   :
            {
              column     : 2,
              row        : 0
            }
          },

          day_1_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[1],
            properties :
            {
              tabIndex   : 1
            }
          },

          day_1_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[1],
            properties :
            {
              tabIndex   : 2
            }
          },

          day_2_label :
          {
            type       : "Label",
            label      : this.bold("Day 2"),
            userdata   :
            {
              row        : 4    // leave a blank row above
            }
          },

          day_2_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[2],
            properties :
            {
              tabIndex   : 3
            }
          },

          day_2_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[2],
            properties :
            {
              tabIndex   : 4
            }
          },

          day_3_label :
          {
            type       : "Label",
            label      : this.bold("Day 3"),
            userdata   :
            {
              row        : 8    // leave a blank row above
            }
          },

          day_3_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[3],
            properties :
            {
              tabIndex   : 5
            }
          },

          day_3_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[3],
            properties :
            {
              tabIndex   : 6
            }
          },

          day_4_label :
          {
            type       : "Label",
            label      : this.bold("Day 4"),
            userdata   :
            {
              column     : 4,
              row        : 0   // leave a blank row above
            }
          },

          day_4_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[4],
            properties :
            {
              tabIndex   : 7
            }
          },

          day_4_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[4],
            properties :
            {
              tabIndex   : 8
            }
          },

          day_5_label :
          {
            type       : "Label",
            label      : this.bold("Day 5"),
            userdata   :
            {
              row        : 4    // leave a blank row above
            }
          },

          day_5_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[5],
            properties :
            {
              tabIndex   : 9
            }
          },

          day_5_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[5],
            properties :
            {
              tabIndex   : 10
            }
          },

          day_6_label :
          {
            type       : "Label",
            label      : this.bold("Day 6"),
            userdata   :
            {
              row        : 8    // leave a blank row above
            }
          },

          day_6_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[6],
            properties :
            {
              tabIndex   : 11
            }
          },

          day_6_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[6],
            properties :
            {
              tabIndex   : 12
            }
          },

          day_7_label :
          {
            type       : "Label",
            label      : this.bold("Day 7"),
            userdata   :
            {
              column     : 6,
              row        : 0    // leave a blank row above,
            }
          },

          day_7_first_appt :
          {
            type       : "SelectBox",
            label      : "First appointment",
            options    : times.slice(),
            value      : first[7],
            properties :
            {
              tabIndex   : 13
            }
          },

          day_7_last_appt :
          {
            type       : "SelectBox",
            label      : "Last appointment",
            options    : times.slice(),
            value      : last[7],
            properties :
            {
              tabIndex   : 14
            }
          },
        };

      form.set(
        {
          message          : this.bold(startDate),
          labelColumnWidth : 150,
          formData         : formData
        });

      form._okButton.set(
        {
          rich    : true,
          label   : this.underlineChar("Save"),
          command : new qx.ui.command.Command("Alt+S")
        });

      form.promise()
        .then(
          (result) =>
          {
            // If the form was cancelled...
            if (! result)
            {
              // ... then just reset the selection, ...
              this._distributions.resetSelection();

              // ... and get outta Dodge!
              return Promise.resolve();
            }

            // Ensure the start date is included in the data to be saved
            result.start_date = startDate;

            return this.rpc("saveDistribution", [ result, ! dist ])
              .catch(
                (e) =>
                {
                  console.warn("Error saving changes:", e);
                  if (e.code == this.constructor.RpcError.AlreadyExists)
                  {
                    qxl.dialog.Dialog.error(
                      `Distribution "${result.start_date}" already exists`);
                  }
                  else
                  {
                    qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                  }
                })
              .then(
                () =>
                {
                  // Remove everything from the list and re-retrieve
                  // it just as at startup
                  this._onDistributionListAppear();
                });
          });

      form.show();

      // Focus the first field upon appear
      form.addListener(
        "appear",
        () =>
        {
          form._formElements["day_1_first_appt"].focus();
        },
        this);
    }
  }
});
