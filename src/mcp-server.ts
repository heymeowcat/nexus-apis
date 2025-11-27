import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// Data Models
interface Employee {
  id: string
  name: string
  email: string
  dateOfJoining: string
  department: string
  designation: string
  manager: string
  workLocation: string
  contactPhone: string
  employmentType: string
  projectAssignment?: string
}

interface OnboardingRecord {
  employeeId: string
  employee: Employee
  status: 'Initiated' | 'Pending Approval' | 'Approved' | 'In Progress' | 'Completed'
  initiatedBy: string
  initiatedDate: string
  approvals: {
    hr: { approved: boolean; approver?: string; date?: string }
    manager: { approved: boolean; approver?: string; date?: string }
  }
  systemProvisioning: {
    hrms: boolean
    email: boolean
    network: boolean
    projectTools: boolean
  }
  compliance: {
    ndaSigned: boolean
    idVerified: boolean
    backgroundCheck: boolean
  }
  financeEnrollment: {
    payroll: boolean
    benefits: boolean
  }
  auditTrail: Array<{ date: string; action: string; actor: string; details: string }>
}

interface OffboardingRecord {
  employeeId: string
  employeeName: string
  lastWorkingDay: string
  department: string
  reason: string
  manager: string
  status: 'Initiated' | 'Pending Approval' | 'Approved' | 'In Progress' | 'Completed'
  initiatedBy: string
  initiatedDate: string
  approvals: {
    manager: { approved: boolean; approver?: string; date?: string }
    hr: { approved: boolean; approver?: string; date?: string }
  }
  systemDeprovisioning: {
    hrms: boolean
    email: boolean
    network: boolean
    projectTools: boolean
  }
  compliance: {
    exitFormSubmitted: boolean
    assetsReturned: boolean
    clearanceCertificate: boolean
  }
  finalPayroll: {
    processed: boolean
    benefitsTerminated: boolean
  }
  auditTrail: Array<{ date: string; action: string; actor: string; details: string }>
}

// In-memory storage
const onboardingRecords: Map<string, OnboardingRecord> = new Map()
const offboardingRecords: Map<string, OffboardingRecord> = new Map()

// Helper function to generate IDs
function generateEmployeeId(): string {
  return `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

// Create MCP Server
const server = new Server(
  {
    name: 'nexus-onboarding-offboarding',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Define all tools
const tools: Tool[] = [
  {
    name: 'initiate_onboarding',
    description: 'Start the onboarding process for a new employee. Creates employee record and initiates workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Employee full name' },
        email: { type: 'string', description: 'Employee email address' },
        dateOfJoining: { type: 'string', description: 'Date of joining (YYYY-MM-DD)' },
        department: { type: 'string', description: 'Department/Business Unit' },
        designation: { type: 'string', description: 'Job title/role' },
        manager: { type: 'string', description: 'Manager/Supervisor name' },
        workLocation: { type: 'string', description: 'Work location' },
        contactPhone: { type: 'string', description: 'Contact phone number' },
        employmentType: { type: 'string', description: 'Employment type (Full-time, Contractor, etc.)' },
        projectAssignment: { type: 'string', description: 'Project assignment (optional)' },
        initiatedBy: { type: 'string', description: 'HR or Hiring Manager initiating the process' },
      },
      required: ['name', 'email', 'dateOfJoining', 'department', 'designation', 'manager', 'workLocation', 'contactPhone', 'employmentType', 'initiatedBy'],
    },
  },
  {
    name: 'validate_onboarding_data',
    description: 'Validate that all required employee data fields are complete and correct.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID to validate' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'approve_onboarding',
    description: 'HR or Manager approval of onboarding request.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        approverRole: { type: 'string', enum: ['hr', 'manager'], description: 'Role of approver' },
        approverName: { type: 'string', description: 'Name of approver' },
        approved: { type: 'boolean', description: 'Approval decision' },
        comments: { type: 'string', description: 'Approval comments' },
      },
      required: ['employeeId', 'approverRole', 'approverName', 'approved'],
    },
  },
  {
    name: 'provision_systems',
    description: 'Trigger IT system provisioning (email, network, project management tools).',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        systems: {
          type: 'array',
          items: { type: 'string', enum: ['hrms', 'email', 'network', 'projectTools'] },
          description: 'Systems to provision',
        },
      },
      required: ['employeeId', 'systems'],
    },
  },
  {
    name: 'enroll_benefits',
    description: 'Finance integration for payroll and benefits enrollment.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        enrollPayroll: { type: 'boolean', description: 'Enroll in payroll' },
        enrollBenefits: { type: 'boolean', description: 'Enroll in benefits' },
      },
      required: ['employeeId', 'enrollPayroll', 'enrollBenefits'],
    },
  },
  {
    name: 'check_onboarding_compliance',
    description: 'Verify mandatory documentation (NDA, ID verification, background check).',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        ndaSigned: { type: 'boolean', description: 'NDA signed' },
        idVerified: { type: 'boolean', description: 'ID verified' },
        backgroundCheck: { type: 'boolean', description: 'Background check completed' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'complete_onboarding',
    description: 'Finalize onboarding process and send completion notifications.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        completedBy: { type: 'string', description: 'HR person completing the process' },
      },
      required: ['employeeId', 'completedBy'],
    },
  },
  {
    name: 'initiate_offboarding',
    description: 'Start the offboarding process for an employee (resignation, termination, contract end).',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        employeeName: { type: 'string', description: 'Employee name' },
        lastWorkingDay: { type: 'string', description: 'Last working day (YYYY-MM-DD)' },
        department: { type: 'string', description: 'Department' },
        reason: { type: 'string', description: 'Reason for offboarding' },
        manager: { type: 'string', description: 'Manager name' },
        initiatedBy: { type: 'string', description: 'HR or Manager initiating' },
      },
      required: ['employeeId', 'employeeName', 'lastWorkingDay', 'department', 'reason', 'manager', 'initiatedBy'],
    },
  },
  {
    name: 'approve_offboarding',
    description: 'Manager or HR approval of offboarding request.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        approverRole: { type: 'string', enum: ['manager', 'hr'], description: 'Role of approver' },
        approverName: { type: 'string', description: 'Name of approver' },
        approved: { type: 'boolean', description: 'Approval decision' },
        comments: { type: 'string', description: 'Approval comments' },
      },
      required: ['employeeId', 'approverRole', 'approverName', 'approved'],
    },
  },
  {
    name: 'deprovision_systems',
    description: 'Deactivate user accounts and revoke access rights.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        systems: {
          type: 'array',
          items: { type: 'string', enum: ['hrms', 'email', 'network', 'projectTools'] },
          description: 'Systems to deprovision',
        },
      },
      required: ['employeeId', 'systems'],
    },
  },
  {
    name: 'process_final_payroll',
    description: 'Finance integration for final payroll processing and benefits termination.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        processFinalPayroll: { type: 'boolean', description: 'Process final payroll' },
        terminateBenefits: { type: 'boolean', description: 'Terminate benefits' },
      },
      required: ['employeeId', 'processFinalPayroll', 'terminateBenefits'],
    },
  },
  {
    name: 'check_offboarding_compliance',
    description: 'Verify exit forms submission and asset return.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        exitFormSubmitted: { type: 'boolean', description: 'Exit form submitted' },
        assetsReturned: { type: 'boolean', description: 'Company assets returned' },
        clearanceCertificate: { type: 'boolean', description: 'Clearance certificate issued' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'complete_offboarding',
    description: 'Finalize offboarding process and send completion notifications.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
        completedBy: { type: 'string', description: 'HR person completing the process' },
      },
      required: ['employeeId', 'completedBy'],
    },
  },
  {
    name: 'get_onboarding_status',
    description: 'Check the current status of an onboarding process.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'get_offboarding_status',
    description: 'Check the current status of an offboarding process.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'list_pending_approvals',
    description: 'Get all pending onboarding/offboarding approvals.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['onboarding', 'offboarding', 'all'], description: 'Type of approvals to list' },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_employee_details',
    description: 'Retrieve employee information from onboarding or offboarding records.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'Employee ID' },
      },
      required: ['employeeId'],
    },
  },
]

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'initiate_onboarding': {
        const employeeId = generateEmployeeId()
        const employee: Employee = {
          id: employeeId,
          name: args.name as string,
          email: args.email as string,
          dateOfJoining: args.dateOfJoining as string,
          department: args.department as string,
          designation: args.designation as string,
          manager: args.manager as string,
          workLocation: args.workLocation as string,
          contactPhone: args.contactPhone as string,
          employmentType: args.employmentType as string,
          projectAssignment: args.projectAssignment as string | undefined,
        }

        const record: OnboardingRecord = {
          employeeId,
          employee,
          status: 'Initiated',
          initiatedBy: args.initiatedBy as string,
          initiatedDate: new Date().toISOString(),
          approvals: {
            hr: { approved: false },
            manager: { approved: false },
          },
          systemProvisioning: {
            hrms: false,
            email: false,
            network: false,
            projectTools: false,
          },
          compliance: {
            ndaSigned: false,
            idVerified: false,
            backgroundCheck: false,
          },
          financeEnrollment: {
            payroll: false,
            benefits: false,
          },
          auditTrail: [
            {
              date: new Date().toISOString(),
              action: 'Onboarding Initiated',
              actor: args.initiatedBy as string,
              details: `Onboarding started for ${employee.name}`,
            },
          ],
        }

        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                status: 'Initiated',
                message: `Onboarding process initiated for ${employee.name}`,
                nextSteps: ['HR Approval', 'Manager Approval'],
                employee,
              }, null, 2),
            },
          ],
        }
      }

      case 'validate_onboarding_data': {
        const employeeId = args.employeeId as string
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        const employee = record.employee
        const missingFields: string[] = []

        if (!employee.name) missingFields.push('name')
        if (!employee.email) missingFields.push('email')
        if (!employee.dateOfJoining) missingFields.push('dateOfJoining')
        if (!employee.department) missingFields.push('department')
        if (!employee.designation) missingFields.push('designation')
        if (!employee.manager) missingFields.push('manager')
        if (!employee.workLocation) missingFields.push('workLocation')
        if (!employee.contactPhone) missingFields.push('contactPhone')
        if (!employee.employmentType) missingFields.push('employmentType')

        const isValid = missingFields.length === 0

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                isValid,
                missingFields,
                message: isValid ? 'All required fields are complete' : 'Missing required fields',
              }, null, 2),
            },
          ],
        }
      }

      case 'approve_onboarding': {
        const employeeId = args.employeeId as string
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        const approverRole = args.approverRole as 'hr' | 'manager'
        const approved = args.approved as boolean
        const approverName = args.approverName as string
        const comments = args.comments as string | undefined

        record.approvals[approverRole] = {
          approved,
          approver: approverName,
          date: new Date().toISOString(),
        }

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: `${approverRole.toUpperCase()} ${approved ? 'Approved' : 'Rejected'}`,
          actor: approverName,
          details: comments || `${approverRole} ${approved ? 'approved' : 'rejected'} onboarding`,
        })

        // Update status if both approved
        if (record.approvals.hr.approved && record.approvals.manager.approved) {
          record.status = 'Approved'
        } else if (!approved) {
          record.status = 'Pending Approval'
        }

        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                approverRole,
                approved,
                status: record.status,
                message: `${approverRole.toUpperCase()} ${approved ? 'approved' : 'rejected'} onboarding for ${record.employee.name}`,
                nextSteps: record.status === 'Approved' ? ['System Provisioning', 'Compliance Checks', 'Finance Enrollment'] : ['Pending other approvals'],
              }, null, 2),
            },
          ],
        }
      }

      case 'provision_systems': {
        const employeeId = args.employeeId as string
        const systems = args.systems as string[]
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        systems.forEach((system) => {
          if (system in record.systemProvisioning) {
            record.systemProvisioning[system as keyof typeof record.systemProvisioning] = true
          }
        })

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Systems Provisioned',
          actor: 'IT System',
          details: `Provisioned: ${systems.join(', ')}`,
        })

        record.status = 'In Progress'
        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                provisionedSystems: systems,
                systemStatus: record.systemProvisioning,
                message: `Systems provisioned for ${record.employee.name}`,
              }, null, 2),
            },
          ],
        }
      }

      case 'enroll_benefits': {
        const employeeId = args.employeeId as string
        const enrollPayroll = args.enrollPayroll as boolean
        const enrollBenefits = args.enrollBenefits as boolean
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        if (enrollPayroll) record.financeEnrollment.payroll = true
        if (enrollBenefits) record.financeEnrollment.benefits = true

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Finance Enrollment',
          actor: 'Finance System',
          details: `Payroll: ${enrollPayroll}, Benefits: ${enrollBenefits}`,
        })

        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                financeEnrollment: record.financeEnrollment,
                message: `Finance enrollment completed for ${record.employee.name}`,
              }, null, 2),
            },
          ],
        }
      }

      case 'check_onboarding_compliance': {
        const employeeId = args.employeeId as string
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        if (args.ndaSigned !== undefined) record.compliance.ndaSigned = args.ndaSigned as boolean
        if (args.idVerified !== undefined) record.compliance.idVerified = args.idVerified as boolean
        if (args.backgroundCheck !== undefined) record.compliance.backgroundCheck = args.backgroundCheck as boolean

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Compliance Check',
          actor: 'Compliance System',
          details: `NDA: ${record.compliance.ndaSigned}, ID: ${record.compliance.idVerified}, Background: ${record.compliance.backgroundCheck}`,
        })

        const allCompliant = record.compliance.ndaSigned && record.compliance.idVerified && record.compliance.backgroundCheck

        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                compliance: record.compliance,
                allCompliant,
                message: allCompliant ? 'All compliance checks passed' : 'Compliance checks incomplete',
              }, null, 2),
            },
          ],
        }
      }

      case 'complete_onboarding': {
        const employeeId = args.employeeId as string
        const completedBy = args.completedBy as string
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        // Check if all requirements are met
        const allSystemsProvisioned = Object.values(record.systemProvisioning).every(v => v)
        const allCompliant = Object.values(record.compliance).every(v => v)
        const financeEnrolled = Object.values(record.financeEnrollment).every(v => v)
        const allApproved = record.approvals.hr.approved && record.approvals.manager.approved

        if (!allSystemsProvisioned || !allCompliant || !financeEnrolled || !allApproved) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Cannot complete onboarding - requirements not met',
                  checklist: {
                    approvals: allApproved,
                    systemProvisioning: allSystemsProvisioned,
                    compliance: allCompliant,
                    financeEnrollment: financeEnrolled,
                  },
                }),
              },
            ],
          }
        }

        record.status = 'Completed'
        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Onboarding Completed',
          actor: completedBy,
          details: `Onboarding process completed for ${record.employee.name}`,
        })

        onboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                status: 'Completed',
                message: `Onboarding completed successfully for ${record.employee.name}`,
                completionDate: new Date().toISOString(),
                notifications: [
                  `Email sent to ${record.employee.email}`,
                  `Manager ${record.employee.manager} notified`,
                  'HR team notified',
                ],
              }, null, 2),
            },
          ],
        }
      }

      case 'initiate_offboarding': {
        const employeeId = args.employeeId as string

        const record: OffboardingRecord = {
          employeeId,
          employeeName: args.employeeName as string,
          lastWorkingDay: args.lastWorkingDay as string,
          department: args.department as string,
          reason: args.reason as string,
          manager: args.manager as string,
          status: 'Initiated',
          initiatedBy: args.initiatedBy as string,
          initiatedDate: new Date().toISOString(),
          approvals: {
            manager: { approved: false },
            hr: { approved: false },
          },
          systemDeprovisioning: {
            hrms: false,
            email: false,
            network: false,
            projectTools: false,
          },
          compliance: {
            exitFormSubmitted: false,
            assetsReturned: false,
            clearanceCertificate: false,
          },
          finalPayroll: {
            processed: false,
            benefitsTerminated: false,
          },
          auditTrail: [
            {
              date: new Date().toISOString(),
              action: 'Offboarding Initiated',
              actor: args.initiatedBy as string,
              details: `Offboarding started for ${args.employeeName}. Reason: ${args.reason}`,
            },
          ],
        }

        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                status: 'Initiated',
                message: `Offboarding process initiated for ${args.employeeName}`,
                lastWorkingDay: args.lastWorkingDay,
                nextSteps: ['Manager Approval', 'HR Approval'],
              }, null, 2),
            },
          ],
        }
      }

      case 'approve_offboarding': {
        const employeeId = args.employeeId as string
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        const approverRole = args.approverRole as 'manager' | 'hr'
        const approved = args.approved as boolean
        const approverName = args.approverName as string
        const comments = args.comments as string | undefined

        record.approvals[approverRole] = {
          approved,
          approver: approverName,
          date: new Date().toISOString(),
        }

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: `${approverRole.toUpperCase()} ${approved ? 'Approved' : 'Rejected'}`,
          actor: approverName,
          details: comments || `${approverRole} ${approved ? 'approved' : 'rejected'} offboarding`,
        })

        if (record.approvals.manager.approved && record.approvals.hr.approved) {
          record.status = 'Approved'
        }

        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                approverRole,
                approved,
                status: record.status,
                message: `${approverRole.toUpperCase()} ${approved ? 'approved' : 'rejected'} offboarding for ${record.employeeName}`,
                nextSteps: record.status === 'Approved' ? ['System Deprovisioning', 'Compliance Checks', 'Final Payroll'] : ['Pending other approvals'],
              }, null, 2),
            },
          ],
        }
      }

      case 'deprovision_systems': {
        const employeeId = args.employeeId as string
        const systems = args.systems as string[]
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        systems.forEach((system) => {
          if (system in record.systemDeprovisioning) {
            record.systemDeprovisioning[system as keyof typeof record.systemDeprovisioning] = true
          }
        })

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Systems Deprovisioned',
          actor: 'IT System',
          details: `Deprovisioned: ${systems.join(', ')}`,
        })

        record.status = 'In Progress'
        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                deprovisionedSystems: systems,
                systemStatus: record.systemDeprovisioning,
                message: `Systems deprovisioned for ${record.employeeName}`,
              }, null, 2),
            },
          ],
        }
      }

      case 'process_final_payroll': {
        const employeeId = args.employeeId as string
        const processFinalPayroll = args.processFinalPayroll as boolean
        const terminateBenefits = args.terminateBenefits as boolean
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        if (processFinalPayroll) record.finalPayroll.processed = true
        if (terminateBenefits) record.finalPayroll.benefitsTerminated = true

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Final Payroll Processing',
          actor: 'Finance System',
          details: `Final Payroll: ${processFinalPayroll}, Benefits Terminated: ${terminateBenefits}`,
        })

        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                finalPayroll: record.finalPayroll,
                message: `Final payroll processing completed for ${record.employeeName}`,
              }, null, 2),
            },
          ],
        }
      }

      case 'check_offboarding_compliance': {
        const employeeId = args.employeeId as string
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        if (args.exitFormSubmitted !== undefined) record.compliance.exitFormSubmitted = args.exitFormSubmitted as boolean
        if (args.assetsReturned !== undefined) record.compliance.assetsReturned = args.assetsReturned as boolean
        if (args.clearanceCertificate !== undefined) record.compliance.clearanceCertificate = args.clearanceCertificate as boolean

        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Compliance Check',
          actor: 'Compliance System',
          details: `Exit Form: ${record.compliance.exitFormSubmitted}, Assets: ${record.compliance.assetsReturned}, Clearance: ${record.compliance.clearanceCertificate}`,
        })

        const allCompliant = record.compliance.exitFormSubmitted && record.compliance.assetsReturned && record.compliance.clearanceCertificate

        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                compliance: record.compliance,
                allCompliant,
                message: allCompliant ? 'All compliance checks passed' : 'Compliance checks incomplete',
              }, null, 2),
            },
          ],
        }
      }

      case 'complete_offboarding': {
        const employeeId = args.employeeId as string
        const completedBy = args.completedBy as string
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        const allSystemsDeprovisioned = Object.values(record.systemDeprovisioning).every(v => v)
        const allCompliant = Object.values(record.compliance).every(v => v)
        const payrollProcessed = Object.values(record.finalPayroll).every(v => v)
        const allApproved = record.approvals.manager.approved && record.approvals.hr.approved

        if (!allSystemsDeprovisioned || !allCompliant || !payrollProcessed || !allApproved) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Cannot complete offboarding - requirements not met',
                  checklist: {
                    approvals: allApproved,
                    systemDeprovisioning: allSystemsDeprovisioned,
                    compliance: allCompliant,
                    finalPayroll: payrollProcessed,
                  },
                }),
              },
            ],
          }
        }

        record.status = 'Completed'
        record.auditTrail.push({
          date: new Date().toISOString(),
          action: 'Offboarding Completed',
          actor: completedBy,
          details: `Offboarding process completed for ${record.employeeName}`,
        })

        offboardingRecords.set(employeeId, record)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                status: 'Completed',
                message: `Offboarding completed successfully for ${record.employeeName}`,
                completionDate: new Date().toISOString(),
                notifications: [
                  'Employee notified',
                  `Manager ${record.manager} notified`,
                  'HR team notified',
                ],
              }, null, 2),
            },
          ],
        }
      }

      case 'get_onboarding_status': {
        const employeeId = args.employeeId as string
        const record = onboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                employee: record.employee,
                status: record.status,
                approvals: record.approvals,
                systemProvisioning: record.systemProvisioning,
                compliance: record.compliance,
                financeEnrollment: record.financeEnrollment,
                auditTrail: record.auditTrail,
              }, null, 2),
            },
          ],
        }
      }

      case 'get_offboarding_status': {
        const employeeId = args.employeeId as string
        const record = offboardingRecords.get(employeeId)

        if (!record) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                employeeId,
                employeeName: record.employeeName,
                status: record.status,
                lastWorkingDay: record.lastWorkingDay,
                approvals: record.approvals,
                systemDeprovisioning: record.systemDeprovisioning,
                compliance: record.compliance,
                finalPayroll: record.finalPayroll,
                auditTrail: record.auditTrail,
              }, null, 2),
            },
          ],
        }
      }

      case 'list_pending_approvals': {
        const type = args.type as 'onboarding' | 'offboarding' | 'all'
        const pendingOnboarding: any[] = []
        const pendingOffboarding: any[] = []

        if (type === 'onboarding' || type === 'all') {
          onboardingRecords.forEach((record) => {
            if (!record.approvals.hr.approved || !record.approvals.manager.approved) {
              pendingOnboarding.push({
                employeeId: record.employeeId,
                employeeName: record.employee.name,
                type: 'onboarding',
                status: record.status,
                pendingApprovals: {
                  hr: !record.approvals.hr.approved,
                  manager: !record.approvals.manager.approved,
                },
              })
            }
          })
        }

        if (type === 'offboarding' || type === 'all') {
          offboardingRecords.forEach((record) => {
            if (!record.approvals.manager.approved || !record.approvals.hr.approved) {
              pendingOffboarding.push({
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                type: 'offboarding',
                status: record.status,
                lastWorkingDay: record.lastWorkingDay,
                pendingApprovals: {
                  manager: !record.approvals.manager.approved,
                  hr: !record.approvals.hr.approved,
                },
              })
            }
          })
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                pendingOnboarding,
                pendingOffboarding,
                totalPending: pendingOnboarding.length + pendingOffboarding.length,
              }, null, 2),
            },
          ],
        }
      }

      case 'get_employee_details': {
        const employeeId = args.employeeId as string
        
        // Check onboarding records first
        const onboardingRecord = onboardingRecords.get(employeeId)
        if (onboardingRecord) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  source: 'onboarding',
                  employee: onboardingRecord.employee,
                  status: onboardingRecord.status,
                }, null, 2),
              },
            ],
          }
        }

        // Check offboarding records
        const offboardingRecord = offboardingRecords.get(employeeId)
        if (offboardingRecord) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  source: 'offboarding',
                  employeeId: offboardingRecord.employeeId,
                  employeeName: offboardingRecord.employeeName,
                  department: offboardingRecord.department,
                  lastWorkingDay: offboardingRecord.lastWorkingDay,
                  status: offboardingRecord.status,
                }, null, 2),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Employee not found' }),
            },
          ],
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        }
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: String(error) }),
        },
      ],
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Nexus Onboarding/Offboarding MCP Server running on stdio')
}

main().catch(console.error)
