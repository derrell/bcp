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
qx.Mixin.define("bcp.client.MAppointment",
{
  members :
  {
    _appointmentClients        : null,
    _appointmentForm           : null,
    _appointmentLabelToListMap : null,
    _butCancelAppointment      : null,
    _tabLabelAppointment       : null,

    /**
     * Create the appointment page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createAppointmentTab(tabView)
    {
      let             page;
      let             vBox;
      let             hBox;
      let             button;
      let             label;
      let             search;
      let             txtSearch;
      let             listSearch;
      let             cbPhone;
      let             command;
      let             formData;
      const           _this = this;

      // Generate the label for this tab
      this._tabLabelAppointment = this.underlineChar("Upcoming Appointments");

      page = new qx.ui.tabview.Page(this._tabLabelAppointment);
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+U");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      // Initialize the label to list map
      this._appointmentLabelToListMap = {};

      // Create a vbox for the client list and footer
      vBox = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      page.add(vBox);

      // Add the list of client family-names
      this._appointmentClients = new qx.ui.form.List();
      this._appointmentClients.set(
        {
          width : 240
        });
      vBox.add(this._appointmentClients, { flex : 1 });

      this._appointmentClients.addListener(
        "appear", this._onAppointmentListAppear, this);
      this._appointmentClients.addListener(
        "changeSelection", this._onAppointmentListChangeSelection, this);

      // Create an hbox for the Search facilities and checkboxes
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      vBox.add(hBox);

      // Create a search box. First its label...
      label = new qx.ui.basic.Label("Search:");
      label.set(
        {
          alignY : "middle",
          font   : "bold"
        });
      hBox.add(label);

      // ... and then the search box itself.
      search = new qx.ui.form.ComboBox();
      txtSearch = search.getChildControl("textfield");
      listSearch = search.getChildControl("list");
      search.set(
        {
          width      : 250,
        });
      txtSearch.set(
        {
          liveUpdate : true
        });
      hBox.add(search);

      cbPhone = new qx.ui.form.CheckBox("by Phone (slow)");
      hBox.add(cbPhone);

      // Each time a character is typed, build a list of all families
      // with the text in the search box within the name
      txtSearch.addListener(
        "changeValue",
        (e) =>
        {
          const           text = e.getData();
          const           byPhone = cbPhone.getValue();
          let             matches =
            byPhone
              ? this._trieSearchPhone.get(text)
              : this._trieSearchFamily.get(text);

          // Filter out matches that have no default appointment
          matches = matches.filter(
            (entry) =>
            {
              return entry.appt_time_default && entry.appt_time_default.length > 0;
            });

          if (matches.length > 0)
          {
            txtSearch.setBackgroundColor(null);
            search.open();
            search.removeAll();
            matches.forEach(
              (entry) =>
              {
                let listItem = new qx.ui.form.ListItem(entry.family_name);
                listItem.getChildControl("label").setWidth(300);
                listItem._add(new qx.ui.basic.Label(entry.phone));
                listItem.setUserData("index", entry.index);
                search.add(listItem);
              });
          }
          else if (text.length == 0)
          {
            // Remove no-match coloring when search is cleared
            search.close();
            txtSearch.setBackgroundColor(null);
          }
          else
          {
            // Indicate no match
            txtSearch.setBackgroundColor("search-failure");
            search.close();
            search.clearTextSelection();
            search.setTextSelection(text.length);
          }

        });

      // changeSelection happens on mouseover, so just find out the
      // family name here; don't actually select anything until
      // pointerdown occurs
      listSearch.addListener(
        "changeSelection",
        (e) =>
        {
          let             familyName;
          const           selection = e.getData();

          // If selection was emptied, we have nothing to do
          if (selection.length === 0)
          {
            // Just clear the found index
            setTimeout(() => listSearch.setUserData("foundIndex", null), 1);
            return;
          }

          // Scroll to this family name
          familyName = selection[0].getLabel();
          listSearch.setUserData("familyName", familyName);
        });

      listSearch.addListener(
        "pointerdown",
        (e) =>
        {
          let             familyName = listSearch.getUserData("familyName");

          // Clear the selected row to prevent mistakes on next search
          listSearch.setUserData("familyName", null);

          // Clear the search box
          search.close();
          txtSearch.setValue("");
          search.removeAll();

          if (! familyName)
          {
            return;
          }

          this._appointmentClients.setSelection(
            [ this._appointmentLabelToListMap[familyName] ] );
        });

      // After a new client is created, we'll get an event that tells us
      // the client list was changed. The event data contains the family
      // name, so we can pre-select that family for fulfullment.
      this.addListener(
        "clientListChanged",
        (e) =>
        {
          let             data;
          let             selection;

          // The purpose of this is so that New Client on the
          // Appointment tab pre-selects the just-added client. We
          // don't want to pre-select anything if we're not on the
          // Appointment tab, e.g., a client is edited from the
          // Clients page)
          selection = this._tabView.getSelection();
          if (selection[0].getLabel() != this._tabLabelAppointment)
          {
            return;
          }

          // Refresh the list
          this._onAppointmentListAppear();

          // If one is provided, select the given family name
          data = e.getData();
          if (data && data.family_name)
          {
            this._appointmentClients.setSelection(
              [ this._appointmentLabelToListMap[data.family_name] ] );
          }
        });

      // Create the form for adding/editing a appointment record
      this._appointmentForm = new qxl.dialog.FormEmbed(
        {
          callback         : function(result)
          {
            console.log("result=", result);
          },
          beforeFormFunction : function(container)
          {
            let             hbox;
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
                const           form = _this._appointmentForm;
                const           formElements = form._formElements;

                day = formElements.appt_day_default.getValue();
                time = formElements.appt_time_default.getUserData("time24");
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
            _this._butCancelAppointment =
              new qx.ui.form.Button("Cancel appointment");
            hbox.add(_this._butCancelAppointment);
            _this._butCancelAppointment.addListener(
              "execute",
              function(e)
              {
                const           form = _this._appointmentForm;
                const           formElements = form._formElements;

                qxl.dialog.Dialog.confirm(
                  "Are you sure you want to cancel this appointment?",
                  (result) =>
                  {
                    const           dist = formElements.distribution;

                    // If they're not sure, don't do it
                    if (! result)
                    {
                      return;
                    }

                    form._cancelButton.execute();
                    _this.rpc(
                      "deleteFulfillment",
                      [
                        {
                          distribution : dist.getValue().getLabel(),
                          family_name  : dist.getUserData("family_name")
                        }
                      ])
                      .catch(
                        (e) =>
                        {
                          console.warn("Error deleting appointment:", e);
                          qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                        });
                  },
                  null,
                  "Confirm");
              });
          },
          afterFormFunction : function(container, form)
          {
            _this._requireAppointment = new qx.ui.basic.Label(
              [
                "<span style='color: red;'>",
                "An appointment is required",
                "</span>"
              ].join(""));
            container.add(_this._requireAppointment);
            _this._requireAppointment.setRich(true);
            _this._requireAppointment.exclude();
          },
          addContainerFunction : function(container, form)
          {
            let             scrollContainer = new qx.ui.container.Scroll();

            scrollContainer.add(container);
            form.add(scrollContainer);

            // When the scroll container appears, determine the width
            // of the list, and resize the scroll container to use
            // remaining horizontal space for it.
            scrollContainer.addListenerOnce(
              "appear",
              () =>
              {
                let             layoutParent = form.getLayoutParent();
                let             parentBounds = layoutParent.getBounds();
                let             children = layoutParent.getChildren();
                let             listBounds = children[0].getBounds();

                scrollContainer.set(
                  {
                    width  : parentBounds.width - listBounds.width - 20,
                    height : listBounds.height
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
          },
          finalizeFunction : function(form, formDialog)
          {
            let             f;
            let             manager;
            const           appointments =
                  formDialog._formElements["appointments"];

            //
            // Use a validation manager. Ensure that the entered data is
            // consistent, and that all required fields are entered.
            // When valid, enable the Save button.
            //

            // Instantiate a validation manager
            form._validationManager = manager =
              new qx.ui.form.validation.Manager();

            // Prepare a validation function
            f = function()
            {
              // Enable the Save button if the form validates
              manager.bind(
                "valid",
                formDialog._okButton,
                "enabled",
               {
                  converter: function(value)
                  {
                    return value || false;
                  }
                });

              // Reset warnings
              _this._requireAppointment.exclude();

              // An appointment time is required
              if (! appointments.getValue())
              {
                _this._requireAppointment.show();
                return false;
              }

              return true;
            }.bind(this);

            // Use that validator
            manager.setValidator(f);
            form.validate(manager);
          }
        });

      // Initially hide form
      this._appointmentForm.hide();

      // When the form is OK'ed or Canceled, remove list-box selection
      this._appointmentForm.addListener(
        "ok", this._onAppointmentOkOrCancel, this);
      this._appointmentForm.addListener(
        "cancel", this._onAppointmentOkOrCancel, this);

      page.add(this._appointmentForm);
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
    _disableAllForAppointment : function(bDisable)
    {
      this._appointmentClients.setEnabled(! bDisable);

      // Disable/Enable all tabs other than the current one
      this._tabView.getChildren().forEach(
        (child) =>
        {
          if (child.getLabel() != this._tabLabelAppointment)
          {
            child.getChildControl("button").setEnabled(! bDisable);
          }
        });
    },

    /**
     * Remove the selection in the client list when Ok or Cancel is
     * selected in the detail form
     */
    _onAppointmentOkOrCancel : function()
    {
      // Re-enable access to the rest of the gui
      this._disableAllForAppointment(false);

      // Remove the selection. We're ready for the next appointment
      this._appointmentClients.resetSelection();
    },

    _onAppointmentListAppear : function()
    {
      this._appointmentClients.removeAll();

      // Recreate the list of clients
      this._tm.getDataAsMapArray()
        .filter(
          (entry) =>
          {
            return entry.appt_time_default && entry.appt_time_default.length > 0;
          })
        .sort(
          (a, b) =>
          {
            a = a.family_name.toLowerCase();
            b = b.family_name.toLowerCase();
            return a < b ? -1 : a > b ? 1 : 0;
          })
        .forEach(
          (entry) =>
          {
            let             listItem;

            listItem = new qx.ui.form.ListItem(entry.family_name);
            this._appointmentLabelToListMap[entry.family_name] = listItem;
            this._appointmentClients.add(listItem);
          });
    },

    _onAppointmentListChangeSelection : function(e)
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

      // Fill in the appointment form and process its result
      this._handleAppointmentForm(familyName);
    },

    _handleAppointmentForm : function(familyName, distributionStart)
    {
      let             formData;
      let             client;
      let             _this = this;

      // Concurrently, retrieve the distribution list and this appointment
      this.rpc(
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
            let             clientInfo = data.clientInfo;
            let             bNew = data.fulfillment.length === 0;
            let             fulfillment = data.fulfillment[0] || {};

            // Disable access to the rest of the gui while working
            // with the form
            this._disableAllForAppointment(true);

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
            client = clientInfo.filter(
              (entry) =>
              {
                return entry.family_name == familyName;
              })[0];

            // In case there was no default appointment time so the
            // record wasn't returned, create a default client entry
            client = client || {};

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
                    distributions : distributions,
                    family_name   : familyName // in case of Cancel Appointment
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

                notes :
                {
                  type       : "TextArea",
                  label      : "Notes",
                  lines      : 3,
                  value      : (fulfillment.notes ||
                                (bNew ? client.notes_default : "") ||
                                ""),
                  properties :
                  {
                    height     : 70
                  }
                },

                perishables :
                {
                  type       : "TextArea",
                  label      : "Perishables",
                  lines      : 3,
                  value      : (fulfillment.perishables ||
                                (bNew ? client.perishables_default : "") ||
                                ""),
                  properties :
                  {
                    height     : 70
                  }
                },

                default_apointment_label :
                {
                  type       : "Label",
                  label      : this.bold("Default Appointment"),
                  userdata   :
                  {
                    row        : 4    // leave a blank row above
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
                  value      : (
                    client.appt_time_default
                      ? this.convert24to12(client.appt_time_default)
                      : null),
                  enabled    : false,
                  userdata   :
                  {
                    time24     : client.appt_time_default || null
                  }
                },

                usda_eligible :
                {
                  type       : "SelectBox",
                  label      : "Eligible for USDA<br>(current distribution)",
                  value      : client.usda_eligible || "",
                  options :
                  [
                    { label : "",    value : "" },
                    { label : "Yes", value : "yes" },
                    { label : "No",  value : "no" }
                  ]
                },

                usda_eligible_next_distro :
                {
                  type       : "SelectBox",
                  label      : "Eligible for USDA<br>(next distribution)",
                  value      : client.usda_eligible_next_distro || "",
                  options :
                  [
                    { label : "Automatic",     value : null },
                    { label : "Override: Yes", value : "yes" },
                    { label : "Override: No",  value : "no" }
                  ]
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
                  events    :
                  {
                    changeValue : function(e)
                    {
                      setTimeout(
                        () => _this._appointmentForm.getForm().validate(),
                        100);
                    }
                  },
                  userdata   :
                  {
                    row      : 0,
                    column   : 4,
                    rowspan  : 10
                  }
                },

                fulfilled :
                {
                  type      : "CheckBox",
                  label     : "Fulfilled",
                  value     : !! fulfillment.fulfilled
                }
              };

            this._appointmentForm.set(
              {
                message          : this.bold(familyName || ""),
                labelColumnWidth : 180,
                formData         : formData
              });

            this._appointmentForm._okButton.set(
              {
                rich    : true,
                label   : this.underlineChar("Save"),
                command : new qx.ui.command.Command("Alt+S")
              });

            this._appointmentForm.promise()
              .then(
                (result) =>
                {
                  // If the form was cancelled...
                  if (! result)
                  {
                    // ... then just reset the selection, ...
                    this._appointmentClients.resetSelection();

                    // ... and get outta Dodge!
                    return Promise.resolve();
                  }

                  // Ensure the start date is included in the data to be saved
                  result.family_name = familyName;

                  return this.rpc("saveFulfillment", [ result ])
                    .catch(
                      (e) =>
                      {
                        console.warn("Error saving changes:", e);
                        qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                      });
                });

            // If this is an existing appointment that has not been
            // fulfilled, then show the Cancel Appointment button;
            // otherwise hide it.
            if (fulfillment.appt_time && ! fulfillment.fulfilled)
            {
              this._butCancelAppointment.show();
            }
            else
            {
              this._butCancelAppointment.exclude();
            }

            this._appointmentForm.show();
          })
        .catch(
          (e) =>
          {
            console.error("getAppointments:", e);
            qxl.dialog.Dialog.error(e.message);
          });
    }
  }
});
