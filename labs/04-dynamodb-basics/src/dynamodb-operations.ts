// Import the DynamoDB client and commands

// Create DynamoDB client instance

// Define the table name with a unique suffix

// Function to create the DynamoDB table

// Function to insert coffee items into the table

// Main function to execute all operations
async function main() {
  try {
    console.log('🚀 Starting DynamoDB operations...');

    // Create table

    // Insert 3 Starbucks coffee items

    // Read and display all items

    // Delete one item

    // Clean up: delete the table

    console.log('End of the execution...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
