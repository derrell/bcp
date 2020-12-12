qx.Mixin.define("bcp.client.MDistribution",
{
  members :
  {
    _distributionForm : null,

    /**
     * Create the distribution page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createDistributionTab(tabView)
    {
      let             rpc;
      let             page;
      let             form;
      let             formData;
      let             dist0;
      let             bNoDists = false;

      page = new qx.ui.tabview.Page("Distributions");
      page.setLayout(new qx.ui.layout.HBox());
      tabView.add(page);

      // Initially build the distribution form
      this._buildDistributionForm()
        .then(form => page.add(form, { flex : 1 }));
    },

    /**
     * Build a new distribution form
     */
    async _buildDistributionForm()
    {
      let             rpc;
      let             form;
      let             formData;
      let             dist0;
      let             first = [ " not used" ];
      let             last = [ "not used" ];
      let             bNoDist = false;

      rpc = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      return rpc.sendRequest("getDistributionList", [])
        .catch(
          (e) =>
          {
            console.error("getDistributionListList:", e);
          })
        .then(
          (distributions) =>
          {
            let             i;
            let             periods;
            let             timestamp;
            let             formatted;
            let             maxTime;
            let             times = [];
            const           fifteenMin = (1000 * 60 * 15);

            // Add each possible time
            for (timestamp = new Date("2020-01-01T08:00"),
                   periods = 0;
                 periods <= 4 * 14; // 4x per hour, many hours
                 timestamp = new Date(timestamp.getTime() + fifteenMin),
                   periods++)
            {
              // Get the formatted time for this timestamp
              formatted = bcp.client.Calendar.formatTime(timestamp);

              // Create an options entry for this time
              times.push( { label : formatted, value : formatted } );

              // Save the maximum timestamp
              maxTime = formatted;
            }

            // If there are no distributions, we can't set any values
            if (! distributions || distributions.length < 1)
            {
              bNoDist = true;
              for (i = 1; i <= 7; i++)
              {
                first[i] = times[0].value;
                last[i] = times[times.length - 1].value;
              }
            }
            else
            {
              // Shorthand for distributions[0]
              dist0 = distributions[0];

              // Get the first/last times for each day
              first[1] = dist0.day_1_first_appt;
              first[2] = dist0.day_2_first_appt;
              first[3] = dist0.day_3_first_appt;
              first[4] = dist0.day_4_first_appt;
              first[5] = dist0.day_5_first_appt;
              first[6] = dist0.day_6_first_appt;
              first[7] = dist0.day_7_first_appt;

              last[1] = dist0.day_1_last_appt;
              last[2] = dist0.day_2_last_appt;
              last[3] = dist0.day_3_last_appt;
              last[4] = dist0.day_4_last_appt;
              last[5] = dist0.day_5_last_appt;
              last[6] = dist0.day_6_last_appt;
              last[7] = dist0.day_7_last_appt;
            }

            formData =
              {
                distribution_start_date :
                {
                  type       : "ComboBox",
                  label      : "Distribution start date",
                  value      : bNoDist ? "" : dist0.start_date,
                  options    : distributions.map(
                    (distribution) =>
                    {
                      return (
                        {
                          label : distribution.start_date,
                          value : distribution.start_date
                        });
                    })
                },

                day_1_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 1"),
                  userdata   :
                  {
                    row        : 2    // leave a blank row above
                  }
                },

                day_1_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[1]
                },

                day_1_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[1]
                },

                day_2_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 2"),
                  userdata   :
                  {
                    row        : 6    // leave a blank row above
                  }
                },

                day_2_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[2]
                },

                day_2_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[2]
                },

                day_3_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 3"),
                  userdata   :
                  {
                    row        : 10    // leave a blank row above
                  }
                },

                day_3_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[3]
                },

                day_3_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[3]
                },

                day_4_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 4"),
                  userdata   :
                  {
                    row        : 2,   // leave a blank row above
                    column     : 2
                  }
                },

                day_4_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[4]
                },

                day_4_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[4]
                },

                day_5_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 5"),
                  userdata   :
                  {
                    row        : 6    // leave a blank row above
                  }
                },

                day_5_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[5]
                },

                day_5_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[5]
                },

                day_6_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 6"),
                  userdata   :
                  {
                    row        : 10    // leave a blank row above
                  }
                },

                day_6_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[6]
                },

                day_6_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[6]
                },

                day_7_label :
                {
                  type       : "Label",
                  label      : this.bold("Day 7"),
                  userdata   :
                  {
                    row        : 2,    // leave a blank row above,
                    column     : 4
                  }
                },

                day_7_first_appt :
                {
                  type       : "SelectBox",
                  label      : "First appointment",
                  options    : times.slice(),
                  value      : first[7]
                },

                day_7_last_appt :
                {
                  type       : "SelectBox",
                  label      : "Last appointment",
                  options    : times.slice(),
                  value      : last[7]
                },
              };

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

            this._distributionForm.set(
              {
                labelColumnWidth : 150,
                formData         : formData
              });

            this._distributionForm._okButton.setLabel("Save");

            this._distributionForm.addListener(
              "ok", this._onDistributionOkOrCancel, this);
            this._distributionForm.addListener(
              "cancel", this._onDistributionOkOrCancel, this);

            this._distributionForm.promise()
              .then(
                result =>
                {
                  this.debug(
                    "distribution result: ",
                    qx.util.Serializer.toJson(result));
                  return Promise.resolve();
                });

            this._distributionForm.show();

            return this._distributionForm;
          });
    },

    _onDistributionOkOrCancel()
    {
      // This form always remains shown. First clean up from prior one...
      this._distributionForm.dispose();

      // ... then create a new one
      this._buildDistributionForm();
    }
  }
});
