import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
// In-memory storage
const onboardingRecords = new Map();
const offboardingRecords = new Map();
// Helper function to generate IDs
function generateEmployeeId() {
    return `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
// Create MCP Server
const server = new McpServer({
    name: 'nexus-onboarding-offboarding',
    version: '1.0.0',
});
// Register Tools
server.tool('initiate_onboarding', 'Start the onboarding process for a new employee. Creates employee record and initiates workflow.', {
    name: z.string().describe('Employee full name'),
    email: z.string().email().describe('Employee email address'),
    dateOfJoining: z.string().describe('Date of joining (YYYY-MM-DD)'),
    department: z.string().describe('Department/Business Unit'),
    designation: z.string().describe('Job title/role'),
    manager: z.string().describe('Manager/Supervisor name'),
    workLocation: z.string().describe('Work location'),
    contactPhone: z.string().describe('Contact phone number'),
    employmentType: z.string().describe('Employment type (Full-time, Contractor, etc.)'),
    projectAssignment: z.string().optional().describe('Project assignment (optional)'),
    initiatedBy: z.string().describe('HR or Hiring Manager initiating the process'),
}, async (args) => {
    const employeeId = generateEmployeeId();
    const employee = {
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
    };
    const record = {
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
    };
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('validate_onboarding_data', 'Validate that all required employee data fields are complete and correct.', {
    employeeId: z.string().describe('Employee ID to validate'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    const employee = record.employee;
    const missingFields = [];
    if (!employee.name)
        missingFields.push('name');
    if (!employee.email)
        missingFields.push('email');
    if (!employee.dateOfJoining)
        missingFields.push('dateOfJoining');
    if (!employee.department)
        missingFields.push('department');
    if (!employee.designation)
        missingFields.push('designation');
    if (!employee.manager)
        missingFields.push('manager');
    if (!employee.workLocation)
        missingFields.push('workLocation');
    if (!employee.contactPhone)
        missingFields.push('contactPhone');
    if (!employee.employmentType)
        missingFields.push('employmentType');
    const isValid = missingFields.length === 0;
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
    };
});
server.tool('approve_onboarding', 'HR or Manager approval of onboarding request.', {
    employeeId: z.string().describe('Employee ID'),
    approverRole: z.enum(['hr', 'manager']).describe('Role of approver'),
    approverName: z.string().describe('Name of approver'),
    approved: z.boolean().describe('Approval decision'),
    comments: z.string().optional().describe('Approval comments'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    const approverRole = args.approverRole;
    const approved = args.approved;
    const approverName = args.approverName;
    const comments = args.comments;
    record.approvals[approverRole] = {
        approved,
        approver: approverName,
        date: new Date().toISOString(),
    };
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: `${approverRole.toUpperCase()} ${approved ? 'Approved' : 'Rejected'}`,
        actor: approverName,
        details: comments || `${approverRole} ${approved ? 'approved' : 'rejected'} onboarding`,
    });
    // Update status if both approved
    if (record.approvals.hr.approved && record.approvals.manager.approved) {
        record.status = 'Approved';
    }
    else if (!approved) {
        record.status = 'Pending Approval';
    }
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('provision_systems', 'Trigger IT system provisioning (email, network, project management tools).', {
    employeeId: z.string().describe('Employee ID'),
    systems: z.array(z.enum(['hrms', 'email', 'network', 'projectTools'])).describe('Systems to provision'),
}, async (args) => {
    const employeeId = args.employeeId;
    const systems = args.systems;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    systems.forEach((system) => {
        if (system in record.systemProvisioning) {
            record.systemProvisioning[system] = true;
        }
    });
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Systems Provisioned',
        actor: 'IT System',
        details: `Provisioned: ${systems.join(', ')}`,
    });
    record.status = 'In Progress';
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('enroll_benefits', 'Finance integration for payroll and benefits enrollment.', {
    employeeId: z.string().describe('Employee ID'),
    enrollPayroll: z.boolean().describe('Enroll in payroll'),
    enrollBenefits: z.boolean().describe('Enroll in benefits'),
}, async (args) => {
    const employeeId = args.employeeId;
    const enrollPayroll = args.enrollPayroll;
    const enrollBenefits = args.enrollBenefits;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    if (enrollPayroll)
        record.financeEnrollment.payroll = true;
    if (enrollBenefits)
        record.financeEnrollment.benefits = true;
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Finance Enrollment',
        actor: 'Finance System',
        details: `Payroll: ${enrollPayroll}, Benefits: ${enrollBenefits}`,
    });
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('check_onboarding_compliance', 'Verify mandatory documentation (NDA, ID verification, background check).', {
    employeeId: z.string().describe('Employee ID'),
    ndaSigned: z.boolean().optional().describe('NDA signed'),
    idVerified: z.boolean().optional().describe('ID verified'),
    backgroundCheck: z.boolean().optional().describe('Background check completed'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    if (args.ndaSigned !== undefined)
        record.compliance.ndaSigned = args.ndaSigned;
    if (args.idVerified !== undefined)
        record.compliance.idVerified = args.idVerified;
    if (args.backgroundCheck !== undefined)
        record.compliance.backgroundCheck = args.backgroundCheck;
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Compliance Check',
        actor: 'Compliance System',
        details: `NDA: ${record.compliance.ndaSigned}, ID: ${record.compliance.idVerified}, Background: ${record.compliance.backgroundCheck}`,
    });
    const allCompliant = record.compliance.ndaSigned && record.compliance.idVerified && record.compliance.backgroundCheck;
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('complete_onboarding', 'Finalize onboarding process and send completion notifications.', {
    employeeId: z.string().describe('Employee ID'),
    completedBy: z.string().describe('HR person completing the process'),
}, async (args) => {
    const employeeId = args.employeeId;
    const completedBy = args.completedBy;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
    }
    // Check if all requirements are met
    const allSystemsProvisioned = Object.values(record.systemProvisioning).every(v => v);
    const allCompliant = Object.values(record.compliance).every(v => v);
    const financeEnrolled = Object.values(record.financeEnrollment).every(v => v);
    const allApproved = record.approvals.hr.approved && record.approvals.manager.approved;
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
        };
    }
    record.status = 'Completed';
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Onboarding Completed',
        actor: completedBy,
        details: `Onboarding process completed for ${record.employee.name}`,
    });
    onboardingRecords.set(employeeId, record);
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
    };
});
server.tool('initiate_offboarding', 'Start the offboarding process for an employee (resignation, termination, contract end).', {
    employeeId: z.string().describe('Employee ID'),
    employeeName: z.string().describe('Employee name'),
    lastWorkingDay: z.string().describe('Last working day (YYYY-MM-DD)'),
    department: z.string().describe('Department'),
    reason: z.string().describe('Reason for offboarding'),
    manager: z.string().describe('Manager name'),
    initiatedBy: z.string().describe('HR or Manager initiating'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = {
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
    };
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('approve_offboarding', 'Manager or HR approval of offboarding request.', {
    employeeId: z.string().describe('Employee ID'),
    approverRole: z.enum(['manager', 'hr']).describe('Role of approver'),
    approverName: z.string().describe('Name of approver'),
    approved: z.boolean().describe('Approval decision'),
    comments: z.string().optional().describe('Approval comments'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
    }
    const approverRole = args.approverRole;
    const approved = args.approved;
    const approverName = args.approverName;
    const comments = args.comments;
    record.approvals[approverRole] = {
        approved,
        approver: approverName,
        date: new Date().toISOString(),
    };
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: `${approverRole.toUpperCase()} ${approved ? 'Approved' : 'Rejected'}`,
        actor: approverName,
        details: comments || `${approverRole} ${approved ? 'approved' : 'rejected'} offboarding`,
    });
    if (record.approvals.manager.approved && record.approvals.hr.approved) {
        record.status = 'Approved';
    }
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('deprovision_systems', 'Deactivate user accounts and revoke access rights.', {
    employeeId: z.string().describe('Employee ID'),
    systems: z.array(z.enum(['hrms', 'email', 'network', 'projectTools'])).describe('Systems to deprovision'),
}, async (args) => {
    const employeeId = args.employeeId;
    const systems = args.systems;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
    }
    systems.forEach((system) => {
        if (system in record.systemDeprovisioning) {
            record.systemDeprovisioning[system] = true;
        }
    });
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Systems Deprovisioned',
        actor: 'IT System',
        details: `Deprovisioned: ${systems.join(', ')}`,
    });
    record.status = 'In Progress';
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('process_final_payroll', 'Finance integration for final payroll processing and benefits termination.', {
    employeeId: z.string().describe('Employee ID'),
    processFinalPayroll: z.boolean().describe('Process final payroll'),
    terminateBenefits: z.boolean().describe('Terminate benefits'),
}, async (args) => {
    const employeeId = args.employeeId;
    const processFinalPayroll = args.processFinalPayroll;
    const terminateBenefits = args.terminateBenefits;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
    }
    if (processFinalPayroll)
        record.finalPayroll.processed = true;
    if (terminateBenefits)
        record.finalPayroll.benefitsTerminated = true;
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Final Payroll Processing',
        actor: 'Finance System',
        details: `Final Payroll: ${processFinalPayroll}, Benefits Terminated: ${terminateBenefits}`,
    });
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('check_offboarding_compliance', 'Verify exit forms submission and asset return.', {
    employeeId: z.string().describe('Employee ID'),
    exitFormSubmitted: z.boolean().optional().describe('Exit form submitted'),
    assetsReturned: z.boolean().optional().describe('Company assets returned'),
    clearanceCertificate: z.boolean().optional().describe('Clearance certificate issued'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
    }
    if (args.exitFormSubmitted !== undefined)
        record.compliance.exitFormSubmitted = args.exitFormSubmitted;
    if (args.assetsReturned !== undefined)
        record.compliance.assetsReturned = args.assetsReturned;
    if (args.clearanceCertificate !== undefined)
        record.compliance.clearanceCertificate = args.clearanceCertificate;
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Compliance Check',
        actor: 'Compliance System',
        details: `Exit Form: ${record.compliance.exitFormSubmitted}, Assets: ${record.compliance.assetsReturned}, Clearance: ${record.compliance.clearanceCertificate}`,
    });
    const allCompliant = record.compliance.exitFormSubmitted && record.compliance.assetsReturned && record.compliance.clearanceCertificate;
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('complete_offboarding', 'Finalize offboarding process and send completion notifications.', {
    employeeId: z.string().describe('Employee ID'),
    completedBy: z.string().describe('HR person completing the process'),
}, async (args) => {
    const employeeId = args.employeeId;
    const completedBy = args.completedBy;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
    }
    const allSystemsDeprovisioned = Object.values(record.systemDeprovisioning).every(v => v);
    const allCompliant = Object.values(record.compliance).every(v => v);
    const payrollProcessed = Object.values(record.finalPayroll).every(v => v);
    const allApproved = record.approvals.manager.approved && record.approvals.hr.approved;
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
        };
    }
    record.status = 'Completed';
    record.auditTrail.push({
        date: new Date().toISOString(),
        action: 'Offboarding Completed',
        actor: completedBy,
        details: `Offboarding process completed for ${record.employeeName}`,
    });
    offboardingRecords.set(employeeId, record);
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
    };
});
server.tool('get_onboarding_status', 'Check the current status of an onboarding process.', {
    employeeId: z.string().describe('Employee ID'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = onboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Employee not found' }),
                },
            ],
        };
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
    };
});
server.tool('get_offboarding_status', 'Check the current status of an offboarding process.', {
    employeeId: z.string().describe('Employee ID'),
}, async (args) => {
    const employeeId = args.employeeId;
    const record = offboardingRecords.get(employeeId);
    if (!record) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: false, error: 'Offboarding record not found' }),
                },
            ],
        };
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
    };
});
server.tool('list_pending_approvals', 'Get all pending onboarding/offboarding approvals.', {
    type: z.enum(['onboarding', 'offboarding', 'all']).describe('Type of approvals to list'),
}, async (args) => {
    const type = args.type;
    const pendingOnboarding = [];
    const pendingOffboarding = [];
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
                });
            }
        });
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
                });
            }
        });
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
    };
});
server.tool('get_employee_details', 'Retrieve employee information from onboarding or offboarding records.', {
    employeeId: z.string().describe('Employee ID'),
}, async (args) => {
    const employeeId = args.employeeId;
    // Check onboarding records first
    const onboardingRecord = onboardingRecords.get(employeeId);
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
        };
    }
    // Check offboarding records
    const offboardingRecord = offboardingRecords.get(employeeId);
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
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Employee not found' }),
            },
        ],
    };
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Nexus Onboarding/Offboarding MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
