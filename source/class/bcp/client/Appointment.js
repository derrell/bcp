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
qx.Class.define("bcp.client.Appointment",
{
  extend     : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct()
  {
    // Establish a layout for this container
    this.base(arguments, new qx.ui.layout.VBox());

    // We want to use some of the high-level node operation convenience
    // methods rather than manually digging into the TreeVirtual helper
    // classes.  Include the mixin that provides them.
    qx.Class.include(qx.ui.treevirtual.TreeVirtual,
                     qx.ui.treevirtual.MNode);

    // Create the tree in default state
    this._buildAppointmentTree();

    this.addListener("appear", this._onAppear, this);
  },

  properties :
  {
    value :
    {
      init      : null,
      nullable  : true,
      check     : "Map",
      event     : "changeValue",
      transform : "_transformValue",
      apply     : "_applyValue"
    },

    showScheduled :
    {
      init     : false,
      nullable : false,
      check    : "Boolean",
      apply    : "_applyShowScheduled"
    },

    startTimes :
    {
      init     :
        [ "08:00", "08:00", "08:00", "08:00", "08:00", "08:00", "08:00" ],
      nullable : false,
      check    : "this._checkTime(value)"
    },

    endTimes :
    {
      init     :
        [ "22:00", "22:00", "22:00", "22:00", "22:00", "22:00", "22:00" ],
      nullable : false,
      check    : "this._checkTime(value)"
    }
  },

  members :
  {
    // The treevirtual object
    _tree          : null,

    // Tree's data model
    _dm            : null,

    // Node IDs by day, time
    _dayTimeNodes : null,

    /**
     * Ensure that start and end times are valid
     *
     * @param value {String}
     *   The value to be checked
     *
     * @return {Boolean}
     *   true if the value is an array of 7 strings of format HH:MM;
     *   false otherwise
     */
    _checkTime : function(value)
    {
      let             i;

      // Ensure we got an array
      if (! Array.isArray(value))
      {
        return false;
      }

      // Ensure it's an array of length 7
      if (value.length != 7)
      {
        return false;
      }

      // Ensure each element of the array is of format HH:MM
      for (i = 0; i < 7; i++)
      {
        if (! (/^[0-9][0-9]:[0-9][0-9]$/.test(value[i])))
        {
          return false;
        }
      }

      // All good!
      return true;
    },

    // property apply
    _applyShowScheduled(value, old)
    {
      this._buildAppointmentTree(value);
    },

    // property transform
    _transformValue(value)
    {
      // If set via a property of the form, the maps will have been
      // converted to objects with getters. If so, pull the day and
      // time out and create a native object value.
      if (value instanceof qx.core.Object)
      {
        value =
          {
            day  : value.getDay(),
            time : value.getTime()
          };
      }

      return value;
    },

    // property apply
    _applyValue(value, old)
    {
      let             day;
      let             time;

      // If the tree has yet to be created...
      if (! this._dm)
      {
        // ... then the value will be handled when buildi
        return;
      }

      if (this.__bInternalChange)
      {
        return;
      }

      // If we haven't built the assignment tree yet, we're done here.
      if (! this._dayTimeNodes)
      {
        return;
      }

      // Ensure it's a valid time
      if (value)
      {
        day = value.day;
        time = value.time;

        if (! this._dayTimeNodes[day][time])
        {
          throw new Error("Time is outside of allowed range");
        }
      }

      this.__bInternalChange = true;

      if (old)
      {
        day = old.day;
        time = old.time;

        if (this._dayTimeNodes[day][time])
        {
          this._tree.nodeSetSelected(this._dayTimeNodes[day][time], false);
        }
      }

      if (value)
      {
        day = value.day;
        time = value.time;

        this._tree.nodeSetSelected(this._dayTimeNodes[day][time], true);
      }

      this._dm.setData();

      if (value === null)
      {
        this._tree.getSelectionModel().resetSelection();
      }

      this.__bInternalChange = false;
    },

    _buildAppointmentTree(bShowScheduledToo = false)
    {
      let             tree;
      let             resizeBehavior;
      let             dm;
      let             fields;

      // If there's an existing tree...
      if (this._tree)
      {
        // ... then remove it
        this.remove(this._tree);
        this._tree.dispose();
        this._tree = null;
      }

      // By default only time tree and default assignment counts are
      // present
      fields =
        [
          "Appointment Time",
          "# default"
        ];

      // If requested, show the number scheduled, too
      if (bShowScheduledToo)
      {
        fields.push("# scheduled");
      }
      
      // Create the new tree
      this._tree = tree = new qx.ui.treevirtual.TreeVirtual(fields);
      tree.set(
        {
          width                      : 400,
          statusBarVisible           : false,
          useTreeLines               : false
        });
      this.add(tree, { flex : 1 });

      // No need to show open/close symbols on empty branches
      tree.setAlwaysShowOpenCloseSymbol(false);

      // Obtain the resize behavior object to manipulate
      resizeBehavior = tree.getTableColumnModel().getBehavior();

      // Ensure that the tree column remains sufficiently wide
      resizeBehavior.set(0, { width: "1*"  });

      // The other one or two columns can have a set width too
      for (let i = 1; i < fields.length; i++)
      {
        resizeBehavior.set(i, { width : 100 });
      }

      // Get the tree data model
      this._dm = dm = tree.getDataModel();

      // Handle selection of an appointment time
      tree.addListener("changeSelection", this._onChangeSelection, this);
    },

    /**
     * Handler for when this calendar appears. Request the appointment list.
     */
    _onAppear()
    {
      const           tree = this._tree;
      const           dm = this._dm;
      const           bShowScheduledToo = this.getShowScheduled();

      qx.core.Init.getApplication().rpc(
        "getAppointments", [ bShowScheduledToo ])
        .then(
          (result) =>
          {
            let         day;
            let         dayNode;
            let         time;
            let         node;
            let         timeNode;
            let         numNodes;
            let         nodes;
            let         dayNum;
            let         numDefaults;
            let         numScheduled;
            let         timestamp;
            let         time12;
            let         time24;
            let         startTime;
            let         endTime;
            let         value = this.getValue();
            const       fifteenMin = (1000 * 60 * 15);
            const       appointmentDefaults = result.appointmentDefaults;
            const       distributionStarts = result.distributionStarts;
            const       appointmentsScheduled = result.appointmentsScheduled;

            // Clear out any prior tree data
            dm.prune(0);

            if (value)
            {
              day = value.day;
              time = value.time;
            }

            // Get ready to track nodes by day, time
            nodes = this._dayTimeNodes = {};

            for (dayNum = 1; dayNum <= 7; dayNum++)
            {
              // Add this day node to the root
              dayNode = dm.addBranch(null, "Day " + dayNum);

              // Day nodes default to opened
              tree.nodeSetOpened(dayNode, true);

              // Create the map of times for this day
              nodes[dayNum] = {};

              // Add each possible time for this day
              for (timestamp = new Date("2020-01-01T08:00"),
                     numNodes = 0;
                   numNodes < 4 * 15; // 4x per hour, many hours
                   timestamp = new Date(timestamp.getTime() + fifteenMin),
                     numNodes++)
              {
                // Get the 12- and 24-hour times for this timestamp
                time12 = this.constructor.formatTime12(timestamp);
                time24 = this.constructor.formatTime24(timestamp);

                // If there is a start time specified for this day, elide
                // any times that preceed the start time
                startTime = this.getStartTimes()[dayNum - 1];
                if (typeof startTime == "string" && time24 < startTime)
                {
                  continue;
                }

                // Similarly, for end time
                endTime = this.getEndTimes()[dayNum - 1];
                if (typeof endTime == "string" && time24 > endTime)
                {
                  break; // If this one is too large, others will be too
                }

                // Create the node for this time
                timeNode = dm.addBranch(dayNode, time12);

                // Save it for adding entries from returned data
                nodes[dayNum][time24] = timeNode;

                // Flag this node as one that is allowed to get selected
                node = tree.nodeGet(timeNode);
                node._bTimeNode = true;

                // Save the 24-hour time (vs the 12-hour time that's displayed)
                node._time24 = time24;

                // If this node has the time of the Appointment's value...
                if (value && day == dayNum && time == time24)
                {
                  // ... then mark this node as selected
                  tree.nodeSetSelected(timeNode, true);
                }
              }
            }

            // Prepare to track number of default appointments per timeslot
            numDefaults =
              {
                1 : {},
                2 : {},
                3 : {},
                4 : {},
                5 : {},
                6 : {},
                7 : {}
              };

            // Add the appointment defaults data to the tree
            appointmentDefaults.forEach(
              (entry) =>
              {
                let             day = entry.appt_day_default;
                let             time = entry.appt_time_default;

                // Get the node for this time slot
                try
                {
                  timeNode =
                    nodes[entry.appt_day_default][entry.appt_time_default];
                }
                catch(e)
                {
                  qxl.dialog.Alert(
                    "Invalid data in database (defaults): " +
                      "appointment day '" + day + "'" +
                      ", appointment time '" + time + "'");
                  return;
                }

                // Keep track of number of default appointments per timeslot
                numDefaults[day][time] =
                  numDefaults[day][time] ? numDefaults[day][time] + 1 : 1;

                // Add the family name to the current time branch if
                // we're not showing scheduled appointments too
                if (! bShowScheduledToo)
                {
                  dm.addLeaf(timeNode, entry.family_name);
                }
              });

            if (bShowScheduledToo)
            {
              // Prepare to track number of actual appointments per timeslot
              numScheduled =
                {
                  1 : {},
                  2 : {},
                  3 : {},
                  4 : {},
                  5 : {},
                  6 : {},
                  7 : {}
                };

              // Add the appointment defaults data to the tree
              appointmentsScheduled.forEach(
                (entry) =>
                {
                  let             day = entry.appt_day;
                  let             time = entry.appt_time;

                  // Get the node for this time slot
                  try
                  {
                    timeNode = nodes[day][time];
                  }
                  catch(e)
                  {
                    qxl.dialog.Alert(
                      "Invalid data in database (appointments): " +
                        "appointment day '" + day + "'" +
                        ", appointment time '" + time + "'");
                    return;
                  }

                  // Keep track of number of default appointments per timeslot
                  numScheduled[day][time] =
                    (numScheduled[day][time]
                     ? numScheduled[day][time] + 1
                     : 1);

                  // Add the family name to the current time branch
                  dm.addLeaf(timeNode, entry.family_name);
                });
            }

            // Update the number of appointments for each time slot
            for (dayNum = 1; dayNum <= 7; dayNum++)
            {
              for (timestamp = new Date("2020-01-01T08:00"),
                     numNodes = 0;
                   numNodes < 4 * 15; // 4x per hour, many hours
                   timestamp = new Date(timestamp.getTime() + fifteenMin),
                     numNodes++)
              {
                // Get the 24-hour time for this timestamp
                time24 = this.constructor.formatTime24(timestamp);

                // Retrieve the time node
                timeNode = nodes[dayNum][time24];

                // If no time node (outside of scheduled times), we're done
                if (! timeNode)
                {
                  continue;
                }

                // Show the number of default appointments for each timeslot
                dm.setColumnData(
                  timeNode,
                  1,
                  "" + (numDefaults[dayNum][time24] || 0));

                // If we're showing scheduled apointments too, add the
                // number for each timeslot
                if (bShowScheduledToo)
                {
                  // Show the number of default appointments for each timeslot
                  dm.setColumnData(
                    timeNode,
                    2,
                    "" + (numScheduled[dayNum][time24] || 0));
                }
              }
            }

            // Use the just-provided data
            dm.setData();

            // Reset the value so the selected entry gets selected
            if (value)
            {
              this.setValue( { day, time } );
            }
          })
        .catch(
          (e) =>
          {
            console.error("getAppointmentDefaults:", e);
          });
    },

    /**
     * Handler for "changeSelection" in the calendar tree
     *
     * @param e {qx.event.Data}
     *   The data contains an array of selected items (always one,
     *   here, but still in an array).
     */
    _onChangeSelection(e)
    {
      let             day;
      let             parentNodeInfo;
      const           nodeInfo = e.getData()[0];

      // Ignore reset selection
      if (e.getData().length < 1)
      {
        return;
      }

      // If they're trying to select an entry that isn't a time, ignore it.
      if (! nodeInfo._bTimeNode)
      {
        return;
      }

      // Get the parent, which has text like "Day n". Extract the day number.
      parentNodeInfo = this._tree.nodeGet(nodeInfo.parentNodeId);
      day = parentNodeInfo.label.split(" ")[1];

      // Scroll the selection ito view
      this._tree.scrollCellVisible(0, nodeInfo.nodeId);

      // If we're not already here as a result of a value change, set value.
      if (! this.__bInternalChange)
      {
        this.set(
          {
            value :
            {
              day  : day,
              time : nodeInfo._time24
            }
          });
      }
    }
  },

  statics :
  {
    /**
     * Provide a consistently formatted 24-hour time
     *
     * @param timestamp {Date}
     *  The timestamp to be formatted
     *
     * @return {String}
     *  The time, formatted as HH:MM
     */
    formatTime24(timestamp)
    {
      return (
        ("0" + timestamp.getHours()).substr(-2) +
          ":" +
          ("0" + timestamp.getMinutes()).substr(-2));
    },

    /**
     * Provide a consistently formatted 12-hour time
     *
     * @param timestamp {Date}
     *  The timestamp to be formatted
     *
     * @return {String}
     *  The time, formatted as H:MM ap
     */
    formatTime12(timestamp)
    {
      let             suffix;
      let             hours = timestamp.getHours();

      if (hours <= 12)
      {
        suffix = " am";
      }
      else
      {
        hours -= 12;
        suffix = " pm";
      }

      return (
        hours + ":" + ("0" + timestamp.getMinutes()).substr(-2) + suffix);
    }
  }
});
