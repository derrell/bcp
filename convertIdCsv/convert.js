//
// Generate the source file (/tmp/x.csv) with something like this:
//  .mode csv
//  .output /tmp/x.csv
//  SELECT ci.family_name, id FROM ClientId ci
//    LEFT JOIN Client c ON c.family_name = ci.family_name
//     WHERE length(coalesce(appt_time_default, '')) > 0;

const       csvFilePath = "/tmp/x.csv";
const       csv = require("csvtojson");

csv()
  .fromFile(csvFilePath)
  .then(
    (json) =>
    {
      json.forEach(
        (obj) =>
        {
          let         digits0 = "ABCDEFGHIJ".split("");
          let         digits1 = "KLMNOPQRST".split("");
          let         num = obj.id;

          // Format it as four digits
          num = ("000" + num).substr(-4);

          // Use letters in place of first two digits
          num = num.split("").map(n => +n);
          num[0] = digits0[num[0]];
          num[1] = digits1[num[1]];
          num = num.join("");

          obj.id = num;
        });

      return json;
    })
  .then(
    (json) =>
    {
      let         csv;

      csv = json.map(obj => `"${obj.familyName}","${obj.id}"`);
      csv.unshift(`"familyName","id"`);
      return csv;
    })
  .then(
    (csv) =>
    {
      const       fsp = require("fs").promises;

      return fsp.writeFile("/tmp/client-ids.csv", csv.join("\n"));
    })
  .then(
    () =>
    {
      console.log("Done");
    });
    
