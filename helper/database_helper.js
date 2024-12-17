//##################
//#     Imports    #
//##################
// Sqlite3 for quick database solution
const sqlite3 = require('sqlite3').verbose();

// Schemas
const OperationSchema = require("../schema/operations.js").OperationSchema;
const DeviceSchema = require("../schema/devices.js").DeviceSchema;

//##############################
//#     Database Functions     #
//##############################
let databaseConnection = null;

// Function to initialize a new Database Connection
function initializeDatabase(){
    // Connect to the sqlite3 database
    databaseConnection = new sqlite3.Database('./database/database.db', (err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Connected to the SQLite database.');
    });
}

// Function to check if the needed Tables exist and create them if missing
function checkTables(){
    if(!databaseConnection){
        initializeDatabase();
    }

    const tableNames = [DeviceSchema.TABLE_NAME, OperationSchema.TABLE_NAME]
    const schema = {[tableNames[0]]:  convertToSQLiteSchema(DeviceSchema), 
                    [tableNames[1]]:  convertToSQLiteSchema(OperationSchema)}

    tableNames.forEach((table) =>{
        databaseConnection.get( `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, 
        [table], 
        (err, row) => {
            // On error return the error message
            if(err){return console.error(err.message);}
            // If row doest exist then the table needs to be created
            if(!row){return databaseConnection.run("CREATE TABLE " + table + " " + schema[table]);}
            if(row){return console.log("Table " + table + " Exists!")}
        })
    })
}

function convertToSQLiteSchema(schema){
    
    sqlSchemaString = "(";
    
    // Iterate through each entry in the js schema and convert to a SQLite schema    
    Object.keys(schema).forEach((key) => {

        // Ignore the table name
        if(key == "TABLE_NAME"){ return; }

        // Special cases like foreign keys
        if(key == "FOREIGN_KEY"){

            // Create the string
            let objectString = `FOREIGN KEY (${schema[key].name}) `;
            objectString += `REFERENCES ${schema[key].reference} (${schema[key].reference_id}) `
            objectString += `ON DELETE ${schema[key].on_delete} `
            objectString += `ON UPDATE ${schema[key].on_update}`

            // Add the string to the Schema
            sqlSchemaString+= objectString;
            sqlSchemaString+= ",";

            // We are done with the special commands and don't want to run the code below
            return;
        }

        let objectString = `${key} ${schema[key].Type}`;

        // Check for Primary Key, if not primary check if it can be null
        if(schema[key].PrimaryKey){
            objectString += " PRIMARY KEY";
        } 
        else if(schema[key].NotNull){
            objectString += " NOT NULL";
        }

        // Add the String to the sqlSchema and add a ',' for separation
        sqlSchemaString+= objectString;
        sqlSchemaString+= ",";
    })

    // Remove the unneeded ',' at the end of the string
    sqlSchemaString = sqlSchemaString.slice(0, -1);
    sqlSchemaString += ")";
    
    return sqlSchemaString;
}

// Inserts an object into the database
function insertIntoDatabase(schema, dataObject){
    let objectKeys = [];
    let objectKeysString = "";
    let valueString = "";

    Object.keys(schema).forEach((key) => {

        // Additional information are uppercase in the schema so we need to skip them
        if(key === key.toUpperCase()){ return;}
        if(schema[key].PrimaryKey == true){return;}
        // Add the key as required field into the objectKeys and them to the string
        objectKeys.push(key);
        objectKeysString += `${key} ,`;
        valueString += "?,";
    });

    // Remove the unneeded ',' at the end of the string
    objectKeysString = objectKeysString.slice(0, -1);
    valueString = valueString.slice(0, -1);

    // Create an Array of the Values from the dataObject
    let values = [];
    objectKeys.forEach(key => {
        values.push(dataObject[key]);
    })

    // Start the database command
    return new Promise((resolve, reject) => {
        databaseConnection.run(`INSERT INTO ${schema.TABLE_NAME}(${objectKeysString}) VALUES(${valueString})`,values, (err)=>{
            if(err){ 
                reject(err);
            }
            else
            {
                resolve();
            }
        });
    });


}

// Retrieve an object from the database
function selectFromDatabase(schema, selectTerm, id){
    
    // check if the searchTerm is an array, meaning more then one search parameter
    if(Array.isArray(selectTerm)){
        let sql = `SELECT * FROM ${schema.TABLE_NAME} WHERE ${selectTerm[0]} = ?`;
        for(i=1; i < selectTerm.length; i++){
            sql += ` AND ${selectTerm[i]} = ?`
        }
        let result = {};
        return new Promise((resolve, reject) => {
            databaseConnection.get(sql, id, (err,row) =>{
                if(err){ 
                    reject(err);
                }
                else
                {
                    resolve(row);
                }
            })
        });
    }
    else
    {
        const sql = `SELECT * FROM ${schema.TABLE_NAME} WHERE ${selectTerm} = ?`;
        let result = {};
        return new Promise((resolve, reject) => {
            databaseConnection.get(sql, [id], (err,row) =>{
                if(err){ 
                    reject(err);
                }
                else
                {
                    resolve(row);
                }
            })
        });
    }
}


function deleteFromDatabase(schema, selectTerm, id){
    const sql = `DELETE FROM ${schema.TABLE_NAME} WHERE ${selectTerm} = ?`;
    return new Promise((resolve, reject) => {
        databaseConnection.get(sql, [id], (err) =>{
            if(err){ 
                reject(err);
            }
            else
            {
                resolve();
            }
        })
    });
}


module.exports = {checkTables, initializeDatabase, insertIntoDatabase, selectFromDatabase, deleteFromDatabase};
