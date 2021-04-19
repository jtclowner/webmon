const path = require('path');
const fs = require('fs');
const { convertCSVToArray } = require('convert-csv-to-array');
const { convertArrayToCSV } = require('convert-array-to-csv');

// Get list of URLS from .csv file
const data = fs.readFileSync('./urls.csv', 'utf8', (err, data) => {});
const domains = convertCSVToArray(data, {separator: ','});

// Get list of urls to remove/delete from the 'trash' directory
const trashPath = path.join(__dirname, './output/trash');
fs.readdir(trashPath, function (err, files) {
    if (err) {
        return console.log('Unable to find any trash files: ' + err);
    } 
    // Create array of files to delete
    let urlsToDelete = [];
    files.forEach(function (filename) {
        // Remove file extension and add to list
        filename = filename.substring(0, filename.length - 4);
        urlsToDelete.push(filename);
    });

    // Create new url array excluding urlsToDelete
    newUrlArray = [];
    // Iterate through existing url array
    for(let url of domains[0]) {
        // Check if url should be added to new array
        for(let badUrl of urlsToDelete){
            if ( badUrl.indexOf( url ) > -1 ) { // URL should not be included to array 
                // Delete existing screenshots in snapshots/trash folder
                console.log("Removing screenshots and CSV data for: " + url);
                let trashPath = `./output/trash/${url}.png`;
                //console.log(trashPath);
                let snapshotPath = `./output/${url}.png`;
                fs.unlink(trashPath, () => {});
                fs.unlink(snapshotPath, () => {});
                }
            else{ // Append url to new array
                newUrlArray.push(url);
                break;
            }
        }
    }
    if (newUrlArray == false) { // There is nothing to delete
        console.log("There is nothing to delete.");
    }
    else { // Write new csv file
    // Turn our array into an array of arrays, like a .csv
    arrayWrapper = [[newUrlArray]]
    const newCsv = convertArrayToCSV(arrayWrapper, {header: '', separator: ','});
    fs.writeFile("./urls.csv", newCsv, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Trash URLS were succesfully removed.");
        }); 
    }
})