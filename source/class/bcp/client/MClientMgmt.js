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
qx.Mixin.define("bcp.client.MClientMgmt",
{
  events :
  {
    /** The client list has changed, e.g., by adding/editing a client */
    clientListChanged : "qx.event.type.Event"
  },

  members :
  {
    /** The client table */
    _clientTable      : null,

    /** The client table model */
    _tm               : null,

    /** This tab's label */
    _tabLabelClient   : null,

    /** Trie Search for clients by family name */
    _trieSearchFamily : null,

    /** Trie Search for clients by phone number */
    _trieSearcPhone   : null,

    /**
     * Create the client list page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createClientListTab(tabView)
    {
      let             page;
      let             tm;
      let             table;
      let             tcm;
      let             hBox;
      let             button;
      let             command;
      let             butNewClient;
      let             label;
      let             search;
      let             listSearch;
      let             txtSearch;
      let             cbPhone;
      let             data;
      let             custom;
      let             behavior;
      let             cellRenderer;

      // Generate the label for this tab
      this._tabLabelClient = this.underlineChar("Clients");

      page = new qx.ui.tabview.Page(this._tabLabelClient);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+C");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      this._tm = tm = new qx.ui.table.model.Simple();
      tm.setColumns(
        [
          "Family",
          "Phone",
          "Email",
          "Ethnicity",
          "Verified",
          "# seniors",
          "# adults",
          "# children",
          "# male",
          "# female",
          "# ?gender",
          "# veteran",
          "Notes",
          "Perishables",
          "Income source",
          "Income amount",
          "Pet types",
          "Address",
          "Appt day",
          "Appt time"
        ],
        [
          "family_name",
          "phone",
          "email",
          "ethnicity",
          "verified",
          "count_senior",
          "count_adult",
          "count_child",
          "count_sex_male",
          "count_sex_female",
          "count_sex_other",
          "count_veteran",
          "notes_default",
          "perishables_default",
          "income_source",
          "income_amount",
          "pet_types",
          "address_default",
          "appt_day_default",
          "appt_time_default"
        ]);

      // TODO
      this.rpc("getClientList", [])
        .then(
          (result) =>
          {
            if (! result)
            {
              return;
            }

            // Add the provided client list, munging column data as necessary
            result = result.map(
              (client) =>
              {
                this._mungeClient(client);
                return client;
              });
            this._tm.setDataAsMapArray(result, true);

            // Sort initially by the Family column
            this._tm.sortByColumn(
              this._tm.getColumnIndexById("family_name"), true);

            // Build the search trees
            this._generateTrieSearch();
          })
        .catch(
          (e) =>
          {
            console.warn("getClientList:", e);
            qxl.dialog.Dialog.alert(
              `Could not retrieve client list: ${e.message}`);
          });

      // Prepare to use the Resize column model, for better column widths
      custom =
        {
          tableColumnModel : (obj) => new qx.ui.table.columnmodel.Resize(obj)
        };

      table = this._clientTable = new qx.ui.table.Table(tm, custom).set(
        {
          statusBarVisible       : false,
          showCellFocusIndicator : false,
          minHeight              : 100,
          height                 : 100
        });
      page.add(table, { flex : 1 });

      tcm = table.getTableColumnModel();

      // Specify column widths
      behavior = tcm.getBehavior();
      behavior.setWidth(tm.getColumnIndexById("family_name"), 180);
      behavior.setWidth(tm.getColumnIndexById("phone"), 100);
      behavior.setWidth(tm.getColumnIndexById("email"), 100);
      behavior.setWidth(tm.getColumnIndexById("ethnicity"), 80);
      behavior.setWidth(tm.getColumnIndexById("verified"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_senior"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_adult"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_child"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_sex_male"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_sex_female"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_sex_other"), 70);
      behavior.setWidth(tm.getColumnIndexById("count_veteran"), 70);
      behavior.setWidth(tm.getColumnIndexById("notes_default"), 200);
      behavior.setWidth(tm.getColumnIndexById("perishables_default"), 200);
      behavior.setWidth(tm.getColumnIndexById("income_source"), 100);
      behavior.setWidth(tm.getColumnIndexById("income_amount"), 100);
      behavior.setWidth(tm.getColumnIndexById("pet_types"), 100);
      behavior.setWidth(tm.getColumnIndexById("address_default"), 100);
      behavior.setWidth(tm.getColumnIndexById("appt_day_default"), 60);
      behavior.setWidth(tm.getColumnIndexById("appt_time_default"), 80);

      // Sort family name case insensitive
      tm.setSortMethods(
        tm.getColumnIndexById("family_name"),
        (a, b) =>
        {
          let             index;

          // Get the index of the family_name column
          index = tm.getColumnIndexById("family_name");

          a = a[index].toLowerCase();
          b = b[index].toLowerCase();

          return a < b ? -1 : a > b ? 1 : 0;
        });

      // Allow sorting for appointment viewing
      tm.setSortMethods(
        tm.getColumnIndexById("appt_day_default"),
        (aRow, bRow) =>
        {
          let             a;
          let             b;
          let             index;

          // Start with appointment day
          index = tm.getColumnIndexById("appt_day_default");

          a = aRow[index] ? aRow[index] : "";
          b = bRow[index] ? bRow[index] : "";

          if (a != "" && b == "")
          {
            return -1;
          }

          if (a == "" && b != "")
          {
            return 1;
          }

          if (a < b)
          {
            return -1;
          }

          if (a > b)
          {
            return 1;
          }

          // Appointment days were the same. Try appointment time
          index = tm.getColumnIndexById("appt_time_default");

          a = aRow[index] ? aRow[index] : "";
          b = bRow[index] ? bRow[index] : "";

          if (a != "" && b == "")
          {
            return -1;
          }

          if (a == "" && b != "")
          {
            return 1;
          }

          if (a < b)
          {
            return -1;
          }

          if (a > b)
          {
            return 1;
          }

          // Both were the same. They sort equally. Sort by family name
          index = tm.getColumnIndexById("family_name");
          return (aRow[index] < bRow[index]
                  ? -1
                  : (aRow[index] > bRow[index]
                     ? 1
                     : 0));
        });

      // The 'verified' column shows a checkmark when client is verified
      cellRenderer = new qx.ui.table.cellrenderer.Boolean();
      cellRenderer.set(
        {
          iconTrue  : "qxl.dialog.icon.ok"
        });
      tcm.setDataCellRenderer(tm.getColumnIndexById("verified"), cellRenderer);

      // Users requested that numeric columns be centered
      [
        "count_senior",
        "count_adult",
        "count_child",
        "count_sex_male",
        "count_sex_female",
        "count_sex_other",
        "count_veteran"
      ].forEach(
        (id) =>
        {
          cellRenderer = new bcp.client.CenterCellRenderer();
          tcm.setDataCellRenderer(tm.getColumnIndexById(id), cellRenderer);
        });

      // Appointment time gets a renderer that converts from 24 to 12-hour time
      cellRenderer = new bcp.client.TimeCellRenderer();
      tcm.setDataCellRenderer(
        tm.getColumnIndexById("appt_time_default"),
        cellRenderer);


      // Create an hbox for the buttons at the bottom. Force some
      // space above it
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
      hBox.set(
        {
          marginTop : 20
        });
      page.add(hBox);

      // Handle tap to edit an existing client
      table.addListener(
        "cellTap",
        (e) =>
        {
          let             row = e.getRow();
          this._buildClientForm(tm.getDataAsMapArray()[row], row);
          table.getSelectionModel().resetSelection();
        });

      // Prepare to create a new client
      butNewClient = new qx.ui.form.Button("New Client");
      hBox.add(butNewClient);

      butNewClient.addListener(
        "execute",
        function()
        {
          this._buildClientForm();
        },
        this);

      hBox.add(new qx.ui.core.Spacer(20, 20));

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
          const           matches =
            byPhone
              ? this._trieSearchPhone.get(text)
              : this._trieSearchFamily.get(text);

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

      listSearch.addListener(
        "changeSelection",
        (e) =>
        {
          let             foundIndex;
          const           selection = e.getData();

          // If selection was emptied, we have nothing to do
          if (selection.length === 0)
          {
            // Just clear the found index
            setTimeout(() => listSearch.setUserData("foundIndex", null), 1);
            return;
          }

          // Scroll to this entry in the table
          foundIndex = selection[0].getUserData("index");
          table.scrollCellVisible(0, foundIndex);

          // Save the found index
          listSearch.setUserData("foundIndex", foundIndex);
        });

      listSearch.addListener(
        "pointerdown",
        (e) =>
        {
          let             row;

          // Ensure that the table is sorted by Family when searching
          tm.sortByColumn(tm.getColumnIndexById("family_name"), 1);

          // Get the selected row
          row  = listSearch.getUserData("foundIndex");

          // Clear the selected row to prevent mistakes on next search
          listSearch.setUserData("foundIndex", null);

          // If there's a selection in the list...
          if (row !== null)
          {
            // ... then open that row
            this._buildClientForm(tm.getDataAsMapArray()[row], row);
          }
          else
          {
            // Close the search box and remove all items from the list
            search.close();
          }

          // Clear the search box
          txtSearch.setValue("");
          search.removeAll();
        });
    },

    /**
     * The database data isn't quite in the form that we want to display it.
     * Alter some fields for display.
     *
     * @param client {Map}
     *   The data for a single client
     */
    _mungeClient(client)
    {
      // Convert verified from numeric 0/1 to boolean false/true
      if (client.verified === 1)
      {
        client.verified = true;
      }
      else if (client.verified === 0)
      {
        client.verified = null;
      }

      // Ensure phone numbers are in consistent form
      if (client.phone && client.phone.trim())
      {
        client.phone = client.phone.trim().replace(/-/g, "");
        client.phone = client.phone.replace(
          /^(\d{3})(\d{3})(\d{4})$/gm,
          "$1-$2-$3");
      }
    },

    /**
     * Create the search trees for family and phone
     *
     * @ignore(require)
     */
    _generateTrieSearch()
    {
      const           clients = this._tm.getDataAsMapArray();
      const           TrieSearch = require("trie-search");

      // Rebuild the index list, for fast retrieval
      clients.forEach(
        (client, index) =>
        {
          client.index = index;
        });

      // Prepare for type-ahead search by family name
      this._trieSearchFamily = new TrieSearch("family_name");
      this._trieSearchFamily.addAll(clients);

      // Prepare for type-ahead search by phone
      this._trieSearchPhone = new TrieSearch("phone");
      this._trieSearchPhone.addAll(clients);
    },

    /**
     * Build the New/Edit Client form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildClientForm(clientInfo, row)
    {
      let             p;
      let             form;
      let             formData;
      let             message;
      const           bNew = ! clientInfo;
      const           caption = "Client Detail";
      const           _this = this;
      
      // Ensure there's a map we can dereference for default values
      clientInfo = clientInfo || {};

      message =
        bNew
        ? "<span style='font-weight: bold;'>New Client</span>"
        : "";

      formData =
        {
          family_name:
          {
            type       : "TextField",
            label      : "Family Name",
            value      : clientInfo.family_name || "",
            validation :
            {
              required   : true
            },
            properties :
            {
              tabIndex   : 1
            }
          },
          address_default :
          {
            type       : "TextArea",
            label      : "Address",
            lines      : 3,
            value      : clientInfo.address_default || "",
            userdata   :
            {
              rowspan    : 2
            },
            properties :
            {
              tabIndex   : 2
            }
          },
          phone :
          {
            type       : "TextField",
            label      : "Phone",
            value      : clientInfo.phone || "",
            properties :
            {
              tabIndex   : 3
            }
          },
          email :
          {
            type       : "TextField",
            label      : "Email",
            value      : clientInfo.email || "",
            properties :
            {
              tabIndex   : 4
            }
          },
          ethnicity :
          {
            type       : "SelectBox",
            label      : "Ethnicity",
            value      : clientInfo.ethnicity || "Undeclared",
            options :
            [
              { label : "Undeclared",       value : "Undeclared" },
              { label : "African American", value : "African American" },
              { label : "Amer. Indian",     value : "Amer. Indian" },
              { label : "Asian",            value : "Asian" },
              { label : "Hispanic",         value : "Hispanic" },
              { label : "White",            value : "White" }
            ],
            properties :
            {
              tabIndex   : 5
            }
          },
          income_source :
          {
            type       : "TextField",
            label      : "Income source",
            value      : clientInfo.income_source || "",
            properties :
            {
              tabIndex   : 6
            }
          },
          income_amount :
          {
            type       : "TextField",
            label      : "Income amount",
            value      : (clientInfo.income_amount || "").toString(),
            properties :
            {
              tabIndex   : 7
            }
          },
          pet_types :
          {
            type       : "TextField",
            label      : "Pet types",
            value      : clientInfo.pet_types || "",
            properties :
            {
              tabIndex   : 8
            }
          },
          notes_default :
          {
            type       : "TextArea",
            label      : "Notes",
            lines      : 3,
            value      : clientInfo.notes_default || "",
            userdata   :
            {
              rowspan    : 2
            },
            properties :
            {
              tabIndex   : 9
            }
          },
          perishables_default :
          {
            type       : "TextArea",
            label      : "Perishables",
            lines      : 3,
            value      : clientInfo.perishables_default || "",
            userdata   :
            {
              rowspan    : 2
            },
            properties :
            {
              tabIndex   : 10
            }
          },
          verified :
          {
            type       : "Checkbox",
            label      : "Verified",
            value      : clientInfo.verified || false,
            properties :
            {
              tabIndex   : null
            }
          },
          count_senior :
          {
            type      : "spinner",
            label     : "# of seniors (age 65+)",
            value     : clientInfo.count_senior || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 0,
              column    : 2
            },
            properties :
            {
              tabIndex   : 11
            }
          },
          count_adult :
          {
            type      : "spinner",
            label     : "# of adults (age 18-64)",
            value     : clientInfo.count_adult || 0,
            min       : 0,
            step      : 1,
            properties :
            {
              tabIndex   : 12
            }
          },
          count_child :
          {
            type      : "spinner",
            label     : "# of children (age 0-17)",
            value     : clientInfo.count_child || 0,
            min       : 0,
            step      : 1,
            properties :
            {
              tabIndex   : 13
            }
          },
          count_sex_male :
          {
            type      : "spinner",
            label     : "# of males",
            value     : clientInfo.count_sex_male || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 4
            },
            properties :
            {
              tabIndex   : 14
            }
          },
          count_sex_female :
          {
            type      : "spinner",
            label     : "# of females",
            value     : clientInfo.count_sex_female || 0,
            min       : 0,
            step      : 1,
            properties :
            {
              tabIndex   : 15
            }
          },
          count_sex_other :
          {
            type      : "spinner",
            label     : "# of other genders",
            value     : clientInfo.count_sex_other || 0,
            min       : 0,
            step      : 1,
            properties :
            {
              tabIndex   : 16
            }
          },
          count_veteran :
          {
            type      : "spinner",
            label     : "# of veterans",
            value     : clientInfo.count_veteran || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 8
            },
            properties :
            {
              tabIndex   : 17
            }
          },
          default_appointment :
          {
            type       : "appointments",
            label      : "Default appointment time",
            value      : (
              clientInfo.appt_time_default
              ? {
                  day  : clientInfo.appt_day_default,
                  time : clientInfo.appt_time_default
                }
              : null),
            properties :
            {
              showScheduled : false,
              tabIndex      : null
            },
            userdata   :
            {
              row      : 0,
              column   : 4,
              rowspan  : 20
            }
          }
        };

      form = new qxl.dialog.Form(
      {
        caption                   : caption,
        message                   : message,
        context                   : this,
        beforeFormFunction : function(container)
        {
          let             hbox;
          let             clearAppointment;
          let             useDefaultAppointment;

          // Get the hbox in which the message label is placed
          hbox = container.getUserData("messageHBox");

          // Right-justify the button
          hbox.add(new qx.ui.core.Spacer(), { flex : 1 });

          // Create a button to clear any existing appointment
          clearAppointment = new qx.ui.form.Button(
            "Remove default appointment");
          hbox.add(clearAppointment);
          clearAppointment.addListener(
            "execute",
            function(e)
            {
              const           formElements = form._formElements;
              formElements.default_appointment.set(
                {
                  value : null
                });
            });
        },
        afterButtonsFunction : function(buttonBar, form)
        {
          let             butDelete;

          // If the user doesn't have permission to delete (level 60),
          // then there's no reason to add a Delete button
          if (_this._me.permissionLevel < 60)
          {
            return;
          }

          // Create the Delete button
          butDelete = new qx.ui.form.Button("Delete");
          butDelete.setWidth(100);

          butDelete.addListener(
            "execute",
            () =>
            {
              let             confirm;

               confirm = qxl.dialog.Dialog.confirm(
                 "Are you absolutely sure you want to delete this client? " +
                   "This will delete all Fulfillment history for this " +
                   "client as well.",
                (result) =>
                {
                  // If they didn't confirm, we have nothing to do
                  if (! result)
                  {
                    return;
                  }

                  // Do normal form cancellation
                  form._cancelButton.execute();

                  // Issue the request to delete this client
                  _this.rpc(
                    "deleteClient",
                    [
                      {
                        family_name  : clientInfo.family_name
                      }
                    ])
                    .catch(
                      (e) =>
                      {
                        console.warn("Error deleting client:", e);
                        qxl.dialog.Dialog.error(
                          `Error deleting client: ${e}`);
                      })

                    // Re-retrieve the client list
                    .then(
                      () =>
                      {
                        this.rpc("getClientList", [])
                          .then(
                            (result) =>
                            {
                              if (! result)
                              {
                                return;
                              }

                              // Add the provided client list, munging
                              // column data as necessary
                              result = result.map(
                                (client) =>
                                {
                                  this._mungeClient(client);
                                  return client;
                                });
                              this._tm.setDataAsMapArray(result, true);

                              // Sort initially by the Family column
                              this._tm.sortByColumn(
                                this._tm.getColumnIndexById("family_name"),
                                true);

                              // Build the search trees
                              this._generateTrieSearch();
                            })
                          .catch(
                            (e) =>
                            {
                              console.warn("getClientList:", e);
                              qxl.dialog.Dialog.alert(
                                "Could not retrieve client list: " +
                                  e.message);
                            });
                      });
                },
                null,
                "Confirm");
              confirm.setWidth(500);
            });

          // Add the delete button at far left, and add spacer to
          // center Save/Cancel buttons
          buttonBar.addAt(butDelete, 0);
          buttonBar.addAt(new qx.ui.core.Spacer(), 1, { flex : 1 });

          // Add corresponding space on right side of Save/Cancel buttons
          buttonBar.add(new qx.ui.core.Spacer(), { flex : 1});
          buttonBar.add(new qx.ui.core.Spacer(100));
        },
        afterFormFunction : function(container, form)
        {
          this._wrongCountsWarning = new qx.ui.basic.Label(
            [
              "<span style='color: red;'>",
              "The counts by age do not match counts by sex",
              "</span>"
            ].join(""));
          container.add(this._wrongCountsWarning);
          this._wrongCountsWarning.setRich(true);
          this._wrongCountsWarning.exclude();

          this._noCountsWarning = new qx.ui.basic.Label(
            [
              "<span style='color: red;'>",
              "Family counts have not yet been entered",
              "</span>"
            ].join(""));
          container.add(this._noCountsWarning);
          this._noCountsWarning.setRich(true);
          this._noCountsWarning.exclude();

          this._veteranWarning = new qx.ui.basic.Label(
            [
              "<span style='color: red;'>",
              "The number of veterans exceeds the number of family members",
              "</span>"
            ].join(""));
          container.add(this._veteranWarning);
          this._veteranWarning.setRich(true);
          this._veteranWarning.exclude();
        },
        setupFormRendererFunction : function(form) {
          var         renderer = new qxl.dialog.MultiColumnFormRenderer(form);
          var         layout = new qx.ui.layout.Grid();
          const       col = renderer.column;

          layout.setSpacing(6);

          layout.setColumnMaxWidth(col(0), this.getLabelColumnWidth());
          layout.setColumnWidth(col(0), this.getLabelColumnWidth());
          layout.setColumnAlign(col(0), "right", "top");

          layout.setColumnFlex(col(1), 1);
          layout.setColumnAlign(col(1), "left", "top");

          layout.setColumnMaxWidth(col(2), this.getLabelColumnWidth());
          layout.setColumnWidth(col(2), this.getLabelColumnWidth());
          layout.setColumnAlign(col(2), "right", "top");

          layout.setColumnFlex(col(3), 1);
          layout.setColumnAlign(col(3), "left", "top");

          layout.setColumnMaxWidth(col(4), this.getLabelColumnWidth());
          layout.setColumnWidth(col(4), this.getLabelColumnWidth());
          layout.setColumnAlign(col(4), "right", "top");

          layout.setColumnFlex(col(5), 1);
          layout.setColumnAlign(col(5), "left", "top");

          renderer._setLayout(layout);

          // Give 'em what they came for
          return renderer;
        },
        finalizeFunction : function(form, formDialog)
        {
          let         f;
          let         manager;

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
            let             familyName;
            let             ageSenior;
            let             ageAdult;
            let             ageChild;
            let             sexMale;
            let             sexFemale;
            let             sexOther;
            let             veteran;

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

            familyName = formDialog._formElements["family_name"].getValue();
            ageSenior = formDialog._formElements["count_senior"].getValue();
            ageAdult = formDialog._formElements["count_adult"].getValue();
            ageChild = formDialog._formElements["count_child"].getValue();
            sexMale = formDialog._formElements["count_sex_male"].getValue();
            sexFemale = formDialog._formElements["count_sex_female"].getValue();
            sexOther = formDialog._formElements["count_sex_other"].getValue();
            veteran = formDialog._formElements["count_veteran"].getValue();

            // If there's text in Family Name, it's valid
            formDialog._formElements["family_name"].setValid(!! familyName);
            manager.add(formDialog._formElements["family_name"]);

            // Reset warnings
            _this._wrongCountsWarning.exclude();
            _this._noCountsWarning.exclude();
            _this._veteranWarning.exclude();

            // Sums of by-age and by-sex must match
            if (ageSenior + ageAdult + ageChild !=
                sexMale + sexFemale + sexOther)
            {
              _this._wrongCountsWarning.show();
              return false;
            }

            // There must be at least one family member
            if (ageSenior + ageAdult + ageChild <= 0)
            {
              _this._noCountsWarning.show();
              return false;
            }

            // Number of veterans must not exceed number of family members
            if (veteran > ageSenior + ageAdult + ageChild)
            {
              _this._veteranWarning.show();
              return false;
            }

            return true;
          }.bind(this);

          // Use that validator
          manager.setValidator(f);
          form.validate(manager);
        }
      });

      form.set(
        {
          labelColumnWidth : 150,
          formData         : formData,
        });
      form._okButton.set(
        {
          label   : "Save"
        });
      form.show();


      // Focus the first field upon appear
      form.addListener(
        "appear",
        () =>
        {
          // If the family name field is enabled...
          if (form._formElements["family_name"].getEnabled())
          {
            // ... then focus it
            form._formElements["family_name"].focus();
          }
          else
          {
            // Otherwise, focus the default delivery address field
            form._formElements["address_default"].focus();
          }
        },
        this);

      p = form.promise();

      p.then(
        (formValues) =>
        {
          // Cancelled?
          if (! formValues)
          {
            // Yup. Nothing to do
            return;
          }

          // Convert the appointment value (a map) to its constituent values
          if (formValues.default_appointment)
          {
            formValues.appt_day_default = formValues.default_appointment.day;
            formValues.appt_time_default = formValues.default_appointment.time;
          }
          else
          {
            formValues.appt_day_default = 1;
            formValues.appt_time_default = "";
          }
          delete formValues.default_appointment;

          // Be sure notes_default is empty string if all whitespace
          formValues.notes_default = formValues.notes_default.trim();

          // Similarly for perishables
          formValues.perishables_default =
            formValues.perishables_default.trim();

          // Add the record name to be updated, in case of rename
          formValues.family_name_update =
            clientInfo.family_name || formValues.family_name;

          console.log("formValues=", formValues);

          this.rpc("saveClient", [ formValues, bNew ])
            .then(
              (result) =>
              {
                console.log(`saveClient result: ${result}`);

                // A result means something failed.
                if (result)
                {
                  qxl.dialog.Dialog.error(result);
                  return;
                }

                // We want nothing displayed for verified==false.
                // Change to null.
                if (! formValues.verified)
                {
                  formValues.verified = null;
                }

                // Find this family name in the table
                row =
                  this._tm
                  .getDataAsMapArray()
                  .map(rowData => rowData.family_name)
                  .indexOf(formValues.family_name_update);

                this._mungeClient(formValues);

                // Does it already exist?
                if (row >= 0)
                {
                  // Yup. Replace the data for that row
                  this._tm.setRowsAsMapArray([formValues], row, true, false);
                }
                else
                {
                  // It's new. Add it.
                  this._tm.addRowsAsMapArray([formValues], null, true, false);
                }

                // Resort  by the Family column
                this._tm.sortByColumn(
                  this._tm.getSortColumnIndex(), true);

                // Recreate the search trees
                this._generateTrieSearch();

                // Let listeners know the client list changed
                this.fireDataEvent(
                  "clientListChanged",
                  {
                    family_name : formValues.family_name
                  });

              })
            .catch(
              (e) =>
              {
                console.warn("Error saving changes:", e);
                if (e.code == this.constructor.RpcError.AlreadyExists)
                {
                  qxl.dialog.Dialog.error(
                    `Family name "${formValues.family_name}" already exists`);
                }
                else
                {
                  qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                }
              });
        });
    }
  }
});
