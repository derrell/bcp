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
qx.Class.define("bcp.client.grocery.CategorySelectionTree",
{
  extend : qx.ui.tree.VirtualTree,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct()
  {
    this.base(arguments, null, "label", "children", "open");
    this.set(
      {
        width                      : 400,
        hideRoot                   : true,
        showTopLevelOpenCloseIcons : true,
        selectionMode              : "one"
      });

//    this.setDelegate(this);
  },

  members :
  {
    // IField implementation: get the selected item
    getValue()
    {
console.log("getSelection=", this.getSelection());
      return this.getSelection()[0];
    },

    // IField implementation: set the specified item as selected
    setValue(value)
    {
//      this.setSelection(value);
    },

    // IField implementation: ignore
    resetValue()
    {
      // do nothing
    },


    // // delegate implementation
    // bindItem(controller, item, id)
    // {
    //   controller.bindDefaultProperties(item, id);
    //   controller.bindProperty("checked", "checked", null, item, id);
    //   controller.bindPropertyReverse("checked", "checked", null, item, id);
    //   controller.bindProperty("notes", "notes", null, item, id);
    //   controller.bindPropertyReverse("notes", "notes", null, item, id);
    //   controller.bindProperty(
    //     "notesVisibility", "notesVisibility", null, item, id);
    // }
  }
});
