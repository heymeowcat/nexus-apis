
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { mcpHandler } from './mcp-handler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json())

// MCP Streamable HTTP endpoint using mcp-handler
app.all('/mcp', async (req, res) => {
  const protocol = req.protocol
  const host = req.get('host')
  const url = new URL(req.originalUrl, `${protocol}://${host}`)
  
  const webReq = new Request(url, {
    method: req.method,
    headers: req.headers as any,
    body: req.method === 'POST' ? JSON.stringify(req.body) : null,
  })

  try {
    const webRes = await mcpHandler(webReq)
    
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    
    res.status(webRes.status)
    
    const text = await webRes.text()
    res.send(text)
  } catch (error) {
    console.error('Error in MCP handler:', error)
    res.status(500).send('Internal Server Error')
  }
})

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
            <tr><td>MCP</td><td>/mcp</td><td><strong>🔌 MCP Server for Onboarding/Offboarding</strong> (17 tools available)</td></tr>
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

// --- Accounts Receivable Automation ---

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  tax_code: string
}

interface Invoice {
  id: string
  customer_id: string
  invoice_date: string
  due_date: string
  line_items: InvoiceItem[]
  currency: string
  payment_terms: string
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled'
  balance: number
}

interface CollectionNote {
  date: string
  user: string
  action: string
  comment: string
}

interface CollectionStatus {
  invoice_id: string
  status: 'Open' | 'In Progress' | 'Closed'
  last_action: string
  next_action_due: string
  notes: CollectionNote[]
}

const invoices: Invoice[] = [
  {
    id: 'INV-2001',
    customer_id: 'CUST-001',
    invoice_date: '2023-10-01',
    due_date: '2023-10-31',
    line_items: [{ description: 'Consulting Services', quantity: 10, unit_price: 150, tax_code: 'VAT' }],
    currency: 'USD',
    payment_terms: 'Net 30',
    status: 'Overdue',
    balance: 1500
  }
]

const collections: CollectionStatus[] = [
  {
    invoice_id: 'INV-2001',
    status: 'In Progress',
    last_action: 'Email Reminder',
    next_action_due: '2023-11-15',
    notes: [
      { date: '2023-11-01', user: 'System', action: 'Email', comment: 'First reminder sent' }
    ]
  }
]

// 1. POST /acc/invoices: Create Invoice
app.post('/acc/invoices', (req, res) => {
  const { customer_id, invoice_date, due_date, line_items, currency, payment_terms } = req.body

  if (!customer_id || !line_items || line_items.length === 0) {
    return res.status(400).json({ error: 'Missing required invoice fields' })
  }

  const totalAmount = line_items.reduce((sum: number, item: InvoiceItem) => sum + (item.quantity * item.unit_price), 0)
  
  const newInvoice: Invoice = {
    id: `INV-${2000 + invoices.length + 1}`,
    customer_id,
    invoice_date,
    due_date,
    line_items,
    currency: currency || 'USD',
    payment_terms: payment_terms || 'Net 30',
    status: 'Sent',
    balance: totalAmount
  }

  invoices.push(newInvoice)
  
  // Initialize collection record
  collections.push({
    invoice_id: newInvoice.id,
    status: 'Open',
    last_action: 'Created',
    next_action_due: due_date,
    notes: []
  })

  res.json({
    invoice_id: newInvoice.id,
    status: 'created',
    message: 'Invoice created successfully',
    download_url: `/acc/invoices/${newInvoice.id}/view`
  })
})

// 1.1 GET /acc/invoices/:id/view: Render Invoice HTML
app.get('/acc/invoices/:id/view', (req, res) => {
  const { id } = req.params
  const invoice = invoices.find(i => i.id === id)
  if (!invoice) return res.status(404).send('Invoice not found')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${invoice.id}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); }
          .header { display: flex; justify-content: space-between; margin-bottom: 50px; }
          .header h1 { margin: 0; color: #333; }
          .info { margin-bottom: 20px; }
          table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
          table td { padding: 10px; vertical-align: top; }
          table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
          table tr.item td { border-bottom: 1px solid #eee; }
          table tr.total td:nth-child(4) { border-top: 2px solid #eee; font-weight: bold; }
          .status { padding: 5px 10px; border-radius: 5px; font-size: 0.9em; font-weight: bold; }
          .status.Overdue { background: #ffebee; color: #c62828; }
          .status.Sent { background: #e3f2fd; color: #1565c0; }
          .status.Paid { background: #e8f5e9; color: #2e7d32; }
          .print-btn { display: block; width: 100%; padding: 10px; background: #333; color: #fff; text-align: center; text-decoration: none; margin-top: 20px; border-radius: 5px; }
          @media print { .print-btn { display: none; } .invoice-box { border: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <h1>INVOICE</h1>
              <div class="info">
                <strong>Invoice #:</strong> ${invoice.id}<br>
                <strong>Date:</strong> ${invoice.invoice_date}<br>
                <strong>Due Date:</strong> ${invoice.due_date}
              </div>
            </div>
            <div style="text-align: right;">
              <h3>Nexus Corp</h3>
              <div class="info">
                <strong>Bill To:</strong><br>
                Customer ID: ${invoice.customer_id}<br>
                Terms: ${invoice.payment_terms}
              </div>
              <span class="status ${invoice.status}">${invoice.status}</span>
            </div>
          </div>
          
          <table>
            <tr class="heading">
              <td>Description</td>
              <td>Qty</td>
              <td>Unit Price</td>
              <td>Total</td>
            </tr>
            ${invoice.line_items.map(item => `
              <tr class="item">
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${invoice.currency} ${item.unit_price.toFixed(2)}</td>
                <td>${invoice.currency} ${(item.quantity * item.unit_price).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total">
              <td></td>
              <td></td>
              <td>Total:</td>
              <td>${invoice.currency} ${invoice.balance.toFixed(2)}</td>
            </tr>
          </table>
          
          <a href="javascript:window.print()" class="print-btn">Download PDF / Print</a>
        </div>
      </body>
    </html>
  `
  res.type('html').send(html)
})

// 2. POST /acc/invoices/:id/reminder: Send Reminder
app.post('/acc/invoices/:id/reminder', (req, res) => {
  const { id } = req.params
  const { reminder_type, send_date } = req.body

  const invoice = invoices.find(i => i.id === id)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

  const collection = collections.find(c => c.invoice_id === id)
  if (collection) {
    collection.last_action = `Reminder: ${reminder_type}`
    collection.notes.push({
      date: new Date().toISOString(),
      user: 'System',
      action: 'Reminder',
      comment: `Sent ${reminder_type} reminder scheduled for ${send_date}`
    })
  }

  res.json({
    status: 'sent',
    message: `Reminder (${reminder_type}) queued for invoice ${id}`
  })
})

// 3. GET /acc/invoices/:id/collections: Get Collection Status
app.get('/acc/invoices/:id/collections', (req, res) => {
  const { id } = req.params
  const collection = collections.find(c => c.invoice_id === id)
  
  if (!collection) return res.status(404).json({ error: 'Collection record not found' })
  
  res.json({
    invoice_id: collection.invoice_id,
    collection_status: collection.status,
    last_action: collection.last_action,
    next_action_due: collection.next_action_due,
    notes: collection.notes
  })
})

// 4. POST /acc/invoices/:id/collections: Update Collection Action
app.post('/acc/invoices/:id/collections', (req, res) => {
  const { id } = req.params
  const { action, comment } = req.body

  const collection = collections.find(c => c.invoice_id === id)
  if (!collection) return res.status(404).json({ error: 'Collection record not found' })

  collection.last_action = action
  collection.notes.push({
    date: new Date().toISOString(),
    user: 'Agent', // In real app, get from auth context
    action,
    comment
  })

  res.json({
    status: 'updated',
    message: 'Collection action logged successfully'
  })
})

// 5. GET /acc/reports/ar-aging: AR Aging Report
app.get('/acc/reports/ar-aging', (req, res) => {
  const { as_of_date } = req.query
  
  // Mock calculation
  const totalDue = invoices.reduce((sum, inv) => sum + inv.balance, 0)
  const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue')
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0)

  res.json({
    report_id: `RPT-${Date.now()}`,
    download_url: `/downloads/ar-aging-${as_of_date}.xlsx`,
    summary: {
      total_due: totalDue,
      total_overdue: totalOverdue,
      by_bucket: {
        '0-30': totalDue - totalOverdue,
        '31-60': totalOverdue * 0.8, // Mock split
        '61-90': totalOverdue * 0.2,
        '90+': 0
      }
    }
  })
})

// 6. GET /acc/reports/invoice-status: Invoice Status Report
app.get('/acc/reports/invoice-status', (req, res) => {
  const { status, start_date, end_date } = req.query

  let filtered = invoices
  if (status) {
    filtered = filtered.filter(i => i.status.toLowerCase() === (status as string).toLowerCase())
  }

  res.json({
    report_id: `RPT-STAT-${Date.now()}`,
    download_url: `/downloads/inv-status.pdf`,
    summary: {
      count: filtered.length,
      total_value: filtered.reduce((sum, i) => sum + i.balance, 0),
      date_range: { start: start_date, end: end_date }
    }
  })
})


export default app

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`MCP Streamable HTTP endpoint: http://localhost:${PORT}/mcp`)
})
