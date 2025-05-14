// This class is a wrapper for the mysql library, providing methods to start, commit and rollback transactions,
// as well as methods to insert, update, delete and select rows from the database.
// It also provides methods to backup the entire database to a local file or a remote ftp directory.

// list of methods provided by the _MySQL class along with short instructions for developers:

// transaction()
// Description: Starts a database transaction.
// Usage: Call this method before a series of database operations that should be treated as a single transaction.

// commit()
// Description: Commits the current transaction.
// Usage: Call this method after successfully completing a series of database operations within a transaction.

// rollback()
// Description: Rolls back the current transaction.
// Usage: Call this method if an error occurs during a transaction, undoing any changes made within the transaction.

// query(sql: string)
// Description: Executes a custom SQL query on the database.
// Usage: Pass a valid SQL query string as an argument. Returns the result of the query.

// insertOne(tableName: string, data: object)
// Description: Inserts a single row into the specified table.
// Usage: Provide the table name and an object containing the data to be inserted. Returns the ID of the inserted row.

// insertMany(tableName: string, data: array)
// Description: Inserts multiple rows into the specified table.
// Usage: Provide the table name and an array of objects, each representing data for a row.
// Returns the number of affected rows.

// updateOne(tableName: string, data: object, condition: object)
// Description: Updates a single row in the specified table based on a given condition.
// Usage: Provide the table name, data to be updated, and a condition to identify the row. Returns the number of affected rows.

// updateMany(tableName: string, data: object, condition: object)
// Description: Updates multiple rows in the specified table based on a given condition.
// Usage: Provide the table name, data to be updated, and a condition to identify rows. Returns the number of affected rows.

// updateDirect(query: string, params: object)
// Description: Executes a custom update query directly on the database.
// Usage: Provide a valid update SQL query and parameters. Returns the number of affected rows.

// deleteOne(tableName: string, condition: object)
// Description: Deletes a single row from the specified table based on a given condition.
// Usage: Provide the table name and a condition to identify the row to be deleted. Returns the number of affected rows.

// deleteMany(tableName: string, condition: object)
// Description: Deletes multiple rows from the specified table based on a given condition.
// Usage: Provide the table name and a condition to identify rows to be deleted. Returns the number of affected rows.

// deleteDirect(query: string, condition: object)
// Description: Executes a custom delete query directly on the database.
// Usage: Provide a valid delete SQL query and parameters. Returns the number of affected rows.

// findOne(tableName: string, condition: object, options: object)
// Description: Retrieves a single row from the specified table based on a given condition.
// Usage: Provide the table name, condition, and optional parameters like columns and useIndex. Returns the selected row.

// findMany(tableName: string, condition: object, options: object)
// Description: Retrieves multiple rows from the specified table based on a given condition.
// Usage: Provide the table name, condition, and optional parameters like columns and useIndex. Returns an array of selected rows.

// findDirect(query: string, condition: object)
// Description: Executes a custom select query directly on the database.
// Usage: Provide a valid select SQL query and parameters. Returns an array of selected rows.

// upsertOne(tableName: string, data: object)
// Description: Inserts or updates a single row into the specified table (based on a unique key).
// Usage: Provide the table name and an object containing the data. Returns the number of affected rows.

// upsertMany(tableName: string, data: array)
// Description: Inserts or updates multiple rows into the specified table (based on a unique key).
// Usage: Provide the table name and an array of objects, each representing data for a row. Returns the number of affected rows.

// insertIgnoreOne(tableName: string, data: object)
// Description: Inserts a single row into the specified table, ignoring duplicates.
// Usage: Provide the table name and an object containing the data. Returns the number of affected rows.

// insertIgnoreMany(tableName: string, data: array)
// Description: Inserts multiple rows into the specified table, ignoring duplicates.
// Usage: Provide the table name and an array of objects, each representing data for a row. Returns the number of affected rows.

// executeDirect(query: string)
// Description: Executes a custom SQL query directly on the database without expecting any specific result.
// Usage: Provide a valid SQL query for execution.


