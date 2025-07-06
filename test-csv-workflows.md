# 📋 CSV Workflow Test Examples

Here are ready-to-test CSV workflows you can try in your Sashi application:

## 🧑‍💼 Example 1: User Data Validation Workflow

**Try this prompt in chat:**

```
Create a workflow to validate user data from a CSV file. I want to check names, emails, and ages for proper formatting and ranges.
```

**Expected AI Response:**

```json
{
    "type": "workflow",
    "description": "Validate user data from CSV",
    "actions": [
        {
            "id": "validate_users",
            "tool": "ProcessUserDataFunction",
            "description": "Validate user information from CSV data",
            "parameters": {
                "userData": "CSV_INPUT"
            },
            "parameterMetadata": {
                "userData": {
                    "type": "csv",
                    "description": "CSV data with user information to validate",
                    "required": true,
                    "expectedColumns": ["name", "email", "age"]
                }
            },
            "map": true
        }
    ]
}
```

**Test CSV Data:**

```csv
name,email,age
John Doe,john@example.com,25
Jane Smith,jane@example.com,30
Bob Johnson,invalid-email,35
Alice Brown,alice@example.com,17
Charlie Wilson,charlie@example.com,45
```

---

## 📁 Example 2: File Processing Workflow

**Try this prompt in chat:**

```
I need to process file metadata from a CSV. Categorize files by type and size, and give recommendations.
```

**Expected AI Response:**

```json
{
    "type": "workflow",
    "description": "Process and categorize file data from CSV",
    "actions": [
        {
            "id": "process_files",
            "tool": "ProcessFileDataFunction",
            "description": "Process file metadata and provide recommendations",
            "parameters": {
                "fileData": "CSV_INPUT"
            },
            "parameterMetadata": {
                "fileData": {
                    "type": "csv",
                    "description": "CSV data containing file information",
                    "required": true,
                    "expectedColumns": ["filename", "size", "type"]
                }
            },
            "map": true
        }
    ]
}
```

**Test CSV Data:**

```csv
filename,size,type
document.pdf,1024000,pdf
image.jpg,512000,jpg
video.mp4,52428800,mp4
script.js,8192,js
presentation.pptx,5242880,pptx
database.sql,20971520,sql
archive.zip,104857600,zip
```

---

## 👥 Example 3: Bulk User Validation Workflow

**Try this prompt in chat:**

```
Create a workflow to validate a list of users from CSV and return summary statistics about the validation results.
```

**Expected AI Response:**

```json
{
    "type": "workflow",
    "description": "Bulk validate users from CSV with summary statistics",
    "actions": [
        {
            "id": "bulk_validate",
            "tool": "ValidateUsersFromCSVFunction",
            "description": "Validate multiple users and provide summary",
            "parameters": {
                "users": "CSV_INPUT"
            },
            "parameterMetadata": {
                "users": {
                    "type": "csv",
                    "description": "CSV data with user records to validate",
                    "required": true,
                    "expectedColumns": ["name", "email", "age"]
                }
            },
            "map": true
        }
    ]
}
```

**Test CSV Data:**

```csv
name,email,age
John Doe,john@example.com,25
Jane Smith,jane.smith@company.org,30
Bob Johnson,bob@invalid,35
Alice Brown,alice@example.com,16
Charlie Wilson,charlie@example.com,45
David Lee,david.lee@test.com,28
Sarah Connor,sarah@,31
Mike Johnson,mike@example.com,22
```

---

## 🧪 How to Test These Workflows

### Step 1: Start Your Server

```bash
cd apps/sashi-server-two
npm start
```

_(If port 3003 is in use, kill the existing process first)_

### Step 2: Open the UI

```bash
cd packages/dev
npm run dev
```

### Step 3: Test the Workflow

1. **Type one of the prompts above** in the chat interface
2. **Wait for the AI to generate a workflow** with CSV field type
3. **Copy and paste the test CSV data** into the CSV field
4. **Watch the real-time validation:**
    - ✅ Green: Valid CSV with correct columns
    - ❌ Red: Missing required columns
    - ⚠️ Yellow: Extra columns (will be ignored)
5. **See the preview** of your CSV data (first 3 rows)
6. **Click Execute** to run the workflow

### Step 4: Expected Results

- **User Validation**: Get validation results for each user (email format, age range, etc.)
- **File Processing**: Get file categorization and recommendations
- **Bulk Validation**: Get summary statistics (total valid, invalid, error breakdown)

---

## 🎯 Pro Tips for Testing

### Test Different CSV Formats:

```csv
# With missing columns
name,email
John,john@example.com

# With extra columns
name,email,age,department
John,john@example.com,25,Engineering

# With malformed data
name,email,age
John Doe,not-an-email,abc
```

### Advanced Prompts to Try:

- _"Process customer data from CSV and flag any issues"_
- _"Analyze sales data from CSV and categorize by region"_
- _"Validate employee records from CSV and check for duplicates"_
- _"Process survey responses from CSV and generate insights"_

The AI should automatically detect these as CSV workflows and generate the appropriate UI! 🚀

---

## 🐛 Troubleshooting

**If CSV field doesn't appear:**

- Check that `parameterMetadata` has `"type": "csv"`
- Ensure `expectedColumns` array is provided
- Verify the workflow has `"map": true` for processing rows

**If validation fails:**

- Check column names match exactly (case-sensitive)
- Ensure CSV has header row
- Remove extra quotes or spaces

**If server errors occur:**

- Verify the AI functions exist in your backend
- Check server logs for detailed error messages
- Make sure the server is running on the correct port
