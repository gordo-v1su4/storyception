/**
 * N8N API Integration Routes
 * 
 * Connects to n8n.v1su4.com for:
 * - Story generation (Gemini via fal.ai)
 * - Image generation (Nano Banana Pro - primary)
 * - Base image creation (fal.ai Flux Pro 2 - only if no user image)
 * 
 * Pipeline:
 * 1. User uploads reference image → Nano Banana creates 9 keyframes
 * 2. OR: fal.ai Flux Pro 2 creates base → Nano Banana creates 9 keyframes
 * 
 * NO ComfyUI - all image work via fal.ai + Nano Banana
 * 
 * API Reference: https://docs.n8n.io/api/api-reference/
 */

import { NextRequest, NextResponse } from 'next/server'

// N8N Configuration
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.v1su4.com'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

// Existing webhook path from Story-ception Master Automation
const N8N_WEBHOOK_VISION = '/webhook/nocodb-image-trigger'

// Helper to make authenticated requests to n8n
async function n8nFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${N8N_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`N8N API Error: ${response.status} - ${error}`)
  }
  
  return response.json()
}

// GET - Health check and list workflows
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'health':
        // Check n8n connectivity
        const health = await n8nFetch('/api/v1/workflows?limit=1')
        return NextResponse.json({ 
          status: 'connected',
          instance: N8N_BASE_URL,
          timestamp: new Date().toISOString()
        })
        
      case 'workflows':
        // List available workflows
        const workflows = await n8nFetch('/api/v1/workflows')
        return NextResponse.json(workflows)
        
      case 'executions':
        // Get recent executions
        const workflowId = searchParams.get('workflowId')
        const executions = await n8nFetch(
          workflowId 
            ? `/api/v1/executions?workflowId=${workflowId}&limit=10`
            : '/api/v1/executions?limit=10'
        )
        return NextResponse.json(executions)
        
      default:
        return NextResponse.json({ 
          message: 'N8N API Ready',
          instance: N8N_BASE_URL,
          actions: ['health', 'workflows', 'executions']
        })
    }
  } catch (error) {
    console.error('N8N GET Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Trigger workflows
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body
    
    switch (action) {
      case 'trigger-webhook':
        // Trigger a workflow via webhook
        const { webhookPath, payload } = data
        if (!webhookPath) {
          return NextResponse.json(
            { error: 'webhookPath is required' },
            { status: 400 }
          )
        }
        
        const webhookResponse = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        })
        
        const webhookResult = await webhookResponse.json()
        return NextResponse.json(webhookResult)
        
      case 'execute-workflow':
        // Execute a workflow by ID
        const { workflowId, inputData } = data
        if (!workflowId) {
          return NextResponse.json(
            { error: 'workflowId is required' },
            { status: 400 }
          )
        }
        
        const execution = await n8nFetch(`/api/v1/workflows/${workflowId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ data: inputData || {} }),
        })
        
        return NextResponse.json(execution)
        
      case 'get-execution':
        // Get execution result by ID
        const { executionId } = data
        if (!executionId) {
          return NextResponse.json(
            { error: 'executionId is required' },
            { status: 400 }
          )
        }
        
        const executionResult = await n8nFetch(`/api/v1/executions/${executionId}`)
        return NextResponse.json(executionResult)
        
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: ['trigger-webhook', 'execute-workflow', 'get-execution'] },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('N8N POST Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
