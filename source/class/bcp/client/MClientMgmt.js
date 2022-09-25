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
qx.Mixin.define("bcp.client.MClientMgmt",
{
  events :
  {
    /** The client list has changed, e.g., by adding/editing a client */
    clientListChanged : "qx.event.type.Event"
  },

  statics :
  {
    /** The maximum number of family members we support */
    MAX_MEMBERS      : 14,

    /** Number of days in each month, 1-relative (ignore index 0) */
    DAYS_PER_MONTH   : [ 0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ]
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
      let             topic;

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
          "Notes",
          "Perishables",
          "Income source",
//          "Income amount",
          "USDA eligible (current)",
          "USDA override (next)",
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
          "notes_default",
          "perishables_default",
          "income_source",
//          "income_amount",
          "usda_eligible",
          "usda_eligible_next_distro",
          "pet_types",
          "address_default",
          "appt_day_default",
          "appt_time_default"
        ]);

      // Refresh the client list whenever returning to the Client tab
      page.addListener(
        "appear",
        () =>
        {
          this._getClientList();
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
      behavior.setWidth(tm.getColumnIndexById("notes_default"), 200);
      behavior.setWidth(tm.getColumnIndexById("perishables_default"), 200);
      behavior.setWidth(tm.getColumnIndexById("income_source"), 100);
//      behavior.setWidth(tm.getColumnIndexById("income_amount"), 100);
      behavior.setWidth(tm.getColumnIndexById("usda_eligible"), 150);
      behavior.setWidth(tm.getColumnIndexById("usda_eligible_next_distro"), 150);
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
          this._prepareForClientForm(tm.getDataAsMapArray()[row], row);
          table.getSelectionModel().resetSelection();
        });

      // Prepare to create a new client
      butNewClient = new qx.ui.form.Button("New Client");
      hBox.add(butNewClient);

      butNewClient.addListener(
        "execute",
        function()
        {
          this._prepareForClientForm();
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
            this._prepareForClientForm(tm.getDataAsMapArray()[row], row);
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

      topic = "clientAncillary/*";
      qx.event.message.Bus.subscribe(
        topic,
        (message) =>
        {
          let             messageData = message.getData();

          if (typeof messageData.verified == "boolean")
          {
            let tableData = this._tm.getData();
            let colName = this._tm.getColumnIndexById("family_name");
            let colVerified = this._tm.getColumnIndexById("verified");

            for (let i = 0; i < tableData.length; i++)
            {
              let row = tableData[i];
              if (row[colName] == messageData.familyName)
              {
                row[colVerified] = messageData.verified || null;

                this._tm.fireDataEvent(
                  "dataChanged",
                  {
                    firstRow    : i,
                    lastRow     : i,
                    firstColumn : colVerified,
                    lastColumn  : colVerified
                  });

                break;
              }
            }
          }
        },
        this);
    },

    /**
     * Request the client list from the server. Build the trie search
     * datastructure for the newly obtained data.
     */
    _getClientList()
    {
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
     * Retrieve family memberrs in preparation for building the client form
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _prepareForClientForm(clientInfo, row)
    {
      return Promise.resolve()
        .then(
          () =>
          {
            // New client?
            if (! clientInfo)
            {
              // Yup. No family members exist yet
              return null;
            }

            return this.rpc("getFamilyMembers", [ clientInfo.family_name ]);
          })
        .then(
          (familyMembers) =>
          {
            if (! familyMembers)
            {
              familyMembers = [];
            }

            return this._buildClientForm(clientInfo, row, familyMembers);
          })
        .catch(
          (e) =>
          {
            console.warn("Error obtaining family members:", e);
            qxl.dialog.Dialog.error(
              `Error obtaining family members: ${e}`);
          });
    },

    /**
     * Build the New/Edit Client form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildClientForm(clientInfo, row, familyMembers)
    {
      let             p;
      let             col;
      let             form;
      let             formData;
      let             message;
      let             familyMember;
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
          //
          // Family
          //

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
/*
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
*/
          usda_eligible :
          {
            type       : "SelectBox",
            label      : "Eligible for USDA<br>(current distribution)",
            value      : clientInfo.usda_eligible || "",
            options :
            [
              { label : "",    value : "" },
              { label : "Yes", value : "yes" },
              { label : "No",  value : "no" }
            ],
            properties :
            {
              tabIndex   : 7
            }
          },
          usda_eligible_next_distro :
          {
            type       : "SelectBox",
            label      : "Eligible for USDA<br>(next distribution)",
            value      : clientInfo.usda_eligible_next_distro || "",
            options :
            [
              { label : "Automatic",     value : null },
              { label : "Override: Yes", value : "yes" },
              { label : "Override: No",  value : "no" }
            ],
            properties :
            {
              tabIndex   : 8
            }
          },
          pet_types :
          {
            type       : "TextField",
            label      : "Pet types",
            value      : clientInfo.pet_types || "",
            properties :
            {
              tabIndex   : 9
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
              tabIndex   : 10
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
              tabIndex   : 11
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
            type      : "TextField",
            label     : "# of seniors (age 65+)",
            value     : (clientInfo.count_senior || 0).toString(),
            width     : 40,
            userdata  :
            {
              row       : 0,
              column    : 2
            },
            properties :
            {
              enabled    : false
            }
          },
          count_adult :
          {
            type      : "TextField",
            label     : "# of adults (age 18-64)",
            value     : (clientInfo.count_adult || 0).toString(),
            width     : 40,
            properties :
            {
              enabled    : false
            }
          },
          count_child :
          {
            type      : "TextField",
            label     : "# of children (age 0-17)",
            value     : (clientInfo.count_child || 0).toString(),
            width     : 40,
            properties :
            {
              enabled    : false
            }
          },
          count_sex_male :
          {
            type      : "TextField",
            label     : "# of males",
            value     : (clientInfo.count_sex_male || 0).toString(),
            width     : 40,
            userdata  :
            {
              row       : 4
            },
            properties :
            {
              enabled    : false
            }
          },
          count_sex_female :
          {
            type      : "TextField",
            label     : "# of females",
            value     : (clientInfo.count_sex_female || 0).toString(),
            width     : 40,
            properties :
            {
              enabled    : false
            }
          },
          count_sex_other :
          {
            type      : "TextField",
            label     : "# of other genders",
            value     : (clientInfo.count_sex_other || 0).toString(),
            width     : 40,
            properties :
            {
              enabled    : false
            }
          },
          count_veteran :
          {
            type      : "TextField",
            label     : "# of veterans",
            value     : (clientInfo.count_veteran || 0).toString(),
            width     : 40,
            userdata  :
            {
              row       : 8
            },
            properties :
            {
              enabled    : false
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
          },

          //
          // Individuals
          //
          nameHeading :
          {
            type       : "label",
            label      : "Name",
            userdata   :
            {
              page       : 1,
              row        : 0,
              column     : (col = 0)
            }
          },

          dobHeading :
          {
            type       : "label",
            label      : "Date of Birth",
            userdata   :
            {
              row        : 0,
              column     : ++col
            }
          },

          genderHeading :
          {
            type       : "label",
            label      : "Gender",
            userdata   :
            {
              row        : 0,
              column     : ++col
            }
          },

          veteranHeading :
          {
            type       : "label",
            label      : "Military status",
            userdata   :
            {
              row        : 0,
              column     : ++col
            }
          }
        };

      // Additional rows on Individuals page
      for (let row = 1, col = 0, tabIndex = 100;
           row <= bcp.client.MClientMgmt.MAX_MEMBERS;
           row++, col = 0, tabIndex++)
      {
        familyMember = familyMembers[row - 1] ||
          {
            member_name   : "",
            date_of_birth : "",
            gender        : "M",
            is_veteran    : false
          };

        formData[`name${row}`] =
          {
            type       : "TextField",
            label      : "",
            value      : familyMember.member_name,
            properties :
            {
              tabIndex   : tabIndex++
            },
            userdata   :
            {
              row        : row,
              column     : col++
            }
          };

        formData[`dob${row}`] =
          {
            type       : "TextField",
            label      : "",
            value      : familyMember.date_of_birth,
            properties :
            {
              placeholder : "YYYY-MM-DD",
              maxWidth    : 120,
              tabIndex    : tabIndex++
            },
            // validation : handled in form validation
            userdata   :
            {
              row        : row,
              column     : col++
            }
          };

        formData[`gender${row}`] =
          {
            type        : "RadioGroup",
            label       : "",
            value       : familyMember.gender,
            properties :
            {
              paddingLeft : 15,
              tabIndex    : tabIndex
            },
            orientation : "horizontal",
            options     :
            [
              { label : "Male",   value : "M", tabIndex : tabIndex },
              { label : "Female", value : "F", tabIndex : tabIndex },
              { label : "Other",  value : "O", tabIndex : tabIndex }
            ],
            userdata    :
            {
              row        : row,
              column     : col++
            }
          };

        formData[`veteran${row}`] =
          {
            type       : "CheckBox",
            label      : "Veteran",
            value      : familyMember.is_veteran,
            properties :
            {
              paddingLeft : 74,
              tabIndex    : tabIndex++
            },
            userdata   :
            {
              row        : row,
              column     : col++
            }
          };
      }

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

          // Provide access to the button, for hiding it when not on
          // Family tab
          _this._butClearAppointment = clearAppointment;
        },
        afterButtonsFunction : function(buttonBar, form)
        {
          let             butDelete;

          // Save the button bar so we have later access to it
          _this._buttonBar = buttonBar;

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
          this._nameAndDobRequiredWarning = new qx.ui.basic.Label(
            [
              "<span style='color: red;'>",
              "Family members must have both name and date of birth.",
              "</span>"
            ].join(""));
          container.add(this._nameAndDobRequiredWarning);
          this._nameAndDobRequiredWarning.setRich(true);
          this._nameAndDobRequiredWarning.exclude();

          this._nameUniqueWarning = new qx.ui.basic.Label(
            [
              "<span style='color: red;'>",
              "Family members names must be unique.",
              "</span>"
            ].join(""));
          container.add(this._nameUniqueWarning);
          this._nameUniqueWarning.setRich(true);
          this._nameUniqueWarning.exclude();

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
              "Family members have not yet been entered",
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
          let         layout;
          let         renderer;
          let         tabInfo = [];
          let         col = qxl.dialog.TabbedMultiColumnFormRenderer.column;

          //
          // Family page
          //

          layout = new qx.ui.layout.Grid();
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

          tabInfo.push(
            {
              name   : "Family",
              layout : layout
            });


          //
          // Members page
          //

          layout = new qx.ui.layout.Grid();
          layout.setSpacing(6);

          col = n => n;

          layout.setColumnMaxWidth(col(0), 1);
          layout.setColumnWidth(col(0), 1);
          layout.setColumnAlign(col(0), "center", "middle");

          layout.setColumnMaxWidth(col(1), 200);
          layout.setColumnWidth(col(1), 200);
          layout.setColumnAlign(col(1), "center", "middle");

          layout.setColumnMaxWidth(col(2), 1);
          layout.setColumnWidth(col(2), 1);
          layout.setColumnAlign(col(2), "center", "middle");

          layout.setColumnMaxWidth(col(3), 200);
          layout.setColumnWidth(col(3), 200);
          layout.setColumnAlign(col(3), "center", "middle");

          layout.setColumnMaxWidth(col(4), 1);
          layout.setColumnWidth(col(4), 1);
          layout.setColumnAlign(col(4), "center", "middle");

          layout.setColumnMaxWidth(col(5), 200);
          layout.setColumnWidth(col(5), 200);
          layout.setColumnAlign(col(5), "center", "middle");

          layout.setColumnMaxWidth(col(6), 1);
          layout.setColumnWidth(col(6), 1);
          layout.setColumnAlign(col(6), "center", "middle");

          layout.setColumnMaxWidth(col(7), 200);
          layout.setColumnWidth(col(7), 200);
          layout.setColumnAlign(col(7), "center", "middle");

          tabInfo.push(
            {
              name   : "Members",
              layout : layout
            });

          renderer = new qxl.dialog.TabbedMultiColumnFormRenderer(form, tabInfo);

          // We want to know when a tab switch occurs
          renderer.addListener(
            "changeTab",
            (e) =>
            {
              let             i;
              let             value;
              let             seniors = 0;
              let             adults = 0;
              let             children = 0;
              let             males = 0;
              let             females = 0;
              let             others = 0;
              let             veterans = 0;
              const           tabViewInfo = form.getTabViewInfo();
              const           newTabIndex = tabViewInfo.pages.indexOf(e.getData());

              // If we're not viewing the family tab, hide the 'Remove
              // default appointment' button
              _this._butClearAppointment.setVisibility(newTabIndex === 0 ? "visible" : "hidden");
              _this._buttonBar.setVisibility(newTabIndex === 0 ? "visible" : "excluded");

              function getAge(dateString, todayString = "")
              {
                let             today = todayString ? new Date(todayString) : new Date();
                let             birthDate = new Date(dateString);
                let             age = today.getFullYear() - birthDate.getFullYear();
                let             m = today.getMonth() - birthDate.getMonth();

                if (m < 0 || (m === 0 && today.getDate() <= birthDate.getDate()))
                {
                  age--;
                }

                return age;
              }

              // Are we switching to the Family tab?
              if (newTabIndex === 0)
              {
                // Yup. Calculate numbers of each age group, gender, veterans
                for (i = 1; i <= bcp.client.MClientMgmt.MAX_MEMBERS; i++)
                {
                  // Is there a date in this dob field?
                  value = this._formElements[`dob${i}`].getValue();
                  if (value)
                  {
                    // Yup. Add each age group
                    getAge(value) >= 65 && ++seniors;
                    getAge(value) >= 18 && getAge(value) <= 64 && ++adults;
                    getAge(value) <= 17 && ++children;

                    // Add genders
                    switch(this._formElements[`gender${i}`].getSelection()[0].getUserData("value"))
                    {
                    case "M" :
                      ++males;
                      break;

                    case "F" :
                      ++females;
                      break;

                    case "O" :
                      ++others;
                      break;
                    }

                    // Add veterans
                    this._formElements[`veteran${i}`].getValue() && ++veterans;
                  }
                }

                // Update the Family page
                this._formElements["count_senior"].setValue(seniors.toString());
                this._formElements["count_adult"].setValue(adults.toString());
                this._formElements["count_child"].setValue(children.toString());
                this._formElements["count_sex_male"].setValue(males.toString());
                this._formElements["count_sex_female"].setValue(females.toString());
                this._formElements["count_sex_other"].setValue(others.toString());
                this._formElements["count_veteran"].setValue(veterans.toString());

                // Re-validate
                form.validate(form.getValidationManager());
              }
            });

          // Give 'em what they came for
          return renderer;
        },
        finalizeFunction : function(form, formDialog)
        {
          let         f;
          let         manager;
          let         tabViewInfo;

          // Get the validation manager. Ensure that the entered data
          // is consistent, and that all required fields are entered.
          // When valid, enable the Save button.
          manager = form.getValidationManager();

          // Prepare a validation function
          f = function()
          {
            let             familyName;
            let             memberNames;
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
            ageSenior = parseInt(formDialog._formElements["count_senior"].getValue(), 10);
            ageAdult = parseInt(formDialog._formElements["count_adult"].getValue(), 10);
            ageChild = parseInt(formDialog._formElements["count_child"].getValue(), 10);
            sexMale = parseInt(formDialog._formElements["count_sex_male"].getValue(), 10);
            sexFemale = parseInt(formDialog._formElements["count_sex_female"].getValue(), 10);
            sexOther = parseInt(formDialog._formElements["count_sex_other"].getValue(), 10);
            veteran = parseInt(formDialog._formElements["count_veteran"].getValue(), 10);

            // Reset warnings
            _this._nameAndDobRequiredWarning.exclude();
            _this._wrongCountsWarning.exclude();
            _this._noCountsWarning.exclude();
            _this._veteranWarning.exclude();

            // Ensure that if there's a birth date, there's also a
            // member name. Store member names for additional
            // validation
            memberNames = [];
            for (let i = 1; i <= bcp.client.MClientMgmt.MAX_MEMBERS; i++)
            {
              let             fields;
              let             nameElem = formDialog._formElements[`name${i}`];
              let             dobElem = formDialog._formElements[`dob${i}`];
              let             name = nameElem.getValue() || "";
              let             dob = dobElem.getValue() || "";

              manager.add(nameElem);
              manager.add(dobElem);

              // If one of family member name and family member birth
              // date is present, both must be present.
              nameElem.setValid(!! ((! name && ! dob) || (name && dob)));

              fields = /([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])/.exec(dob);
              if ((! dob && name) || (dob && ! name))
              {
                dobElem.setValid(false);
              }
              else if (! dob)
              {
                dobElem.setValid(true);
              }
              else if (! fields ||
                       fields.length != 4 ||
                       fields[1] < 1900 || fields[1] > (new Date()).getFullYear() ||
                       fields[2] < 1 || fields[2] > 12 ||
                       fields[3] < 1 || fields[3] > bcp.client.MClientMgmt.DAYS_PER_MONTH[fields[3]] ||
                       isNaN(Date.parse(dob)))
              {
                dobElem.setValid(false);
              }
              else
              {
                dobElem.setValid(true);
              }

              if ((name && ! dob) || (! name && dob))
              {
                this._nameAndDobRequiredWarning.show();
                return false;
              }

              // We'll want to ensure these names are unique, so make a list of them
              memberNames.push(name.trim().toLowerCase());
            }

            // Filter out empty member names
            memberNames = memberNames.filter(s => s.length > 0);

            // Are all members unique?
            if ((new Set(memberNames)).size != memberNames.length)
            {
              this._nameUniqueWarning.show();
              return false;
            }

            // If there's text in Family Name, it's valid
            formDialog._formElements["family_name"].setValid(!! familyName);
            manager.add(formDialog._formElements["family_name"]);

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

          // Switch to tab 1 and then to tab 0, to force recalculation
          // of age, gender, veteran counts
          tabViewInfo = form.getTabViewInfo();
          tabViewInfo.tabView.setSelection( [ tabViewInfo.pages[1] ] );
          tabViewInfo.tabView.setSelection( [ tabViewInfo.pages[0] ] );

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
          let             familyMembers;

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

          // Move family members to a separate array, and delete
          // superfluous data
          familyMembers = [];
          for (let i = 1; i <= bcp.client.MClientMgmt.MAX_MEMBERS; i++)
          {
            // Add this family member to its list
            if (formValues[`name${i}`])
            {
              familyMembers.push(
                {
                  name    : formValues[`name${i}`],
                  dob     : formValues[`dob${i}`],
                  gender  : formValues[`gender${i}`],
                  veteran : formValues[`veteran${i}`]
                });
            }

            // Delete member-specific data from family data
            delete formValues[`name${i}`];
            delete formValues[`dob${i}`];
            delete formValues[`gender${i}`];
            delete formValues[`veteran${i}`];
          }

          // Delete headings from family data
          delete formValues["nameHeading"];
          delete formValues["dobHeading"];
          delete formValues["genderHeading"];
          delete formValues["veteranHeading"];

          this.rpc("saveClient", [ formValues, familyMembers, bNew ])
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
