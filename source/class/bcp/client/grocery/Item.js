/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2021 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
qx.Class.define("bcp.client.grocery.Item",
{
  extend : qx.ui.tree.VirtualTreeItem,

  properties :
  {
    checked :
    {
      check    : "Boolean",
      event    : "changeChecked",
      nullable : true
    },

    notes :
    {
      check    : "String",
      event    : "changeNotes",
      nullable : true
    }
  },

  members :
  {
    _notes : null,

    _addWidgets : function()
    {
      let             checkbox;
      let             notes;

      // Tree indentation
      this.addSpacer();
      this.addOpenButton();

      // Selection checkbox
      checkbox = new qx.ui.form.CheckBox();
      this.bind("checked", checkbox, "value");
      checkbox.bind("value", this, "checked");
      checkbox.setFocusable(false);
      checkbox.setTriState(true);
      checkbox.setMarginRight(4);
      this.addWidget(checkbox);

      // Item name
      this.addLabel();

      // All else should be right justified
      this.addWidget(new qx.ui.core.Spacer(), {flex: 1});

      // Notes
      notes = this._notes = new qx.ui.form.TextField();
      this.bind("notes", notes, "value");
      notes.bind("value", this, "notes");
      notes.set(
        {
          width      : 200,
          height     : 22,
          liveUpdate : true
        });
      this.addWidget(notes);
    },

    getNotesWidget()
    {
      return this._notes;
    }
  }
});
