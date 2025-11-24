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
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/requisitionApproval">Requisition Approval</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to Nexus APIs 🚀</h1>
        <p>This is a minimal example without a database or forms.</p>
        <img src="/logo.png" alt="Logo" width="120" />
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

export default app
