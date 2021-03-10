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

  construct(model)
  {
    this.base(arguments, model, "label", "children", "open");
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
//     // IField implementation: get the selected item
//     getValue()
//     {
// console.log("getValue: getSelection=", this.getSelection());
// console.log("getValue: native=", JSON.stringify(qx.util.Serializer.toNativeObject(this.getSelection())), null, "  ");
//       return 23;
//       return qx.util.Serializer.toNativeObject(this.getSelection())[0].id;
//     },

    // IField implementation: set the specified item as selected
    setValue(value)
    {
      // We're called with an array containing the selected element
      // index. Convert that to the element's id
      if (Array.isArray(value))
      {
console.log("setValue value=", value);
console.log("getValue[0].id=", this.getValue().getItem(0).getId());
        this.fireDataEvent("changeValue", this.getValue().getItem(0).getId());
      }
    },

//     // IField implementation: ignore
//     resetValue()
//     {
//       // do nothing
// console.log("resetValue called");
//     },


    // delegate implementation
    // bindItem(controller, item, id)
    // {
    //   controller.bindDefaultProperties(item, id);
    //   controller.bindProperty("open", "open", null, item, id);
    //   controller.bindProperty("checked", "checked", null, item, id);
    //   controller.bindPropertyReverse("checked", "checked", null, item, id);
    //   controller.bindProperty("notes", "notes", null, item, id);
    //   controller.bindPropertyReverse("notes", "notes", null, item, id);
    //   controller.bindProperty(
    //     "notesVisibility", "notesVisibility", null, item, id);
    // }
  }
});
