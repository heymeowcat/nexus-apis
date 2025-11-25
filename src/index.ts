import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json())

// Home route - HTML
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Nexus APIs</title>
        <link rel="stylesheet" href="/style.css" />
        <style>
          body { font-family: sans-serif; padding: 2rem; }
          nav { margin-bottom: 2rem; }
          nav a { margin-right: 1rem; text-decoration: none; color: #007bff; }
          nav a:hover { text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
          th { background-color: #f8f9fa; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/requisitionApproval">Requisition Approval</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to Nexus APIs 🚀</h1>
        
        <h2>Available Endpoints</h2>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>POST</td><td>/requisitionApproval</td><td>Submit a requisition for approval</td></tr>
            <tr><td>GET</td><td>/healthz</td><td>Service health check</td></tr>
            <tr><td>GET</td><td>/po/notifications</td><td>Retrieve pending PO approvals</td></tr>
            <tr><td>POST</td><td>/po/approve</td><td>Approve a Purchase Order</td></tr>
            <tr><td>POST</td><td>/po/reject</td><td>Reject a Purchase Order</td></tr>
            <tr><td>POST</td><td>/po/reassign</td><td>Reassign a PO approval</td></tr>
            <tr><td>GET</td><td>/po/approval-matrix</td><td>Fetch approval hierarchy</td></tr>
            <tr><td>POST</td><td>/team/createTask</td><td>Create a new task</td></tr>
            <tr><td>POST</td><td>/team/assignTask</td><td>Assign a task to team members</td></tr>
            <tr><td>PUT</td><td>/team/editTask</td><td>Update task details</td></tr>
            <tr><td>GET</td><td>/team/getTeamMembers</td><td>List all team members</td></tr>
            <tr><td>POST</td><td>/team/replaceTeamMember</td><td>Replace a team member on a task</td></tr>
            <tr><td>POST</td><td>/team/assignRole</td><td>Assign a role to a team member</td></tr>
            <tr><td>POST</td><td>/team/triggerNotification</td><td>Trigger a team notification</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `)
})

app.get('/about', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'))
})

// Requisition Approval API
app.post('/requisitionApproval', (req, res) => {
  const { requisitionId, approverId, decision, comments } = req.body

  if (!requisitionId || !approverId || !decision) {
    return res.status(400).json({
      error: 'Missing required fields: requisitionId, approverId, or decision',
    })
  }

  const timestamp = new Date().toISOString()
  let decisionStatus = ''
  let nextApprover = ''
  let message = ''

  if (decision.toLowerCase() === 'approve') {
    decisionStatus = 'Approved'
    nextApprover = 'Director' // Example hierarchy
    message = 'Requisition approved successfully'
  } else if (decision.toLowerCase() === 'reject') {
    decisionStatus = 'Rejected'
    nextApprover = 'None'
    message = 'Requisition rejected'
  } else {
    decisionStatus = 'Error'
    message = 'Invalid decision value'
    return res.status(400).json({
      requisitionId,
      decisionStatus,
      approverId,
      nextApprover: 'None',
      comments: comments || '',
      timestamp,
      message,
    })
  }

  res.json({
    requisitionId,
    decisionStatus,
    approverId,
    nextApprover,
    comments: comments || '',
    timestamp,
    message,
  })
})

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// --- Purchase Order Approval Workflow ---

// Mock Data for Purchase Orders
interface PurchaseOrder {
  id: string
  amount: number
  region: string
  requester: string
  status: 'Pending' | 'Approved' | 'Rejected'
  currentApprover: string
  details: string
  history: Array<{ action: string; actor: string; date: string; comments?: string }>
}

const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-1001',
    amount: 5000,
    region: 'US',
    requester: 'Alice Smith',
    status: 'Pending',
    currentApprover: 'CPM',
    details: 'Office Supplies for Q4',
    history: [],
  },
  {
    id: 'PO-1002',
    amount: 15000,
    region: 'EMEA',
    requester: 'Bob Jones',
    status: 'Pending',
    currentApprover: 'CPH',
    details: 'New Server Hardware',
    history: [],
  },
  {
    id: 'PO-1003',
    amount: 75000,
    region: 'APAC',
    requester: 'Charlie Kim',
    status: 'Pending',
    currentApprover: 'Geo Controller',
    details: 'Consulting Services Contract',
    history: [],
  },
]

// Helper to determine approval matrix
const getApprovalMatrix = (region: string, amount: number): string[] => {
  // Base hierarchy: CPM -> CPH -> Geo Controller -> Corporate Controller
  const fullHierarchy = ['CPM', 'CPH', 'Geo Controller', 'Corporate Controller']
  
  // Logic: Higher amounts require more levels
  if (amount < 10000) return ['CPM']
  if (amount < 50000) return ['CPM', 'CPH']
  if (amount < 100000) return ['CPM', 'CPH', 'Geo Controller']
  return fullHierarchy
}

// 1. GET /po/notifications: Retrieve pending PO approvals
app.get('/po/notifications', (req, res) => {
  const pendingPOs = purchaseOrders.filter((po) => po.status === 'Pending')
  res.json({
    count: pendingPOs.length,
    notifications: pendingPOs.map((po) => ({
      message: `PO ${po.id} requires approval`,
      poId: po.id,
      amount: po.amount,
      requester: po.requester,
      currentApprover: po.currentApprover,
    })),
  })
})

// 2. POST /po/approve: Approve PO
app.post('/po/approve', (req, res) => {
  const { poId, approverId, comments } = req.body

  const po = purchaseOrders.find((p) => p.id === poId)
  if (!po) {
    return res.status(404).json({ error: 'Purchase Order not found' })
  }

  if (po.status !== 'Pending') {
    return res.status(400).json({ error: `PO is already ${po.status}` })
  }

  // Check matrix to see if there is a next approver
  const matrix = getApprovalMatrix(po.region, po.amount)
  const currentLevelIndex = matrix.indexOf(po.currentApprover)
  
  let message = 'PO Approved'
  let nextApprover = null

  if (currentLevelIndex !== -1 && currentLevelIndex < matrix.length - 1) {
    // Move to next approver
    nextApprover = matrix[currentLevelIndex + 1]
    po.currentApprover = nextApprover
    message = `Approved by ${approverId}. Forwarded to ${nextApprover}.`
  } else {
    // Final approval
    po.status = 'Approved'
    po.currentApprover = 'None'
    message = `PO ${po.id} fully approved.`
  }

  po.history.push({
    action: 'Approve',
    actor: approverId,
    date: new Date().toISOString(),
    comments,
  })

  res.json({
    message,
    poId: po.id,
    status: po.status,
    nextApprover,
  })
})

// 3. POST /po/reject: Reject PO
app.post('/po/reject', (req, res) => {
  const { poId, approverId, comments } = req.body

  if (!comments) {
    return res.status(400).json({ error: 'Comments are required for rejection' })
  }

  const po = purchaseOrders.find((p) => p.id === poId)
  if (!po) {
    return res.status(404).json({ error: 'Purchase Order not found' })
  }

  po.status = 'Rejected'
  po.currentApprover = 'None'
  po.history.push({
    action: 'Reject',
    actor: approverId,
    date: new Date().toISOString(),
    comments,
  })

  res.json({
    message: `PO ${po.id} has been rejected.`,
    poId: po.id,
    status: 'Rejected',
  })
})

// 4. POST /po/reassign: Reassign approval
app.post('/po/reassign', (req, res) => {
  const { poId, newApproverId, currentApproverId } = req.body

  const po = purchaseOrders.find((p) => p.id === poId)
  if (!po) {
    return res.status(404).json({ error: 'Purchase Order not found' })
  }

  const oldApprover = po.currentApprover
  po.currentApprover = newApproverId
  
  po.history.push({
    action: 'Reassign',
    actor: currentApproverId || 'System',
    date: new Date().toISOString(),
    comments: `Reassigned from ${oldApprover} to ${newApproverId}`,
  })

  res.json({
    message: `PO ${po.id} reassigned to ${newApproverId}`,
    poId: po.id,
    previousApprover: oldApprover,
    currentApprover: newApproverId,
  })
})

// 5. GET /po/approval-matrix: Fetch approval hierarchy for a PO
app.get('/po/approval-matrix', (req, res) => {
  const { poId, region, amount } = req.query

  let targetRegion = region as string
  let targetAmount = Number(amount)

  // If poId is provided, look it up
  if (poId) {
    const po = purchaseOrders.find((p) => p.id === poId)
    if (po) {
      targetRegion = po.region
      targetAmount = po.amount
    } else {
      return res.status(404).json({ error: 'Purchase Order not found' })
    }
  }

  if (!targetRegion || isNaN(targetAmount)) {
    return res.status(400).json({ error: 'Please provide poId OR (region and amount)' })
  }

  const matrix = getApprovalMatrix(targetRegion, targetAmount)

  res.json({
    region: targetRegion,
    amount: targetAmount,
    approvalMatrix: matrix,
  })
})

// --- Task and Team Member Management ---

interface TeamMember {
  id: string
  name: string
  role: string
  workItemTypes: string[]
}

interface Task {
  id: string
  name: string
  description: string
  projectCode: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  assignedTo: string[] // TeamMember IDs
  startDate: string
  endDate: string
}

const teamMembers: TeamMember[] = [
  { id: 'TM-001', name: 'John Doe', role: 'Developer', workItemTypes: ['Backend', 'API'] },
  { id: 'TM-002', name: 'Jane Smith', role: 'Tester', workItemTypes: ['QA', 'Automation'] },
  { id: 'TM-003', name: 'Mike Johnson', role: 'Project Manager', workItemTypes: ['Management'] },
]

const tasks: Task[] = [
  {
    id: 'TASK-1001',
    name: 'Initial Setup',
    description: 'Project initialization',
    projectCode: 'PROJ-A',
    status: 'Not Started',
    assignedTo: [],
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString(),
  }
]

// 1. POST /team/createTask
app.post('/team/createTask', (req, res) => {
  const { name, description, projectCode, startDate, endDate } = req.body
  
  if (!name || !projectCode) {
    return res.status(400).json({ error: 'Name and Project Code are required' })
  }

  const newTask: Task = {
    id: `TASK-${1000 + tasks.length + 1}`,
    name,
    description: description || '',
    projectCode,
    status: 'Not Started',
    assignedTo: [],
    startDate: startDate || new Date().toISOString(),
    endDate: endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
  }

  tasks.push(newTask)
  res.json({ message: 'Task created successfully', task: newTask })
})

// 2. POST /team/assignTask
app.post('/team/assignTask', (req, res) => {
  const { taskId, teamMemberIds } = req.body

  const task = tasks.find(t => t.id === taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  // Validate team members
  const validMembers = teamMembers.filter(tm => teamMemberIds.includes(tm.id))
  if (validMembers.length !== teamMemberIds.length) {
    return res.status(400).json({ error: 'One or more team members not found' })
  }

  task.assignedTo = [...new Set([...task.assignedTo, ...teamMemberIds])]
  res.json({ message: 'Task assigned successfully', task })
})

// 3. PUT /team/editTask
app.put('/team/editTask', (req, res) => {
  const { taskId, updates } = req.body
  
  const taskIndex = tasks.findIndex(t => t.id === taskId)
  if (taskIndex === -1) return res.status(404).json({ error: 'Task not found' })

  tasks[taskIndex] = { ...tasks[taskIndex], ...updates }
  res.json({ message: 'Task updated successfully', task: tasks[taskIndex] })
})

// 4. GET /team/getTeamMembers
app.get('/team/getTeamMembers', (req, res) => {
  res.json({ count: teamMembers.length, teamMembers })
})

// 5. POST /team/replaceTeamMember
app.post('/team/replaceTeamMember', (req, res) => {
  const { taskId, oldMemberId, newMemberId } = req.body

  const task = tasks.find(t => t.id === taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  if (!task.assignedTo.includes(oldMemberId)) {
    return res.status(400).json({ error: 'Old member is not assigned to this task' })
  }

  const newMember = teamMembers.find(tm => tm.id === newMemberId)
  if (!newMember) return res.status(404).json({ error: 'New team member not found' })

  // Replace
  task.assignedTo = task.assignedTo.map(id => id === oldMemberId ? newMemberId : id)
  
  res.json({ 
    message: `Replaced ${oldMemberId} with ${newMemberId} on task ${taskId}`,
    task 
  })
})

// 6. POST /team/assignRole
app.post('/team/assignRole', (req, res) => {
  const { teamMemberId, newRole } = req.body
  
  const member = teamMembers.find(tm => tm.id === teamMemberId)
  if (!member) return res.status(404).json({ error: 'Team member not found' })

  member.role = newRole
  res.json({ message: 'Role updated', teamMember: member })
})

// 7. POST /team/triggerNotification
app.post('/team/triggerNotification', (req, res) => {
  const { type, recipientId, message } = req.body
  // Mock notification logic
  console.log(`[Notification] Type: ${type}, To: ${recipientId}, Msg: ${message}`)
  res.json({ success: true, timestamp: new Date().toISOString() })
})

export default app
