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
qx.Mixin.define("bcp.client.MFulfillment",
{
  members :
  {
    _fulfillmentClients        : null,
    _fulfillmentForm           : null,
    _fulfillmentLabelToListMap : null,
    _butNewClient              : null,

    /**
     * Create the fulfillment page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createFulfillmentTab(tabView)
    {
      let             page;
      let             vBox;
      let             formData;
      const           _this = this;

      page = new qx.ui.tabview.Page("Fulfillment");
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      // Initialize the label to list map
      this._fulfillmentLabelToListMap = {};

      // Create a vbox for the client list and New Client button
      vBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      page.add(vBox);

      // Add the list of client family-names
      this._fulfillmentClients = new qx.ui.form.List();
      this._fulfillmentClients.set(
        {
          width : 240
        });
      vBox.add(this._fulfillmentClients, { flex : 1 });

      this._fulfillmentClients.addListener(
        "appear", this._onFulfillmentListAppear, this);
      this._fulfillmentClients.addListener(
        "changeSelection", this._onFulfillmentListChangeSelection, this);

      // Allow creating a new client right from here
      this._butNewClient = new qx.ui.form.Button("New Client");
      this._butNewClient.set(
        {
          maxWidth : 80
        });
      vBox.add(this._butNewClient);
      this._butNewClient.addListener(
        "execute",
        () =>
        {
          this._buildClientForm();
        },
        this);

      // After a new client is created, we'll get an event that tells us
      // the client list was changed. The event data contains the family
      // name, so we can pre-select that family for fulfullment.
      this.addListener(
        "clientListChanged",
        (e) =>
        {
          let             data;

          // Refresh the list
          this._onFulfillmentListAppear();

          // If one is provided, select the given family name
          data = e.getData();
          if (data && data.family_name)
          {
            this._fulfillmentClients.setSelection(
              [ this._fulfillmentLabelToListMap[data.family_name] ] );
          }
        });

      // Create the form for adding/editing a fulfillment record
      this._fulfillmentForm = new qxl.dialog.FormEmbed(
        {
          callback         : function(result)
          {
            console.log("result=", result);
          },
          beforeFormFunction : function(container)
          {
            let             hbox;
            let             clearAppointment;
            let             useDefaultAppointment;

            // Get the hbox in which the message label is placed
            hbox = container.getUserData("messageHBox");

            // Create a button to pull in the default appointment
            useDefaultAppointment = new qx.ui.form.Button(
              "Set to default appointment");
            hbox.add(useDefaultAppointment);
            useDefaultAppointment.addListener(
              "execute",
              function(e)
              {
                let             day;
                let             time;
                const           form = _this._fulfillmentForm;
                const           formElements = form._formElements;

                day = formElements.appt_day_default.getValue();
                time = formElements.appt_time_default.getValue();
                if (time && time.length > 0)
                {
                  try
                  {
                    formElements.appointments.set(
                      {
                        value : { day, time }
                      });
                  }
                  catch(e)
                  {
                    qxl.dialog.Dialog.warning(
                      "Default appointment is outside Distribution times");
                    return;
                  }
                }
                else
                {
                  qxl.dialog.Dialog.alert(
                    "There is no default appointment time specified");
                  formElements.appointments.set(
                    {
                      value : null
                    });
                }
              },
              this);

            // Create a button to clear any existing appointment
            clearAppointment = new qx.ui.form.Button(
              "Cancel appointment");
            hbox.add(clearAppointment);
            clearAppointment.addListener(
              "execute",
              function(e)
              {
                const           form = _this._fulfillmentForm;
                const           formElements = form._formElements;
                formElements.appointments.set(
                  {
                    value : null
                  });
              });
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

            layout.setColumnFlex(col(1), 1);
            layout.setRowFlex(10, 1);

            renderer._setLayout(layout);
            return renderer;
          }
        });

      // Initially hide form
      this._fulfillmentForm.hide();

      // When the form is OK'ed or Canceled, remove list-box selection
      this._fulfillmentForm.addListener(
        "ok", this._onFulfillmentOkOrCancel, this);
      this._fulfillmentForm.addListener(
        "cancel", this._onFulfillmentOkOrCancel, this);

      page.add(this._fulfillmentForm);
      page.add(new qx.ui.core.Spacer(), { flex : 1 });
    },

    /**
     * Disallow changing list selection, adding a new client, or switching
     * tabs, while form is present. User must press Save or Cancel to
     * continue.
     *
     * @param bDisable {Boolean}
     *   true to disable them (called when form is shwon)
     *   false to re-enable all of the buttons (called by Ok/Cancel handlers);
     */
    _disableAllForFulfillment : function(bDisable)
    {
      this._fulfillmentClients.setEnabled(! bDisable);
      this._butNewClient.setEnabled(! bDisable);

      // Disable/Enable all tabs other than "Fulfillment"
      this._tabView.getChildren().forEach(
        (child) =>
        {
          if (child.getLabel() != "Fulfillment")
          {
            child.getChildControl("button").setEnabled(! bDisable);
          }
        });
    },

    /**
     * Remove the selection in the client list when Ok or Cancel is
     * selected in the detail form
     */
    _onFulfillmentOkOrCancel : function()
    {
      // Re-enable access to the rest of the gui
      this._disableAllForFulfillment(false);

      // Remove the selection. We're ready for the next fulfillment
      this._fulfillmentClients.resetSelection();
    },

    _onFulfillmentListAppear : function()
    {
      this._fulfillmentClients.removeAll();

      // Recreate the list of clients
      this._tm.getDataAsMapArray()
        .sort(
          (a, b) =>
          {
            a = a.family_name;
            b = b.family_name;
            return a < b ? -1 : a > b ? 1 : 0;
          })
        .forEach(
          (entry) =>
          {
            let             listItem;

            listItem = new qx.ui.form.ListItem(entry.family_name);
            this._fulfillmentLabelToListMap[entry.family_name] = listItem;
            this._fulfillmentClients.add(listItem);
          });
    },

    _onFulfillmentListChangeSelection : function(e)
    {
      let             familyName;
      const           eData = e.getData();

      // If the selection is being cleared, we have nothing to do.
      if (eData.length === 0)
      {
        return;
      }

      // Retrieve the family name selected in the client list
      familyName = eData[0].getLabel();

      // Fill in the fulfillment form and process its result
      this._handleFulfillmentForm(familyName);
    },

    _handleFulfillmentForm : function(familyName, distributionStart)
    {
      let             rpc;
      let             formData;
      let             client;

      rpc = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));

      // Concurrently, retrieve the distribution list and this fulfillment
      rpc.sendRequest(
        "getAppointments",
        [
          distributionStart || true,
          familyName
        ])
        .then(
          (data) =>
          {
            let             distribution;
            let             distributions = data.distributions;
            let             appointmentsScheduled = data.appoitnmentsScheduled;
            let             fulfillment = data.fulfillment[0] || {};

            // Disable access to the rest of the gui while working
            // with the form
            this._disableAllForFulfillment(true);

            // Get the information for the selected distribution
            if (! distributionStart)
            {
              distribution = distributions[0];
            }
            else
            {
              distribution = distributions.filter(
                (distro => distro.start_date == distributionStart))[0];
            }

            // Sanity check
            if (! distribution)
            {
              console.error(
                `Did not find distribution ${distributionStart} in:`,
                distributions);
              throw new Error("Did not find expected distribution");
            }

            // Get the client record for the selected list item
            client = this._tm.getDataAsMapArray().filter(
              (entry) =>
              {
                return entry.family_name == familyName;
              })[0];

            formData =
              {
                distribution :
                {
                  type       : "SelectBox",
                  label      : "Distribution start date",
                  value      : distribution.start_date,
                  options    : distributions.map(
                    (distribution) =>
                    {
                      return (
                        {
                          label : distribution.start_date,
                          value : distribution.start_date
                        });
                    }),
                  userdata   :
                  {
                    row           : 1,
                    distributions : distributions
                  },
                  events     :
                  {
                    changeSelection : function(e)
                    {
                      console.log(
                        "distribution changeSelection:",
                        e.getData(),
                        "distributions=", this.getUserData("distributions"));
                    }
                  },
                  enabled    : false
                },

                default_apointment_label :
                {
                  type       : "Label",
                  label      : this.bold("Default Appointment"),
                  userdata   :
                  {
                    row        : 2    // leave a blank row above
                  }
                },

                appt_day_default :
                {
                  type       : "TextField",
                  label      : "Day",
                  value      : "" + (client.appt_day_default || ""),
                  enabled    : false
                },

                appt_time_default :
                {
                  type       : "TextField",
                  label      : "Time",
                  value      : "" + (client.appt_time_default || ""),
                  enabled    : false
                },

                delivery_address :
                {
                  type       : "TextArea",
                  label      : "Delivery address",
                  lines      : 3,
                  value      : fulfillment.delivery_address || "",
                  userdata   :
                  {
                    rowspan    : 3
                  },
                  properties :
                  {
                    height     : 70
                  }
                },

                appointments :
                {
                  type       : "appointments",
                  label      : "",
                  value      :
                    (fulfillment.appt_time
                     ?
                     {
                       day  : fulfillment.appt_day,
                       time : fulfillment.appt_time
                     }
                     : null),
                  properties :
                  {
                    height        : 200,
                    showScheduled : true,
                    startTimes    :
                    [
                      distribution.day_1_first_appt,
                      distribution.day_2_first_appt,
                      distribution.day_3_first_appt,
                      distribution.day_4_first_appt,
                      distribution.day_5_first_appt,
                      distribution.day_6_first_appt,
                      distribution.day_7_first_appt
                    ],
                    endTimes    :
                    [
                      distribution.day_1_last_appt,
                      distribution.day_2_last_appt,
                      distribution.day_3_last_appt,
                      distribution.day_4_last_appt,
                      distribution.day_5_last_appt,
                      distribution.day_6_last_appt,
                      distribution.day_7_last_appt
                    ]
                  },
                  userdata   :
                  {
                    row      : 0,
                    column   : 4,
                    rowspan  : 20
                  }
                },

                deliver :
                {
                  type      : "SelectBox",
                  label     : "Fulfilment method",
                  value     : "Pick-up",
                  options   :
                  [
                    { label : "Pick-up",  value : "Pick-up" },
                    { label : "Delivery", value : "Delivery" },
                  ],
                  userdata  :
                  {
                    row       : 22
                  }
                },

                fulfilled :
                {
                  type      : "CheckBox",
                  label     : "Fulfilled",
                  value     : false
                }
              };

            this._fulfillmentForm.set(
              {
                message          : this.bold(familyName || ""),
                labelColumnWidth : 150,
                formData         : formData
              });

            this._fulfillmentForm._okButton.setLabel("Save");

            this._fulfillmentForm.promise()
              .then(
                (result) =>
                {
                  let             rpc;

                  // If the form was cancelled...
                  if (! result)
                  {
                    // ... then just reset the selection, ...
                    this._fulfillmentClients.resetSelection();

                    // ... and get outta Dodge!
                    return Promise.resolve();
                  }

                  // Ensure the start date is included in the data to be saved
                  result.family_name = familyName;

                  rpc = new qx.io.jsonrpc.Client(
                    new qx.io.transport.Xhr("/rpc"));

                  return rpc.sendRequest("saveFulfillment", [ result ])
                    .catch(
                      (e) =>
                      {
                        console.warn("Error saving changes:", e);
                        qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                      });
                });

            this._fulfillmentForm.show();
          })
        .catch(
          (e) =>
          {
            console.error("getDistributionList:", e);
          });
    }
  }
});
