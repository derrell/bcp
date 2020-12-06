qx.Class.define("custom.AutoCompleteComboBox",
{
   extend: qx.ui.form.ComboBox,

   properties: {

       model: {
           init: null,
           nullable: true,
           check: "qx.type.Array",
           apply: "_applyModel"
       },
       displayPropertyName: {
           init: null,
           nullable: true,
           check: "String",
           event: "changeDisplayPropertyName",
           apply: "_applyDisplayPropertyName"
       },

       showAllIfTextIsEmpty: {
           init: true,
           check: "Boolean"
       }
   },

   members: {
       __listItems : null,

       getSelectedItem: function(){
           var list = this.getChildControl("list");
           var selection = list.getSelection();
           if (selection && selection.length > 0) {
               var model  = selection[0].getModel();
               return model;
           }
           return null;
       },

       resetSelection: function() {
           var list = this.getChildControl("list");
           list.setSelection([]);
           this.setValue("");
       },

       _keyHandler: function(e) {
           var key = e.getKeyIdentifier();

           if (key == "Escape") {
               this.close();
               return;
           }

           if (key == "Enter") {
               // fill by selected value
               if (this.__preSelectedItem) {
                   var list = this.getChildControl("list");
                   list.setSelection([this.__preSelectedItem]);
               }
               this.close();
               return;
           }

           if (key == "Left" || key == "Right" || key == "Home" || key == "End" || key == "Backspace") {
               // moving cursor, autocomplete is not needed
               e.stopPropagation();
           }

           if(key == "Down" || key == "Up" || key == "Tab") {
               // user is selecting an item.
               // Fix 'hovered' bug.
               if (this.__listItems != null) {
                   for(i = 0; i <= this.__listItems.length; i++) {
                       var currentListItem = this.__listItems[i];
                       if(!currentListItem) {
                           continue;
                       }
                       currentListItem.removeState("hovered");
                   }
               }
               // autocomplete is not needed because text is the same
               this.open();
               return;
           }

           //autocomplete part. Remove all items and add only proper ones.
           this._updateDropDownItems();
           var availableItemsNumber = this.getChildren().length;
           if (availableItemsNumber == 0) {
               // todo translation
               var notFoundListItem = new qx.ui.form.ListItem("No results found");
               notFoundListItem.setEnabled(false);
               this.add(notFoundListItem);
           }
           this.open();
       },

       _updateDropDownItems: function () {
           this.removeAll();
           var enteredText = this.getValue();
           var forceAddAll = this.getShowAllIfTextIsEmpty() && !enteredText;

           if (this.__listItems) {
               for (var i = 0; i <= this.__listItems.length; i++) {
                   var currentListItem = this.__listItems[i];
                   if (!currentListItem || !currentListItem.getLabel()) {
                       continue;
                   }



                   if (forceAddAll || currentListItem.getLabel().toUpperCase()
                           .match(new RegExp(enteredText.toUpperCase(), ""), "")) {
                       this.add(currentListItem);
                   }
               }
           }
       },

       _applyModel: function (newModel) {
           this._clearBindings();
           this.__listItems = [];
           if (newModel) {
               newModel.forEach(function (modelItem) {
                   if (modelItem) {
                       var listItem = new qx.ui.form.ListItem(null, null, modelItem);
                       modelItem.bind(this.getDisplayPropertyName(), listItem, "label");
                       this.__listItems.push(listItem);
                   }
               }, this);
           }

           this._updateDropDownItems();
       },

       _clearBindings: function () {
           if (this.__listItems) {
               this.__listItems.forEach(function (listItem) {
                   qx.data.SingleValueBinding.removeAllBindingsForObject(listItem);
               });
           }
       },

       _applyDisplayPropertyName: function (newDisplayProperty) {
           this._applyModel(this.getModel());
       }
   },

   construct : function() {
       this.base(arguments);

       var textfield = this.getChildControl("textfield");

       textfield.addListener("keydown",this._keyHandler,this);
       textfield.addListener("keypress",this._keyHandler,this);
       textfield.addListener("keyup",this._keyHandler,this);


       //if clicked, the combobox will extend with all the items
       textfield.addListener("mouseup",function(e){
           var context = this;
           this._updateDropDownItems();
           setTimeout(
               function(){
                   context.open();
               },300
           );
       },this);
   }

});


(async () => {
  // get countries, somewhat wasteful since source data contains lots of info that we don't need.
  let response = await fetch("https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json");
  let data = (await response.json()).map(item => ({
   name: item.name.common 
  }));
  let cb = new custom.AutoCompleteComboBox();
  cb.set({
    displayPropertyName: "name",
    model: qx.data.marshal.Json.createModel(data)
  });

  this.getRoot().add(cb,{
    left : 100,
    top  : 50
  });

})();
