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
    _fullfillmentClients : null,
    _labelToListMap      : null,

    /**
     * Create the fulfillment page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createFulfillmentTab(tabView)
    {
      let             page;
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

      // Add the list of client family-names
      this._fullfillmentClients = new qx.ui.form.List();
      this._fullfillmentClients.set(
        {
          width : 240
        });
      page.add(this._fullfillmentClients);

      this._fullfillmentClients.addListener(
        "appear", this._onListAppear, this);
      this._fullfillmentClients.addListener(
        "changeSelection", this._onListChangeSelection, this);

      this._fulfillmentForm = new qxl.dialog.FormEmbed(
        {
          callback         : function(result)
          {

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
                  formElements.appointments.set(
                    {
                      value : { day, time }
                    });
                }
                else
                {
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
     * Remove the selection in the client list when Ok or Cancel is
     * selected in the detail form
     */
    _onOkOrCancel : function()
    {
      this._fullfillmentClients.resetSelection();
    },

    _onListAppear : function()
    {
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
            this._fullfillmentClients.add(listItem);
          });
    },

    _onListChangeSelection : function(e)
    {
      let             formData;
      let             client;
      let             familyName;

      // If the selection is being cleared, we have nothing to do.
      if (e.getData().length === 0)
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

      // Retrieve the family name selected in the client list
      familyName = e.getData()[0].getLabel();

      // Get the client record for the selected list item
      client = this._tm.getDataAsMapArray().filter(
        (entry) =>
        {
          return entry.family_name == familyName;
        })[0];
console.log("client=", client);

      formData =
        {
          distribution_start_date :
          {
            type       : "TextField",
            label      : "Distribution start date",
            value      : "2020-12-21",
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
              showScheduled : true
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
    }
  }
});