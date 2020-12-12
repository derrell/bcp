qx.Mixin.define("bcp.client.MFulfillment",
{
  statics :
  {
    _registration :
    {
      initElement : function(fieldType, fieldData, key)
      {
        let formElement = new bcp.client.Calendar(true);
        return formElement;
      },

      addToFormController : function(fieldType, fieldData, key, formElement)
      {
        this._formController.addTarget(formElement, "value", key, true, null);
      }
    }
  },

  members :
  {
    _fulfillmentClients  : null,
    _labelToListMap      : null,
    _butNewClient        : null,

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

      // If we haven't yet registered our appointment calendar to be a
      // form element...
      if (bcp.client.MFulfillment._registration)
      {
        // ... then do so now.
        qxl.dialog.Dialog.registerFormElementHandlers(
          "appointments", bcp.client.MFulfillment._registration);

        // Preevent doing so again.
        bcp.client.MFulfillment._registration = null;
      }

      page = new qx.ui.tabview.Page("Fulfillment");
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      // Initialize the label to list map
      this._labelToListMap = {};

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
        "appear", this._onListAppear, this);
      this._fulfillmentClients.addListener(
        "changeSelection", this._onListChangeSelection, this);

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
          this._onListAppear();

          // If one is provided, select the given family name
          data = e.getData();
          if (data && data.family_name)
          {
            this._fulfillmentClients.setSelection(
              [ this._labelToListMap[data.family_name] ] );
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

            renderer._setLayout(layout);
            return renderer;
          }
        });

      // Initially hide form so the top (before-form) buttons get hidden
      this._fulfillmentForm.hide();

      // When the form is OK'ed or Canceled, remove list-box selection
      this._fulfillmentForm.addListener("ok", this._onOkOrCancel, this);
      this._fulfillmentForm.addListener("cancel", this._onOkOrCancel, this);

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
    _onOkOrCancel : function()
    {
      // Re-enable access to the rest of the gui
      this._disableAllForFulfillment(false);

      // Remove the selection. We're ready for the next fulfillment
      this._fulfillmentClients.resetSelection();
    },

    _onListAppear : function()
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
            this._labelToListMap[entry.family_name] = listItem;
            this._fulfillmentClients.add(listItem);
          });
    },

    _onListChangeSelection : function(e)
    {
      let             rpc;
      let             formData;
      let             client;
      let             familyName;
      let             eData = e.getData();

      // If the selection is being cleared, we have nothing to do.
      if (eData.length === 0)
      {
        return;
      }

      function bold(s)
      {
        return (
          [
            "<span style='font-weight: bold;'>",
            s,
            "</span>"
          ].join(""));
      }

      rpc = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      rpc.sendRequest("getDistributionList", [])
        .then(
          (distributions) =>
          {
            // If there are no distributions, we can't do anything
            if (! distributions || distributions.length < 1)
            {
              qxl.dialog.Dialog.alert(
                "There are no distributions yet scheduled");
              return;
            }

            // Disable access to the rest of the gui while working
            // with the form
            this._disableAllForFulfillment(true);

            // Retrieve the family name selected in the client list
            familyName = eData[0].getLabel();

            // Get the client record for the selected list item
            client = this._tm.getDataAsMapArray().filter(
              (entry) =>
              {
                return entry.family_name == familyName;
              })[0];

            formData =
              {
                distribution_start_date :
                {
                  type       : "SelectBox",
                  label      : "Distribution start date",
                  value      : distributions[0].start_date,
                  options    : distributions.map(
                    (distribution) =>
                    {
                      return (
                        {
                          label : distribution.start_date,
                          value : distribution.start_date
                        });
                    }),
                  enabled    : false
                },

                default_apointment_label :
                {
                  type       : "Label",
                  label      : bold("Default Appointment"),
                  userdata   :
                  {
                    row        : 2    // leave a blank row above
                  }
                },

                appt_day_default :
                {
                  type       : "TextField",
                  label      : "Day",
                  value      : "" + client.appt_day_default,
                  enabled    : false
                },

                appt_time_default :
                {
                  type       : "TextField",
                  label      : "Time",
                  value      : "" + (client.appt_time_default || ""),
                  enabled    : false
                },

                address_default :
                {
                  type       : "TextArea",
                  label      : "Delivery address",
                  lines      : 3,
                  value      : client.address_default || "",
                  userdata   :
                  {
                    rowspan    : 3
                  }
                },

                appointments :
                {
                  type       : "appointments",
                  label      : "",
                  properties :
                  {
                    showScheduled : true,
                    startTimes    :
                    [
                      distributions[0].day_1_first_appt,
                      distributions[0].day_2_first_appt,
                      distributions[0].day_3_first_appt,
                      distributions[0].day_4_first_appt,
                      distributions[0].day_5_first_appt,
                      distributions[0].day_6_first_appt,
                      distributions[0].day_7_first_appt
                    ],
                    endTimes    :
                    [
                      distributions[0].day_1_last_appt,
                      distributions[0].day_2_last_appt,
                      distributions[0].day_3_last_appt,
                      distributions[0].day_4_last_appt,
                      distributions[0].day_5_last_appt,
                      distributions[0].day_6_last_appt,
                      distributions[0].day_7_last_appt
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
                message          : bold(familyName || ""),
                labelColumnWidth : 150,
                formData         : formData
              });

            this._fulfillmentForm._okButton.setLabel("Save");

            this._fulfillmentForm.promise()
              .then(
                result =>
                {
                  this.debug(
                    "fulfillment result: ", qx.util.Serializer.toJson(result));
                  return Promise.resolve();
                });

            this._fulfillmentForm.show();
          })
        .catch(
          (e) =>
          {
            console.error("getClientList:", e);
          });
    }
  }
});
