import express, { Request, Response } from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// Data Models (same as mcp-server.ts)
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

// Tool execution logic (same as mcp-server.ts)
async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'initiate_onboarding': {
      const employeeId = generateEmployeeId()
      const employee: Employee = {
        id: employeeId,
        name: args.name,
        email: args.email,
        dateOfJoining: args.dateOfJoining,
        department: args.department,
        designation: args.designation,
        manager: args.manager,
        workLocation: args.workLocation,
        contactPhone: args.contactPhone,
        employmentType: args.employmentType,
        projectAssignment: args.projectAssignment,
      }

      const record: OnboardingRecord = {
        employeeId,
        employee,
        status: 'Initiated',
        initiatedBy: args.initiatedBy,
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
            actor: args.initiatedBy,
            details: `Onboarding started for ${employee.name}`,
          },
        ],
      }

      onboardingRecords.set(employeeId, record)

      return {
        success: true,
        employeeId,
        status: 'Initiated',
        message: `Onboarding process initiated for ${employee.name}`,
        nextSteps: ['HR Approval', 'Manager Approval'],
        employee,
      }
    }

    case 'validate_onboarding_data': {
      const employeeId = args.employeeId
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
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
        success: true,
        employeeId,
        isValid,
        missingFields,
        message: isValid ? 'All required fields are complete' : 'Missing required fields',
      }
    }

    case 'approve_onboarding': {
      const employeeId = args.employeeId
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
      }

      const approverRole = args.approverRole
      const approved = args.approved
      const approverName = args.approverName
      const comments = args.comments

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

      if (record.approvals.hr.approved && record.approvals.manager.approved) {
        record.status = 'Approved'
      } else if (!approved) {
        record.status = 'Pending Approval'
      }

      onboardingRecords.set(employeeId, record)

      return {
        success: true,
        employeeId,
        approverRole,
        approved,
        status: record.status,
        message: `${approverRole.toUpperCase()} ${approved ? 'approved' : 'rejected'} onboarding for ${record.employee.name}`,
        nextSteps: record.status === 'Approved' ? ['System Provisioning', 'Compliance Checks', 'Finance Enrollment'] : ['Pending other approvals'],
      }
    }

    case 'provision_systems': {
      const employeeId = args.employeeId
      const systems = args.systems
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
      }

      systems.forEach((system: string) => {
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
        success: true,
        employeeId,
        provisionedSystems: systems,
        systemStatus: record.systemProvisioning,
        message: `Systems provisioned for ${record.employee.name}`,
      }
    }

    case 'enroll_benefits': {
      const employeeId = args.employeeId
      const enrollPayroll = args.enrollPayroll
      const enrollBenefits = args.enrollBenefits
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
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
        success: true,
        employeeId,
        financeEnrollment: record.financeEnrollment,
        message: `Finance enrollment completed for ${record.employee.name}`,
      }
    }

    case 'check_onboarding_compliance': {
      const employeeId = args.employeeId
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
      }

      if (args.ndaSigned !== undefined) record.compliance.ndaSigned = args.ndaSigned
      if (args.idVerified !== undefined) record.compliance.idVerified = args.idVerified
      if (args.backgroundCheck !== undefined) record.compliance.backgroundCheck = args.backgroundCheck

      record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Compliance Check',
        actor: 'Compliance System',
        details: `NDA: ${record.compliance.ndaSigned}, ID: ${record.compliance.idVerified}, Background: ${record.compliance.backgroundCheck}`,
      })

      const allCompliant = record.compliance.ndaSigned && record.compliance.idVerified && record.compliance.backgroundCheck

      onboardingRecords.set(employeeId, record)

      return {
        success: true,
        employeeId,
        compliance: record.compliance,
        allCompliant,
        message: allCompliant ? 'All compliance checks passed' : 'Compliance checks incomplete',
      }
    }

    case 'complete_onboarding': {
      const employeeId = args.employeeId
      const completedBy = args.completedBy
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
      }

      const allSystemsProvisioned = Object.values(record.systemProvisioning).every(v => v)
      const allCompliant = Object.values(record.compliance).every(v => v)
      const financeEnrolled = Object.values(record.financeEnrollment).every(v => v)
      const allApproved = record.approvals.hr.approved && record.approvals.manager.approved

      if (!allSystemsProvisioned || !allCompliant || !financeEnrolled || !allApproved) {
        return {
          success: false,
          error: 'Cannot complete onboarding - requirements not met',
          checklist: {
            approvals: allApproved,
            systemProvisioning: allSystemsProvisioned,
            compliance: allCompliant,
            financeEnrollment: financeEnrolled,
          },
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
      }
    }

    case 'initiate_offboarding': {
      const employeeId = args.employeeId

      const record: OffboardingRecord = {
        employeeId,
        employeeName: args.employeeName,
        lastWorkingDay: args.lastWorkingDay,
        department: args.department,
        reason: args.reason,
        manager: args.manager,
        status: 'Initiated',
        initiatedBy: args.initiatedBy,
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
            actor: args.initiatedBy,
            details: `Offboarding started for ${args.employeeName}. Reason: ${args.reason}`,
          },
        ],
      }

      offboardingRecords.set(employeeId, record)

      return {
        success: true,
        employeeId,
        status: 'Initiated',
        message: `Offboarding process initiated for ${args.employeeName}`,
        lastWorkingDay: args.lastWorkingDay,
        nextSteps: ['Manager Approval', 'HR Approval'],
      }
    }

    case 'approve_offboarding': {
      const employeeId = args.employeeId
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
      }

      const approverRole = args.approverRole
      const approved = args.approved
      const approverName = args.approverName
      const comments = args.comments

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
        success: true,
        employeeId,
        approverRole,
        approved,
        status: record.status,
        message: `${approverRole.toUpperCase()} ${approved ? 'approved' : 'rejected'} offboarding for ${record.employeeName}`,
        nextSteps: record.status === 'Approved' ? ['System Deprovisioning', 'Compliance Checks', 'Final Payroll'] : ['Pending other approvals'],
      }
    }

    case 'deprovision_systems': {
      const employeeId = args.employeeId
      const systems = args.systems
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
      }

      systems.forEach((system: string) => {
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
        success: true,
        employeeId,
        deprovisionedSystems: systems,
        systemStatus: record.systemDeprovisioning,
        message: `Systems deprovisioned for ${record.employeeName}`,
      }
    }

    case 'process_final_payroll': {
      const employeeId = args.employeeId
      const processFinalPayroll = args.processFinalPayroll
      const terminateBenefits = args.terminateBenefits
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
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
        success: true,
        employeeId,
        finalPayroll: record.finalPayroll,
        message: `Final payroll processing completed for ${record.employeeName}`,
      }
    }

    case 'check_offboarding_compliance': {
      const employeeId = args.employeeId
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
      }

      if (args.exitFormSubmitted !== undefined) record.compliance.exitFormSubmitted = args.exitFormSubmitted
      if (args.assetsReturned !== undefined) record.compliance.assetsReturned = args.assetsReturned
      if (args.clearanceCertificate !== undefined) record.compliance.clearanceCertificate = args.clearanceCertificate

      record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Compliance Check',
        actor: 'Compliance System',
        details: `Exit Form: ${record.compliance.exitFormSubmitted}, Assets: ${record.compliance.assetsReturned}, Clearance: ${record.compliance.clearanceCertificate}`,
      })

      const allCompliant = record.compliance.exitFormSubmitted && record.compliance.assetsReturned && record.compliance.clearanceCertificate

      offboardingRecords.set(employeeId, record)

      return {
        success: true,
        employeeId,
        compliance: record.compliance,
        allCompliant,
        message: allCompliant ? 'All compliance checks passed' : 'Compliance checks incomplete',
      }
    }

    case 'complete_offboarding': {
      const employeeId = args.employeeId
      const completedBy = args.completedBy
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
      }

      const allSystemsDeprovisioned = Object.values(record.systemDeprovisioning).every(v => v)
      const allCompliant = Object.values(record.compliance).every(v => v)
      const payrollProcessed = Object.values(record.finalPayroll).every(v => v)
      const allApproved = record.approvals.manager.approved && record.approvals.hr.approved

      if (!allSystemsDeprovisioned || !allCompliant || !payrollProcessed || !allApproved) {
        return {
          success: false,
          error: 'Cannot complete offboarding - requirements not met',
          checklist: {
            approvals: allApproved,
            systemDeprovisioning: allSystemsDeprovisioned,
            compliance: allCompliant,
            finalPayroll: payrollProcessed,
          },
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
      }
    }

    case 'get_onboarding_status': {
      const employeeId = args.employeeId
      const record = onboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Employee not found' }
      }

      return {
        success: true,
        employeeId,
        employee: record.employee,
        status: record.status,
        approvals: record.approvals,
        systemProvisioning: record.systemProvisioning,
        compliance: record.compliance,
        financeEnrollment: record.financeEnrollment,
        auditTrail: record.auditTrail,
      }
    }

    case 'get_offboarding_status': {
      const employeeId = args.employeeId
      const record = offboardingRecords.get(employeeId)

      if (!record) {
        return { success: false, error: 'Offboarding record not found' }
      }

      return {
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
      }
    }

    case 'list_pending_approvals': {
      const type = args.type
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
        success: true,
        pendingOnboarding,
        pendingOffboarding,
        totalPending: pendingOnboarding.length + pendingOffboarding.length,
      }
    }

    case 'get_employee_details': {
      const employeeId = args.employeeId
      
      const onboardingRecord = onboardingRecords.get(employeeId)
      if (onboardingRecord) {
        return {
          success: true,
          source: 'onboarding',
          employee: onboardingRecord.employee,
          status: onboardingRecord.status,
        }
      }

      const offboardingRecord = offboardingRecords.get(employeeId)
      if (offboardingRecord) {
        return {
          success: true,
          source: 'offboarding',
          employeeId: offboardingRecord.employeeId,
          employeeName: offboardingRecord.employeeName,
          department: offboardingRecord.department,
          lastWorkingDay: offboardingRecord.lastWorkingDay,
          status: offboardingRecord.status,
        }
      }

      return { success: false, error: 'Employee not found' }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Create Express router for MCP HTTP transport
export function createMCPRouter() {
  const router = express.Router()

  // Handle MCP JSON-RPC requests
  router.post('/message', async (req: Request, res: Response) => {
    try {
      const request = req.body as JSONRPCRequest

      if (request.method === 'tools/list') {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools },
        }
        return res.json(response)
      }

      if (request.method === 'tools/call') {
        const { name, arguments: args } = request.params as any
        const result = await executeTool(name, args || {})
        
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        }
        return res.json(response)
      }

      // Handle initialize request
      if (request.method === 'initialize') {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'nexus-onboarding-offboarding',
              version: '1.0.0',
            },
          },
        }
        return res.json(response)
      }

      // Unknown method
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      }
      return res.status(404).json(errorResponse)
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: (req.body as any)?.id || null,
        error: {
          code: -32603,
          message: `Internal error: ${error}`,
        },
      }
      return res.status(500).json(errorResponse)
    }
  })

  // Server info endpoint
  router.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Nexus HR Workflows MCP',
      version: '1.0.0',
      description: 'MCP server for employee onboarding and offboarding workflows',
      protocol: 'MCP over HTTP',
      transport: 'http',
      endpoint: '/mcp/message',
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
      })),
    })
  })

  return router
}
