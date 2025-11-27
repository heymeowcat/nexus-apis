# MCP Server Integration Guide

## Overview

This project now includes a **Model Context Protocol (MCP) server** for automated employee onboarding and offboarding workflows. The MCP server provides 17 tools that can be used by Microsoft Copilot agents to handle the complete employee lifecycle.

## Server Information

- **Server Name**: `Nexus Onboarding/Offboarding MCP`
- **Server Description**: `Handles automated employee onboarding and offboarding workflows with HRMS integration, compliance checks, and system provisioning`
- **Version**: 1.0.0
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: stdio

## Accessing the MCP Server

### Information Endpoint

Visit the `/mcp` endpoint on your deployed Vercel app to get server information:

```
GET https://your-vercel-app.vercel.app/mcp
```

This returns JSON with all available tools and integration instructions.

### Running the MCP Server

The MCP server runs as a separate process using stdio transport:

```bash
node src/mcp-server.ts
```

## Microsoft Copilot Studio Integration

### Adding the MCP Server

1. Open **Microsoft Copilot Studio**
2. Navigate to your agent (HR, Finance, or PM agent)
3. Go to **Settings** → **Model Context Protocol**
4. Click **Add MCP Server**
5. Enter the following details:
   - **Server Name**: `Nexus Onboarding/Offboarding MCP`
   - **Server Description**: `Handles automated employee onboarding and offboarding workflows with HRMS integration, compliance checks, and system provisioning`
   - **Server Command**: `node src/mcp-server.ts`
   - **Working Directory**: Path to your nexus-apis project

### Configuration for Vercel Deployment

Since the MCP server uses stdio transport, you'll need to run it locally or on a server where Microsoft Copilot can execute the command. For cloud deployment:

1. **Option A - Local MCP Server**: Run the MCP server on your local machine or a dedicated server, and configure Copilot to connect to it
2. **Option B - Serverless Function**: Convert to HTTP transport (requires code modifications)

## Available Tools

### Onboarding Tools (7 tools)

#### 1. `initiate_onboarding`
Start the onboarding process for a new employee.

**Parameters:**
- `name` (string, required): Employee full name
- `email` (string, required): Employee email address
- `dateOfJoining` (string, required): Date of joining (YYYY-MM-DD)
- `department` (string, required): Department/Business Unit
- `designation` (string, required): Job title/role
- `manager` (string, required): Manager/Supervisor name
- `workLocation` (string, required): Work location
- `contactPhone` (string, required): Contact phone number
- `employmentType` (string, required): Employment type (Full-time, Contractor, etc.)
- `projectAssignment` (string, optional): Project assignment
- `initiatedBy` (string, required): HR or Hiring Manager initiating

**Returns:**
- Employee ID
- Status
- Next steps

#### 2. `validate_onboarding_data`
Validate that all required employee data fields are complete.

**Parameters:**
- `employeeId` (string, required): Employee ID to validate

**Returns:**
- Validation status
- List of missing fields (if any)

#### 3. `approve_onboarding`
HR or Manager approval of onboarding request.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `approverRole` (string, required): 'hr' or 'manager'
- `approverName` (string, required): Name of approver
- `approved` (boolean, required): Approval decision
- `comments` (string, optional): Approval comments

**Returns:**
- Approval status
- Overall onboarding status
- Next steps

#### 4. `provision_systems`
Trigger IT system provisioning (email, network, project management tools).

**Parameters:**
- `employeeId` (string, required): Employee ID
- `systems` (array, required): Systems to provision ['hrms', 'email', 'network', 'projectTools']

**Returns:**
- Provisioned systems
- System status

#### 5. `enroll_benefits`
Finance integration for payroll and benefits enrollment.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `enrollPayroll` (boolean, required): Enroll in payroll
- `enrollBenefits` (boolean, required): Enroll in benefits

**Returns:**
- Finance enrollment status

#### 6. `check_onboarding_compliance`
Verify mandatory documentation (NDA, ID verification, background check).

**Parameters:**
- `employeeId` (string, required): Employee ID
- `ndaSigned` (boolean, optional): NDA signed
- `idVerified` (boolean, optional): ID verified
- `backgroundCheck` (boolean, optional): Background check completed

**Returns:**
- Compliance status
- All compliant flag

#### 7. `complete_onboarding`
Finalize onboarding process and send completion notifications.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `completedBy` (string, required): HR person completing the process

**Returns:**
- Completion status
- Notifications sent

---

### Offboarding Tools (6 tools)

#### 8. `initiate_offboarding`
Start the offboarding process for an employee.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `employeeName` (string, required): Employee name
- `lastWorkingDay` (string, required): Last working day (YYYY-MM-DD)
- `department` (string, required): Department
- `reason` (string, required): Reason for offboarding
- `manager` (string, required): Manager name
- `initiatedBy` (string, required): HR or Manager initiating

**Returns:**
- Offboarding status
- Next steps

#### 9. `approve_offboarding`
Manager or HR approval of offboarding request.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `approverRole` (string, required): 'manager' or 'hr'
- `approverName` (string, required): Name of approver
- `approved` (boolean, required): Approval decision
- `comments` (string, optional): Approval comments

**Returns:**
- Approval status
- Next steps

#### 10. `deprovision_systems`
Deactivate user accounts and revoke access rights.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `systems` (array, required): Systems to deprovision ['hrms', 'email', 'network', 'projectTools']

**Returns:**
- Deprovisioned systems
- System status

#### 11. `process_final_payroll`
Finance integration for final payroll processing and benefits termination.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `processFinalPayroll` (boolean, required): Process final payroll
- `terminateBenefits` (boolean, required): Terminate benefits

**Returns:**
- Final payroll status

#### 12. `check_offboarding_compliance`
Verify exit forms submission and asset return.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `exitFormSubmitted` (boolean, optional): Exit form submitted
- `assetsReturned` (boolean, optional): Company assets returned
- `clearanceCertificate` (boolean, optional): Clearance certificate issued

**Returns:**
- Compliance status
- All compliant flag

#### 13. `complete_offboarding`
Finalize offboarding process and send completion notifications.

**Parameters:**
- `employeeId` (string, required): Employee ID
- `completedBy` (string, required): HR person completing the process

**Returns:**
- Completion status
- Notifications sent

---

### Query Tools (4 tools)

#### 14. `get_onboarding_status`
Check the current status of an onboarding process.

**Parameters:**
- `employeeId` (string, required): Employee ID

**Returns:**
- Complete onboarding record
- Status, approvals, system provisioning, compliance, finance enrollment
- Audit trail

#### 15. `get_offboarding_status`
Check the current status of an offboarding process.

**Parameters:**
- `employeeId` (string, required): Employee ID

**Returns:**
- Complete offboarding record
- Status, approvals, system deprovisioning, compliance, final payroll
- Audit trail

#### 16. `list_pending_approvals`
Get all pending onboarding/offboarding approvals.

**Parameters:**
- `type` (string, required): 'onboarding', 'offboarding', or 'all'

**Returns:**
- List of pending onboarding approvals
- List of pending offboarding approvals
- Total pending count

#### 17. `get_employee_details`
Retrieve employee information from onboarding or offboarding records.

**Parameters:**
- `employeeId` (string, required): Employee ID

**Returns:**
- Employee details
- Source (onboarding or offboarding)
- Current status

---

## Workflow Examples

### Complete Onboarding Workflow

```
1. initiate_onboarding
   → Creates employee record and starts workflow
   → Returns Employee ID

2. validate_onboarding_data
   → Ensures all required fields are complete

3. approve_onboarding (HR)
   → HR approves the onboarding

4. approve_onboarding (Manager)
   → Manager approves the onboarding
   → Status changes to "Approved"

5. provision_systems
   → Provision HRMS, email, network, project tools

6. enroll_benefits
   → Enroll in payroll and benefits

7. check_onboarding_compliance
   → Verify NDA signed, ID verified, background check

8. complete_onboarding
   → Finalize and send notifications
   → Status changes to "Completed"
```

### Complete Offboarding Workflow

```
1. initiate_offboarding
   → Starts offboarding process
   → Returns Employee ID

2. approve_offboarding (Manager)
   → Manager approves the offboarding

3. approve_offboarding (HR)
   → HR approves the offboarding
   → Status changes to "Approved"

4. deprovision_systems
   → Deactivate HRMS, email, network, project tools

5. process_final_payroll
   → Process final payroll and terminate benefits

6. check_offboarding_compliance
   → Verify exit form, assets returned, clearance certificate

7. complete_offboarding
   → Finalize and send notifications
   → Status changes to "Completed"
```

---

## Agent Flow Integration

### HR Agent Flow Example

```yaml
Trigger: User says "Onboard new employee"

Steps:
  1. Collect employee information via conversation
  2. Call initiate_onboarding with collected data
  3. Get Employee ID from response
  4. Call validate_onboarding_data
  5. If valid, notify HR for approval
  6. When HR approves, call approve_onboarding
  7. Continue with system provisioning...
```

### Using in HTTP Connectors

While the MCP server uses stdio transport, you can still use the REST APIs for similar functionality. The MCP server is specifically designed for Microsoft Copilot's native MCP integration.

---

## Testing Locally

### 1. Run the MCP Server

```bash
cd /path/to/nexus-apis
node src/mcp-server.ts
```

### 2. Test with MCP Inspector

Install the MCP Inspector:

```bash
npm install -g @modelcontextprotocol/inspector
```

Run the inspector:

```bash
mcp-inspector node src/mcp-server.ts
```

### 3. Test Individual Tools

Use the inspector UI to:
- View all available tools
- Test tool parameters
- See responses
- Verify workflow logic

---

## Data Persistence

**Important**: This implementation uses **in-memory storage**. Data is lost when the server restarts.

For production use, integrate with:
- **HRMS**: Workday, SAP SuccessFactors, BambooHR
- **IT Systems**: Active Directory, Google Workspace, Microsoft 365
- **Finance**: SAP, Oracle Financials, QuickBooks
- **Database**: PostgreSQL, MongoDB, or your preferred database

---

## Troubleshooting

### MCP Server Not Connecting

1. Verify the command is correct: `node src/mcp-server.ts`
2. Check the working directory path
3. Ensure Node.js is installed and accessible
4. Check console for error messages

### Tools Not Appearing in Copilot

1. Verify MCP server is running
2. Check server logs for errors
3. Restart Copilot Studio
4. Re-add the MCP server configuration

### Tool Execution Errors

1. Check parameter types match the schema
2. Verify required parameters are provided
3. Check employee ID exists
4. Review audit trail for workflow state

---

## Support

For issues or questions:
1. Check the `/mcp` endpoint for server status
2. Review server logs
3. Test with MCP Inspector
4. Verify Microsoft Copilot configuration

---

## Next Steps

1. **Deploy to Vercel**: Your existing Express APIs will continue to work
2. **Configure Copilot**: Add the MCP server to your HR agent
3. **Test Workflows**: Run complete onboarding and offboarding flows
4. **Integrate Systems**: Connect to real HRMS, IT, and Finance systems
5. **Add Database**: Implement persistent storage for production use
